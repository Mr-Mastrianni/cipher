/**
 * End-to-end agent turn against simulated OpenAI and GitHub endpoints.
 *
 * Covers the path that lets an admin change the site from the console: the
 * model reads a file, proposes a pull request that edits an existing file and
 * adds a new one, the operator approves, and the server replays exactly the
 * approved call — once — committing with the existing file's blob sha.
 */

import test from "node:test";
import assert from "node:assert/strict";

process.env.OPENAI_API_KEY = "test-key";
process.env.OPENAI_BASE_URL = "https://model.test/v1";
process.env.GITHUB_TOKEN = "test-token";
process.env.AGENT_GITHUB_REPO = "owner/site";
process.env.AGENT_ENABLE_WRITES = "true";
process.env.AGENT_CONFIRMATION_SECRET = "test-secret";
delete process.env.DATABASE_URL;

const EXISTING = "# The Cipher\n";
const PROPOSAL = {
  title: "Update the README headline",
  body: "Edits README.md and adds a note.",
  changes: [
    { path: "README.md", contents: "# The Cipher — verified charts\n" },
    { path: "src/content/note.md", contents: "New file.\n" },
  ],
};

/** One scripted model reply: text, or a single tool call. */
type Reply = { text: string } | { tool: string; args: unknown };

function sse(reply: Reply): Response {
  const chunks =
    "text" in reply
      ? [{ choices: [{ delta: { content: reply.text } }] }]
      : [
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: `call_${Math.random().toString(36).slice(2, 10)}`,
                      type: "function",
                      function: { name: reply.tool, arguments: JSON.stringify(reply.args) },
                    },
                  ],
                },
              },
            ],
          },
        ];
  const body = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

test("agent: read, propose, approve, and open a PR that edits an existing file", async () => {
  const replies: Reply[] = [
    { tool: "read_repo_file", args: { path: "README.md" } },
    { tool: "open_pull_request", args: PROPOSAL },
    { text: "I have proposed the change; approve it to open the pull request." },
    { text: "Opened draft pull request #7." },
  ];
  const puts: Array<{ path: string; sha?: string; branch: string }> = [];
  let pullsOpened = 0;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = init?.method ?? "GET";
    if (url.host === "model.test") {
      const next = replies.shift();
      assert.ok(next, "the model was called more times than scripted");
      return sse(next);
    }
    assert.equal(url.host, "api.github.com");
    const path = url.pathname;
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

    if (method === "GET" && path === "/repos/owner/site/contents/README.md") {
      return json({ type: "file", sha: "blob-readme", size: EXISTING.length, content: Buffer.from(EXISTING).toString("base64") });
    }
    if (method === "GET" && path.startsWith("/repos/owner/site/contents/")) return json({ message: "Not Found" }, 404);
    if (method === "GET" && path === "/repos/owner/site/git/ref/heads/main") return json({ object: { sha: "base-sha" } });
    if (method === "POST" && path === "/repos/owner/site/git/refs") return json({ ref: "ok" }, 201);
    if (method === "PUT" && path.startsWith("/repos/owner/site/contents/")) {
      const body = JSON.parse(String(init?.body)) as { sha?: string; branch: string };
      puts.push({ path: decodeURIComponent(path.replace("/repos/owner/site/contents/", "")), sha: body.sha, branch: body.branch });
      return json({ content: {} }, 201);
    }
    if (method === "POST" && path === "/repos/owner/site/pulls") {
      pullsOpened += 1;
      return json({ number: 7, html_url: "https://github.com/owner/site/pull/7" }, 201);
    }
    throw new Error(`unexpected request ${method} ${url.href}`);
  }) as typeof fetch;

  const { getStore } = await import("../../db/store");
  const { runAgentTurn } = await import("../runner");
  const store = getStore();
  const admin = await store.upsertUser({
    clerkUserId: "user_agent_test",
    email: "admin@test",
    firstName: null,
    lastName: null,
    imageUrl: null,
    role: "admin",
  });
  const session = await store.createAgentSession({ userId: admin.id, title: "test" });

  const drain = async (confirmationToken?: string) => {
    const events: Array<Record<string, unknown>> = [];
    for await (const event of runAgentTurn({ store, adminUserId: admin.id, sessionId: session.id, confirmationToken })) {
      events.push(event as Record<string, unknown>);
    }
    return events;
  };

  // Turn 1: read, then propose. The PR must wait for approval.
  await store.appendAgentMessage({ sessionId: session.id, role: "user", content: "Update the README headline." });
  const first = await drain();
  const read = first.find((e) => e.type === "tool_result" && e.name === "read_repo_file");
  assert.equal(read?.ok, true, "read_repo_file reads from GitHub");
  const confirmation = first.find((e) => e.type === "confirmation");
  assert.ok(confirmation, "open_pull_request asks for approval");
  assert.equal(puts.length, 0, "nothing is written before approval");

  // Turn 2: approve. The server replays the approved call itself.
  await store.appendAgentMessage({ sessionId: session.id, role: "user", content: "Approved." });
  const second = await drain(String(confirmation.token));
  const opened = second.find((e) => e.type === "tool_result" && e.name === "open_pull_request");
  assert.equal(opened?.ok, true, `the PR opens: ${String(opened?.summary)}`);
  assert.equal(pullsOpened, 1);
  assert.deepEqual(
    puts.map((p) => [p.path, p.sha ?? null]),
    [
      ["README.md", "blob-readme"],
      ["src/content/note.md", null],
    ],
    "the existing file is updated with its sha; the new file is created without one",
  );
  assert.ok(puts.every((p) => p.branch.startsWith("cipher-agent/")), "commits go to an agent branch, never main");

  // A resent approval token must not open a second pull request.
  replies.push({ text: "Nothing further to do." });
  await store.appendAgentMessage({ sessionId: session.id, role: "user", content: "Approved." });
  await drain(String(confirmation.token));
  assert.equal(pullsOpened, 1, "the approval is single-use");
});

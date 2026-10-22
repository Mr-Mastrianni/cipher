/**
 * The admin manual.
 *
 * Editorial copy lives here rather than in the page, so the page stays a
 * renderer and the words can be reviewed, corrected and translated without
 * touching JSX. Every claim below is checked against the code it describes:
 * the role rules in `lib/auth`, the application workflow in
 * `api/applications`, the tier ladder in `db/schema` and `payments/stripe`, the
 * moderation rules in `api/community/messages`, and the agent guardrails in
 * `lib/agent/tools`.
 *
 * Keep it honest. Where a feature is declared but not wired up, this says so
 * instead of implying an admin can switch it on and have it work.
 */

/** One piece of a section: prose, a procedure, a reference table or a note. */
export type ManualBlock =
  | { kind: "prose"; text: string }
  | { kind: "steps"; items: readonly string[] }
  | {
      kind: "table";
      columns: readonly string[];
      rows: readonly (readonly string[])[];
    }
  | { kind: "note"; tone: "info" | "warn"; title: string; text: string }
  | { kind: "faq"; items: readonly { question: string; answer: string }[] };

export interface ManualSection {
  /** Anchor id, used by the contents list and deep links. */
  id: string;
  title: string;
  body: readonly ManualBlock[];
}

export const ADMIN_MANUAL: readonly ManualSection[] = [
  {
    id: "access",
    title: "Getting in",
    body: [
      {
        kind: "prose",
        text: "The console belongs to accounts whose role is admin. That role is stored on the local user row, and there are exactly two ways it gets there.",
      },
      {
        kind: "steps",
        items: [
          "Clerk public metadata: set publicMetadata.role to \"admin\" on the account, from the Clerk dashboard or the Clerk API. Only a server or the dashboard can write public metadata, so a member cannot promote themselves.",
          "ADMIN_EMAILS: a comma-separated allowlist of email addresses. A verified address on it grants admin on sign-in — including for an account that already exists, so you do not have to sign up in a particular order. This is how the first admin exists without a database edit.",
        ],
      },
      {
        kind: "note",
        tone: "info",
        title: "Metadata wins",
        text: "If an account carries a Clerk metadata role, it overrides the role stored here — within five minutes, or immediately when the session token has been customised to carry the metadata. If you want to manage roles from this console, leave publicMetadata.role unset.",
      },
      {
        kind: "note",
        tone: "info",
        title: "Adding an address is enough",
        text: "Set ADMIN_EMAILS and redeploy; the next sign-in promotes that account. The address must be the verified primary email, and the match is exact. Removing an address does not demote anyone — change the role under Members for that.",
      },
      {
        kind: "note",
        tone: "info",
        title: "Admins skip onboarding",
        text: "An admin does not need a birth chart to run the site, so the dashboard no longer routes admins through onboarding or the membership application. You can still complete onboarding deliberately to see the member experience.",
      },
      {
        kind: "prose",
        text: "Visitors who are not signed in are sent to sign-in with a redirect back here. A signed-in account that is not an admin sees an \"Administrator access required\" screen that names the address it is signed in as, and the two ways to grant it — because \"why can't I get in\" is the expensive failure. Every admin page re-checks access on the server; the sidebar is a convenience, not the boundary.",
      },
    ],
  },
  {
    id: "console",
    title: "What each page is for",
    body: [
      {
        kind: "table",
        columns: ["Page", "What it is for"],
        rows: [
          ["Overview", "Counts, members by tier, upcoming calls and the most recent privileged actions."],
          ["Applications", "Review and decide applications; expand a row to read the answers and the chart."],
          ["Members", "Search every account, and edit role, membership status or tier."],
          ["Agent", "A read-mostly assistant that can inspect the data and the repository, and propose changes as pull requests."],
          ["Audit", "The append-only record of every privileged action, with before, after and metadata."],
          ["Manual", "This page."],
        ],
      },
    ],
  },
  {
    id: "applications",
    title: "Reviewing an application",
    body: [
      {
        kind: "prose",
        text: "Membership is by application, and this is the main job. The page opens on Pending; the filter on the left switches to Approved, Denied, Withdrawn or All.",
      },
      {
        kind: "steps",
        items: [
          "Open an application to read what they want, what they make, their stated experience and how they found the place.",
          "Check the chart strip. It is computed when they signed up, so it is the same reading the member sees.",
          "Approve or Deny. The decision is written immediately; there is no confirmation step and no undo.",
          "If you approved the wrong person, fix it under Members by setting their status and tier.",
        ],
      },
      {
        kind: "table",
        columns: ["Approve does", "Detail"],
        rows: [
          ["Membership status", "Becomes approved."],
          ["Tier", "The tier they applied for. If none was recorded, Initiate."],
          ["Audit", "membership.approve, with before and after and your note."],
          ["Applicant", "Gets an in-app notification in their bell."],
        ],
      },
      {
        kind: "note",
        tone: "info",
        title: "Nothing is charged before you approve",
        text: "Checkout refuses any account whose membership status is not approved, so approving is the only way a person can be billed.",
      },
      {
        kind: "note",
        tone: "info",
        title: "One application at a time",
        text: "A pending or approved applicant cannot submit again. A denied or withdrawn applicant can, and their new application appears at the top of the queue.",
      },
      {
        kind: "note",
        tone: "warn",
        title: "No email",
        text: "A decision produces an in-app notification only. The applicant is not emailed, so a denial can sit unseen until they next open the site.",
      },
    ],
  },
  {
    id: "members",
    title: "Members, roles and access",
    body: [
      {
        kind: "prose",
        text: "Every account is listed here, including people who have only applied. Search matches names and email addresses; the filters narrow by role, membership status and tier.",
      },
      {
        kind: "table",
        columns: ["Field", "Values", "What it changes"],
        rows: [
          ["Role", "member, moderator, admin", "Only admin opens this console. moderator is reserved and grants nothing extra today."],
          ["Membership status", "none, pending, approved, denied, suspended", "Only approved accounts reach member features. Suspended is the revoke switch."],
          ["Tier", "free, initiate, adept, oracle", "Which paid features the member can reach."],
        ],
      },
      {
        kind: "note",
        tone: "info",
        title: "Suspending is reversible and non-destructive",
        text: "A suspended account keeps its profile, its chart and its history. It loses member features until the status is set back to approved.",
      },
      {
        kind: "note",
        tone: "info",
        title: "Every edit is recorded",
        text: "A role, status or tier change writes an audit entry with the before and after values, the member it targeted, and who made the change.",
      },
      {
        kind: "note",
        tone: "warn",
        title: "Clerk metadata can undo a role change",
        text: "If the account has publicMetadata.role set, the sync will overwrite what you set here. That is a feature, not a bug: Clerk is the identity source. See Getting in.",
      },
    ],
  },
  {
    id: "billing",
    title: "Tiers and billing",
    body: [
      {
        kind: "table",
        columns: ["Tier", "Price", "Unlocks"],
        rows: [
          ["Threshold", "Free", "The full KP chart and bodygraph, the Aura Avatar, two foundation courses, the cosmic map and the public feed."],
          ["Initiate", "$15 / month", "The Collective and direct messages, the weekly call, full flashcard decks."],
          ["Adept", "$29 / month", "KP horary with ruling-planet timing, call recordings and priority."],
          ["Oracle", "$59 / month", "The monthly reading circle, a direct studio line, early access."],
        ],
      },
      {
        kind: "prose",
        text: "Stripe owns the subscription. This site mirrors what Stripe's webhooks report: the subscription row, the status shown beside a member, and the tier. A member changes or cancels through the Stripe Billing Portal, which the dashboard links to — cancellation is never written by this app.",
      },
      {
        kind: "prose",
        text: "When a payment succeeds, fails or a subscription changes, POST /api/stripe/webhook updates the local mirror. The event id is recorded first, so a redelivered event cannot be applied twice.",
      },
      {
        kind: "note",
        tone: "warn",
        title: "A deployment without Stripe can still approve members",
        text: "If STRIPE_SECRET_KEY or a STRIPE_PRICE_* id is missing, the billing surfaces say so plainly rather than failing silently. You can run the community; you just cannot take money.",
      },
    ],
  },
  {
    id: "community",
    title: "Community and moderation",
    body: [
      {
        kind: "prose",
        text: "The Collective's rooms are created on first visit, so a fresh deployment never has an empty-channel problem. Members are added to the rooms their onboarding answers map to.",
      },
      {
        kind: "table",
        columns: ["Action", "Who can", "Notes"],
        rows: [
          ["Delete a message", "Its author, or an admin", "Soft delete: the row is kept and hidden. The action is audited with the original body."],
          ["Edit a message", "Its author only", "Admins cannot rewrite a member's words."],
          ["Read a direct message", "The two participants", "Admins have no route into member-to-member DMs."],
        ],
      },
      {
        kind: "note",
        tone: "info",
        title: "There is no separate ban list",
        text: "Suspending the account under Members is the moderation lever. It blocks member features; it does not delete anything.",
      },
      {
        kind: "note",
        tone: "warn",
        title: "No bulk tools",
        text: "Moderation is one message at a time. There is no mass delete, no keyword filter and no queue.",
      },
    ],
  },
  {
    id: "agent",
    title: "The admin agent",
    body: [
      {
        kind: "prose",
        text: "The agent can answer questions about the site and draft changes. It is admin-only at the route, read-only by default, and it cannot push to the default branch under any configuration.",
      },
      {
        kind: "table",
        columns: ["Tool", "Capability", "What it does"],
        rows: [
          ["search_web", "read", "Live web search. Needs BRAVE_SEARCH_API_KEY or TAVILY_API_KEY; without one it explains that search is not configured."],
          ["fetch_url", "read", "Fetches one absolute http(s) URL as text."],
          ["query_database", "read", "Runs curated read-only views over members, applications, tiers, agent sessions, the audit log and headline counts. It cannot execute arbitrary SQL."],
          ["read_repo_file", "read", "Reads one file inside the allowlisted repository paths, capped at 128 KiB."],
          ["list_repo_files", "read", "Lists one directory level inside the allowlist."],
          ["record_note", "write", "Writes a note into the audit trail so a decision outlives the session."],
          ["propose_file_change", "write", "Drafts a complete replacement file. Nothing is committed by this tool."],
          ["open_pull_request", "github", "Opens a pull request against a non-default branch. Requires confirmation."],
          ["create_issue", "github", "Files an issue. Requires confirmation."],
        ],
      },
      {
        kind: "prose",
        text: "Write capability is opt-in twice: AGENT_ENABLE_WRITES=true and a GitHub token plus AGENT_GITHUB_REPO. Without both, the surface degrades to read-only and says why. Destructive tools require a confirmation token bound to the session, the tool name and a hash of the exact arguments, so approving one call can never authorise a different one.",
      },
      {
        kind: "note",
        tone: "info",
        title: "DeepSeek by default",
        text: "The loop speaks OpenAI-compatible Chat Completions. It uses DeepSeek when DEEPSEEK_API_KEY is set — deepseek-flash (V4.1-Flash) unless AGENT_MODEL names deepseek-v4-pro — and falls back to OpenAI (gpt-4o-mini) when only OPENAI_API_KEY is present. AGENT_PROVIDER forces one, OPENAI_BASE_URL points at a gateway, and the console header shows the model in use. Voice and server-side transcription remain OpenAI-only; DeepSeek cannot drive them.",
      },
      {
        kind: "note",
        tone: "info",
        title: "Every tool call is audited",
        text: "Including refusals and unavailable tools. A session's transcript is stored, and each attempt adds an audit row.",
      },
      {
        kind: "note",
        tone: "warn",
        title: "Without a model key the console is still honest",
        text: "The page loads, lists its tools and explains what it needs. It never pretends to answer.",
      },
    ],
  },
  {
    id: "audit",
    title: "The audit log",
    body: [
      {
        kind: "prose",
        text: "Everything privileged is appended here: application decisions, member edits, message deletions, RSVPs, every agent tool attempt, and billing webhook effects. Entries are never edited or removed.",
      },
      {
        kind: "table",
        columns: ["Field", "Meaning"],
        rows: [
          ["Action", "A dotted name such as membership.approve or user.update."],
          ["Actor", "The admin or member who acted, or system when it was automated."],
          ["Target", "What was acted on, and its id."],
          ["Before / after", "The values on either side of the change, when there were any."],
          ["Metadata", "Anything else worth keeping: an applicant id, a decision note, a tool argument hash."],
          ["Actor IP", "Recorded when the request carried a trustworthy client address."],
        ],
      },
      {
        kind: "note",
        tone: "info",
        title: "Read it before you debug",
        text: "If a member says their tier changed by itself, the audit log usually answers it in one line: either an admin edited it, or a Stripe webhook mirrored a subscription.",
      },
    ],
  },
  {
    id: "setup",
    title: "First-run setup",
    body: [
      {
        kind: "prose",
        text: "The app boots with no configuration at all: it renders pages and computes charts, and explains what is missing where a feature needs a secret. These are the steps that turn it into a real deployment.",
      },
      {
        kind: "steps",
        items: [
          "Deploy to Vercel. The Git integration redeploys production on every push to the main branch.",
          "Add DATABASE_URL (Neon), then run pnpm db:push once to create the schema and pnpm db:seed once to install the four tiers and the Collective's rooms. Both are safe to re-run.",
          "Create a Clerk application, set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY, and point a webhook at /api/webhooks/clerk for user.created, user.updated and user.deleted.",
          "Set ADMIN_EMAILS to your own address and sign in once. You are now the first admin; after that, manage roles under Members.",
          "Create three monthly Stripe prices, put their ids in STRIPE_PRICE_INITIATE, STRIPE_PRICE_ADEPT and STRIPE_PRICE_ORACLE, set STRIPE_SECRET_KEY, and point a webhook at /api/stripe/webhook.",
          "Optionally add DEEPSEEK_API_KEY for the admin agent (or OPENAI_API_KEY), and GITHUB_TOKEN plus AGENT_GITHUB_REPO for its write mode.",
        ],
      },
      {
        kind: "table",
        columns: ["Variable", "Unlocks"],
        rows: [
          ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY", "Sign-in, sessions and the local user projection."],
          ["CLERK_WEBHOOK_SIGNING_SECRET", "Verified Clerk webhooks."],
          ["DATABASE_URL", "Durable storage. Without it the app uses a per-process in-memory store that resets on restart."],
          ["STRIPE_SECRET_KEY, STRIPE_PRICE_*", "Checkout, the billing portal and the webhook."],
          ["STRIPE_WEBHOOK_SECRET", "Verified Stripe webhooks."],
          ["ADMIN_EMAILS", "The first admin account."],
          ["DEEPSEEK_API_KEY (or OPENAI_API_KEY), AGENT_MODEL, AGENT_PROVIDER", "The admin agent and the model it uses. DeepSeek is the default (deepseek-flash); OpenAI is the fallback."],
          ["GITHUB_TOKEN, AGENT_GITHUB_REPO, AGENT_ENABLE_WRITES", "The agent's write and pull-request tools."],
          ["AGENT_CONFIRMATION_SECRET", "Confirmations that survive a restart. Without it the secret is per-process and approvals fail closed after a cold start."],
        ],
      },
      {
        kind: "note",
        tone: "warn",
        title: "Declared but not wired up",
        text: "ABLY_API_KEY, DAILY_API_KEY, RESEND_API_KEY, EMAIL_FROM and the UPSTASH_REDIS_* pair are listed in .env.example and reported by /api/health, but no code path consumes them yet. Setting them changes nothing today. Notifications are in-app only, community and DMs are polled, live-call rooms are the scheduled link, and rate limiting is per instance.",
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "When something looks wrong",
    body: [
      {
        kind: "faq",
        items: [
          {
            question: "I set ADMIN_EMAILS but I still cannot get in.",
            answer: "Check three things: the variable is set on the deployment that is serving the site (and redeployed after you added it), the address is the account's verified primary email in Clerk, and it matches exactly. The admin console's access screen prints the address you are signed in as — compare it there. As a fallback, set publicMetadata.role to admin for the account in Clerk.",
          },
          {
            question: "I am an admin but the dashboard keeps asking me to onboard.",
            answer: "That was a bug: the onboarding redirect applied to admins as well. It no longer does. If you still see it, the account is not actually an administrator — open /admin and read the address on the access screen.",
          },
          {
            question: "My role change was reverted.",
            answer: "The account probably has a Clerk metadata role, which is the source of truth and re-syncs within five minutes. Clear publicMetadata.role to manage that account from the console.",
          },
          {
            question: "Everyone sees demo data, and it disappears on restart.",
            answer: "DATABASE_URL is not set, so the app is running on its in-memory fallback. Set the variable, run pnpm db:push and pnpm db:seed, then redeploy.",
          },
          {
            question: "Billing says it is not configured.",
            answer: "STRIPE_SECRET_KEY is missing, or one of the STRIPE_PRICE_* ids is. Checkout cannot open without both; approving members still works.",
          },
          {
            question: "A member paid but is still on the free tier.",
            answer: "The webhook did not arrive or did not match. Confirm the endpoint is /api/stripe/webhook with STRIPE_WEBHOOK_SECRET set, and check the Stripe dashboard for failed deliveries. The tier is mirrored from the price id.",
          },
          {
            question: "The agent says GitHub is not configured.",
            answer: "It needs GITHUB_TOKEN and AGENT_GITHUB_REPO before it can read the repository or open a pull request, and AGENT_ENABLE_WRITES=true before it can write.",
          },
          {
            question: "An approved member still cannot open a paid feature.",
            answer: "Approval and tier are separate. Check the tier under Members; a feature that needs Adept will refuse an approved Initiate member and say which tier it needs.",
          },
        ],
      },
    ],
  },
  {
    id: "data",
    title: "Where the data lives",
    body: [
      {
        kind: "prose",
        text: "Postgres on Neon, through Drizzle. The schema is the single source of truth and lives in src/lib/db/schema.ts; pnpm db:studio opens a browser against DATABASE_URL when you need to look at rows directly.",
      },
      {
        kind: "prose",
        text: "Deletes are soft wherever they are offered: messages keep their row and gain a deletedAt, and Clerk's user.deleted event sets deletedAt on the user rather than removing history. That is deliberate — the audit log and the chart history stay coherent.",
      },
      {
        kind: "note",
        tone: "info",
        title: "Backups are the database provider's job",
        text: "The app has no export of its own. If the data matters, enable point-in-time recovery or scheduled backups on the Neon project before inviting members.",
      },
    ],
  },
];

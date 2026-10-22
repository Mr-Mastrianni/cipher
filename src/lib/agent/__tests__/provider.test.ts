/**
 * Agent provider resolution.
 *
 * These decide which endpoint an admin's message is sent to, so they are
 * pinned: the DeepSeek default, the OpenAI fallback, the explicit override,
 * and the refusal to send one provider's key to another.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  DEEPSEEK_BASE_URL,
  DEFAULT_DEEPSEEK_MODEL,
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_MODEL,
  DEEPSEEK_MODEL_PRO,
  resolveAgentProvider,
} from "../provider";

test("with no keys the agent is unconfigured but still resolves a sane default", () => {
  const config = resolveAgentProvider({});
  assert.equal(config.apiKey, null);
  assert.equal(config.name, "openai");
  assert.equal(config.baseUrl, DEFAULT_OPENAI_BASE_URL);
  assert.equal(config.model, DEFAULT_OPENAI_MODEL);
});

test("a DeepSeek key selects DeepSeek and its newest chat model", () => {
  const config = resolveAgentProvider({ DEEPSEEK_API_KEY: "sk-deepseek" });
  assert.equal(config.name, "deepseek");
  assert.equal(config.apiKey, "sk-deepseek");
  assert.equal(config.baseUrl, DEEPSEEK_BASE_URL);
  assert.equal(config.model, DEFAULT_DEEPSEEK_MODEL);
  assert.equal(config.model, "deepseek-flash");
});

test("an OpenAI-only deployment keeps working unchanged", () => {
  const config = resolveAgentProvider({ OPENAI_API_KEY: "sk-openai" });
  assert.equal(config.name, "openai");
  assert.equal(config.apiKey, "sk-openai");
  assert.equal(config.baseUrl, DEFAULT_OPENAI_BASE_URL);
  assert.equal(config.model, DEFAULT_OPENAI_MODEL);
});

test("DeepSeek wins when both keys are present", () => {
  const config = resolveAgentProvider({
    DEEPSEEK_API_KEY: "sk-deepseek",
    OPENAI_API_KEY: "sk-openai",
  });
  assert.equal(config.name, "deepseek");
  assert.equal(config.apiKey, "sk-deepseek");
});

test("AGENT_PROVIDER overrides the key-based choice", () => {
  const config = resolveAgentProvider({
    AGENT_PROVIDER: "openai",
    DEEPSEEK_API_KEY: "sk-deepseek",
    OPENAI_API_KEY: "sk-openai",
  });
  assert.equal(config.name, "openai");
  assert.equal(config.apiKey, "sk-openai");
  assert.equal(config.baseUrl, DEFAULT_OPENAI_BASE_URL);
});

test("an explicit provider with no matching key is unconfigured, not mis-keyed", () => {
  const config = resolveAgentProvider({
    AGENT_PROVIDER: "deepseek",
    OPENAI_API_KEY: "sk-openai",
  });
  assert.equal(config.name, "deepseek");
  assert.equal(config.apiKey, null);
});

test("AGENT_MODEL overrides the default, including the Pro model", () => {
  const config = resolveAgentProvider({
    DEEPSEEK_API_KEY: "sk-deepseek",
    AGENT_MODEL: DEEPSEEK_MODEL_PRO,
  });
  assert.equal(config.model, "deepseek-v4-pro");
});

test("OPENAI_BASE_URL overrides any provider, without a trailing slash", () => {
  const config = resolveAgentProvider({
    DEEPSEEK_API_KEY: "sk-deepseek",
    OPENAI_BASE_URL: "https://gateway.example.com/v1///",
  });
  assert.equal(config.baseUrl, "https://gateway.example.com/v1");
});

test("blank and whitespace values are treated as absent", () => {
  const config = resolveAgentProvider({
    DEEPSEEK_API_KEY: "   ",
    OPENAI_API_KEY: "sk-openai",
    AGENT_MODEL: "  ",
  });
  assert.equal(config.name, "openai");
  assert.equal(config.apiKey, "sk-openai");
  assert.equal(config.model, DEFAULT_OPENAI_MODEL);
});

test("keys are trimmed", () => {
  const config = resolveAgentProvider({ DEEPSEEK_API_KEY: "  sk-deepseek  " });
  assert.equal(config.apiKey, "sk-deepseek");
});

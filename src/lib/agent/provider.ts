/**
 * Which model endpoint the admin agent talks to.
 *
 * The agent speaks the OpenAI-compatible Chat Completions protocol, so a
 * provider is just a key, a base URL and a model id. Those three are resolved
 * here — purely from an environment object — so the rules are testable without
 * a network, and so every caller (the loop, the health probe, the console)
 * agrees on what is configured.
 *
 * **DeepSeek is the preferred default.** Its current models (`deepseek-flash`,
 * the V4.1-Flash build, and `deepseek-v4-pro`) support tool calls, which is what
 * the agent needs, and are cheaper than the OpenAI default. An existing
 * deployment with only `OPENAI_API_KEY` keeps working exactly as before.
 *
 * Precedence:
 *
 *  1. `AGENT_PROVIDER=deepseek|openai` wins outright, when set.
 *  2. Otherwise a `DEEPSEEK_API_KEY` selects DeepSeek, and its absence selects
 *     OpenAI.
 *  3. `OPENAI_BASE_URL` still overrides the base URL for any provider, which is
 *     what a gateway or a self-hosted compatible endpoint needs.
 *  4. `AGENT_MODEL` overrides the model id.
 */

/** The providers this module understands. */
export type AgentProviderName = "deepseek" | "openai";

/** DeepSeek's OpenAI-compatible base URL. The loop appends `/chat/completions`. */
export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

/** OpenAI's base URL, kept as the fallback for existing deployments. */
export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

/**
 * DeepSeek's current models.
 *
 * `deepseek-flash` is the V4.1-Flash build (October 2026): 1M context, 384K
 * output, tool calls, vision. `deepseek-v4-pro` trades vision for reasoning
 * depth. The legacy `deepseek-v4-flash` ids are still accepted by the API but
 * are served by V4.1 Flash, so new code should use these names.
 */
export const DEEPSEEK_MODEL_FLASH = "deepseek-flash";
export const DEEPSEEK_MODEL_PRO = "deepseek-v4-pro";

/** The model used when DeepSeek is the provider and `AGENT_MODEL` is unset. */
export const DEFAULT_DEEPSEEK_MODEL = DEEPSEEK_MODEL_FLASH;

/** The model used when OpenAI is the provider and `AGENT_MODEL` is unset. */
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

/** A resolved provider: everything the loop needs to make one request. */
export interface AgentProviderConfig {
  /** Which provider the key and URL belong to. */
  name: AgentProviderName;
  /** The bearer key, or `null` when none is configured. */
  apiKey: string | null;
  /** The OpenAI-compatible base URL, without a trailing slash. */
  baseUrl: string;
  /** The model id to send. */
  model: string;
}

/** The subset of an environment this module reads. */
export type ProviderEnv = Record<string, string | undefined>;

/** A trimmed, non-empty environment value, or `null`. */
function envValue(env: ProviderEnv, key: string): string | null {
  const raw = env[key];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Resolve the provider from the environment.
 *
 * @param env - Defaults to `process.env`; injectable so tests stay hermetic.
 */
export function resolveAgentProvider(
  env: ProviderEnv = process.env,
): AgentProviderConfig {
  const deepseekKey = envValue(env, "DEEPSEEK_API_KEY");
  const openaiKey = envValue(env, "OPENAI_API_KEY");
  const requested = envValue(env, "AGENT_PROVIDER")?.toLowerCase();

  const name: AgentProviderName =
    requested === "deepseek" || requested === "openai"
      ? requested
      : deepseekKey
        ? "deepseek"
        : "openai";

  // No cross-provider key fallback: sending an OpenAI key to DeepSeek (or the
  // reverse) fails with an opaque 401, which is worse than reporting that the
  // agent is unconfigured.
  const apiKey = name === "deepseek" ? deepseekKey : openaiKey;

  const override = envValue(env, "OPENAI_BASE_URL");
  const baseUrl = (
    override ?? (name === "deepseek" ? DEEPSEEK_BASE_URL : DEFAULT_OPENAI_BASE_URL)
  ).replace(/\/+$/, "");

  const model =
    envValue(env, "AGENT_MODEL") ??
    (name === "deepseek" ? DEFAULT_DEEPSEEK_MODEL : DEFAULT_OPENAI_MODEL);

  return { name, apiKey, baseUrl, model };
}

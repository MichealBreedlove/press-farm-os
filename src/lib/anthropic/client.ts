import Anthropic from "@anthropic-ai/sdk";

/**
 * Shared Anthropic client for AI-powered admin features.
 *
 * Server-only — never instantiate from a client component. The API key
 * lives in ANTHROPIC_API_KEY (Vercel env var, not exposed to the
 * browser). Returns null when the key isn't set so callers can return a
 * clean error instead of crashing the page; this keeps the AI features
 * gracefully "off" until the key is configured.
 */
let cachedClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey });
  }
  return cachedClient;
}

export const ANTHROPIC_KEY_MISSING_ERROR =
  "Claude API key not configured. Add ANTHROPIC_API_KEY to your Vercel environment variables.";

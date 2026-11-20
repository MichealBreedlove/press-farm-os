import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropic/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { splitInlineSpanish } from "./localize";

/**
 * Spanish text for a farm task, so the crew reads it in their language on
 * the Farm Hand portal. Best-effort: returns null when the API key is
 * missing or the call fails — the portal then falls back to English.
 *
 * Server-only.
 */

const SYSTEM = `You translate farm task instructions from English to Spanish for a field crew in California.
Use short, concrete, Latin American (Mexican) Spanish in the imperative infinitive style ("Regar los canteros", "Sembrar la lechuga").
Keep bed, row, quadrant and tray labels, numbers, measurements and tool names exactly as written. Keep crop variety names (e.g. "Salanova", "Red Frills") untranslated; translate common crop names.
Translate only; never add instructions that are not in the source. If the description is empty, return an empty string for it.`;

const SCHEMA = {
  type: "object",
  properties: {
    title_es: { type: "string" },
    description_es: { type: "string" },
  },
  required: ["title_es", "description_es"],
  additionalProperties: false,
};

export async function translateTaskToSpanish(input: {
  title: string;
  description: string | null;
}): Promise<{ title_es: string; description_es: string | null } | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  // A hand-written "ES: …" tail is already Spanish — translate the English part only.
  const description = input.description ? splitInlineSpanish(input.description).en : "";

  try {
    const response = await client.messages.create(
      {
        model: "claude-opus-5-5",
        max_tokens: 4000,
        system: SYSTEM,
        output_config: {
          effort: "low",
          format: { type: "json_schema", schema: SCHEMA as any },
        },
        messages: [
          {
            role: "user",
            content: `Title: ${input.title}\n\nDescription: ${description}`,
          },
        ],
      },
      { timeout: 30_000, maxRetries: 1 },
    );
    if (response.stop_reason !== "end_turn") return null;
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return null;
    const parsed = JSON.parse(text.text) as { title_es?: string; description_es?: string };
    const titleEs = parsed.title_es?.trim();
    if (!titleEs) return null;
    return {
      title_es: titleEs.slice(0, 500),
      description_es: parsed.description_es?.trim() || null,
    };
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error(`[TASKS] translate failed (${err.status})`, err.message);
    } else {
      console.error("[TASKS] translate failed", err);
    }
    return null;
  }
}

/**
 * Translate a task and store the Spanish text. Runs after the response is
 * sent (`after()` in the task routes) so creating a task stays instant.
 * Skips the write if the English text changed while the translation ran.
 */
export async function translateAndStoreTask(taskId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: task } = await admin
    .from("farm_tasks")
    .select("id, title, description")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return;
  const es = await translateTaskToSpanish({ title: task.title, description: task.description });
  if (!es) return;
  await admin
    .from("farm_tasks")
    .update({ title_es: es.title_es, description_es: es.description_es })
    .eq("id", taskId)
    .eq("title", task.title);
}

/**
 * LLM-proposed task schedule for inbound chef requests.
 *
 * Runs after extractItemRequests has written suggestions. For each
 * suggestion linked to this inbound message, ask Haiku 4.5 to propose a
 * growing schedule (sow / transplant / harvest dates as day offsets from
 * today) given the email body + matched catalog data.
 *
 * Writes inbox_task_drafts rows. Nothing in farm_tasks until the user
 * confirms via the inbox UI.
 *
 * Cache strategy mirrors item-requests.ts:
 *   - System prompt: cached.
 *   - Tight catalog of scheduling-relevant fields: cached.
 *   - Per-suggestion user message (email body + item name): uncached.
 *
 * Failure semantics: per-suggestion try/catch. One failure doesn't kill
 * other drafts for the same message.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InboxTaskDraftScheduleItem } from "@/types/database";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 1024;

const SYSTEM_PROMPT = `You propose a planting / growing schedule for Press Farm in Yountville CA, a small farm growing produce + edible flowers for Napa Valley restaurants.

Input: a chef's email (or excerpt) that mentions one specific item the chef wants. You may also receive catalog growing data for that item.

Your job: propose 1-4 tasks (sow, transplant, harvest, maintenance) with day offsets from today.

Rules:
- Output dates as offset_days_from_today (integer). Today = 0. Two weeks out = 14. Past dates allowed if relevant (e.g., "should have already started seedlings 30 days ago" → -30).
- If the chef mentions a specific target window ("June salad", "we want them in July"), aim harvest tasks at that window.
- If catalog data has days_to_maturity, sow_method, indoor_start_weeks — use them to derive the sow → transplant → harvest sequence. Otherwise make a reasonable best guess and note the uncertainty.
- Set confidence:
  - 'high' if catalog data is complete AND chef's request is specific.
  - 'medium' if either is missing but the schedule is reasonable.
  - 'low' if you're guessing about windowing or growing requirements.
- Keep titles short and actionable: "Sow beets indoors", "Transplant beets to Bed 4", "Harvest beets for June".
- Description should be one sentence with reasoning.
- Always return at least one task. Never return an empty schedule.`;

interface ProposeArgs {
  inboundMessageId: string;
}

interface CatalogScheduleRow {
  id: string;
  name: string;
  category: string | null;
  days_to_maturity: number | null;
  sow_method: string | null;
  indoor_start_weeks: number | null;
  growing_notes: string | null;
}

interface SuggestionRow {
  id: string;
  text: string;
  source: string;
}

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return _client;
}

function formatCatalog(rows: CatalogScheduleRow[]): string {
  return rows
    .map((r) => {
      const parts = [r.id, r.name];
      if (r.category) parts.push(`(${r.category})`);
      const grow: string[] = [];
      if (r.days_to_maturity != null) grow.push(`dtm=${r.days_to_maturity}d`);
      if (r.sow_method) grow.push(`sow=${r.sow_method}`);
      if (r.indoor_start_weeks != null) grow.push(`indoor=${r.indoor_start_weeks}w`);
      if (r.growing_notes) grow.push(`notes="${r.growing_notes.slice(0, 80)}"`);
      if (grow.length) parts.push(`{${grow.join(", ")}}`);
      return parts.join(" | ");
    })
    .join("\n");
}

interface ToolInput {
  matched_item_id: string | null;
  proposed_schedule: InboxTaskDraftScheduleItem[];
  reasoning: string;
  confidence: "high" | "medium" | "low";
}

export async function proposeTaskSchedules({
  inboundMessageId,
}: ProposeArgs): Promise<{ drafts_inserted: number }> {
  const admin = createAdminClient();

  if (!process.env.ANTHROPIC_API_KEY) {
    return { drafts_inserted: 0 };
  }

  // Pull message + linked suggestions in parallel.
  const [msgRes, suggRes] = await Promise.all([
    (admin as any)
      .from("inbound_messages")
      .select("id, farm_id, text_body, from_name")
      .eq("id", inboundMessageId)
      .single(),
    (admin as any)
      .from("suggestions")
      .select("id, text, source")
      .eq("inbound_message_id", inboundMessageId),
  ]);

  if (msgRes.error || !msgRes.data) {
    console.error("[TASK-SCHED] message lookup failed", msgRes.error);
    return { drafts_inserted: 0 };
  }
  const msg = msgRes.data;
  const suggestions = (suggRes.data ?? []) as SuggestionRow[];
  if (suggestions.length === 0) return { drafts_inserted: 0 };
  if (!msg.text_body || msg.text_body.trim().length === 0) {
    return { drafts_inserted: 0 };
  }

  // Tight catalog projection — only scheduling fields.
  const { data: items } = await (admin as any)
    .from("items")
    .select("id, name, category, days_to_maturity, sow_method, indoor_start_weeks, growing_notes")
    .eq("farm_id", msg.farm_id)
    .order("name", { ascending: true });
  const catalog = (items ?? []) as CatalogScheduleRow[];

  const client = getClient();
  let drafts_inserted = 0;

  for (const sugg of suggestions) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
          {
            type: "text",
            text: `Item catalog with scheduling fields:\n${formatCatalog(catalog)}`,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: [
          {
            name: "propose_schedule",
            description:
              "Record a proposed growing schedule. Always call exactly once.",
            input_schema: {
              type: "object",
              properties: {
                matched_item_id: {
                  type: ["string", "null"],
                  description: "UUID from catalog if this item matches, else null.",
                },
                proposed_schedule: {
                  type: "array",
                  minItems: 1,
                  maxItems: 4,
                  items: {
                    type: "object",
                    properties: {
                      task_type: {
                        type: "string",
                        enum: ["sow", "transplant", "harvest", "maintenance"],
                      },
                      offset_days_from_today: {
                        type: "integer",
                        description: "Days from today. 0=today, 14=two weeks out, -30=30 days ago.",
                      },
                      title: { type: "string" },
                      description: { type: "string" },
                    },
                    required: ["task_type", "offset_days_from_today", "title", "description"],
                  },
                },
                reasoning: { type: "string" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
              },
              required: ["matched_item_id", "proposed_schedule", "reasoning", "confidence"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "propose_schedule" },
        messages: [
          {
            role: "user",
            content:
              `Chef ${msg.from_name ?? "unknown"} wrote:\n---\n${msg.text_body.trim()}\n---\n\n` +
              `Item of focus for this draft: "${sugg.text}"`,
          },
        ],
      });

      const toolUse = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      if (!toolUse) throw new Error("model did not return tool_use");

      const input = toolUse.input as ToolInput;
      if (!Array.isArray(input.proposed_schedule) || input.proposed_schedule.length === 0) {
        throw new Error("empty proposed_schedule");
      }

      const { error: insertErr } = await (admin as any).from("inbox_task_drafts").insert({
        inbound_message_id: inboundMessageId,
        suggestion_id: sugg.id,
        proposed_item_name: sugg.text.split(" — ")[0]?.trim() || sugg.text,
        matched_item_id: input.matched_item_id,
        proposed_schedule: input.proposed_schedule,
        reasoning: input.reasoning,
        confidence: input.confidence,
        status: "pending",
      });
      if (insertErr) {
        console.error("[TASK-SCHED] draft insert failed", insertErr);
      } else {
        drafts_inserted++;
      }
    } catch (err) {
      console.error("[TASK-SCHED] suggestion proposal failed", {
        sugg_id: sugg.id,
        err: err instanceof Error ? err.message : String(err),
      });
      // Continue with other suggestions.
    }
  }

  return { drafts_inserted };
}

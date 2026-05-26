/**
 * LLM extraction of item requests from inbound chef replies.
 *
 * Strategy:
 *   - Claude Haiku 4.5 (claude-haiku-4-5-20251001) via @anthropic-ai/sdk.
 *   - Tool-use output (not freeform) so we get a typed JSON array back.
 *   - Prompt-cache the system prompt + item catalog. Reply body is the only
 *     uncached chunk per call. At Press Farm's volume (<10/week) this keeps
 *     cost in single-digit cents/month and latency snappy.
 *
 * Failure semantics:
 *   - This function never throws to its caller. Errors are captured into
 *     `inbound_messages.extraction_status='failed'` with the error string in
 *     `extraction_error`.
 *   - On success, sets `extraction_status='done'` and inserts one suggestion
 *     row per extracted request, all linked back via `inbound_message_id`.
 *
 * Cost guard:
 *   - If ANTHROPIC_API_KEY is unset, mark `extraction_status='skipped'` and
 *     return cleanly. Useful for local dev and for graceful operation if
 *     the API key is rotated mid-flight.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 1024;

const SYSTEM_PROMPT = `You extract item requests from chef replies to Press Farm, a small farm in Yountville CA that grows produce + edible flowers for Napa Valley restaurants.

Your only job: identify produce or flowers the chef is actively asking for, expressing interest in growing/receiving, or asking the farm to look into.

Rules:
- "Loved the radish this week" → NOT a request (compliment).
- "Any chance you can grow shiso next month?" → REQUEST: shiso.
- "Will take everything you have on radish flowers" → NOT a new request (current availability, handled elsewhere).
- "Can you look into getting some Thai basil?" → REQUEST: Thai basil.
- "We're planning a beet salad for June — can you grow more?" → REQUEST: beets, note about June salad.
- If a mentioned item matches the catalog provided to you, return its UUID in catalog_item_id.
- If the chef asks about something not in the catalog, leave catalog_item_id null (it's a new item request).
- Return an empty array if there are no requests.
- One row per distinct item, even if mentioned multiple times.
- Keep notes short. Capture quantity, timing, dish context if the chef mentioned them — nothing else.`;

interface ExtractArgs {
  inboundMessageId: string;
}

interface ItemRequest {
  item_name_raw: string;
  catalog_item_id: string | null;
  notes: string;
}

interface CatalogRow {
  id: string;
  name: string;
  category: string | null;
}

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return _client;
}

function formatCatalog(rows: CatalogRow[]): string {
  return rows
    .map((r) => `${r.id} | ${r.name}${r.category ? ` (${r.category})` : ""}`)
    .join("\n");
}

export async function extractItemRequests({ inboundMessageId }: ExtractArgs): Promise<void> {
  const admin = createAdminClient();

  // Pull the message + farm_id + matched info
  const { data: msg, error: msgErr } = await (admin as any)
    .from("inbound_messages")
    .select("id, farm_id, text_body, from_name, matched_user_id")
    .eq("id", inboundMessageId)
    .single();

  if (msgErr || !msg) {
    console.error("[EXTRACT] message lookup failed", { inboundMessageId, msgErr });
    return;
  }

  // Skip silently if no API key — operator can re-run later.
  if (!process.env.ANTHROPIC_API_KEY) {
    await (admin as any)
      .from("inbound_messages")
      .update({
        extraction_status: "skipped",
        extraction_error: "ANTHROPIC_API_KEY not set",
        extracted_at: new Date().toISOString(),
      })
      .eq("id", inboundMessageId);
    return;
  }

  // Skip if no text body to analyze.
  if (!msg.text_body || msg.text_body.trim().length === 0) {
    await (admin as any)
      .from("inbound_messages")
      .update({
        extraction_status: "skipped",
        extraction_error: "no text body",
        extracted_at: new Date().toISOString(),
      })
      .eq("id", inboundMessageId);
    return;
  }

  try {
    // Pull current catalog for matching
    const { data: items } = await (admin as any)
      .from("items")
      .select("id, name, category")
      .eq("farm_id", msg.farm_id)
      .order("name", { ascending: true });

    const catalog = (items ?? []) as CatalogRow[];

    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // Split into two cache breakpoints: stable system + (slower-changing)
      // catalog. Reply body lives in the user message, uncached.
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: `Item catalog (UUID | name (category)):\n${formatCatalog(catalog)}`,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [
        {
          name: "record_item_requests",
          description:
            "Record item requests found in the chef's reply. Always call this exactly once, even if the array is empty.",
          input_schema: {
            type: "object",
            properties: {
              requests: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    item_name_raw: {
                      type: "string",
                      description: "The item name as the chef wrote it (e.g. 'shiso', 'Thai basil').",
                    },
                    catalog_item_id: {
                      type: ["string", "null"],
                      description:
                        "If this item matches a row in the provided catalog, the UUID from the first column. Else null.",
                    },
                    notes: {
                      type: "string",
                      description:
                        "Short note capturing quantity, timing, or dish context from the chef. Empty string if none.",
                    },
                  },
                  required: ["item_name_raw", "catalog_item_id", "notes"],
                },
              },
            },
            required: ["requests"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "record_item_requests" },
      messages: [
        {
          role: "user",
          content:
            `Reply from chef ${msg.from_name ?? "unknown"}:\n\n` +
            "---\n" +
            msg.text_body.trim() +
            "\n---",
        },
      ],
    });

    // Find the tool_use block in the response
    const toolUseBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    if (!toolUseBlock) {
      throw new Error("model did not return a tool_use block");
    }
    const input = toolUseBlock.input as { requests?: ItemRequest[] };
    const requests = Array.isArray(input.requests) ? input.requests : [];

    // Insert one suggestion per request, linked back to the inbound message
    if (requests.length > 0) {
      const rows = requests.map((r) => {
        const matched = r.catalog_item_id
          ? catalog.find((c) => c.id === r.catalog_item_id)
          : null;
        const displayName = matched?.name ?? r.item_name_raw;
        const text = r.notes
          ? `${displayName} — ${r.notes}`
          : `${displayName} — requested via email`;
        return {
          farm_id: msg.farm_id,
          text,
          author: msg.from_name ?? "Email reply",
          status: "new",
          source: "email_reply",
          inbound_message_id: msg.id,
        };
      });

      const { error: insertErr } = await (admin as any).from("suggestions").insert(rows);
      if (insertErr) throw insertErr;
    }

    await (admin as any)
      .from("inbound_messages")
      .update({
        extraction_status: "done",
        extraction_error: null,
        extracted_at: new Date().toISOString(),
      })
      .eq("id", inboundMessageId);

    console.log(
      `[EXTRACT] ${inboundMessageId}: extracted ${requests.length} request(s)`,
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[EXTRACT] failed", { inboundMessageId, errMsg });
    await (admin as any)
      .from("inbound_messages")
      .update({
        extraction_status: "failed",
        extraction_error: errMsg.slice(0, 500),
        extracted_at: new Date().toISOString(),
      })
      .eq("id", inboundMessageId);
  }
}

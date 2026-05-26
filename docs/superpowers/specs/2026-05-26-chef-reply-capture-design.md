# Chef Reply Capture — Design Spec

**Date:** 2026-05-26
**Author:** Claude (brainstorm session with Micheal)
**Status:** Approved for implementation

## Problem

Press Farm sends 8+ kinds of email to chefs (order confirmations, availability, partner reports, etc.). Every email goes from `*@pressfarm.io` — a Resend-only sender domain with no inbound MX. The Partner Report email even invites the chef to "Reply anytime to plan ahead or request a crop." But replies bounce or silently disappear because no `Reply-To` is set and the From-domain has no inbox.

## Goal

Capture chef replies, surface them in the admin UI, and auto-extract any item requests into the existing `suggestions` triage workflow.

## Architecture

```
Chef hits Reply
  └─► replies@pressfarm.io (MX → Resend Inbound)
        └─► POST /api/inbound/reply
              ├─► verify signature
              ├─► upsert into inbound_messages (idempotent by message_id)
              └─► fire-and-forget LLM extraction
                    └─► Claude Haiku 4.5 (tool-use, prompt-cached catalog)
                          └─► insert suggestion rows linked back to message
```

Admin reads at `/admin/inbox`. Unread count surfaces as a badge on the BottomNav.

## Decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Inbound provider | Resend Inbound | Same vendor as outbound, clean JSON contract |
| Inbound address | `replies@pressfarm.io` | OS-owned, single-tenant |
| Capture surface | DB + admin UI (no email forward) | Stays in the OS, badge in nav |
| Extraction model | Claude Haiku 4.5 | Cheap, sufficient for short replies |
| Extraction output | Rows in existing `suggestions` table | Reuse triage UI |
| Schema for linking item-to-catalog | None (item names stay as text) | Avoid schema churn; LLM match goes in note |

## Data Model

New table `inbound_messages` + two columns on `suggestions`. Migration 047.

See `supabase/migrations/047_inbound_replies.sql` for full DDL. Highlights:
- `resend_message_id UNIQUE` for idempotent upsert
- `matched_user_id` / `matched_restaurant_id` best-effort backfill from `from_email`
- `status` (unread/read/archived) and `extraction_status` (pending/done/failed/skipped) as independent state machines
- `suggestions.source` enum (manual/email_reply) + `inbound_message_id` back-link

## Code Surface

| File | Purpose |
|---|---|
| `supabase/migrations/047_inbound_replies.sql` | Schema |
| `src/lib/email.ts` | Add `replyTo` to `safeResendSend` call |
| `src/lib/constants.ts` | Add `REPLY_TO_ADDRESS` constant |
| `src/lib/resend/inbound.ts` | Svix-style HMAC signature verification |
| `src/lib/extraction/item-requests.ts` | Claude Haiku 4.5 extractor |
| `src/app/api/inbound/reply/route.ts` | Webhook endpoint |
| `src/app/api/admin/inbox/[id]/route.ts` | Mark read / archive / re-extract actions |
| `src/app/admin/inbox/page.tsx` | List view |
| `src/app/admin/inbox/[id]/page.tsx` | Detail view |
| `src/components/admin/BottomNav.tsx` | Add Inbox slot + unread badge |
| `src/app/admin/layout.tsx` | Fetch unread count → pass to BottomNav |
| `src/app/admin/settings/suggestions/SuggestionBoxClient.tsx` | Add source chip |
| `src/types/database.ts` | Type additions (or `(supabase as any)` casts where types lag) |

## Operator Setup (Micheal does this)

1. **Resend dashboard** — Enable Inbound on `pressfarm.io`, add address `replies@pressfarm.io`, set webhook URL to `https://pressfarm.app/api/inbound/reply`, copy signing secret.
2. **DNS on pressfarm.io** — Add MX record Resend provides.
3. **Vercel env vars:**
   - `RESEND_INBOUND_SIGNING_SECRET` (from Resend dashboard, format `whsec_...`)
   - `ANTHROPIC_API_KEY` (from console.anthropic.com)
4. **Apply migration 047** via Supabase SQL editor.

## Failure Modes

| Failure | Behavior | Recovery |
|---|---|---|
| Bad webhook signature | 401, Resend retries | Fix secret in env |
| Duplicate message_id | Upsert no-ops, returns 200 | None — by design |
| Sender doesn't match a profile | Stored with null match | Admin sees "Unknown sender" |
| LLM extraction fails | `extraction_status='failed'` | Admin clicks "Re-run extraction" |
| Resend Inbound not configured yet | replyTo emails to address that bounces | Set up Resend Inbound — replyTo change is otherwise harmless |
| Migration 047 hasn't run | Admin layout count query throws | Wrapped in try/catch, returns 0 |

## Out of Scope (Possible Phase 2)

- Multi-tenant farm support (single-farm OS today)
- Threading: linking related replies into a conversation
- Inline reply from admin UI (uses mailto: for now)
- Linking suggestions to specific items via FK (text-only today)
- Sending automated acknowledgements

## Rollback

The `replyTo` change can be reverted in one line. The migration is additive (new table + new columns with defaults) and safe to leave in place. The webhook endpoint can stay deployed but inactive if Resend Inbound is disabled.

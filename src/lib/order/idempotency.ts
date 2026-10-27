/**
 * Idempotency tokens for order submission.
 *
 * POST /api/orders and /api/events/order treat a submission whose token
 * matches the order's `last_submission_token` as already committed and return
 * success without re-merging. For that to protect against the realistic
 * failure (the write lands, the response is lost, the chef retries) the SAME
 * token has to travel with every retry of one submission, and only a
 * submission that was confirmed successful may rotate it. Callers therefore
 * mint once when a draft is created or restored, keep the token with the
 * draft, and drop it on success.
 */
export function mintIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

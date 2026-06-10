import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateApiKey } from "@/lib/api-auth";

/**
 * validateApiKey gates every public /api/v1/* endpoint with the shared
 * PRESSFARM_API_KEY. Lock down the header parsing, the unset-key 503, and
 * the constant-time comparison (including the mismatched-length path, which
 * must reject rather than throw — timingSafeEqual throws on unequal buffer
 * lengths if called directly).
 */
describe("validateApiKey", () => {
  const KEY = "pf_test_key_123456";
  const originalKey = process.env.PRESSFARM_API_KEY;

  beforeEach(() => {
    process.env.PRESSFARM_API_KEY = KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.PRESSFARM_API_KEY;
    else process.env.PRESSFARM_API_KEY = originalKey;
  });

  const req = (headers: Record<string, string>) =>
    new Request("https://pressfarm.io/api/v1/items", { headers });

  it("returns 503 when PRESSFARM_API_KEY is not configured", () => {
    delete process.env.PRESSFARM_API_KEY;
    const res = validateApiKey(req({ "x-api-key": KEY }));
    expect(res?.status).toBe(503);
  });

  it("accepts the key via Authorization: Bearer", () => {
    expect(validateApiKey(req({ authorization: `Bearer ${KEY}` }))).toBeNull();
  });

  it("accepts the key via x-api-key", () => {
    expect(validateApiKey(req({ "x-api-key": KEY }))).toBeNull();
  });

  it("rejects a wrong key of the same length", () => {
    const wrong = KEY.slice(0, -1) + "X";
    const res = validateApiKey(req({ "x-api-key": wrong }));
    expect(res?.status).toBe(401);
  });

  it("rejects a wrong key of a different length without throwing", () => {
    const res = validateApiKey(req({ "x-api-key": "short" }));
    expect(res?.status).toBe(401);
  });

  it("rejects when no credential header is present", () => {
    const res = validateApiKey(req({}));
    expect(res?.status).toBe(401);
  });

  it("does not fall back to x-api-key parsing for a malformed Authorization header", () => {
    // "Bearer" prefix missing → providedKey comes from x-api-key (absent here).
    const res = validateApiKey(req({ authorization: KEY }));
    expect(res?.status).toBe(401);
  });
});

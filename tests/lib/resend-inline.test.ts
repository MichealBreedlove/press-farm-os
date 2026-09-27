import { describe, it, expect } from "vitest";
import { inlineBrandImages } from "@/lib/resend/client";
import { APP_URL } from "@/lib/constants";

describe("inlineBrandImages", () => {
  it("swaps our hosted images for cid refs and attaches them once each", async () => {
    const m = `${APP_URL}/assets/pressfarm/logo/png/pressfarm-mandala-240.png`;
    const w = `${APP_URL}/assets/logo/logo-wordmark-bank-gothic-transparent.png`;
    const out: any = await inlineBrandImages({
      from: "a@b.c", to: "x@y.z", subject: "s",
      html: `<img src="${m}"/><img src="${w}"/><img src="${m}"/><img src="https://other.com/x.png"/>`,
    } as any);
    expect(out.html).toBe(`<img src="cid:pf-img-1"/><img src="cid:pf-img-2"/><img src="cid:pf-img-1"/><img src="https://other.com/x.png"/>`);
    expect(out.attachments).toEqual([
      { path: m, filename: "pressfarm-mandala-240.png", inlineContentId: "pf-img-1" },
      { path: w, filename: "logo-wordmark-bank-gothic-transparent.png", inlineContentId: "pf-img-2" },
    ]);
  });

  it("leaves payloads without our images untouched", async () => {
    const p: any = { from: "a@b.c", to: "x@y.z", subject: "s", html: "<p>hi</p>" };
    expect(await inlineBrandImages(p)).toBe(p);
  });
});

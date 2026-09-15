import { describe, it, expect } from "vitest";
import { ADMIN_NAV_SECTIONS, adminNavFor, resolveActiveHref } from "@/lib/admin-nav";

describe("resolveActiveHref", () => {
  it("picks the most specific href", () => {
    expect(resolveActiveHref("/admin/reports")).toBe("/admin/reports");
    expect(resolveActiveHref("/admin/reports/executive")).toBe("/admin/reports/executive");
    expect(resolveActiveHref("/admin/reports/executive/print")).toBe("/admin/reports/executive");
  });

  it("maps Growing's member pages back to the Growing entry", () => {
    expect(resolveActiveHref("/admin/growing")).toBe("/admin/growing");
    expect(resolveActiveHref("/admin/crop-plan")).toBe("/admin/growing");
    expect(resolveActiveHref("/admin/microgreens/trays/abc")).toBe("/admin/growing");
    expect(resolveActiveHref("/admin/planter-boxes/new")).toBe("/admin/growing");
  });

  it("does not prefix-match unrelated paths", () => {
    expect(resolveActiveHref("/admin/ordersx")).toBeNull();
    expect(resolveActiveHref("/order")).toBeNull();
  });
});

describe("adminNavFor", () => {
  it("honours hideFrom per surface", () => {
    const sheet = adminNavFor("sheet").flatMap((s) => s.links.map((l) => l.href));
    const settings = adminNavFor("settings").flatMap((s) => s.links.map((l) => l.href));
    expect(sheet).toContain("/admin/settings");
    expect(sheet).not.toContain("/admin/settings/emails");
    expect(settings).toContain("/admin/settings/emails");
    expect(settings).not.toContain("/admin/settings");
  });

  it("has no duplicate hrefs across sections", () => {
    const all = ADMIN_NAV_SECTIONS.flatMap((s) => s.links.map((l) => l.href));
    expect(new Set(all).size).toBe(all.length);
  });
});

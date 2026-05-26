import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const getUserMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));

vi.mock("@/lib/forecasting", () => ({
  fetchHistoricalDeliveries: vi.fn().mockResolvedValue([]),
  fetchSeasonalItems: vi.fn().mockResolvedValue([]),
  getCalendarEvents: vi.fn().mockResolvedValue([]),
  historicalWeeks: vi.fn().mockReturnValue([]),
}));

import ForecastPage from "@/app/order/forecast/page";

beforeEach(() => {
  getUserMock.mockReset();
  fromMock.mockReset();
});

describe("/order/forecast page", () => {
  it("redirects to /login when unauthenticated", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await expect(ForecastPage()).rejects.toThrow("REDIRECT:/login");
  });

  it("renders the 'No restaurant' message when user has no restaurant_users row", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: null }) }),
      }),
    });
    const result = await ForecastPage();
    const html = JSON.stringify(result);
    expect(html).toContain("No restaurant found");
  });

  it("renders Forecast header with restaurant name when authenticated chef has a restaurant", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: {
              restaurant_id: "r1",
              restaurants: { id: "r1", name: "Press" },
            },
          }),
        }),
      }),
    });
    const result = await ForecastPage();
    const html = JSON.stringify(result);
    expect(html).toContain("Forecast");
    expect(html).toContain("Press");
  });
});

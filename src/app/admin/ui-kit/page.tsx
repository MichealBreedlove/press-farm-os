import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PressFarmLogo } from "@/components/shared/PressFarmLogo";

const FLOWERS = [
  { name: "Squash Blossom", file: "squash-blossom.png", role: "Signature crop", color: "Orange" },
  { name: "Marigold", file: "marigold.png", role: "Harvest garnish", color: "Orange" },
  { name: "Gem Marigold", file: "gem-marigold.png", role: "Chef garnish", color: "Yellow" },
  { name: "Nasturtium", file: "nasturtium.png", role: "Edible flower", color: "Orange / Red" },
  { name: "Bachelor Button", file: "bachelor-button.png", role: "Blue accent", color: "Blue" },
  { name: "Pea Flower", file: "pea-flower.png", role: "Seasonal bloom", color: "White" },
  { name: "Mustard Flower", file: "mustard-flower.png", role: "Brassica bloom", color: "Yellow" },
  { name: "Alyssum", file: "alyssum.png", role: "Delicate filler", color: "White" },
  { name: "Viola", file: "viola.png", role: "Plate flower", color: "Purple / Yellow" },
  { name: "Fava Flower", file: "fava-flower.png", role: "Cover-crop bloom", color: "Black / White" },
  { name: "Hairy Vetch", file: "hairy-vetch.png", role: "Soil health", color: "Purple" },
];

const ASSET_PATHS = [
  { label: "Primary logo (mandala + wordmark)", path: "/assets/pressfarm/logo/pressfarm-primary.svg" },
  { label: "Seal logo (cream background)", path: "/assets/pressfarm/logo/pressfarm-seal.png" },
  { label: "Icon only (squash blossom)", path: "/assets/pressfarm/logo/pressfarm-icon.png" },
  { label: "Dark monochrome", path: "/assets/pressfarm/logo/pressfarm-dark.svg" },
  { label: "Light monochrome (for dark UI)", path: "/assets/pressfarm/logo/pressfarm-light.svg" },
  { label: "Favicon (ICO + PNG variants)", path: "/assets/pressfarm/favicon/" },
  { label: "Bank Gothic LT font", path: "/assets/fonts/BankGothicLT.woff2" },
  { label: "Flower illustrations (11)", path: "/assets/pressfarm/flowers/" },
];

export default async function UIKitPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="pb-24">
      <header className="page-header no-wordmark">
        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard" className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-white/70 hover:text-white">←</Link>
          <div>
            <h1 className="page-title">Brand &amp; UI Kit</h1>
            <p className="text-xs text-white/60">Design system reference</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-8 space-y-12 max-w-5xl mx-auto">

        {/* HERO LOGO */}
        <section className="text-center py-10 bg-farm-cream rounded-2xl border border-farm-dark/5">
          <PressFarmLogo size="lg" />
          <p className="text-xs text-farm-muted mt-6">Master lockup · 260px max · Bank Gothic LT</p>
        </section>

        {/* TYPOGRAPHY */}
        <section>
          <p className="section-eyebrow text-farm-muted mb-4">Typography</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="card p-6">
              <p className="text-[11px] tracking-[0.22em] uppercase text-farm-muted mb-3">Wordmark</p>
              <p style={{ fontFamily: "'Bank Gothic LT', sans-serif", fontWeight: 700, letterSpacing: "0.08em", fontSize: "1.75rem", color: "#0D2A1E", margin: 0 }}>
                PRESS FARM
              </p>
              <p className="text-xs text-farm-muted mt-3 font-mono">Bank Gothic LT · 700 · 0.08em</p>
            </div>
            <div className="card p-6">
              <p className="text-[11px] tracking-[0.22em] uppercase text-farm-muted mb-3">Tagline</p>
              <p style={{ fontFamily: "'Bank Gothic LT', sans-serif", fontWeight: 400, letterSpacing: "0.12em", fontSize: "0.85rem", color: "#0D2A1E", opacity: 0.85, margin: 0 }}>
                CULTIVATED WITH CHEFS
              </p>
              <p className="text-xs text-farm-muted mt-3 font-mono">Bank Gothic LT · 400 · 0.12em · opacity 0.85</p>
            </div>
            <div className="card p-6">
              <p className="text-[11px] tracking-[0.22em] uppercase text-farm-muted mb-3">Display heading</p>
              <p className="font-display text-3xl text-farm-dark m-0">Picked &amp; Packed</p>
              <p className="text-xs text-farm-muted mt-3 font-mono">Baskervville · serif</p>
            </div>
            <div className="card p-6">
              <p className="text-[11px] tracking-[0.22em] uppercase text-farm-muted mb-3">Body</p>
              <p className="text-base text-farm-dark m-0">Order produce direct from Press Farm.</p>
              <p className="text-xs text-farm-muted mt-3 font-mono">Roboto · sans-serif</p>
            </div>
          </div>
        </section>

        {/* COLOR */}
        <section>
          <p className="section-eyebrow text-farm-muted mb-4">Color</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { name: "Cream", hex: "#faf7f0", bg: "bg-farm-cream", text: "text-farm-dark" },
              { name: "Farm Dark", hex: "#0D2A1E", bg: "bg-farm-dark", text: "text-farm-cream" },
              { name: "Farm Green", hex: "#00774A", bg: "bg-farm-green", text: "text-white" },
              { name: "Gold Accent", hex: "#B58B48", bg: "", text: "text-white", style: { backgroundColor: "#B58B48" } },
            ].map((c) => (
              <div key={c.name} className={`rounded-xl p-5 ${c.bg} ${c.text} border border-farm-dark/10`} style={c.style}>
                <p className="font-display text-base m-0">{c.name}</p>
                <p className="font-mono text-xs opacity-80 mt-1">{c.hex}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FLOWER SYSTEM */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <p className="section-eyebrow text-farm-muted">Flower System</p>
            <p className="text-xs text-farm-muted">11 botanical illustrations</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {FLOWERS.map((f) => (
              <div key={f.file} className="card overflow-hidden text-center">
                <div className="bg-farm-cream py-6 flex items-center justify-center" style={{ minHeight: "160px" }}>
                  <img src={`/assets/pressfarm/flowers/${f.file}`} alt={f.name} className="max-h-32 w-auto" />
                </div>
                <div className="p-4">
                  <p className="font-display text-base text-farm-dark m-0">{f.name}</p>
                  <p className="text-[11px] text-farm-muted mt-1">{f.role}</p>
                  <p className="text-[10px] text-farm-muted/70 tracking-wide uppercase mt-1">{f.color}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BUTTONS */}
        <section>
          <p className="section-eyebrow text-farm-muted mb-4">Buttons</p>
          <div className="card p-6 flex flex-wrap items-center gap-3">
            <button className="btn-primary text-sm">Primary action</button>
            <button className="btn-secondary text-sm">Secondary</button>
            <button className="btn-ghost text-sm">Ghost</button>
            <button className="btn-danger text-sm">Danger</button>
            <a className="login-cta inline-flex items-center text-sm">Hero CTA</a>
          </div>
        </section>

        {/* BADGES */}
        <section>
          <p className="section-eyebrow text-farm-muted mb-4">Status Badges</p>
          <div className="card p-6 flex flex-wrap items-center gap-2">
            <span className="badge-green">Available</span>
            <span className="badge-gold">Limited</span>
            <span className="badge-orange">Shorted</span>
            <span className="badge-blue">Submitted</span>
            <span className="badge-gray">Draft</span>
            <span className="badge-red">Cancelled</span>
          </div>
        </section>

        {/* CARDS */}
        <section>
          <p className="section-eyebrow text-farm-muted mb-4">Card Variants</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="card p-5">
              <p className="font-display text-base text-farm-dark">Standard Card</p>
              <p className="text-sm text-farm-muted mt-2">Default elevation, soft border, white background.</p>
            </div>
            <div className="card-success">
              <p className="section-eyebrow text-white/70">KPI</p>
              <p className="text-3xl font-bold mt-2">$12.4K</p>
              <p className="text-sm text-white/80 mt-1">April revenue</p>
            </div>
            <div className="card-cream">
              <p className="font-display text-base text-farm-dark">Cream variant</p>
              <p className="text-sm text-farm-muted mt-2">Soft cream fill for subtle highlight blocks.</p>
            </div>
          </div>
        </section>

        {/* CHEF ORDER CARDS */}
        <section>
          <p className="section-eyebrow text-farm-muted mb-4">Chef Order Cards</p>
          <div className="card p-5 space-y-3">
            {[
              { chef: "PRESS", item: "Squash blossoms", qty: "48 ct", status: "Harvest tomorrow", flower: "squash-blossom.png" },
              { chef: "UNDER-STUDY", item: "Violas + alyssum", qty: "3 clamshells", status: "Ready to pack", flower: "viola.png" },
              { chef: "PRESS", item: "Nasturtium leaves/flowers", qty: "2 trays", status: "Chef confirmed", flower: "nasturtium.png" },
            ].map((order) => (
              <div key={`${order.chef}-${order.item}`} className="flex items-center gap-4 p-3 bg-farm-cream/50 rounded-xl border border-farm-dark/5">
                <div className="w-14 h-14 rounded-full bg-white border border-farm-dark/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                  <img src={`/assets/pressfarm/flowers/${order.flower}`} alt="" className="h-12 w-auto" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-farm-dark">{order.item}</p>
                  <p className="text-xs text-farm-muted">{order.chef} · {order.qty}</p>
                </div>
                <span className="badge-gold">{order.status}</span>
              </div>
            ))}
          </div>
        </section>

        {/* HARVEST STANDARDS */}
        <section>
          <p className="section-eyebrow text-farm-muted mb-4">Harvest Standards</p>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-farm-cream text-farm-muted">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-xs tracking-wider uppercase">Crop</th>
                  <th className="text-left px-4 py-3 font-medium text-xs tracking-wider uppercase">Qty</th>
                  <th className="text-left px-4 py-3 font-medium text-xs tracking-wider uppercase">Stage</th>
                  <th className="text-left px-4 py-3 font-medium text-xs tracking-wider uppercase">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-farm-dark/5 bg-white">
                {[
                  ["Squash Blossom", "24-48 ct", "Early AM", "Handle upright, deliver same day"],
                  ["Marigold", "2 clamshells", "Open blooms", "Avoid wet petals"],
                  ["Pea Flower", "1 pint", "Tender stems", "Keep cool, no compression"],
                  ["Fava Flower", "1 pint", "Selective pick", "Small chef sample"],
                ].map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, i) => (
                      <td key={i} className="px-4 py-3 text-farm-dark">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ASSET PATHS */}
        <section>
          <p className="section-eyebrow text-farm-muted mb-4">Asset Paths</p>
          <div className="card overflow-hidden">
            {ASSET_PATHS.map((a, i) => (
              <div key={a.path} className={`px-5 py-3 flex items-center justify-between gap-4 ${i < ASSET_PATHS.length - 1 ? "border-b border-farm-dark/5" : ""}`}>
                <p className="text-sm text-farm-dark">{a.label}</p>
                <code className="text-xs text-farm-muted font-mono bg-farm-cream/60 px-2 py-1 rounded">{a.path}</code>
              </div>
            ))}
          </div>
        </section>

        {/* DESIGN INTENT */}
        <section className="card-cream">
          <p className="section-eyebrow text-farm-green mb-3">Design Intent</p>
          <p className="font-display text-2xl text-farm-dark mb-4">Top expressive · Bottom controlled · Whole intentional</p>
          <ul className="space-y-2 text-sm text-farm-dark/85 leading-relaxed">
            <li><strong>Top:</strong> botanical illustrations, organic warmth, hand-drawn personality.</li>
            <li><strong>Bottom:</strong> Bank Gothic LT typography, restrained spacing, refined hierarchy.</li>
            <li><strong>Whole:</strong> chef-facing identity that feels like a kitchen menu — minimal, intentional, premium.</li>
          </ul>
        </section>

      </div>
    </main>
  );
}

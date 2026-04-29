import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PressFarmLogo } from "@/components/shared/PressFarmLogo";

const FLOWERS_BRAND = [
  { name: "Squash Blossom", file: "squash-blossom.png", role: "Signature crop", color: "Yellow", chip: "pf-crop-squash" },
  { name: "Nasturtium", file: "nasturtium.png", role: "Edible flower", color: "Orange / Red", chip: "pf-crop-nasturtium" },
  { name: "Marigold", file: "marigold.png", role: "Harvest garnish", color: "Orange", chip: "pf-crop-marigold" },
  { name: "Gem Marigold", file: "gem-marigold.png", role: "Chef garnish", color: "Yellow", chip: "pf-crop-gem-marigold" },
  { name: "Bachelor Button", file: "bachelor-button.png", role: "Blue accent", color: "Blue", chip: "pf-crop-bachelor-button" },
  { name: "Pansy", file: "pansy.png", role: "Plate flower", color: "Purple / White", chip: "pf-crop-pansy" },
  { name: "Pea Flower", file: "pea-flower.png", role: "Seasonal bloom", color: "Purple", chip: "pf-crop-pea-flower" },
  { name: "Chive Blossom", file: "chive-blossom.png", role: "Allium globe", color: "Pink / Purple", chip: "pf-crop-chive-blossom" },
  { name: "Mustard Flower", file: "mustard-flower.png", role: "Brassica bloom", color: "Yellow", chip: "pf-crop-mustard" },
  { name: "Fava Flower", file: "fava-flower.png", role: "Cover-crop bloom", color: "White / Black", chip: "pf-crop-fava" },
  { name: "Fairy Vetch", file: "fairy-vetch.png", role: "Soil health", color: "Cream / Violet", chip: "pf-crop-fairy-vetch" },
  { name: "Alyssum", file: "alyssum.png", role: "Delicate filler", color: "Cream", chip: "pf-crop-alyssum" },
  { name: "Viola", file: "viola.png", role: "Plate flower", color: "Purple / Yellow", chip: "pf-crop-viola" },
  { name: "Green Leaf", file: "green-leaf.png", role: "Foliage accent", color: "Green", chip: "pf-crop-leaf" },
];

const FLOWERS_EXTENDED = [
  { name: "Borage", file: "borage.png", role: "Cucumber garnish", color: "Cornflower Blue", chip: "pf-crop-borage" },
  { name: "Calendula", file: "calendula.png", role: "Tasting menu petals", color: "Orange", chip: "pf-crop-calendula" },
  { name: "Chamomile", file: "chamomile.png", role: "Tea + garnish", color: "White / Yellow", chip: "pf-crop-chamomile" },
  { name: "Lavender", file: "lavender.png", role: "Aromatic spike", color: "Violet", chip: "pf-crop-lavender" },
  { name: "Anise Hyssop", file: "anise-hyssop.png", role: "Mint-family spike", color: "Violet", chip: "pf-crop-anise-hyssop" },
  { name: "Chervil", file: "chervil.png", role: "Fine herb umbel", color: "Cream", chip: "pf-crop-chervil" },
  { name: "Dill", file: "dill.png", role: "Pickling umbel", color: "Yellow", chip: "pf-crop-dill" },
  { name: "Fennel", file: "fennel.png", role: "Anise umbel", color: "Yellow", chip: "pf-crop-fennel" },
  { name: "Garlic Chive", file: "garlic-chive.png", role: "Allium star cluster", color: "White", chip: "pf-crop-garlic-chive" },
  { name: "Rosemary", file: "rosemary.png", role: "Woody herb sprig", color: "Pale Blue", chip: "pf-crop-rosemary" },
  { name: "Thyme", file: "thyme.png", role: "Tight herb cluster", color: "Pink / Purple", chip: "pf-crop-thyme" },
  { name: "Thai Basil", file: "thai-basil.png", role: "Aromatic stalk", color: "Violet", chip: "pf-crop-thai-basil" },
  { name: "Nasturtium Leaf", file: "nasturtium-leaf.png", role: "Peltate foliage", color: "Green", chip: "pf-crop-nasturtium-leaf" },
  { name: "Squash Bud", file: "squash-bud.png", role: "Closed blossom", color: "Yellow", chip: "pf-crop-squash-bud" },
  { name: "Buttercup", file: "buttercup.png", role: "Wild meadow accent", color: "Yellow", chip: "pf-crop-buttercup" },
  { name: "California Poppy", file: "california-poppy.png", role: "State wildflower", color: "Orange", chip: "pf-crop-california-poppy" },
  { name: "Allium", file: "allium.png", role: "Ornamental globe", color: "Deep Violet", chip: "pf-crop-allium" },
];

const FLOWERS = [...FLOWERS_BRAND, ...FLOWERS_EXTENDED];

const PF_PALETTE = [
  { group: "Cream", swatches: [
    { name: "cream-50", hex: "#fffdf8" }, { name: "cream-100", hex: "#fbf8f1" },
    { name: "cream-200", hex: "#f7f1e7" }, { name: "cream-300", hex: "#efe6d6" },
  ]},
  { group: "Green", swatches: [
    { name: "green-900", hex: "#0f1a14" }, { name: "green-700", hex: "#17351f" },
    { name: "green-600", hex: "#234d2e" }, { name: "green-500", hex: "#365a3a" },
    { name: "green-300", hex: "#7f9275" },
  ]},
  { group: "Gold", swatches: [
    { name: "gold-700", hex: "#7a6a43" }, { name: "gold-500", hex: "#b99a46" },
    { name: "gold-300", hex: "#d8c9a7" }, { name: "gold-200", hex: "#e2d7c4" },
  ]},
  { group: "Ink", swatches: [
    { name: "ink-900", hex: "#111411" }, { name: "ink-700", hex: "#2b302a" },
    { name: "ink-500", hex: "#5b6258" }, { name: "ink-300", hex: "#9ca195" },
  ]},
];

const ASSET_PATHS = [
  { label: "Primary logo (mandala + wordmark)", path: "/assets/pressfarm/logo/pressfarm-primary.svg" },
  { label: "Mandala only (color)", path: "/assets/pressfarm/logo/png/pressfarm-mandala-only.png" },
  { label: "Mandala monochrome — deep green", path: "/assets/pressfarm/logo/png/pressfarm-mandala-mono-deep-green.png" },
  { label: "Mandala monochrome — black", path: "/assets/pressfarm/logo/png/pressfarm-mandala-mono-black.png" },
  { label: "Mandala monochrome — gold", path: "/assets/pressfarm/logo/png/pressfarm-mandala-mono-gold.png" },
  { label: "Seal logo (cream background)", path: "/assets/pressfarm/logo/pressfarm-seal.png" },
  { label: "Icon only (squash blossom)", path: "/assets/pressfarm/logo/pressfarm-icon.png" },
  { label: "Dark monochrome", path: "/assets/pressfarm/logo/pressfarm-dark.svg" },
  { label: "Light monochrome (for dark UI)", path: "/assets/pressfarm/logo/pressfarm-light.svg" },
  { label: "Favicon (ICO + PNG variants)", path: "/assets/pressfarm/favicon/" },
  { label: "Bank Gothic LT font", path: "/assets/fonts/BankGothicLT.woff2" },
  { label: "Flower illustrations (31 species + 8 alternates)", path: "/assets/pressfarm/flowers/" },
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

        {/* MANDALA VARIANTS */}
        <section>
          <p className="section-eyebrow text-farm-muted mb-4">Mandala Variants</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card text-center p-5">
              <div className="bg-farm-cream rounded-xl py-3 flex items-center justify-center" style={{ minHeight: "150px" }}>
                <img src="/assets/pressfarm/logo/png/pressfarm-mandala-only.png" alt="Color mandala" className="max-h-32 w-auto" />
              </div>
              <p className="font-display text-base text-farm-dark mt-3 m-0">Color</p>
              <p className="text-[11px] text-farm-muted mt-1">Primary · web hero</p>
            </div>
            <div className="card text-center p-5">
              <div className="bg-farm-cream rounded-xl py-3 flex items-center justify-center" style={{ minHeight: "150px" }}>
                <img src="/assets/pressfarm/logo/png/pressfarm-mandala-mono-deep-green.png" alt="Monochrome green mandala" className="max-h-32 w-auto" />
              </div>
              <p className="font-display text-base text-farm-dark mt-3 m-0">Mono · Green</p>
              <p className="text-[11px] text-farm-muted mt-1">Brand-coherent · single-color print</p>
            </div>
            <div className="card text-center p-5">
              <div className="bg-farm-cream rounded-xl py-3 flex items-center justify-center" style={{ minHeight: "150px" }}>
                <img src="/assets/pressfarm/logo/png/pressfarm-mandala-mono-black.png" alt="Monochrome black mandala" className="max-h-32 w-auto" />
              </div>
              <p className="font-display text-base text-farm-dark mt-3 m-0">Mono · Black</p>
              <p className="text-[11px] text-farm-muted mt-1">B&amp;W print · stamps</p>
            </div>
            <div className="card text-center p-5">
              <div className="bg-farm-dark rounded-xl py-3 flex items-center justify-center" style={{ minHeight: "150px" }}>
                <img src="/assets/pressfarm/logo/png/pressfarm-mandala-mono-gold.png" alt="Monochrome gold mandala" className="max-h-32 w-auto" />
              </div>
              <p className="font-display text-base text-farm-dark mt-3 m-0">Mono · Gold</p>
              <p className="text-[11px] text-farm-muted mt-1">Premium · dark surfaces</p>
            </div>
          </div>
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

        {/* FLOWER SYSTEM — BRAND SHEET */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <p className="section-eyebrow text-farm-muted">Flower System · Brand Sheet</p>
            <p className="text-xs text-farm-muted">14 canonical botanicals</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {FLOWERS_BRAND.map((f) => (
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

        {/* FLOWER SYSTEM — EXTENDED CHEF GARDEN */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <p className="section-eyebrow text-farm-muted">Flower System · Extended Chef Garden</p>
            <p className="text-xs text-farm-muted">17 herbs & seasonals</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {FLOWERS_EXTENDED.map((f) => (
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

        {/* ============================================================
             PRESSFARM OS DESIGN TOKENS — pf-* namespace
             ============================================================ */}
        <hr className="pf-divider-gold" />

        <section>
          <p className="pf-eyebrow mb-2">Design Tokens</p>
          <h2 className="pf-heading-1 mb-3">PressFarm OS · pf-* namespace</h2>
          <p className="pf-body max-w-2xl">
            Production-grade tokens for color, typography, spacing, radius, shadow, and motion.
            Use via Tailwind utilities (<code className="font-pf-mono text-xs">bg-pf-green-700</code>),
            CSS variables (<code className="font-pf-mono text-xs">var(--pf-color-gold-500)</code>),
            or the named class shortcuts below.
          </p>
        </section>

        {/* PF Palette */}
        <section>
          <p className="pf-eyebrow mb-4">Color System</p>
          <div className="space-y-5">
            {PF_PALETTE.map((group) => (
              <div key={group.group}>
                <p className="text-xs font-medium text-farm-muted mb-2">{group.group}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                  {group.swatches.map((s) => (
                    <div key={s.name} className="rounded-xl overflow-hidden border border-farm-dark/5">
                      <div style={{ backgroundColor: s.hex, height: "70px" }} />
                      <div className="p-2 bg-white">
                        <p className="text-xs font-mono text-farm-dark">{s.name}</p>
                        <p className="text-[10px] font-mono text-farm-muted">{s.hex}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PF Typography */}
        <section>
          <p className="pf-eyebrow mb-4">Typography Stack</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="pf-card p-6">
              <p className="pf-eyebrow mb-3">Brand · Bank Gothic LT</p>
              <p className="pf-brand-wordmark" style={{ fontSize: "1.75rem" }}>PRESS FARM</p>
              <p className="pf-brand-tagline mt-2">CULTIVATED WITH CHEFS</p>
              <p className="text-xs font-pf-mono text-farm-muted mt-3">.pf-brand-wordmark · .pf-brand-tagline</p>
            </div>
            <div className="pf-card p-6">
              <p className="pf-eyebrow mb-3">Display · Cormorant Garamond</p>
              <p className="pf-heading-1">Picked &amp; Packed</p>
              <p className="pf-heading-2 mt-2">Yountville harvest</p>
              <p className="text-xs font-pf-mono text-farm-muted mt-3">.pf-heading-1 · .pf-heading-2</p>
            </div>
            <div className="pf-card p-6">
              <p className="pf-eyebrow mb-3">Body · Inter</p>
              <p className="pf-body">Order produce direct from Press Farm — fresh-cut the morning of delivery.</p>
              <p className="text-xs font-pf-mono text-farm-muted mt-3">.pf-body · font-pf-sans</p>
            </div>
            <div className="pf-card p-6">
              <p className="pf-eyebrow mb-3">Mono · JetBrains Mono</p>
              <p className="font-pf-mono text-sm text-farm-dark">/api/v1/items?category=flowers</p>
              <p className="text-xs font-pf-mono text-farm-muted mt-3">font-pf-mono · code blocks, asset paths</p>
            </div>
          </div>
        </section>

        {/* PF Buttons */}
        <section>
          <p className="pf-eyebrow mb-4">Buttons · pf namespace</p>
          <div className="pf-card p-6 flex flex-wrap items-center gap-3">
            <button className="pf-button-primary">Primary action</button>
            <button className="pf-button-secondary">Secondary</button>
          </div>
        </section>

        {/* Status pills */}
        <section>
          <p className="pf-eyebrow mb-4">Status · pf namespace</p>
          <div className="pf-card p-6 flex flex-wrap items-center gap-3">
            <span className="pf-status-ready">Ready</span>
            <span className="pf-status-review">Review</span>
            <span className="pf-status-alert">Alert</span>
          </div>
        </section>

        {/* CROP SIGNAL CHIPS */}
        <section>
          <p className="pf-eyebrow mb-4">Crop Signal Chips</p>
          <div className="pf-card p-6 flex flex-wrap items-center gap-2">
            {FLOWERS.map((f) => (
              <span key={f.name} className={`pf-crop-chip ${f.chip}`}>
                {f.name}
              </span>
            ))}
          </div>
          <p className="text-xs text-farm-muted mt-2 font-pf-mono">
            .pf-crop-chip + .pf-crop-* modifier · auto-adapting fill via color-mix()
          </p>
        </section>

        {/* PF Cards */}
        <section>
          <p className="pf-eyebrow mb-4">Card Variants · pf namespace</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="pf-card p-6">
              <p className="pf-eyebrow mb-2">Soft</p>
              <h3 className="pf-heading-2">.pf-card</h3>
              <p className="pf-body mt-2">Cream-100 fill, soft gold border, lifted shadow.</p>
            </div>
            <div className="pf-card-elevated p-6">
              <p className="pf-eyebrow mb-2">Elevated</p>
              <h3 className="pf-heading-2">.pf-card-elevated</h3>
              <p className="pf-body mt-2">Cream-50 fill, stronger gold border, deeper shadow.</p>
            </div>
          </div>
        </section>

        {/* Tokens cheat sheet */}
        <section>
          <p className="pf-eyebrow mb-4">Token Reference</p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="pf-card p-5">
              <p className="text-xs text-farm-muted uppercase tracking-wider mb-2">Spacing</p>
              <p className="font-pf-mono text-xs text-farm-dark leading-relaxed">
                --pf-space-1 → 0.25rem<br />
                --pf-space-4 → 1rem<br />
                --pf-space-8 → 2rem<br />
                --pf-space-16 → 4rem
              </p>
            </div>
            <div className="pf-card p-5">
              <p className="text-xs text-farm-muted uppercase tracking-wider mb-2">Radius</p>
              <p className="font-pf-mono text-xs text-farm-dark leading-relaxed">
                --pf-radius-sm → 0.5rem<br />
                --pf-radius-md → 0.75rem<br />
                --pf-radius-2xl → 1.5rem<br />
                --pf-radius-full → 9999px
              </p>
            </div>
            <div className="pf-card p-5">
              <p className="text-xs text-farm-muted uppercase tracking-wider mb-2">Shadow</p>
              <p className="font-pf-mono text-xs text-farm-dark leading-relaxed">
                --pf-shadow-soft<br />
                --pf-shadow-card<br />
                --pf-shadow-lifted
              </p>
            </div>
            <div className="pf-card p-5">
              <p className="text-xs text-farm-muted uppercase tracking-wider mb-2">Motion</p>
              <p className="font-pf-mono text-xs text-farm-dark leading-relaxed">
                --pf-motion-fast → 140ms ease<br />
                --pf-motion-base → 220ms ease<br />
                --pf-motion-slow → 420ms ease
              </p>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}

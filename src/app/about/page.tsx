import Link from "next/link";
import { PressFarmLogo } from "@/components/shared/PressFarmLogo";

const FLOWERS = [
  { src: "/assets/flowers/nasturtium.png", name: "Nasturtium" },
  { src: "/assets/flowers/squash-blossom.png", name: "Squash Blossom" },
  { src: "/assets/flowers/marigold.png", name: "Marigold" },
  { src: "/assets/flowers/gem-marigold.png", name: "Gem Marigold" },
  { src: "/assets/flowers/violas.png", name: "Violas" },
  { src: "/assets/flowers/pea-flower.png", name: "Pea Flower" },
  { src: "/assets/flowers/fava-flowers.png", name: "Fava Flowers" },
  { src: "/assets/flowers/mustard-flowers.png", name: "Mustard Flowers" },
  { src: "/assets/flowers/bachelor-buttons.png", name: "Bachelor Buttons" },
  { src: "/assets/flowers/alyssum.png", name: "Alyssum" },
  { src: "/assets/flowers/hairy-vetch.png", name: "Hairy Vetch" },
];

/**
 * /about — Public brand page. Story, what we grow, contact.
 */
export default function AboutPage() {
  return (
    <main className="min-h-screen bg-farm-cream">
      {/* Hero */}
      <section className="login-bg relative px-6 py-20 sm:py-28 text-center overflow-hidden">
        <div className="max-w-2xl mx-auto space-y-6">
          <PressFarmLogo size="lg" />

          <p className="login-eyebrow text-farm-green pt-4">Yountville · California</p>

          <h1 className="font-display text-3xl sm:text-5xl text-farm-dark leading-tight">
            Half an acre,<br />grown for chefs.
          </h1>

          <p className="text-base sm:text-lg text-farm-muted leading-relaxed max-w-xl mx-auto">
            Press Farm is a small specialty farm in Yountville, California, growing
            edible flowers, micro-greens, and seasonal produce in close partnership
            with Press, Under-Study, and Events.
          </p>
        </div>
      </section>

      {/* What we grow — flower gallery */}
      <section className="px-6 py-16 sm:py-20 bg-white border-y border-farm-dark/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="login-eyebrow text-farm-green mb-2">What We Grow</p>
            <h2 className="font-display text-2xl sm:text-3xl text-farm-dark">Edible flowers, in season</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {FLOWERS.map((f) => (
              <div key={f.name} className="text-center group">
                <div className="aspect-square bg-farm-cream rounded-2xl p-4 flex items-center justify-center transition-transform group-hover:scale-105">
                  <img src={f.src} alt={f.name} className="max-w-full max-h-full object-contain" loading="lazy" />
                </div>
                <p className="mt-3 text-sm font-medium text-farm-dark">{f.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="login-eyebrow text-farm-green mb-2">How It Works</p>
            <h2 className="font-display text-2xl sm:text-3xl text-farm-dark">A quiet handshake between farm &amp; kitchen</h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-farm-green-light flex items-center justify-center mb-3">
                <span className="text-farm-green font-display text-lg">1</span>
              </div>
              <h3 className="font-display text-base text-farm-dark mb-2">Cultivated</h3>
              <p className="text-sm text-farm-muted leading-relaxed">
                We grow what chefs ask for, planting in cycles tuned to the menus they&apos;re writing.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-farm-green-light flex items-center justify-center mb-3">
                <span className="text-farm-green font-display text-lg">2</span>
              </div>
              <h3 className="font-display text-base text-farm-dark mb-2">Harvested</h3>
              <p className="text-sm text-farm-muted leading-relaxed">
                Picked the morning of delivery. Chefs see what&apos;s ready and order the night before.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-farm-green-light flex items-center justify-center mb-3">
                <span className="text-farm-green font-display text-lg">3</span>
              </div>
              <h3 className="font-display text-base text-farm-dark mb-2">Delivered</h3>
              <p className="text-sm text-farm-muted leading-relaxed">
                Thursday, Saturday, Monday. From bed to plate in hours, not days.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 sm:py-20 bg-farm-dark text-farm-cream text-center">
        <div className="max-w-2xl mx-auto space-y-5">
          <p className="login-eyebrow opacity-70">Chefs &amp; Restaurants</p>
          <h2 className="font-display text-2xl sm:text-3xl">Want produce from Press Farm?</h2>
          <p className="text-farm-cream/80 leading-relaxed">
            We work with a small handful of restaurants in the Yountville area.
            If you&apos;re a chef interested in our produce, get in touch.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="mailto:micheal@pressfarm.io" className="login-cta inline-flex items-center" style={{ background: "#faf7f0", color: "#0D2A1E" }}>
              Email Micheal
            </a>
            <Link href="/login" className="login-link" style={{ color: "rgba(250,247,240,0.8)" }}>
              Chef sign in →
            </Link>
          </div>
        </div>
      </section>

      <footer className="px-6 py-8 text-center">
        <p className="login-footer">Press Farm · Yountville, California · Est. 2024</p>
      </footer>
    </main>
  );
}

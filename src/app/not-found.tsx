import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-farm-cream flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        {/* Hero floral mark — wandering pansy as the "lost flower" motif */}
        <div className="relative mx-auto w-56 h-56 sm:w-72 sm:h-72 mb-2">
          <img
            src="/assets/pressfarm/flowers/pansy.png"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-contain"
          />
          {/* Subtle 404 badge over the bottom-right of the flower */}
          <div className="absolute bottom-4 right-2 sm:bottom-6 sm:right-4">
            <p className="font-display text-5xl sm:text-6xl font-bold text-farm-green/30 leading-none">404</p>
          </div>
        </div>

        <p className="login-eyebrow text-farm-green mb-2">Lost in the Field</p>
        <h2 className="font-display text-2xl text-farm-dark mb-3">Page not found</h2>
        <p className="text-sm text-farm-muted leading-relaxed max-w-xs mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved. Maybe it bolted with the spring rains.
        </p>

        <div className="mt-8 flex flex-col gap-3 max-w-xs mx-auto">
          <Link href="/" className="login-cta inline-flex items-center justify-center">
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}

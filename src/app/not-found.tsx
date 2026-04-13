import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-farm-cream flex items-center justify-center px-6">
      <div className="text-center space-y-4 max-w-sm">
        <p className="text-6xl font-bold text-farm-green/20">404</p>
        <h2 className="text-lg font-semibold text-farm-dark">Page not found</h2>
        <p className="text-sm text-gray-500">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/" className="btn-primary inline-block px-6 py-2.5 text-sm">
          Go Home
        </Link>
      </div>
    </div>
  );
}

export default function OrderLoading() {
  return (
    <div className="min-h-screen bg-farm-cream flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-farm-green border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-400">Loading order form...</p>
      </div>
    </div>
  );
}

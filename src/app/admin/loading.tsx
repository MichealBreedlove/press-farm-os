export default function AdminLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-farm-green border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

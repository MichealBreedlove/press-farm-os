/**
 * Admin layout — wraps all /admin/* pages.
 * Includes mobile bottom navigation tabs.
 * Auth check: redirects non-admins to /order.
 *
 * TODO: Add auth check (verify profile.role === 'admin')
 * TODO: Add BottomNav component
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main content — padded bottom for bottom nav */}
      <div className="pb-20">{children}</div>

      {/* TODO: BottomNav component */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16 flex items-center justify-around px-4">
        <span className="text-xs text-gray-400">Orders</span>
        <span className="text-xs text-gray-400">Availability</span>
        <span className="text-xs text-gray-400">Deliveries</span>
        <span className="text-xs text-gray-400">Items</span>
        <span className="text-xs text-gray-400">Reports</span>
      </nav>
    </div>
  );
}

/**
 * /admin/settings/users — User management
 *
 * List all chef accounts with restaurant assignment and status.
 * Invite new chef (email + restaurant → Supabase magic link invite).
 * Deactivate chef (sets profiles.is_active = false).
 *
 * TODO: Build user management UI
 */
export default function AdminUsersPage() {
  return (
    <main>
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Users</h1>
        {/* TODO: "Invite Chef" button */}
      </header>

      <div className="px-4 py-6">
        {/* TODO: User list with invite/deactivate actions */}
        <p className="text-center text-gray-400 text-sm">
          User management — coming in Phase 1 build
        </p>
      </div>
    </main>
  );
}

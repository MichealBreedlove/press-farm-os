/**
 * /login — Magic link login page
 *
 * Chefs: enter email → receive magic link → click to authenticate
 * Admin: email + password (handled via same form, type detection TBD)
 *
 * TODO: Build login form UI
 */
export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-farm-cream px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-farm-green">Press Farm OS</h1>
          <p className="text-gray-500 mt-1">Farm-to-kitchen ordering</p>
        </div>

        {/* TODO: LoginForm component */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-center text-gray-400 text-sm">
            Login form — coming in Phase 1 build
          </p>
        </div>
      </div>
    </main>
  );
}

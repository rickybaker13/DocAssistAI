import { Outlet, NavLink } from 'react-router-dom';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';

export function CoderLayout() {
  const user = useScribeAuthStore((s) => s.user);
  const isManager = user?.user_role === 'coding_manager';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top nav bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold">
            <span className="text-teal-400">Code</span>Assist
          </h1>
          <nav className="flex gap-4">
            <NavLink
              to="/coder/dashboard"
              className={({ isActive }) =>
                `text-sm ${isActive ? 'text-teal-400' : 'text-slate-400 hover:text-slate-200'}`
              }
            >
              Dashboard
            </NavLink>
            {isManager && (
              <NavLink
                to="/coder/team"
                className={({ isActive }) =>
                  `text-sm ${isActive ? 'text-teal-400' : 'text-slate-400 hover:text-slate-200'}`
                }
              >
                Team
              </NavLink>
            )}
          </nav>
        </div>
        <div className="text-sm text-slate-400">
          {user?.name || user?.email}
        </div>
      </header>
      {/* Page content */}
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}

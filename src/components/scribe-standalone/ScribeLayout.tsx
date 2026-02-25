import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';
import {
  LayoutDashboard,
  Plus,
  FileText,
  User,
  LogOut,
  Sparkles,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/scribe/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/scribe/note/new',  icon: Plus,            label: 'New Note'  },
  { to: '/scribe/templates', icon: FileText,         label: 'Templates' },
];

export const ScribeLayout: React.FC = () => {
  const { user, logout } = useScribeAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/scribe/login');
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="min-h-screen bg-slate-950 flex">

      {/* ── Desktop sidebar (≥ md) ──────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-60 bg-slate-900 border-r border-slate-800 z-20">
        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-2.5 border-b border-slate-800">
          <div className="w-8 h-8 bg-teal-400 rounded-lg flex items-center justify-center flex-shrink-0">
            <Sparkles size={18} className="text-slate-900" />
          </div>
          <span className="font-semibold text-slate-50 text-sm tracking-tight">DocAssist Scribe</span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive(to)
                  ? 'bg-teal-950 text-teal-400'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>

        {/* User + logout */}
        {user && (
          <div className="px-3 py-4 border-t border-slate-800 space-y-1">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-7 h-7 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
                <User size={14} className="text-slate-400" />
              </div>
              <span className="text-xs text-slate-400 truncate">{user.name || user.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-all duration-150"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        )}
      </aside>

      {/* ── Main content area ────────────────────────────────────────────── */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">

        {/* Mobile top bar (< md) */}
        <header className="md:hidden sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-teal-400 rounded-md flex items-center justify-center">
              <Sparkles size={15} className="text-slate-900" />
            </div>
            <span className="font-semibold text-slate-50 text-sm">DocAssist Scribe</span>
          </div>
          {user && (
            <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-red-400 transition-colors">
              Sign out
            </button>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 md:px-8 py-6 pb-24 md:pb-8 max-w-4xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Mobile bottom tab bar (< md) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-slate-900/95 backdrop-blur border-t border-slate-800 flex">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-xs font-medium transition-colors ${
                isActive(to) ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-xs font-medium text-slate-500 hover:text-red-400 transition-colors"
          >
            <User size={20} />
            <span>Account</span>
          </button>
        </nav>

      </div>
    </div>
  );
};

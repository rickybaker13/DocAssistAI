import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';

export const ScribeLayout: React.FC = () => {
  const { user, logout } = useScribeAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/scribe/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <Link to="/scribe/dashboard" className="flex items-center gap-2">
          <span className="text-blue-600 font-bold text-lg">DocAssist Scribe</span>
        </Link>
        {user && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">{user.name || user.email}</span>
            <Link to="/scribe/templates" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
              Sections
            </Link>
            <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-red-500 transition-colors">
              Sign out
            </button>
          </div>
        )}
      </header>
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
};

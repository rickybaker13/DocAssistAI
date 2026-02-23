import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';

export const ScribeAuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, fetchMe, loading } = useScribeAuthStore();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user) {
      fetchMe().finally(() => setChecked(true));
    } else {
      setChecked(true);
    }
  }, []);

  if (!checked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!useScribeAuthStore.getState().user) {
    return <Navigate to="/scribe/login" replace />;
  }

  return <>{children}</>;
};

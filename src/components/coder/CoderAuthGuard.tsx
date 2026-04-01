import { Navigate } from 'react-router-dom';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';

export function CoderAuthGuard({ children }: { children: React.ReactNode }) {
  const user = useScribeAuthStore((s) => s.user);

  if (!user) return <Navigate to="/scribe/login" replace />;
  if (user.user_role !== 'billing_coder' && user.user_role !== 'coding_manager') {
    return <Navigate to="/scribe/dashboard" replace />;
  }
  return <>{children}</>;
}

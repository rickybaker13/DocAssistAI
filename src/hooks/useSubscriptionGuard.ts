import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useScribeAuthStore } from '../stores/scribeAuthStore';

/**
 * Fetches subscription status on mount and redirects to account page
 * if subscription is expired.
 */
export function useSubscriptionGuard(): void {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, subscriptionStatus, fetchSubscriptionStatus } = useScribeAuthStore();

  // Fetch subscription status when user is present
  useEffect(() => {
    if (user) {
      fetchSubscriptionStatus();
    }
  }, [user]);

  // Redirect if expired (but not if already on account page)
  useEffect(() => {
    if (
      subscriptionStatus?.subscription_status === 'expired' &&
      location.pathname !== '/scribe/account'
    ) {
      navigate('/scribe/account?expired=true', { replace: true });
    }
  }, [subscriptionStatus, location.pathname]);
}

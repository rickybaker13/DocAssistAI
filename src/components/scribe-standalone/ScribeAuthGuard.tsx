import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';
import { ConsentAttestationModal } from './ConsentAttestationModal';

export const ScribeAuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user, fetchMe, loading,
    subscriptionStatus, fetchSubscriptionStatus,
    tosAccepted, checkConsent, acceptTerms,
  } = useScribeAuthStore();
  const [checked, setChecked] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      fetchMe().finally(() => setChecked(true));
    } else {
      setChecked(true);
    }
  }, []);

  // Fetch subscription status and consent status after auth resolves
  useEffect(() => {
    if (checked && user) {
      fetchSubscriptionStatus();
      checkConsent();
    }
  }, [checked, user]);

  // Redirect expired users to account page (except if already there)
  useEffect(() => {
    if (
      subscriptionStatus?.subscription_status === 'expired' &&
      location.pathname !== '/scribe/account'
    ) {
      navigate('/scribe/account?expired=true', { replace: true });
    }
  }, [subscriptionStatus, location.pathname]);

  if (!checked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/scribe/login" replace />;
  }

  // Show consent attestation modal if user hasn't accepted TOS yet
  if (tosAccepted === false) {
    return <ConsentAttestationModal onAccept={acceptTerms} />;
  }

  return <>{children}</>;
};

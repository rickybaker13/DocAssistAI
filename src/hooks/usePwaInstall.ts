import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const IOS_USER_AGENT_REGEX = /iphone|ipad|ipod/i;

const isStandaloneMode = () => {
  const isDisplayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isNavigatorStandalone =
    'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

  return isDisplayModeStandalone || isNavigatorStandalone;
};

const isIosDevice = () => IOS_USER_AGENT_REGEX.test(navigator.userAgent);

const isSafari = () => {
  const agent = navigator.userAgent.toLowerCase();
  return agent.includes('safari') && !agent.includes('crios') && !agent.includes('fxios');
};

export const usePwaInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    setIsInstalled(isStandaloneMode());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) {
      return 'unavailable' as const;
    }

    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;

    if (choiceResult.outcome === 'accepted') {
      setDeferredPrompt(null);
      return 'accepted' as const;
    }

    return 'dismissed' as const;
  }, [deferredPrompt]);

  const needsIosInstructions = !isInstalled && isIosDevice() && isSafari();

  return {
    isInstalled,
    canInstall: Boolean(deferredPrompt),
    needsIosInstructions,
    promptInstall,
  };
};


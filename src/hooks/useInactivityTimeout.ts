import { useEffect, useRef, useCallback, useState } from 'react';

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'pointerdown',
];

const TIMEOUT_MS = 15 * 60 * 1000;    // 15 minutes
const WARNING_MS = TIMEOUT_MS - 60_000; // warn at 14 min (1 min before logout)

/**
 * Tracks user activity and calls `onTimeout` after 15 minutes of inactivity.
 * Shows a 60-second warning via the returned `warningSecondsLeft` value.
 * HIPAA 45 CFR 164.312(a)(2)(iii) — automatic logoff.
 */
export function useInactivityTimeout(onTimeout: () => void) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const warningRef = useRef<ReturnType<typeof setTimeout>>();
  const countdownRef = useRef<ReturnType<typeof setInterval>>();
  const [warningSecondsLeft, setWarningSecondsLeft] = useState<number | null>(null);

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setWarningSecondsLeft(null);
  }, []);

  const resetTimers = useCallback(() => {
    clearAllTimers();

    warningRef.current = setTimeout(() => {
      let seconds = 60;
      setWarningSecondsLeft(seconds);
      countdownRef.current = setInterval(() => {
        seconds -= 1;
        setWarningSecondsLeft(seconds);
        if (seconds <= 0 && countdownRef.current) clearInterval(countdownRef.current);
      }, 1000);
    }, WARNING_MS);

    timeoutRef.current = setTimeout(onTimeout, TIMEOUT_MS);
  }, [onTimeout, clearAllTimers]);

  useEffect(() => {
    resetTimers();

    const handler = () => resetTimers();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handler, { passive: true });
    }

    return () => {
      clearAllTimers();
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handler);
      }
    };
  }, [resetTimers, clearAllTimers]);

  return { warningSecondsLeft };
}

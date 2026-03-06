/**
 * Patches global fetch to intercept 402 responses (subscription expired).
 * When a 402 is received from our backend API, redirects to the account page.
 */
export function install402Interceptor(): void {
  const originalFetch = window.fetch;

  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const response = await originalFetch.apply(this, args);

    if (response.status === 402) {
      const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof Request ? args[0].url : '';
      // Only intercept our own API calls
      if (url.includes('/api/')) {
        // Use window.location to force navigation (works outside React Router context)
        if (!window.location.pathname.includes('/scribe/account')) {
          window.location.href = '/scribe/account?expired=true';
        }
      }
    }

    return response;
  };
}

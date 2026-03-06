/**
 * Shared iOS device detection utility.
 * Extracted from usePwaInstall.ts so multiple modules can reuse it.
 */

const IOS_USER_AGENT_REGEX = /iphone|ipad|ipod/i;

export function isIosDevice(): boolean {
  return IOS_USER_AGENT_REGEX.test(navigator.userAgent);
}

import { describe, it, expect, vi, afterEach } from 'vitest';
import { isIosDevice } from './isIosDevice';

describe('isIosDevice', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns true for iPhone user agent', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
    );
    expect(isIosDevice()).toBe(true);
  });

  it('returns true for iPad user agent', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
    );
    expect(isIosDevice()).toBe(true);
  });

  it('returns false for Android user agent', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36'
    );
    expect(isIosDevice()).toBe(false);
  });

  it('returns false for desktop user agent', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    );
    expect(isIosDevice()).toBe(false);
  });
});

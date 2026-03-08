import React from 'react';

interface Props {
  /** CSS classes for the outer <img> element (e.g. "h-8 w-8") */
  className?: string;
  /** Shorthand pixel size — sets both width and height. Ignored when className is provided. */
  size?: number;
  /**
   * Color variant:
   *  - "brand" (default) — teal background with dark lines, for dark website backgrounds
   *  - "dark"  — dark background with teal lines, used as favicon / PWA icon
   */
  variant?: 'brand' | 'dark';
}

/**
 * Renders the DocAssistAI branded icon (clinical document with accent lines).
 * Defaults to the "brand" variant (teal bg) which pops on the dark website theme.
 */
export const DocAssistLogo: React.FC<Props> = ({ className, size, variant = 'brand' }) => {
  const src = variant === 'dark' ? '/icon.svg' : '/icon-brand.svg';
  const style = !className && size ? { width: size, height: size } : undefined;

  return (
    <img
      src={src}
      alt="DocAssistAI"
      draggable={false}
      className={className ?? ''}
      style={style}
    />
  );
};

export default DocAssistLogo;

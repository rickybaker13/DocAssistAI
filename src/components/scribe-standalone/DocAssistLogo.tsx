import React from 'react';

interface Props {
  /** CSS classes for the outer <img> element (e.g. "h-8 w-8") */
  className?: string;
  /** Shorthand pixel size — sets both width and height. Ignored when className is provided. */
  size?: number;
}

/**
 * Renders the DocAssistAI branded icon (clinical document with teal accent lines).
 * Uses the same SVG that serves as the PWA / favicon icon so branding stays consistent.
 */
export const DocAssistLogo: React.FC<Props> = ({ className, size }) => {
  const style = !className && size ? { width: size, height: size } : undefined;

  return (
    <img
      src="/icon.svg"
      alt="DocAssistAI"
      draggable={false}
      className={className ?? ''}
      style={style}
    />
  );
};

export default DocAssistLogo;

import React from "react";

/** Decorative Material Design icon; the containing control supplies its name. */
export function Icon({ path, size = 24 }: { path: string; size?: number }) {
  return (
    <svg
      className="material-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path fill="currentColor" d={path} />
    </svg>
  );
}

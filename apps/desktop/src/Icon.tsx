import React from "react";
/** Decorative local symbol; the containing control owns its accessible name. */
export function Icon({ path, size = 24 }: { path: string; size?: number }) {
  return <span className="material-icon material-symbol" style={{ fontSize: size, width: size, height: size }} aria-hidden="true">{path}</span>;
}

import { COLOR_SCHEMES } from './zip-colors.mjs';

/** Saved explicit accents and scheduled overrides win in tonal themes, never in contrast. */
export function resolvePresentationTheme(prefs, record, systemDark = false) {
  const name = prefs.highContrast || prefs.theme === 'contrast'
    ? 'contrast'
    : prefs.theme === 'system' ? (systemDark ? 'dark' : 'light')
      : prefs.theme === 'light' ? 'light' : 'dark';
  const roles = { ...COLOR_SCHEMES[name] };
  const explicitAccent = record
    ? record.writtenKeys?.includes('accent') || prefs.accent !== record.preferences?.accent
    : prefs.accent && prefs.accent.toUpperCase() !== '#8FCDFF';
  if (name !== 'contrast' && explicitAccent && /^#[\da-f]{6}$/i.test(prefs.accent)) {
    roles.primary = prefs.accent;
    const channels = prefs.accent.slice(1).match(/../g).map((s) => {
      const value = parseInt(s, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    roles['on-primary'] = luminance > 0.179 ? '#000000' : '#FFFFFF';
    roles['surface-tint'] = prefs.accent;
  }
  return { name, roles };
}

export function applyPresentationTheme(root, prefs, record, systemDark) {
  const { name, roles } = resolvePresentationTheme(prefs, record, systemDark);
  root.dataset.resolvedTheme = name;
  root.style.colorScheme = name === 'light' ? 'light' : 'dark';
  for (const [role, value] of Object.entries(roles)) root.style.setProperty(`--md-sys-color-${role}`, value);
  return name;
}

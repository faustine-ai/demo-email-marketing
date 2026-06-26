// Theme handling — dark (default) or light ("clear"). The choice is persisted
// in localStorage and applied as a `data-theme` attribute on <html>, which the
// stylesheet keys its colour variables off.
const KEY = 'relay_theme';

export function getTheme() {
  try {
    return localStorage.getItem(KEY) || 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* private mode — ignore */
  }
}

// Set the attribute as early as possible so the first paint matches.
applyTheme(getTheme());

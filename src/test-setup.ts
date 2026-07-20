import '@testing-library/jest-dom/vitest'

// jsdom does not implement matchMedia. useTheme() (used by ThemeToggle) calls it
// on mount, so any test that renders a screen with ThemeToggle needs this stub.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

// jsdom does not implement scrollIntoView; MatchupsTab calls it after assigning.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

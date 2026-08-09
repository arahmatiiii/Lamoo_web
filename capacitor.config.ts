import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ir.lamoo.kitchen',
  appName: 'لامو',
  webDir: 'dist',
  android: {
    // The web app calls Gemini/OpenRouter/Anthropic over HTTPS from the WebView
    allowMixedContent: false,
  },
  // Capacitor 8's SystemBars plugin (default insetsHandling: "css") keeps the
  // WebView clear of the status/gesture bars: it passes real values through to
  // env(safe-area-inset-*) on modern WebViews and pads the view natively on
  // older ones — matching the CSS this app already uses.
};

export default config;

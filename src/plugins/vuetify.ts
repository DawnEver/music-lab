/**
 * Vuetify setup with the lab's own dark palette mapped onto the theme
 * tokens (see src/styles/tokens.css). Vuetify drives form controls and
 * chrome; the lab-specific visuals stay hand-drawn in style.css.
 */

import { createVuetify, type ThemeDefinition } from "vuetify";
import "vuetify/styles";

const labDark: ThemeDefinition = {
  dark: true,
  colors: {
    background: "#070b16",
    surface: "#0d1324",
    "surface-variant": "#131c32",
    primary: "#7c9cff",
    secondary: "#5eead4",
    tertiary: "#c084fc",
    accent: "#7c9cff",
    success: "#34d399",
    warning: "#fbbf24",
    error: "#fb7185",
    info: "#7c9cff",
    "on-background": "#f8fafc",
    "on-surface": "#f8fafc",
    "on-primary": "#0b1226",
    "on-secondary": "#0b1226",
    muted: "#94a3b8"
  }
};

export default createVuetify({
  theme: {
    defaultTheme: "labDark",
    themes: { labDark }
  },
  defaults: {
    VCard: { rounded: "lg", flat: true },
    VBtn: { rounded: "md" },
    VSlider: { color: "primary" }
  }
});

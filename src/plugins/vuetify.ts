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

const labLight: ThemeDefinition = {
  dark: false,
  colors: {
    background: "#eef1f8",
    surface: "#ffffff",
    "surface-variant": "#f2f5fc",
    primary: "#4f5fd5",
    secondary: "#0d9488",
    tertiary: "#9333ea",
    accent: "#4f5fd5",
    success: "#059669",
    warning: "#b45309",
    error: "#e11d48",
    info: "#4f5fd5",
    "on-background": "#0f172a",
    "on-surface": "#0f172a",
    "on-primary": "#ffffff",
    "on-secondary": "#ffffff",
    muted: "#52607a"
  }
};

export default createVuetify({
  theme: {
    defaultTheme: "labDark",
    themes: { labDark, labLight }
  },
  defaults: {
    VCard: { rounded: "lg", flat: true },
    VBtn: { rounded: "md" },
    VSlider: { color: "primary" }
  }
});

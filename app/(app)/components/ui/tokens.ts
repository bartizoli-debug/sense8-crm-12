// /components/ui/tokens.ts
// Central place for UI design tokens (colors, spacing, radius, borders).
// Modern, clean design system with professional aesthetics.

export const ui = {
  color: {
    // Backgrounds
    bg: "#fafbfc",
    surface: "#ffffff",
    surface2: "#f8fafb",
    surface3: "#f1f4f6",
    surfaceHover: "#f8fafb",

    // Borders
    border: "#e2e8f0",
    borderLight: "#f1f5f9",
    borderStrong: "#cbd5e1",

    // Text
    text: "#0f172a",
    text2: "#475569",
    text3: "#64748b",
    textMuted: "#94a3b8",

    // Primary - Professional green
    primary: "#2DA745",
    primaryHover: "#248a37",
    primarySoft: "#dcfce7",
    primaryLight: "#f0fdf4",

    // Secondary - Teal
    secondary: "#0891b2",
    secondaryHover: "#0e7490",
    secondarySoft: "#cffafe",

    // Status colors
    danger: "#dc2626",
    dangerHover: "#b91c1c",
    dangerSoft: "#fee2e2",
    success: "#16a34a",
    successSoft: "#dcfce7",
    warning: "#f59e0b",
    warningSoft: "#fef3c7",
    info: "#3b82f6",
    infoSoft: "#dbeafe",
  },

  radius: {
    xs: 6,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },

  space: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },

  font: {
    size: {
      xs: 11,
      sm: 12,
      base: 13,
      md: 14,
      lg: 16,
      xl: 18,
      xxl: 22,
      xxxl: 28,
    },
    weight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
  },

  line: {
    height: {
      tight: 1.2,
      snug: 1.375,
      normal: 1.5,
      relaxed: 1.625,
    },
  },

  shadow: {
    xs: "0 1px 2px rgba(15, 23, 42, 0.04)",
    sm: "0 2px 4px rgba(15, 23, 42, 0.06)",
    md: "0 4px 12px rgba(15, 23, 42, 0.08)",
    lg: "0 8px 24px rgba(15, 23, 42, 0.1)",
    xl: "0 12px 32px rgba(15, 23, 42, 0.12)",
  },

  transition: {
    fast: "120ms ease",
    base: "200ms ease",
    slow: "300ms ease",
  },

  focusRing: (color: string) => `0 0 0 3px ${color}`,
} as const;

export type UI = typeof ui;

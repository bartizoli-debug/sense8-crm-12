export const designSystem = {
  colors: {
    slate: {
      50: '#f8f9fa',
      100: '#f1f3f5',
      200: '#e9ecef',
      300: '#dee2e6',
      400: '#ced4da',
      500: '#94a3b8',
      600: '#64748b',
      700: '#475569',
      800: '#334155',
      900: '#0f172a',
    },
    primary: {
      50: '#f0fdf4',
      100: '#dcfce7',
      500: '#2DA745',
      600: '#27923d',
      700: '#248a37',
    },
    white: '#ffffff',
    border: '#e1e4e8',
    borderLight: '#f3f4f6',
    danger: '#dc2626',
    dangerLight: '#fee',
    dangerBorder: '#fca5a5',
  },

  typography: {
    fontWeights: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    sizes: {
      xs: '11px',
      sm: '12px',
      base: '13px',
      md: '14px',
      lg: '15px',
      xl: '17px',
      '2xl': '18px',
    },
    letterSpacing: {
      tight: '-0.02em',
      normal: '0',
      wide: '0.02em',
      wider: '0.08em',
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
  },

  borderRadius: {
    sm: 6,
    md: 7,
    lg: 8,
    xl: 12,
    full: 999,
  },

  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.03)',
    md: '0 2px 4px rgba(0, 0, 0, 0.05)',
    lg: '0 4px 8px rgba(0, 0, 0, 0.08)',
    primary: '0 2px 8px rgba(45, 167, 69, 0.25)',
    primarySm: '0 2px 4px rgba(45, 167, 69, 0.2)',
  },

  transitions: {
    fast: 'all 150ms ease',
    normal: 'all 180ms ease',
    smooth: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

export const corporateCardStyle = {
  background: designSystem.colors.white,
  border: `1px solid ${designSystem.colors.border}`,
  borderRadius: designSystem.borderRadius.xl,
  padding: designSystem.spacing.xl,
  boxShadow: designSystem.shadows.sm,
};

export const corporateButtonStyle = {
  padding: '10px 16px',
  borderRadius: designSystem.borderRadius.md,
  fontSize: designSystem.typography.sizes.base,
  fontWeight: designSystem.typography.fontWeights.semibold,
  cursor: 'pointer',
  transition: designSystem.transitions.normal,
  border: 'none',
};

export const corporateInputStyle = {
  padding: '10px 12px',
  borderRadius: designSystem.borderRadius.md,
  border: `1px solid ${designSystem.colors.border}`,
  background: designSystem.colors.white,
  fontSize: designSystem.typography.sizes.base,
  transition: designSystem.transitions.fast,
  outline: 'none',
};

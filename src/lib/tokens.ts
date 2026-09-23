/**
 * Chowdhury Agro ERP — Centralized Design Tokens
 * Single source of truth for all design values.
 * Mirrors CSS custom properties in globals.css.
 */

// ── Colors ───────────────────────────────────────────────────────────────────
export const colors = {
  primary: { DEFAULT: "oklch(0.57 0.175 152)", foreground: "oklch(0.99 0 0)" },
  secondary: { DEFAULT: "oklch(0.955 0.008 240)", foreground: "oklch(0.22 0.02 240)" },
  muted: { DEFAULT: "oklch(0.955 0.006 240)", foreground: "oklch(0.48 0.02 240)" },
  accent: { DEFAULT: "oklch(0.955 0.008 240)", foreground: "oklch(0.20 0.02 240)" },
  destructive: { DEFAULT: "oklch(0.577 0.245 27.325)", foreground: "oklch(0.99 0 0)" },
  success: { DEFAULT: "oklch(0.60 0.18 145)", foreground: "oklch(0.99 0 0)" },
  warning: { DEFAULT: "oklch(0.72 0.16 75)", foreground: "oklch(0.15 0.02 75)" },
  info: { DEFAULT: "oklch(0.55 0.17 264)", foreground: "oklch(0.99 0 0)" },
  background: "oklch(0.978 0.003 240)",
  foreground: "oklch(0.14 0.015 240)",
  border: "oklch(0.885 0.006 240)",
  ring: "oklch(0.57 0.175 152)",
} as const;

export const statusColors = {
  active: { bg: "emerald-50", text: "emerald-600", dot: "emerald-500" },
  healthy: { bg: "emerald-50", text: "emerald-600", dot: "emerald-500" },
  sold: { bg: "blue-50", text: "blue-600", dot: "blue-500" },
  dead: { bg: "red-50", text: "red-600", dot: "red-500" },
  sick: { bg: "rose-50", text: "rose-600", dot: "rose-500" },
  quarantined: { bg: "amber-50", text: "amber-600", dot: "amber-500" },
  pregnant: { bg: "purple-50", text: "purple-600", dot: "purple-500" },
  pending: { bg: "amber-50", text: "amber-600", dot: "amber-500" },
  overdue: { bg: "red-50", text: "red-600", dot: "red-500" },
  completed: { bg: "emerald-50", text: "emerald-600", dot: "emerald-500" },
  draft: { bg: "muted", text: "muted-foreground", dot: "muted-foreground" },
  paid: { bg: "emerald-50", text: "emerald-600", dot: "emerald-500" },
  in_stock: { bg: "emerald-50", text: "emerald-600", dot: "emerald-500" },
  low_stock: { bg: "amber-50", text: "amber-600", dot: "amber-500" },
  out_of_stock: { bg: "red-50", text: "red-600", dot: "red-500" },
} as const;

export const chartColors = [
  "oklch(0.60 0.18 145)", "oklch(0.55 0.17 264)", "oklch(0.72 0.16 75)",
  "oklch(0.577 0.245 27.325)", "oklch(0.55 0.18 305)", "oklch(0.65 0.15 195)",
] as const;

// ── Typography ───────────────────────────────────────────────────────────────
export const typography = {
  fontFamily: {
    sans: "var(--font-poppins)", mono: "var(--font-fira-code)",
    heading: "var(--font-poppins)", bengali: "var(--font-bengali)",
  },
  styles: {
    pageTitle: "text-2xl font-bold tracking-tight",
    sectionTitle: "text-xl font-semibold tracking-tight",
    cardTitle: "text-base font-semibold leading-snug",
    subtitle: "text-sm text-muted-foreground",
    body: "text-sm leading-relaxed",
    caption: "text-xs text-muted-foreground",
    label: "text-xs font-medium uppercase tracking-wider text-muted-foreground",
    kpiValue: "text-2xl font-bold tabular-nums",
    badge: "text-[11px] font-semibold",
    tableHeader: "text-xs font-bold uppercase tracking-wider text-muted-foreground/75",
  },
} as const;

// ── Spacing Presets ──────────────────────────────────────────────────────────
export const spacingPresets = {
  pagePadding: { mobile: "p-3.5", tablet: "p-5", desktop: "p-6", wide: "p-8" },
  cardPadding: { compact: "p-3.5", default: "p-5", large: "p-6" },
  gridGap: { tight: "gap-3", default: "gap-4", relaxed: "gap-5 sm:gap-6", spacious: "gap-8" },
  section: { tight: "space-y-3", default: "space-y-4", relaxed: "space-y-6" },
} as const;

// ── Radius ───────────────────────────────────────────────────────────────────
export const radius = {
  none: "0", sm: "0.375rem", md: "0.5rem", lg: "0.75rem",
  xl: "1rem", "2xl": "1.25rem", "3xl": "1.5rem", full: "9999px",
} as const;

export const radiusPresets = {
  badge: "rounded-full", button: "rounded-lg", input: "rounded-lg",
  card: "rounded-xl", cardLarge: "rounded-2xl", dialog: "rounded-2xl",
  avatar: "rounded-full", pill: "rounded-full",
} as const;

// ── Shadows & Elevation ──────────────────────────────────────────────────────
export const shadows = {
  xs: "var(--shadow-xs)", card: "var(--shadow-card)",
  cardMd: "var(--shadow-card-md)", dropdown: "var(--shadow-dropdown)",
  floating: "var(--shadow-floating)",
} as const;

export const elevation = {
  flat: 0, raised: 1, card: 2, dropdown: 3, sticky: 4,
  overlay: 5, modal: 6, tooltip: 7,
} as const;

// ── Z-Index Scale ────────────────────────────────────────────────────────────
export const zIndex = {
  base: 0, raised: 10, sticky: 20, sidebar: 30, header: 40,
  mobileDrawer: 45, modal: 50, tooltip: 60, skipNav: 100, debug: 9999,
} as const;

export const zClasses = {
  base: "z-0", raised: "z-10", sticky: "z-20", sidebar: "z-30",
  header: "z-40", mobileDrawer: "z-[45]", modal: "z-50",
  tooltip: "z-[60]", skipNav: "z-[100]",
} as const;

// ── Animation / Motion ───────────────────────────────────────────────────────
export const animation = {
  duration: {
    instant: 75, fast: 150, normal: 200, slow: 300, slower: 500,
    shimmer: 1800, toast: 4000,
  },
  easing: {
    default: "cubic-bezier(0.4, 0, 0.2, 1)",
    enter: "cubic-bezier(0, 0, 0.2, 1)",
    exit: "cubic-bezier(0.4, 0, 1, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    linear: "linear",
  },
  classes: {
    fadeIn: "animate-fade-in", fadeInUp: "animate-fade-in-up",
    scaleIn: "animate-scale-in", slideUp: "animate-slide-up",
    shimmer: "animate-shimmer", pulseSoft: "animate-pulse-soft", spin: "animate-spin",
  },
} as const;

// ── Container & Responsive ───────────────────────────────────────────────────
export const container = {
  narrow: "max-w-3xl", prose: "max-w-4xl", standard: "max-w-7xl",
  wide: "max-w-[1600px]", full: "max-w-none",
} as const;

export const breakpoints = {
  sm: "640px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1536px",
} as const;

export const sidebarTokens = {
  expanded: "w-60", collapsed: "w-16", mobileDrawer: "w-72",
} as const;

export const opacity = {
  disabled: "opacity-50", hover: "hover:opacity-90", subtle: "opacity-75",
  muted: "opacity-60", faint: "opacity-40", invisible: "opacity-0",
} as const;

// ── Unified Export ───────────────────────────────────────────────────────────
export const tokens = {
  colors, statusColors, chartColors, typography, spacingPresets,
  radius, radiusPresets, shadows, elevation, zIndex, zClasses,
  animation, container, breakpoints, sidebar: sidebarTokens, opacity,
} as const;

export default tokens;

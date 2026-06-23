export type Tokens = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  surfaceHover: string;
  dropdownBg: string;
  border: string;
  borderMuted: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;
  textLabel: string;
  link: string;
  chipBg: string;
  chipText: string;
  inputBorder: string;
  inputBg: string;
  error: string;
  success: string;
  warning: string;
  info: string;
  ctaBg: string;
  ctaText: string;
  primaryBtnBg: string;
  primaryBtnText: string;
  danger: string;
  navLinkColor: string;
  blockquoteBg: string;
  blockquoteBorder: string;
  pendingBg: string;
  pendingText: string;
  pendingBorder: string;
  imagePlaceholderBg: string;
}

export const MOBILE_LAYOUT_BREAKPOINT = 768

export const MOBILE_RAIL_WIDTH = 72

export const DESKTOP_SIDEBAR_WIDTH = 200

export const lightTokens: Tokens = {
  bg: '#ffffff',
  surface: '#f4f4f5',
  surfaceAlt: '#f9f9fb',
  surfaceHover: '#f5f5f5',
  dropdownBg: '#ffffff',
  border: '#e4e4e7',
  borderMuted: '#f0f0f0',
  textPrimary: '#111111',
  textSecondary: '#555555',
  textMuted: '#888888',
  textDisabled: '#aaaaaa',
  textLabel: '#374151',
  link: '#1a56db',
  chipBg: '#e8f0fe',
  chipText: '#1a56db',
  inputBorder: '#d1d5db',
  inputBg: '#ffffff',
  error: '#dc2626',
  success: '#16a34a',
  warning: '#d97706',
  info: '#2563eb',
  ctaBg: '#111111',
  ctaText: '#ffffff',
  primaryBtnBg: '#2563eb',
  primaryBtnText: '#ffffff',
  danger: '#cc0000',
  navLinkColor: '#333333',
  blockquoteBg: '#f9f9f9',
  blockquoteBorder: '#cccccc',
  pendingBg: '#fef3c7',
  pendingText: '#92400e',
  pendingBorder: '#fde68a',
  imagePlaceholderBg: '#f0f0f0',
} as const

export const darkTokens: Tokens = {
  bg: '#0f0f10',
  surface: '#1c1c1e',
  surfaceAlt: '#1c1c1e',
  surfaceHover: '#27272a',
  dropdownBg: '#1c1c1e',
  border: '#2d2d30',
  borderMuted: '#2d2d30',
  textPrimary: '#f4f4f5',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  textDisabled: '#52525b',
  textLabel: '#d4d4d8',
  link: '#60a5fa',
  chipBg: '#1e3a5f',
  chipText: '#93c5fd',
  inputBorder: '#3f3f46',
  inputBg: '#27272a',
  error: '#f87171',
  success: '#4ade80',
  warning: '#fbbf24',
  info: '#60a5fa',
  ctaBg: '#f4f4f5',
  ctaText: '#111111',
  primaryBtnBg: '#2563eb',
  primaryBtnText: '#ffffff',
  danger: '#f87171',
  navLinkColor: '#d4d4d8',
  blockquoteBg: '#1c1c1e',
  blockquoteBorder: '#3f3f46',
  pendingBg: '#292307',
  pendingText: '#fde68a',
  pendingBorder: '#713f12',
  imagePlaceholderBg: '#27272a',
} as const

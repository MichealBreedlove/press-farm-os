/**
 * Shared email styles + helpers.
 *
 * Email clients are limited — no @font-face, no flex with gap, no CSS variables.
 * Stick to inline styles, system fonts, and table-friendly layouts.
 */

import { APP_URL } from "@/lib/constants";

export const FONT_STACK = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export const colors = {
  cream: "#faf7f0",
  white: "#ffffff",
  green: "#00774A",
  greenDark: "#0D2A1E",
  gold: "#B58B48",
  goldLight: "rgba(181, 139, 72, 0.4)",
  text: "#1a1a1a",
  textMuted: "#6b6b6b",
  textLight: "#9ca3af",
  border: "rgba(13, 42, 30, 0.08)",
  borderSoft: "#f0ebe0",
};

export const styles = {
  body: {
    backgroundColor: colors.cream,
    fontFamily: FONT_STACK,
    margin: 0,
    padding: 0,
    color: colors.text,
  },
  container: {
    margin: "0 auto",
    padding: "32px 16px",
    maxWidth: "560px",
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: "20px",
    border: `1px solid ${colors.border}`,
    padding: "0",
    overflow: "hidden" as const,
  },
  hero: {
    textAlign: "center" as const,
    padding: "56px 24px 20px",
  },
  // Floral mark in header
  floral: {
    display: "block",
    margin: "0 auto",
    width: "72px",
    height: "auto",
  },
  brand: {
    fontFamily: FONT_STACK,
    fontSize: "22px",
    fontWeight: 700,
    letterSpacing: "0.18em",
    color: colors.greenDark,
    margin: "16px 0 4px",
    lineHeight: 1,
  },
  tagline: {
    fontFamily: FONT_STACK,
    fontSize: "10px",
    letterSpacing: "0.28em",
    color: colors.gold,
    margin: "0 0 8px",
    textTransform: "uppercase" as const,
  },
  goldRule: {
    display: "block",
    width: "32px",
    height: "1px",
    backgroundColor: colors.gold,
    margin: "16px auto",
    border: "none",
  },
  body_section: {
    padding: "8px 32px 32px",
  },
  eyebrow: {
    fontFamily: FONT_STACK,
    fontSize: "11px",
    letterSpacing: "0.22em",
    textTransform: "uppercase" as const,
    color: colors.green,
    margin: "16px 0 8px",
    fontWeight: 600,
  },
  h1: {
    fontFamily: FONT_STACK,
    fontSize: "26px",
    fontWeight: 600,
    color: colors.greenDark,
    margin: "0 0 20px",
    lineHeight: 1.2,
  },
  h2: {
    fontFamily: FONT_STACK,
    fontSize: "16px",
    fontWeight: 600,
    color: colors.greenDark,
    margin: "28px 0 12px",
  },
  paragraph: {
    fontFamily: FONT_STACK,
    fontSize: "15px",
    color: colors.text,
    lineHeight: 1.6,
    margin: "0 0 14px",
  },
  paragraphMuted: {
    fontFamily: FONT_STACK,
    fontSize: "14px",
    color: colors.textMuted,
    lineHeight: 1.6,
    margin: "0 0 14px",
  },
  ctaWrap: {
    textAlign: "center" as const,
    margin: "28px 0",
  },
  button: {
    backgroundColor: colors.greenDark,
    color: colors.cream,
    padding: "14px 36px",
    borderRadius: "12px",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    display: "inline-block",
    fontFamily: FONT_STACK,
  },
  buttonSecondary: {
    backgroundColor: colors.white,
    color: colors.greenDark,
    padding: "12px 24px",
    borderRadius: "12px",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: 600,
    letterSpacing: "0.06em",
    border: `1px solid ${colors.border}`,
    display: "inline-block",
    fontFamily: FONT_STACK,
  },
  highlightBox: {
    backgroundColor: colors.cream,
    borderRadius: "12px",
    padding: "16px 20px",
    margin: "20px 0",
    border: `1px solid ${colors.border}`,
    textAlign: "center" as const,
  },
  highlightLabel: {
    fontFamily: FONT_STACK,
    fontSize: "11px",
    letterSpacing: "0.22em",
    textTransform: "uppercase" as const,
    color: colors.textMuted,
    margin: "0 0 4px",
  },
  highlightValue: {
    fontFamily: FONT_STACK,
    fontSize: "20px",
    fontWeight: 700,
    color: colors.greenDark,
    margin: 0,
  },
  // Step row
  step: {
    margin: "0 0 20px",
  },
  stepNumWrap: {
    width: "32px",
    height: "32px",
    backgroundColor: colors.green,
    borderRadius: "50%",
    display: "inline-block",
    marginRight: "12px",
    verticalAlign: "top" as const,
    textAlign: "center" as const,
    lineHeight: "32px",
  },
  stepNumText: {
    color: colors.white,
    fontFamily: FONT_STACK,
    fontSize: "14px",
    fontWeight: 700,
    margin: 0,
  },
  stepBody: {
    display: "inline-block",
    verticalAlign: "top" as const,
    width: "calc(100% - 50px)",
  },
  stepTitle: {
    fontFamily: FONT_STACK,
    fontSize: "15px",
    fontWeight: 600,
    color: colors.greenDark,
    margin: "0 0 4px",
  },
  stepDesc: {
    fontFamily: FONT_STACK,
    fontSize: "13px",
    color: colors.textMuted,
    lineHeight: 1.5,
    margin: 0,
  },
  // Item row in lists
  itemRow: {
    padding: "12px 0",
    borderBottom: `1px solid ${colors.borderSoft}`,
  },
  itemRowLast: {
    padding: "12px 0",
  },
  itemName: {
    fontFamily: FONT_STACK,
    fontSize: "14px",
    fontWeight: 500,
    color: colors.text,
    margin: 0,
  },
  itemQty: {
    fontFamily: FONT_STACK,
    fontSize: "14px",
    fontWeight: 600,
    color: colors.greenDark,
    margin: 0,
  },
  // Footer
  footerSection: {
    textAlign: "center" as const,
    padding: "24px 16px 8px",
  },
  footerLine: {
    fontFamily: FONT_STACK,
    fontSize: "13px",
    color: colors.textMuted,
    margin: "0 0 8px",
    lineHeight: 1.5,
  },
  footerSignature: {
    fontFamily: FONT_STACK,
    fontSize: "10px",
    letterSpacing: "0.28em",
    textTransform: "uppercase" as const,
    color: colors.textLight,
    margin: "16px 0 0",
  },
};

export const FLORAL_URL = `${APP_URL}/assets/logo/png/logo-floral-only-transparent.png`;
/** Bank Gothic LT "PRESS FARM" wordmark rendered as PNG (email clients can't load custom fonts) */
export const WORDMARK_URL = `${APP_URL}/assets/logo/logo-wordmark-bank-gothic-transparent.png`;

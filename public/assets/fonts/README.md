# Bank Gothic LT — Font Files

Currently installed:
- `BankGothicLT.woff2` (19 KB) — Light weight, converted from BNKGOTHL.TTF
- `BankGothicLT.ttf` (43 KB) — TrueType fallback

Loaded by `src/app/globals.css` `@font-face` for all weights (100–900) since
only one weight is provided. This prevents browsers from synthesizing fake
bold variants which look poor on display fonts like Bank Gothic.

## To upgrade with additional weights

If you obtain a Bank Gothic LT Bold (700) or Medium (500) variant, drop them
in here as `BankGothicLT-Bold.woff2` etc. and add separate `@font-face`
declarations in globals.css with proper `font-weight` values.

## License

These font files are present because the user supplied a licensed copy.
Verify your license terms before redistributing the project repo publicly.

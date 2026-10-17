# Stage 0 UI verification

Validated the production build against the unchanged canonical `../Design` preview.

- `npm run build`: strict TypeScript and Vite build passed.
- Browser matrix: 11 canonical routes × 3 widths (1440, 768, 390) × 2 themes = 66 comparisons.
- All 66 rendered shell DOM and page titles match exactly.
- 64 screenshots match byte for byte. Animated UI Kit specimens are masked for screenshot comparison; their surrounding layout is compared.
- Mobile search native query controls show Chromium paint differences: 1,175 pixels in light mode (0.3013%) and 1,215 pixels in dark mode (0.3115%). No pixels differ outside the query icon and native select controls. Their actual computed styles and layout match; CSS minification equivalents are normalized in the verification script. This is a measured browser rendering limitation, not a claim of exact pixel parity for those two cases.
- Appearance palette, scale and font selection, persistence after reload, mobile navigation, Escape handling and keyboard skip link passed.
- No browser page errors or failed network requests.

The source Design files were not modified. The UI still uses the approved prototype fixtures and does not represent connected backend workflows. See README.md for the transitional architecture and repeatable browser verification command. Failure screenshots and the machine-readable result are written under ignored `.scratch/parity/`.

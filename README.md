# Raccoon UI — stage 0

React 19, strict TypeScript and Vite bootstrap, using exact versions from Kitsu/FE's lockfile.

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:5100. Every approved Design page retains its canonical pathname, including `/system.html` and the separate `/jmouse-uik.html`. The server binds only to loopback and refuses to choose a different port. `/v1` is reserved for the backend on port 8150.

The approved `../Design` is the canonical interface. This transitional React host imports its original styles, appearance system, page renderers, fixtures and interactions unchanged. Assets are served from the original directory during development and emitted unchanged into the build. There is no independently recreated layout, stylesheet or token set.

The screens remain the explicitly labelled interactive design prototype. Search, source settings, context and jobs use the original fixtures and browser session state; they do not call the backend or alter real documents. Backend system-parameter APIs are implemented separately and will be connected to approved UI components in a subsequent stage. Authentication and server state are not yet integrated in this bridge. No backend bearer token is shipped to the browser.

```powershell
npm run typecheck
npm run build
```

For build preview use `npm run preview` (http://127.0.0.1:5101). Hosting must provide history fallback to `index.html` for the canonical `*.html` routes. The React root owns only the stable mount nodes; the existing renderer owns their contents. The canonical scripts register their document listeners once per full page navigation. Incremental migration to React components must preserve the approved DOM, styles, appearance axes and interactions.

Browser parity verification requires Playwright (the existing workspace cache is used by default). Set `PLAYWRIGHT_MODULE` to another installation and `DESIGN_URL` / `UI_URL` if the previews use different addresses:

```powershell
node scripts/verify-parity.cjs
```

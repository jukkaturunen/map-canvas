# AGENTS
Guidelines for coding agents contributing to Map Canvas.
1. Build/Release: `zip -r module.zip module.json LICENSE README.md CHANGELOG.md modules/ templates/ styles/` mirrors CI.
2. Dependencies: none installed locally; browser scripts (Google Maps, html2canvas) load via CDN.
3. Tests: no automated suite; smoke test by launching Foundry, enabling Map Canvas, and opening the GM control button.
4. Single-test flow: in console call `window.mapCanvasInstance.openDialog()` then trigger `MapCanvas.updateScene(true)`.
5. Linting: no config checked in; if you introduce ESLint, run `npx eslint modules/**/*.js` before committing.
6. Imports: use relative ES module paths with explicit `.js` extensions and named exports.
7. Prefer `const` for immutable bindings, `let` for controlled mutation, never `var`.
8. Keep class names PascalCase, functions/methods camelCase, settings keys ALL_CAPS strings.
9. Formatting: 4-space indent, trailing commas avoided, wrap lines near 120 columns.
10. Strings: default to double quotes; reserve template literals for interpolation.
11. Async: favor `async/await`; wrap external calls (Hooks, Scene updates, fetches) in try/catch logging `console.error('map-canvas:', e)`.
12. Global state: mutate `MAP_CANVAS_STATE` and expose via `window.mapcanvas` only when compatibility demands it.
13. DOM access: guard `document.getElementById`/`querySelector` results before adding listeners; no inline event attributes.
14. Hooks/keybindings: register with Foundry `Hooks.on/once` and always unregister in `close()` or cleanup paths.
15. Error handling: fail fast, display user feedback through `ui.notifications` where appropriate.
16. CSS: keep reusable styles in `styles/`, avoid inline styles in templates unless absolutely necessary.
17. Metadata/Licensing: keep LICENSE plus module.json and workflow artifact lists in sync when versioning.
18. Documentation/Logging: update README+CHANGELOG for new settings and prefix logs with `map-canvas:`.

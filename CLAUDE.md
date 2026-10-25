# Nineling

Sudoku game in plain HTML, CSS and JavaScript with no build step. Open `index.html` directly.

- The development plan lives in `ROADMAP.md`. Follow its phases in order, honor its "المبادئ الثابتة" section, and mark items ✅ and append to "سجل التنفيذ" when work lands.
- Layout: `js/sudoku.js` (pure rules), `js/i18n.js` (translation, plurals, numbers), `js/sound.js`, `js/levels.js` (puzzle data), `js/app.js` (state and UI), `locales/*.js` (one file per language), `fonts/` (bundled Baloo fonts).
- Scripts are classic `<script>` files, not ES modules, so the game keeps working from `file://`.
- Never put user-facing text in `index.html` or `js/`; add a key to every file in `locales/`. A test enforces this.
- The board and number pad stay `dir="ltr"` with digits 1–9 in every language.
- Every puzzle in `js/levels.js` must have a valid solution and exactly one solution.
- Run `npm test` before every push (needs Playwright with Chromium for `tests/ui.test.js`).

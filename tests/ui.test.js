// Browser tests. Needs Playwright with Chromium (npm install && npx playwright install chromium).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

const url = "file://" + path.join(__dirname, "..", "index.html");
let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function open(locale = "en-US", context) {
  const page = await (context || browser).newPage(context ? undefined : { locale });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(url);
  return { page, errors };
}
const cell = (page, r, c) => page.locator(".cell").nth(r * 9 + c);
const num = (page, n) => page.locator(".num").nth(n - 1);
const data = page => page.evaluate(() => ({ puzzle, solution }));
const empties = puzzle => puzzle.flatMap((row, r) => row.flatMap((value, c) => value ? [] : [[r, c]]));

test("picks the device language and switches without losing the game", async () => {
  const { page, errors } = await open("ar-EG");
  assert.equal(await page.getAttribute("html", "dir"), "rtl");
  assert.equal(await page.locator("#session").innerText(), "٤ مستويات مفتوحة الآن.");
  await page.click('[data-level="0"]');
  const { puzzle, solution } = await data(page);
  const [r, c] = empties(puzzle)[0];
  await cell(page, r, c).click(); await num(page, solution[r][c]).click();
  await page.click("#gear"); await page.selectOption("#lang", "en"); await page.click("#back");
  assert.equal(await page.getAttribute("html", "dir"), "ltr");
  assert.equal(await page.locator("#level-name").innerText(), "Easy");
  assert.equal(await cell(page, r, c).innerText(), String(solution[r][c]));
  assert.equal(await page.getAttribute("#board", "dir"), "ltr");
  await page.reload();
  assert.equal(await page.locator("#lang").inputValue(), "en", "choice is remembered");
  assert.deepEqual(errors, []);
});

test("notes, not-here marks, erase and undo", async () => {
  const { page, errors } = await open();
  await page.click('[data-level="0"]');
  const [r, c] = empties((await data(page)).puzzle)[0];
  await page.click("#forbid"); await cell(page, r, c).click(); await num(page, 3).click();
  assert.equal(await cell(page, r, c).locator(".notes i.no").count(), 1, "not-here mark written");
  await page.click("#forbid"); await page.click("#notes"); await num(page, 5).click();
  assert.equal(await cell(page, r, c).locator(".notes i:not(.no):not(:empty)").count(), 1, "note written");
  await page.click("#notes"); await num(page, 1).click();
  assert.equal(await cell(page, r, c).innerText(), "1");
  await page.click("#undo");
  assert.equal(await cell(page, r, c).locator(".notes i:not(:empty)").count(), 2, "undo restores notes");
  await page.click("#clear-notes"); await page.click("#erase");
  assert.equal(await page.evaluate(() => history.length), 3, "erasing an empty cell adds no undo step");
  assert.deepEqual(errors, []);
});

test("a full but wrong grid keeps progress, then a fix wins", async () => {
  const { page, errors } = await open();
  await page.click('[data-level="0"]');
  const { puzzle, solution } = await data(page);
  const cells = empties(puzzle);
  const [a, b] = cells.filter(([r]) => r === cells[0][0]).filter((x, i, all) => solution[x[0]][x[1]] !== solution[all[0][0]][all[0][1]] || i === 0).slice(0, 2);
  const swap = new Map([[a.join(), solution[b[0]][b[1]]], [b.join(), solution[a[0]][a[1]]]]);
  for (const [r, c] of cells) { await cell(page, r, c).click(); await num(page, swap.get(`${r},${c}`) || solution[r][c]).click(); }
  assert.equal(await page.locator(".board.shake").count(), 1);
  assert.equal(await page.locator("#hint").innerText(), "The grid is full, but something is off. Find it or use a check.");
  await page.click("#check");
  assert.equal(await page.locator(".cell.bad").count(), 2);
  for (const [r, c] of [a, b]) { await cell(page, r, c).click(); await page.click("#erase"); }
  for (const [r, c] of [a, b]) { await cell(page, r, c).click(); await num(page, solution[r][c]).click(); }
  assert.equal(await page.locator("#veil.on").count(), 1);
  assert.match(await page.locator("#win-time").innerText(), /^Time \d\d:\d\d · You finished 1 puzzle this session\.$/);
  await page.click("#to-levels");
  assert.equal(await page.locator("#session").innerText(), "You finished 1 puzzle this session.");
  assert.deepEqual(errors, []);
});

test("bundled fonts load", async () => {
  const { page } = await open("ar");
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() => [...document.fonts].filter(font => font.status === "loaded").map(font => font.family.replace(/"/g, "")));
  assert.ok(loaded.includes("Baloo 2"), loaded.join());
  assert.ok(loaded.includes("Baloo Bhaijaan 2"), loaded.join());
});

async function solveAllBut(page, keep = 0) {
  const { puzzle, solution } = await data(page);
  const cells = empties(puzzle);
  for (const [r, c] of cells.slice(0, cells.length - keep)) { await cell(page, r, c).click(); await num(page, solution[r][c]).click(); }
  return cells.slice(cells.length - keep);
}

test("each new game is a different puzzle", async () => {
  const { page } = await open();
  await page.click('[data-level="0"]');
  const first = (await data(page)).puzzle;
  await page.click("#back"); await page.click('[data-level="0"]');
  assert.notDeepEqual((await data(page)).puzzle, first);
});

test("the game is saved and can be continued after closing", async () => {
  const context = await browser.newContext({ locale: "en-US" });
  const { page, errors } = await open(null, context);
  await page.click('[data-level="1"]');
  const { puzzle, solution } = await data(page);
  const [r, c] = empties(puzzle)[0];
  await cell(page, r, c).click(); await num(page, solution[r][c]).click();
  await page.waitForTimeout(1100);
  await page.reload();
  assert.equal(await page.locator("#continue").isVisible(), true);
  assert.match(await page.locator("#continue-detail").innerText(), /^Medium · 00:0\d$/);
  await page.click("#continue");
  assert.deepEqual((await data(page)).puzzle, puzzle);
  assert.equal(await cell(page, r, c).innerText(), String(solution[r][c]));
  await page.click("#undo");
  assert.equal(await cell(page, r, c).innerText(), "", "undo history survives too");
  await solveAllBut(page);
  await page.click("#to-levels");
  assert.equal(await page.locator("#continue").isVisible(), false, "a won game is not offered again");
  assert.deepEqual(errors, []);
  await context.close();
});

test("placing a number removes it from peer notes, unless turned off", async () => {
  const { page } = await open();
  await page.click('[data-level="0"]');
  const { puzzle, solution } = await data(page);
  const cells = empties(puzzle);
  const [a] = cells, b = cells.find(([r, c]) => r === a[0] && c !== a[1]);
  const n = solution[a[0]][a[1]];
  await cell(page, ...b).click(); await page.click("#notes"); await num(page, n).click(); await page.click("#notes");
  await cell(page, ...a).click(); await num(page, n).click();
  assert.equal(await cell(page, ...b).locator(".notes i:not(:empty)").count(), 0);
  await page.click("#undo");
  assert.equal(await cell(page, ...b).locator(".notes i:not(:empty)").count(), 1, "undo brings the note back");
  await page.click("#gear"); await page.click('label[for="set-autoNotes"]'); await page.click("#back");
  await cell(page, ...a).click(); await num(page, n).click();
  assert.equal(await cell(page, ...b).locator(".notes i:not(:empty)").count(), 1);
});

test("the whole game can be played from the keyboard", async () => {
  const { page, errors } = await open();
  await page.click('[data-level="0"]');
  const { puzzle, solution } = await data(page);
  const cells = empties(puzzle);
  await page.keyboard.press("ArrowRight");
  let at = [0, 0];
  for (const [r, c] of cells) {
    while (at[0] !== r) { await page.keyboard.press("ArrowDown"); at[0] = (at[0] + 1) % 9; }
    while (at[1] !== c) { await page.keyboard.press(c > at[1] ? "ArrowRight" : "ArrowLeft"); at[1] += c > at[1] ? 1 : -1; }
    if (r === cells[0][0] && c === cells[0][1]) {
      await page.keyboard.press("n"); await page.keyboard.press(String(solution[r][c] % 9 + 1)); await page.keyboard.press("n");
      assert.equal(await cell(page, r, c).locator(".notes i:not(:empty)").count(), 1);
      await page.keyboard.press(String(solution[r][c])); await page.keyboard.press("Backspace");
      assert.equal(await cell(page, r, c).innerText(), "");
      await page.keyboard.press("Control+z");
      assert.equal(await cell(page, r, c).innerText(), String(solution[r][c]));
      continue;
    }
    await page.keyboard.press(String(solution[r][c]));
  }
  assert.equal(await page.locator("#veil.on").count(), 1);
  assert.deepEqual(errors, []);
});

test("settings are remembered and mistakes can show right away", async () => {
  const context = await browser.newContext({ locale: "en-US" });
  const { page } = await open(null, context);
  await page.click("#gear");
  await page.click('label[for="set-showMistakes"]');
  await page.click('label[for="set-sound"]');
  await page.reload(); await page.click("#gear");
  assert.equal(await page.isChecked("#set-showMistakes"), true);
  assert.equal(await page.isChecked("#set-sound"), false);
  assert.equal(await page.getAttribute("#sound", "aria-label"), "Turn sound on");
  await page.click("#back"); await page.click('[data-level="0"]');
  const { puzzle, solution } = await data(page);
  const [r, c] = empties(puzzle)[0];
  await cell(page, r, c).click(); await num(page, solution[r][c] % 9 + 1).click();
  assert.match(await cell(page, r, c).getAttribute("aria-label"), /, wrong$/);
  await context.close();
});

test("no accessibility violations on any screen, in both languages", async () => {
  const axe = require.resolve("axe-core/axe.min.js");
  for (const locale of ["en-US", "ar-EG"]) {
    const { page } = await open(locale);
    const audit = async name => {
      await page.addScriptTag({ path: axe });
      const { violations } = await page.evaluate(() => axe.run(document, { resultTypes: ["violations"] }));
      assert.deepEqual(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(" ")).slice(0, 3).join(" | ")}`), [], `${locale} ${name}`);
    };
    await audit("home");
    await page.click('[data-level="0"]'); await cell(page, 0, 0).click(); await audit("play");
    await page.click("#gear"); await audit("settings");
  }
});

// Browser tests. Needs Playwright with Chromium (npm install && npx playwright install chromium).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

const url = "file://" + path.join(__dirname, "..", "index.html");
let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function open(locale = "en-US") {
  const page = await browser.newPage({ locale });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(url);
  return { page, errors };
}
const cell = (page, r, c) => page.locator(".cell").nth(r * 9 + c);
const num = (page, n) => page.locator(".num").nth(n - 1);
const data = page => page.evaluate(() => ({ puzzle: levels[0].puzzle, solution: levels[0].solution }));
const empties = puzzle => puzzle.flatMap((row, r) => row.flatMap((value, c) => value ? [] : [[r, c]]));

test("picks the device language and switches without losing the game", async () => {
  const { page, errors } = await open("ar-EG");
  assert.equal(await page.getAttribute("html", "dir"), "rtl");
  assert.equal(await page.locator("#session").innerText(), "٤ مستويات مفتوحة الآن.");
  await page.click('[data-level="0"]');
  const { puzzle, solution } = await data(page);
  const [r, c] = empties(puzzle)[0];
  await cell(page, r, c).click(); await num(page, solution[r][c]).click();
  await page.selectOption("#lang", "en");
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
  await page.click("#again");
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

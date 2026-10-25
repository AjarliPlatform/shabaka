const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

require("../js/i18n.js");
const { I18n } = globalThis;
const localeDir = path.join(__dirname, "..", "locales");
for (const file of fs.readdirSync(localeDir)) require(path.join(localeDir, file));
const codes = I18n.supported();


test("every locale has every key the English locale has", () => {
  const read = file => fs.readFileSync(path.join(localeDir, file), "utf8");
  const keys = text => new Set([...text.matchAll(/^\s*"([a-z]+\.[A-Za-z]+)":/gm)].map(match => match[1]));
  const english = keys(read("en.js"));
  for (const file of fs.readdirSync(localeDir)) {
    const own = keys(read(file));
    const missing = [...english].filter(key => !own.has(key));
    assert.deepEqual(missing, [], `${file} is missing keys`);
  }
});

test("plural strings define the 'other' form", () => {
  for (const code of codes) {
    I18n.set(code);
    for (const key of ["home.openCount", "home.finished", "level.clues", "hint.wrong"]) {
      assert.doesNotMatch(I18n.t(key, { count: 7 }), /^[a-z]+\.[A-Za-z]+$/, `${code} ${key}`);
    }
  }
});

test("Arabic uses Arabic-Indic digits and the right plural form", () => {
  I18n.set("ar");
  assert.equal(I18n.time(65), "٠١:٠٥");
  assert.equal(I18n.t("level.clues", { count: 38 }), "٣٨ رقمًا ظاهرًا");
  assert.equal(I18n.t("home.openCount", { count: 4 }), "٤ مستويات مفتوحة الآن.");
});

test("English formats time and plurals", () => {
  I18n.set("en");
  assert.equal(I18n.time(65), "01:05");
  assert.equal(I18n.t("hint.wrong", { count: 1 }), "1 number is in the wrong place.");
  assert.equal(I18n.t("hint.wrong", { count: 3 }), "3 numbers are in the wrong place.");
});

test("language detection falls back by base language, then to English", () => {
  assert.equal(I18n.detect(null, ["ar-EG"]), "ar");
  assert.equal(I18n.detect("ar", ["en-US"]), "ar");
  assert.equal(I18n.detect(null, ["xx-YY"]), "en");
});

test("no user-facing text is hard-coded outside the locale files", () => {
  const files = ["index.html", ...fs.readdirSync(path.join(__dirname, "..", "js")).map(file => `js/${file}`)];
  for (const file of files) {
    const text = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.doesNotMatch(text, /[؀-ۿ]/, `${file} contains Arabic text`);
  }
});

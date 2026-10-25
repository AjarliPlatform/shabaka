// Game state, rendering and input. Text comes from I18n, rules from Sudoku.
const { t } = I18n;
const $ = id => document.getElementById(id);
const board = $("board");
const KEYS = { lang: "nineling.lang", settings: "nineling.settings", game: "nineling.game" };
const DEFAULTS = { sound: true, vibration: true, autoNotes: true, showMistakes: false };

let level = null, puzzle, solution, boardState, notes, selected = null, picked = 0;
let done = false, noteMode = false, forbidMode = false, checks = 3, reveal = false, seconds = 0, history = [], finished = 0;
let litLines = new Set(), screen = "levels", returnTo = "levels", hint = { key: "hint.start", params: {} };
let settings = { ...DEFAULTS, ...readJSON(KEYS.settings) };

function storage(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { return null; }
}
function readJSON(key) { try { return JSON.parse(storage(key)) || null; } catch { return null; } }

function setHint(key, params = {}) { hint = { key, params }; $("hint").textContent = t(key, params); }
const levelName = item => t(`level.${item.id}`);
const lineComplete = (index, isRow) => Sudoku.lineComplete(boardState, solution, index, isRow);
const digitFull = n => Sudoku.countOf(boardState, n) === 9;
const noNotes = cell => !cell.yes.size && !cell.no.size;
const emptyNotes = () => ({ yes: new Set(), no: new Set() });
const notesToJSON = () => notes.map(row => row.map(cell => ({ yes: [...cell.yes], no: [...cell.no] })));
const notesFromJSON = rows => rows.map(row => row.map(cell => ({ yes: new Set(cell.yes), no: new Set(cell.no) })));
const vibrate = ms => { if (settings.vibration && navigator.vibrate) navigator.vibrate(ms); };

// ---- saving -------------------------------------------------------------

function saveGame() {
  if (!level || done) return;
  storage(KEYS.game, JSON.stringify({ v: 1, id: level.id, puzzle, solution, boardState, notes: notesToJSON(), seconds, checks, history }));
}

function savedGame() {
  const game = readJSON(KEYS.game);
  return game && game.v === 1 && levels.some(item => item.id === game.id) ? game : null;
}

function resumeGame(game) {
  level = levels.find(item => item.id === game.id);
  puzzle = game.puzzle; solution = game.solution; boardState = game.boardState;
  notes = notesFromJSON(game.notes); seconds = game.seconds; checks = game.checks; history = game.history || [];
  selected = null; picked = 0; done = false; reveal = false; litLines = new Set();
  setHint("hint.start"); show("play"); render();
}

function startLevel(next) {
  const fresh = Sudoku.variant(next.puzzle, next.solution, Math.random() * 2 ** 32 | 0);
  level = next; puzzle = fresh.puzzle; solution = fresh.solution;
  boardState = puzzle.map(row => row.slice());
  notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, emptyNotes));
  selected = null; picked = 0; done = false; checks = 3; reveal = false; seconds = 0; history = []; litLines = new Set();
  setHint("hint.start");
  show("play"); render(); saveGame();
}

// The clock only runs while the board is on screen and the page is visible.
setInterval(() => {
  if (screen !== "play" || done || document.hidden || !level) return;
  seconds++; renderStatus();
  if (seconds % 5 === 0) saveGame();
}, 1000);
document.addEventListener("visibilitychange", () => { if (document.hidden) saveGame(); });

// ---- rendering ----------------------------------------------------------

function renderStatus() {
  $("timer").textContent = I18n.time(seconds);
  const check = $("check");
  check.textContent = checks ? t("play.check", { count: checks }) : t("play.noChecks");
  check.disabled = !checks;
}

function renderLevels() {
  $("levels-list").innerHTML = levels.map((item, index) => {
    const detail = item.open ? t("level.clues", { count: Sudoku.clues(item.puzzle) }) : t("level.lockedNote");
    return `<button class="level" data-level="${index}" ${item.open ? "" : "disabled"}><span><b>${levelName(item)}</b><small>${detail}</small></span><span>${t(item.open ? "level.start" : "level.locked")}</span></button>`;
  }).join("");
  $("session").textContent = finished
    ? t("home.finished", { count: finished })
    : t("home.openCount", { count: levels.filter(item => item.open).length });
  const game = done ? null : savedGame();
  $("continue").hidden = !game;
  if (game) $("continue-detail").textContent = t("home.continueDetail", { level: levelName(game), time: I18n.time(game.seconds) });
}

function cellLabel(r, c, wrong) {
  const value = boardState[r][c], place = { row: r + 1, col: c + 1, value };
  const label = !value ? t("play.cellEmpty", place) : t(puzzle[r][c] ? "play.cellGiven" : "play.cellValue", place);
  return wrong ? t("play.cellWrong", { label }) : label;
}

function render() {
  const hadFocus = board.contains(document.activeElement);
  board.innerHTML = "";
  const value = selected ? boardState[selected[0]][selected[1]] : picked;
  const focusCell = selected || [0, 0];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    const button = document.createElement("button");
    const here = boardState[r][c];
    const cell = notes[r][c];
    const wrong = (reveal || settings.showMistakes) && here && here !== solution[r][c];
    button.className = `cell r${r + 1} c${c + 1}${puzzle[r][c] ? " given" : ""}`;
    button.tabIndex = r === focusCell[0] && c === focusCell[1] ? 0 : -1;
    button.setAttribute("aria-label", cellLabel(r, c, wrong));
    if (!here && !noNotes(cell)) button.innerHTML = `<span class="notes" aria-hidden="true">${[1,2,3,4,5,6,7,8,9].map(n => `<i class="${cell.no.has(n) ? "no" : ""}">${cell.yes.has(n) || cell.no.has(n) ? n : ""}</i>`).join("")}</span>`;
    else button.textContent = here || "";
    if (selected && (r === selected[0] || c === selected[1] || Sudoku.box(r, c) === Sudoku.box(...selected))) button.classList.add("peer");
    if (selected && r === selected[0] && c === selected[1]) button.classList.add("selected");
    if (value && here === value) button.classList.add("same");
    if (wrong) button.classList.add("bad");
    if (lineComplete(r, true) || lineComplete(c, false)) button.classList.add("lit");
    if (litLines.has("r" + r)) button.style.animationDelay = `${c * 34}ms`;
    if (litLines.has("c" + c)) button.style.animationDelay = `${((litLines.has("r" + r) ? 9 : 0) + r) * 34}ms`;
    if (litLines.has("r" + r) || litLines.has("c" + c)) button.classList.add("strike");
    button.onclick = () => select(r, c);
    board.appendChild(button);
  }
  if (hadFocus) board.children[focusCell[0] * 9 + focusCell[1]].focus();
  litLines.clear(); renderStatus();
  document.querySelectorAll(".num").forEach(button => {
    const n = Number(button.textContent);
    const full = digitFull(n);
    button.classList.toggle("picked", n === value && !full);
    button.classList.toggle("full", full);
    button.disabled = full;
  });
}

// ---- moves --------------------------------------------------------------

function select(r, c) {
  if (done) return;
  selected = [r, c]; picked = boardState[r][c]; render();
}

function snapshot() {
  history.push(JSON.stringify({ boardState, notes: notesToJSON() }));
  if (history.length > 80) history.shift();
}

// Placing n removes it from the notes of every cell that shares a row, column or box.
function clearPeerNotes(r, c, n) {
  for (let rr = 0; rr < 9; rr++) for (let cc = 0; cc < 9; cc++) {
    if (rr === r || cc === c || Sudoku.box(rr, cc) === Sudoku.box(r, c)) notes[rr][cc].yes.delete(n);
  }
}

function place(n) {
  if (n && digitFull(n)) return;
  if (!selected || done || puzzle[selected[0]][selected[1]]) { picked = n; render(); return; }
  if ((noteMode || forbidMode) && n) { picked = n; writeNote(); return; }
  const [r, c] = selected;
  if (!n && !boardState[r][c] && noNotes(notes[r][c])) return;
  snapshot();
  boardState[r][c] = n; notes[r][c] = emptyNotes(); picked = n;
  if (n && settings.autoNotes) clearPeerNotes(r, c, n);
  reveal = false;
  const fresh = [["r" + r, lineComplete(r, true)], ["c" + c, lineComplete(c, false)]];
  fresh.forEach(([key, complete]) => { if (complete) litLines.add(key); });
  if (n) { Sound.tap(); vibrate(8); }
  fresh.forEach(([, complete]) => { if (complete) { Sound.piano(9); vibrate(25); } });
  render(); board.children[r * 9 + c].classList.add("pop");
  if (Sudoku.isFull(boardState)) Sudoku.matches(boardState, solution) ? win() : fullButWrong();
  saveGame();
}

function undo() {
  const previous = history.pop(); if (!previous || done) return;
  const state = JSON.parse(previous); boardState = state.boardState;
  notes = notesFromJSON(state.notes);
  setHint("hint.undo");
  render(); saveGame();
}

function renderWin() {
  $("win-time").textContent = `${t("win.time", { time: I18n.time(seconds) })} · ${t("home.finished", { count: finished })}`;
}

function win() {
  done = true; finished++; Sound.finish(); vibrate([30, 40, 30]);
  storage(KEYS.game, null);
  renderWin();
  $("mini-board").innerHTML = boardState.flat().map((value, index) => `<i class="r${(index / 9 | 0) + 1} c${index % 9 + 1}">${value}</i>`).join("");
  $("confetti").innerHTML = Array.from({ length: 26 }, (_, index) => `<b style="--x:${8 + (index * 37) % 86}%;--d:${index % 7 * .08}s;--r:${index % 2 ? 1 : -1}"></b>`).join("");
  $("veil").classList.add("on");
  $("again").focus();
}

function inspectBoard() {
  if (!checks || done) return;
  checks--; reveal = true;
  const wrong = Sudoku.wrongCount(boardState, solution);
  wrong ? setHint("hint.wrong", { count: wrong }) : setHint("hint.allGood");
  render(); saveGame();
}

function fullButWrong() {
  setHint("hint.fullWrong");
  vibrate([20, 60, 20]);
  board.classList.remove("shake"); void board.offsetWidth; board.classList.add("shake");
}

function toggleNotes() {
  noteMode = !noteMode; if (noteMode) forbidMode = false;
  $("forbid").classList.remove("on");
  $("notes").classList.toggle("on", noteMode);
  setHint(noteMode ? "hint.notesOn" : "hint.normal");
}

function toggleForbid() {
  forbidMode = !forbidMode; if (forbidMode) noteMode = false;
  $("notes").classList.remove("on");
  $("forbid").classList.toggle("on", forbidMode);
  setHint(forbidMode ? "hint.forbidOn" : "hint.normal");
}

function writeNote() {
  if (!selected || done || puzzle[selected[0]][selected[1]] || !picked) { setHint("hint.pickFirst"); return; }
  const [r, c] = selected; snapshot();
  const keep = forbidMode ? notes[r][c].no : notes[r][c].yes;
  const other = forbidMode ? notes[r][c].yes : notes[r][c].no;
  if (boardState[r][c]) notes[r][c].yes.add(boardState[r][c]);
  other.delete(picked);
  keep.has(picked) ? keep.delete(picked) : keep.add(picked);
  boardState[r][c] = 0;
  setHint(forbidMode ? "hint.forbidAdded" : "hint.noteAdded");
  Sound.tap(); render(); saveGame();
}

function clearNotes() {
  if (done || notes.every(row => row.every(noNotes))) return;
  snapshot();
  notes.forEach(row => row.forEach(cell => { cell.yes.clear(); cell.no.clear(); }));
  setHint("hint.notesCleared");
  render(); saveGame();
}

// ---- screens and settings -----------------------------------------------

function show(name) {
  if (name !== "settings") returnTo = name;
  screen = name;
  document.querySelectorAll(".screen").forEach(section => section.classList.toggle("on", section.id === name));
  $("back").hidden = name === "levels";
  $("gear").hidden = name === "settings";
  $("crumb").textContent = name === "settings" ? t("settings.title") : name === "levels" || !level ? t("nav.chooseLevel") : levelName(level);
  if (level) $("level-name").textContent = levelName(level);
  if (name === "levels") renderLevels();
}

function goBack() {
  if (screen === "settings") { show(returnTo); if (returnTo === "play") render(); return; }
  saveGame(); show("levels");
}

function renderSettings() {
  Object.keys(DEFAULTS).forEach(key => { $(`set-${key}`).checked = settings[key]; });
  Sound.muted = !settings.sound;
  const button = $("sound");
  button.classList.toggle("off", Sound.muted);
  button.textContent = Sound.muted ? "×" : "♪";
  button.setAttribute("aria-label", t(Sound.muted ? "sound.unmute" : "sound.mute"));
}

function changeSetting(key, value) {
  settings[key] = value;
  storage(KEYS.settings, JSON.stringify(settings));
  renderSettings();
}

// Re-renders every piece of visible text in the current language, keeping game state.
function applyLanguage(code) {
  I18n.set(code);
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-aria]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
  $("lang").value = I18n.current();
  $("hint").textContent = t(hint.key, hint.params);
  renderSettings(); show(screen);
  if (puzzle) render();
  if (done && $("veil").classList.contains("on")) renderWin();
}

// ---- keyboard -----------------------------------------------------------

const MOVES = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
document.addEventListener("keydown", event => {
  if (screen !== "play" || done || event.altKey || event.metaKey || event.target.tagName === "SELECT") return;
  const key = event.key, lower = key.toLowerCase();
  if (event.ctrlKey) { if (lower === "z") { event.preventDefault(); undo(); } return; }
  if (MOVES[key]) {
    event.preventDefault();
    const [r, c] = selected || [0, 0], [dr, dc] = selected ? MOVES[key] : [0, 0];
    select((r + dr + 9) % 9, (c + dc + 9) % 9);
    board.children[selected[0] * 9 + selected[1]].focus();
  } else if (/^[1-9]$/.test(key)) place(Number(key));
  else if (key === "Backspace" || key === "Delete" || key === "0") { event.preventDefault(); place(0); }
  else if (lower === "n") toggleNotes();
  else if (lower === "x") toggleForbid();
  else if (lower === "z") undo();
});

// ---- wiring -------------------------------------------------------------

$("lang").innerHTML = I18n.supported().map(code => `<option value="${code}">${I18n.meta(code).name}</option>`).join("");
$("lang").onchange = event => { storage(KEYS.lang, event.target.value); applyLanguage(event.target.value); };
Object.keys(DEFAULTS).forEach(key => { $(`set-${key}`).onchange = event => changeSetting(key, event.target.checked); });
$("set-showMistakes").addEventListener("change", () => { if (puzzle) render(); });
$("levels-list").onclick = event => { const card = event.target.closest("[data-level]"); if (card && levels[card.dataset.level].open) startLevel(levels[card.dataset.level]); };
$("continue").onclick = () => { const game = savedGame(); if (game) resumeGame(game); };
$("pad").innerHTML = [1,2,3,4,5,6,7,8,9].map(n => `<button class="num">${n}</button>`).join("");
$("pad").onclick = event => { if (event.target.classList.contains("num")) place(Number(event.target.textContent)); };
$("erase").onclick = () => place(0);
$("undo").onclick = undo;
$("check").onclick = inspectBoard;
$("notes").onclick = toggleNotes;
$("forbid").onclick = toggleForbid;
$("clear-notes").onclick = clearNotes;
$("sound").onclick = () => changeSetting("sound", !settings.sound);
$("gear").onclick = () => show("settings");
$("back").onclick = goBack;
$("again").onclick = () => { $("veil").classList.remove("on"); startLevel(level); };
$("to-levels").onclick = () => { $("veil").classList.remove("on"); show("levels"); };

applyLanguage(I18n.detect(storage(KEYS.lang), navigator.languages || [navigator.language]));

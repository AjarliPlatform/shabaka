// Game state, rendering and input. Text comes from I18n, rules from Sudoku.
const { t } = I18n;
const $ = id => document.getElementById(id);
const board = $("board");
const LANG_KEY = "nineling.lang";

let level = levels[0], puzzle, solution, boardState, notes, selected = null, picked = 0;
let done = false, noteMode = false, forbidMode = false, checks = 3, reveal = false, seconds = 0, clock = null, history = [], finished = 0;
let litLines = new Set(), screen = "levels", hint = { key: "hint.start", params: {} };

function storage(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch { return null; }
}

function setHint(key, params = {}) { hint = { key, params }; $("hint").textContent = t(key, params); }
const levelName = item => t(`level.${item.id}`);
const lineComplete = (index, isRow) => Sudoku.lineComplete(boardState, solution, index, isRow);
const digitFull = n => Sudoku.countOf(boardState, n) === 9;
const noNotes = cell => !cell.yes.size && !cell.no.size;
const emptyNotes = () => ({ yes: new Set(), no: new Set() });

function startLevel(next) {
  level = next; puzzle = next.puzzle.map(row => row.slice()); solution = next.solution;
  boardState = puzzle.map(row => row.slice());
  notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, emptyNotes));
  selected = null; picked = 0; done = false; checks = 3; reveal = false; seconds = 0; history = []; litLines = new Set();
  clearInterval(clock); clock = setInterval(() => { if (!done) { seconds++; renderStatus(); } }, 1000);
  setHint("hint.start");
  show("play"); render();
}

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
}

function render() {
  board.innerHTML = "";
  const value = selected ? boardState[selected[0]][selected[1]] : picked;
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    const button = document.createElement("button");
    const here = boardState[r][c];
    const cell = notes[r][c];
    button.className = `cell r${r + 1} c${c + 1}${puzzle[r][c] ? " given" : ""}`;
    button.setAttribute("aria-label", t("play.cell", { row: r + 1, col: c + 1 }));
    if (!here && !noNotes(cell)) button.innerHTML = `<span class="notes">${[1,2,3,4,5,6,7,8,9].map(n => `<i class="${cell.no.has(n) ? "no" : ""}">${cell.yes.has(n) || cell.no.has(n) ? n : ""}</i>`).join("")}</span>`;
    else button.textContent = here || "";
    if (selected && (r === selected[0] || c === selected[1] || Sudoku.box(r, c) === Sudoku.box(...selected))) button.classList.add("peer");
    if (selected && r === selected[0] && c === selected[1]) button.classList.add("selected");
    if (value && here === value) button.classList.add("same");
    if (reveal && here && here !== solution[r][c]) button.classList.add("bad");
    if (lineComplete(r, true) || lineComplete(c, false)) button.classList.add("lit");
    if (litLines.has("r" + r)) button.style.animationDelay = `${c * 34}ms`;
    if (litLines.has("c" + c)) button.style.animationDelay = `${((litLines.has("r" + r) ? 9 : 0) + r) * 34}ms`;
    if (litLines.has("r" + r) || litLines.has("c" + c)) button.classList.add("strike");
    button.onclick = () => { if (!done) { selected = [r, c]; picked = here; render(); } };
    board.appendChild(button);
  }
  litLines.clear(); renderStatus();
  document.querySelectorAll(".num").forEach(button => {
    const n = Number(button.textContent);
    const full = digitFull(n);
    button.classList.toggle("picked", n === value && !full);
    button.classList.toggle("full", full);
    button.disabled = full;
  });
}

function snapshot() {
  history.push(JSON.stringify({ boardState, notes: notes.map(row => row.map(cell => ({ yes: [...cell.yes], no: [...cell.no] }))) }));
  if (history.length > 80) history.shift();
}

function place(n) {
  if (n && digitFull(n)) return;
  if (!selected || done || puzzle[selected[0]][selected[1]]) { picked = n; render(); return; }
  if ((noteMode || forbidMode) && n) { picked = n; writeNote(); return; }
  const [r, c] = selected;
  if (!n && !boardState[r][c] && noNotes(notes[r][c])) return;
  snapshot();
  boardState[r][c] = n; notes[r][c] = emptyNotes(); picked = n;
  reveal = false;
  const fresh = [["r" + r, lineComplete(r, true)], ["c" + c, lineComplete(c, false)]];
  fresh.forEach(([key, complete]) => { if (complete) litLines.add(key); });
  if (n) Sound.tap();
  fresh.forEach(([, complete]) => { if (complete) Sound.piano(9); });
  render(); board.children[r * 9 + c].classList.add("pop");
  if (Sudoku.isFull(boardState)) Sudoku.matches(boardState, solution) ? win() : fullButWrong();
}

function undo() {
  const previous = history.pop(); if (!previous || done) return;
  const state = JSON.parse(previous); boardState = state.boardState;
  notes = state.notes.map(row => row.map(cell => ({ yes: new Set(cell.yes), no: new Set(cell.no) })));
  setHint("hint.undo");
  render();
}

function renderWin() {
  $("win-time").textContent = `${t("win.time", { time: I18n.time(seconds) })} · ${t("home.finished", { count: finished })}`;
}

function win() {
  done = true; finished++; clearInterval(clock); Sound.finish();
  renderWin();
  $("mini-board").innerHTML = boardState.flat().map((value, index) => `<i class="r${(index / 9 | 0) + 1} c${index % 9 + 1}">${value}</i>`).join("");
  $("confetti").innerHTML = Array.from({ length: 26 }, (_, index) => `<b style="--x:${8 + (index * 37) % 86}%;--d:${index % 7 * .08}s;--r:${index % 2 ? 1 : -1}"></b>`).join("");
  $("veil").classList.add("on");
}

function inspectBoard() {
  if (!checks || done) return;
  checks--; reveal = true;
  const wrong = Sudoku.wrongCount(boardState, solution);
  wrong ? setHint("hint.wrong", { count: wrong }) : setHint("hint.allGood");
  render();
}

function fullButWrong() {
  setHint("hint.fullWrong");
  board.classList.remove("shake"); void board.offsetWidth; board.classList.add("shake");
}

function show(name) {
  screen = name;
  document.querySelectorAll(".screen").forEach(section => section.classList.toggle("on", section.id === name));
  $("back").hidden = name === "levels";
  $("crumb").textContent = name === "levels" ? t("nav.chooseLevel") : levelName(level);
  $("level-name").textContent = levelName(level);
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
  Sound.tap(); render();
}

function clearNotes() {
  if (done || notes.every(row => row.every(noNotes))) return;
  snapshot();
  notes.forEach(row => row.forEach(cell => { cell.yes.clear(); cell.no.clear(); }));
  setHint("hint.notesCleared");
  render();
}

function renderSound() {
  const button = $("sound");
  button.classList.toggle("off", Sound.muted);
  button.textContent = Sound.muted ? "×" : "♪";
  button.setAttribute("aria-label", t(Sound.muted ? "sound.unmute" : "sound.mute"));
}

// Re-renders every piece of visible text in the current language, keeping game state.
function applyLanguage(code) {
  I18n.set(code);
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-aria]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
  $("lang").value = I18n.current();
  $("hint").textContent = t(hint.key, hint.params);
  renderSound(); renderLevels(); show(screen);
  if (puzzle) render();
  if (done && $("veil").classList.contains("on")) renderWin();
}

$("lang").innerHTML = I18n.supported().map(code => `<option value="${code}">${I18n.meta(code).name}</option>`).join("");
$("lang").onchange = event => { storage(LANG_KEY, event.target.value); applyLanguage(event.target.value); };
$("levels-list").onclick = event => { const card = event.target.closest("[data-level]"); if (card && levels[card.dataset.level].open) startLevel(levels[card.dataset.level]); };
$("pad").innerHTML = [1,2,3,4,5,6,7,8,9].map(n => `<button class="num">${n}</button>`).join("");
$("pad").onclick = event => { if (event.target.classList.contains("num")) place(Number(event.target.textContent)); };
$("erase").onclick = () => place(0);
$("undo").onclick = undo;
$("check").onclick = inspectBoard;
$("notes").onclick = toggleNotes;
$("forbid").onclick = toggleForbid;
$("clear-notes").onclick = clearNotes;
$("sound").onclick = () => { Sound.muted = !Sound.muted; renderSound(); };
$("back").onclick = () => { clearInterval(clock); done = true; show("levels"); };
$("again").onclick = () => { $("veil").classList.remove("on"); renderLevels(); show("levels"); };

applyLanguage(I18n.detect(storage(LANG_KEY), navigator.languages || [navigator.language]));

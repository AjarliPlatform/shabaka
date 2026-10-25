const easy = levels[0];
let level = easy, puzzle, solution, boardState, notes, selected = null, picked = 0;
let done = false, noteMode = false, forbidMode = false, checks = 3, reveal = false, seconds = 0, clock = null, history = [], finished = 0;
let litLines = new Set(), muted = false, audio = null;
const board = document.getElementById("board");
const num = value => String(value).replace(/\d/g, digit => "٠١٢٣٤٥٦٧٨٩"[digit]);
const ar = value => num(String(value).padStart(2, "0"));

function tone(freq, at, length, volume) {
  if (muted) return;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  try { audio = audio || new Context(); } catch { return; }
  const osc = audio.createOscillator(), gain = audio.createGain();
  osc.frequency.value = freq; osc.type = "sine";
  gain.gain.setValueAtTime(volume, audio.currentTime + at);
  gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + at + length);
  osc.connect(gain).connect(audio.destination);
  osc.start(audio.currentTime + at); osc.stop(audio.currentTime + at + length);
}
const tapSound = () => tone(520, 0, .07, .035);
const pianoSound = count => { for (let i = 0; i < count; i++) tone(494 + i * 42, i * .034, .09, .03); };
const finishSound = () => [523, 659, 784].forEach((freq, i) => tone(freq, i * .09, .18, .04));
function box(r, c) { return `${r / 3 | 0},${c / 3 | 0}`; }
function lineComplete(index, row) {
  for (let i = 0; i < 9; i++) {
    const value = row ? boardState[index][i] : boardState[i][index];
    const answer = row ? solution[index][i] : solution[i][index];
    if (value !== answer) return false;
  }
  return true;
}
function startLevel(next) {
  level = next; puzzle = next.puzzle.map(row => row.slice()); solution = next.solution;
  boardState = puzzle.map(row => row.slice());
  notes = Array.from({length:9}, () => Array.from({length:9}, () => ({yes:new Set(), no:new Set()})));
  selected = null; picked = 0; done = false; checks = 3; reveal = false; seconds = 0; history = []; litLines = new Set();
  clearInterval(clock); clock = setInterval(() => { if (!done) { seconds++; renderStatus(); } }, 1000);
  document.getElementById("level-name").textContent = next.name;
  document.getElementById("hint").textContent = "اختار خانة، وبعدين رقم.";
  show("play"); render();
}
function renderStatus() {
  document.getElementById("timer").textContent = `${ar(seconds / 60 | 0)}:${ar(seconds % 60)}`;
  const check = document.getElementById("check");
  check.textContent = checks ? `افحص · ${"٠١٢٣"[checks]}` : "خلصت الفحص";
  check.disabled = !checks;
}
function renderLevels() {
  document.getElementById("levels-list").innerHTML = levels.map((item, index) => `<button class="level" data-level="${index}" ${item.open ? "" : "disabled"}><span><b>${item.name}</b><small>${item.open ? `${item.clues} رقم ظاهر` : item.note}</small></span><span>${item.open ? "ابدأ" : "مقفول"}</span></button>`).join("");
  const open = levels.filter(item => item.open).length;
  document.getElementById("session").textContent = finished ? `خلّصت ${num(finished)} في الجلسة دي` : `${num(open)} مستويات مفتوحة دلوقتي.`;
}
function render() {
  board.innerHTML = "";
  const value = selected ? boardState[selected[0]][selected[1]] : picked;
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    const button = document.createElement("button");
    const here = boardState[r][c];
    button.className = `cell r${r + 1} c${c + 1}${puzzle[r][c] ? " given" : ""}`;
    button.setAttribute("aria-label", `صف ${r + 1} عمود ${c + 1}`);
    if (!here && (notes[r][c].yes.size || notes[r][c].no.size)) button.innerHTML = `<span class="notes">${[1,2,3,4,5,6,7,8,9].map(n => `<i class="${notes[r][c].no.has(n) ? "no" : ""}">${notes[r][c].yes.has(n) || notes[r][c].no.has(n) ? n : ""}</i>`).join("")}</span>`;
    else button.textContent = here || "";
    if (selected && (r === selected[0] || c === selected[1] || box(r, c) === box(...selected))) button.classList.add("peer");
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
    const full = boardState.flat().filter(value => value === n).length === 9;
    button.classList.toggle("picked", n === value && !full);
    button.classList.toggle("full", full);
    button.disabled = full;
  });
}
function snapshot() { history.push(JSON.stringify({boardState, notes:notes.map(row => row.map(cell => ({yes:[...cell.yes], no:[...cell.no]})))})); if (history.length > 80) history.shift(); }
function place(n) {
  if (n && boardState.flat().filter(value => value === n).length === 9) return;
  if (!selected || done || puzzle[selected[0]][selected[1]]) { picked = n; render(); return; }
  if ((noteMode || forbidMode) && n) { picked = n; writeNote(); return; }
  const [r, c] = selected;
  if (!n && !boardState[r][c] && !notes[r][c].yes.size && !notes[r][c].no.size) return;
  snapshot();
  boardState[r][c] = n; notes[r][c] = {yes:new Set(), no:new Set()}; picked = n;
  reveal = false;
  const fresh = [["r" + r, lineComplete(r, true)], ["c" + c, lineComplete(c, false)]];
  fresh.forEach(([key, complete]) => { if (complete) litLines.add(key); });
  if (n) tapSound(); fresh.forEach(([key, complete]) => { if (complete) pianoSound(9); });
  render(); board.children[r * 9 + c].classList.add("pop");
  const filled = boardState.every(row => row.every(Boolean));
  const correct = boardState.every((row, rr) => row.every((value, cc) => value === solution[rr][cc]));
  if (filled && correct) win();
  else if (filled) fullButWrong();
}
function undo() {
  const previous = history.pop(); if (!previous || done) return;
  const state = JSON.parse(previous); boardState = state.boardState;
  notes = state.notes.map(row => row.map(cell => ({yes:new Set(cell.yes), no:new Set(cell.no)})));
  document.getElementById("hint").textContent = "رجعت آخر حركة، والملاحظات رجعت معاها.";
  render();
}
function win() {
  done = true; finished++; clearInterval(clock); finishSound();
  document.getElementById("win-time").textContent = `الوقت ${document.getElementById("timer").textContent} · خلّصت ${num(finished)} في الجلسة`;
  document.getElementById("mini-board").innerHTML = boardState.flat().map((value, index) => `<i class="r${(index / 9 | 0) + 1} c${index % 9 + 1}">${value}</i>`).join("");
  const confetti = document.getElementById("confetti");
  confetti.innerHTML = Array.from({length:26}, (_, index) => `<b style="--x:${8 + (index * 37) % 86}%;--d:${index % 7 * .08}s;--r:${index % 2 ? 1 : -1}"></b>`).join("");
  document.getElementById("veil").classList.add("on");
}
function inspectBoard() {
  if (!checks || done) return;
  checks--; reveal = true;
  const wrong = boardState.flat().filter((value, index) => value && value !== solution[index / 9 | 0][index % 9]).length;
  document.getElementById("hint").textContent = wrong ? `فيه ${num(wrong)} خارج مكانه.` : "اللي كتبته لحد دلوقتي سليم.";
  render();
}
function fullButWrong() {
  document.getElementById("hint").textContent = "الشبكة اتملت بس فيها غلط. دوّر عليه أو استخدم الفحص.";
  board.classList.remove("shake"); void board.offsetWidth; board.classList.add("shake");
}
function show(name) {
  document.querySelectorAll(".screen").forEach(screen => screen.classList.toggle("on", screen.id === name));
  document.getElementById("back").hidden = name === "levels";
  document.getElementById("crumb").textContent = name === "levels" ? "اختار مستوى" : level.name;
}
document.getElementById("levels-list").onclick = event => { const card = event.target.closest("[data-level]"); if (card && levels[card.dataset.level].open) startLevel(levels[card.dataset.level]); };
document.getElementById("pad").innerHTML = [1,2,3,4,5,6,7,8,9].map(n => `<button class="num">${n}</button>`).join("");
document.getElementById("pad").onclick = event => { if (event.target.classList.contains("num")) place(Number(event.target.textContent)); };
document.getElementById("erase").onclick = () => place(0);
document.getElementById("undo").onclick = undo;
document.getElementById("check").onclick = inspectBoard;
function toggleNotes() {
  noteMode = !noteMode; if (noteMode) forbidMode = false;
  document.getElementById("forbid").classList.remove("on");
  document.getElementById("notes").classList.toggle("on", noteMode);
  document.getElementById("hint").textContent = noteMode ? "الملاحظات شغالة." : "رجعت للرقم الكامل.";
}
function toggleForbid() {
  forbidMode = !forbidMode; if (forbidMode) noteMode = false;
  document.getElementById("notes").classList.remove("on");
  document.getElementById("forbid").classList.toggle("on", forbidMode);
  document.getElementById("hint").textContent = forbidMode ? "الرقم هيتشطب كممنوع." : "رجعت للرقم الكامل.";
}
function writeNote() {
  if (!selected || done || puzzle[selected[0]][selected[1]] || !picked) { document.getElementById("hint").textContent = "اختار خانة ورقم الأول."; return; }
  const [r, c] = selected; snapshot();
  const keep = forbidMode ? notes[r][c].no : notes[r][c].yes;
  const other = forbidMode ? notes[r][c].yes : notes[r][c].no;
  if (boardState[r][c]) notes[r][c].yes.add(boardState[r][c]);
  other.delete(picked);
  keep.has(picked) ? keep.delete(picked) : keep.add(picked);
  boardState[r][c] = 0;
  document.getElementById("hint").textContent = forbidMode ? "الرقم اتعلم كممنوع." : "الملاحظة اتضافت.";
  tapSound(); render();
}
document.getElementById("notes").onclick = toggleNotes;
document.getElementById("forbid").onclick = toggleForbid;
document.getElementById("clear-notes").onclick = () => {
  if (done || !notes.some(row => row.some(cell => cell.yes.size || cell.no.size))) return;
  snapshot();
  notes.forEach(row => row.forEach(cell => { cell.yes.clear(); cell.no.clear(); }));
  document.getElementById("hint").textContent = "كل الملاحظات اتمسحت.";
  render();
};
document.getElementById("sound").onclick = () => { muted = !muted; const button = document.getElementById("sound"); button.classList.toggle("off", muted); button.textContent = muted ? "×" : "♪"; button.setAttribute("aria-label", muted ? "تشغيل الصوت" : "كتم الصوت"); };
document.getElementById("back").onclick = () => { clearInterval(clock); done = true; show("levels"); };
document.getElementById("again").onclick = () => { document.getElementById("veil").classList.remove("on"); renderLevels(); show("levels"); };
renderLevels();

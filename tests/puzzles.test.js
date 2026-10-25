const test = require("node:test");
const assert = require("node:assert/strict");
const Sudoku = require("../js/sudoku.js");
const levels = require("../js/levels.js");

for (const level of levels.filter(item => item.open)) {
  test(`${level.id}: solution is a valid Sudoku`, () => {
    assert.ok(Sudoku.isValidSolution(level.solution.map(row => row.slice())));
  });
  test(`${level.id}: givens match the solution`, () => {
    level.puzzle.forEach((row, r) => row.forEach((value, c) => {
      if (value) assert.equal(value, level.solution[r][c], `cell ${r},${c}`);
    }));
  });
  test(`${level.id}: has exactly one solution`, () => {
    assert.equal(Sudoku.countSolutions(level.puzzle, 2), 1);
  });
}

test("levels have unique ids and locked levels carry no puzzle", () => {
  assert.equal(new Set(levels.map(item => item.id)).size, levels.length);
  levels.filter(item => !item.open).forEach(item => assert.equal(item.puzzle, undefined));
});

test("variants keep a valid, unique solution and the same number of givens", () => {
  for (const level of levels.filter(item => item.open)) {
    for (let seed = 1; seed <= 12; seed++) {
      const { puzzle, solution } = Sudoku.variant(level.puzzle, level.solution, seed * 7919);
      assert.ok(Sudoku.isValidSolution(solution.map(row => row.slice())), `${level.id} seed ${seed}`);
      puzzle.forEach((row, r) => row.forEach((value, c) => { if (value) assert.equal(value, solution[r][c]); }));
      assert.equal(Sudoku.clues(puzzle), Sudoku.clues(level.puzzle));
      assert.equal(Sudoku.countSolutions(puzzle, 2), 1);
    }
  }
});

test("the same seed gives the same variant, different seeds differ", () => {
  const [level] = levels;
  const a = Sudoku.variant(level.puzzle, level.solution, 42), b = Sudoku.variant(level.puzzle, level.solution, 42);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.puzzle, Sudoku.variant(level.puzzle, level.solution, 43).puzzle);
});

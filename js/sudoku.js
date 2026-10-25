// Pure Sudoku rules, shared by the game and the tests. No DOM access here.
(function (root) {
  const box = (r, c) => `${r / 3 | 0},${c / 3 | 0}`;
  const clues = puzzle => puzzle.flat().filter(Boolean).length;
  const countOf = (grid, n) => grid.flat().filter(value => value === n).length;
  const isFull = grid => grid.every(row => row.every(Boolean));
  const matches = (grid, solution) => grid.every((row, r) => row.every((value, c) => value === solution[r][c]));

  function lineComplete(grid, solution, index, isRow) {
    for (let i = 0; i < 9; i++) {
      const value = isRow ? grid[index][i] : grid[i][index];
      const answer = isRow ? solution[index][i] : solution[i][index];
      if (value !== answer) return false;
    }
    return true;
  }

  function wrongCount(grid, solution) {
    return grid.flat().filter((value, index) => value && value !== solution[index / 9 | 0][index % 9]).length;
  }

  function canPlace(grid, r, c, n) {
    for (let i = 0; i < 9; i++) if (grid[r][i] === n || grid[i][c] === n) return false;
    const br = r - r % 3, bc = c - c % 3;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (grid[br + i][bc + j] === n) return false;
    return true;
  }

  // Counts solutions up to `limit`, so uniqueness checks stop early.
  function countSolutions(puzzle, limit = 2) {
    const grid = puzzle.map(row => row.slice());
    function walk() {
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
        if (grid[r][c]) continue;
        let found = 0;
        for (let n = 1; n <= 9 && found < limit; n++) {
          if (!canPlace(grid, r, c, n)) continue;
          grid[r][c] = n; found += walk(); grid[r][c] = 0;
        }
        return found;
      }
      return 1;
    }
    return walk();
  }

  function isValidSolution(solution) {
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      const n = solution[r][c];
      if (!(n >= 1 && n <= 9)) return false;
      solution[r][c] = 0;
      const ok = canPlace(solution, r, c, n);
      solution[r][c] = n;
      if (!ok) return false;
    }
    return true;
  }

  const Sudoku = { box, clues, countOf, isFull, matches, lineComplete, wrongCount, canPlace, countSolutions, isValidSolution };
  root.Sudoku = Sudoku;
  if (typeof module !== "undefined") module.exports = Sudoku;
})(typeof window !== "undefined" ? window : globalThis);

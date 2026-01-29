/**
 * Knuth-Morris-Pratt (KMP) string matching.
 * Mengembalikan jumlah kemunculan pattern di text + beberapa posisi awal (untuk snippet).
 */

function buildLps(pattern) {
  const m = pattern.length;
  const lps = new Array(m).fill(0);

  let len = 0; 
  let i = 1;

  while (i < m) {
    if (pattern[i] === pattern[len]) {
      len++;
      lps[i] = len;
      i++;
    } else {
      if (len !== 0) {
        len = lps[len - 1];
      } else {
        lps[i] = 0;
        i++;
      }
    }
  }

  return lps;
}

/**
 * @param {string} text
 * @param {string} pattern
 * @param {{ maxPositions?: number }} [opts]
 * @returns {{ count: number, positions: number[] }}
 */
function kmpSearchAll(text, pattern, opts = {}) {
  const maxPositions = Number.isFinite(opts.maxPositions) ? opts.maxPositions : 10;
  const n = text.length;
  const m = pattern.length;

  if (m === 0) return { count: 0, positions: [] };
  if (n === 0 || m > n) return { count: 0, positions: [] };

  const lps = buildLps(pattern);
  const positions = [];
  let count = 0;

  let i = 0; // index text
  let j = 0; // index pattern

  while (i < n) {
    if (text[i] === pattern[j]) {
      i++;
      j++;

      if (j === m) {
        count++;
        const pos = i - j;
        if (positions.length < maxPositions) positions.push(pos);
        j = lps[j - 1];
      }
    } else {
      if (j !== 0) {
        j = lps[j - 1];
      } else {
        i++;
      }
    }
  }

  return { count, positions };
}

module.exports = { buildLps, kmpSearchAll };

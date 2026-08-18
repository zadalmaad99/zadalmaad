// Where each line sits inside the printed mushaf page images, so a ruler
// can be drawn under the line being recited without replacing the original
// artwork. Measured directly off the page PNGs (1260x2038) by scanning for
// rows of dark pixels, not guessed.
export const PAGE_W = 1260;
export const PAGE_H = 2038;

// Pages 3-604 share one grid: line 2's baseline sits at 270px and every
// following line is 132.5px lower (max drift against the measured pages is
// ~3px, well under the ruler's own thickness).
const GRID_ORIGIN = 270;
const GRID_STEP = 132.5;

// The opening two pages are typeset differently — a large ornamental
// banner, then fewer, tighter lines occupying only the upper half. Their
// baselines are listed outright, keyed by the API's line_number.
const SPECIAL = {
  1: { 9: 330, 10: 435, 11: 549, 12: 656, 13: 766, 14: 877, 15: 982 },
  2: { 10: 437, 11: 548, 12: 658, 13: 765, 14: 879, 15: 980 },
};

// Baseline of a line, in image pixels from the top.
export function baselineFor(page, line) {
  const special = SPECIAL[page];
  if (special) return special[line] ?? null;
  return GRID_ORIGIN + (line - 2) * GRID_STEP;
}

// Same, as a 0..1 fraction of page height — what the overlay positions with.
export function baselineFraction(page, line) {
  const y = baselineFor(page, line);
  return y == null ? null : y / PAGE_H;
}

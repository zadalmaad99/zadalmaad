const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const dir = "C:/Users/mathe/AppData/Local/Temp/claude/D--My-Projects-quran-tracker/87ae42a2-10ec-4cb9-890b-51ddf897523b/scratchpad/pages";

function bands(file) {
  const png = PNG.sync.read(fs.readFileSync(path.join(dir, file)));
  const { width, height, data } = png;
  const rows = new Array(height).fill(0);
  for (let y = 0; y < height; y++) {
    let dark = 0;
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      const lum = a < 40 ? 255 : (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (lum < 140) dark++;
    }
    rows[y] = dark;
  }
  const thr = 3;
  const out = [];
  let start = null;
  for (let y = 0; y < height; y++) {
    if (rows[y] > thr && start === null) start = y;
    else if (rows[y] <= thr && start !== null) {
      if (y - start > 8) out.push([start, y]);
      start = null;
    }
  }
  if (start !== null) out.push([start, height]);
  return { width, height, out };
}

for (const f of fs.readdirSync(dir)) {
  const { width, height, out } = bands(f);
  console.log(`\n== ${f}  ${width}x${height}  bands=${out.length}`);
  out.forEach((b, i) => console.log(`  line ${i + 1}: ${b[0]}..${b[1]}  (h=${b[1] - b[0]})`));
}

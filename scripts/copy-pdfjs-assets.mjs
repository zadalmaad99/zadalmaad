import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// pdf.js can't render a PDF whose fonts aren't embedded (Arial, Times New
// Roman, ...) unless it can load its own substitute font data, and Type0 /
// Identity-H text needs the CMap tables. Without them Arabic loses its
// letter joining and comes out scrambled. These ship inside pdfjs-dist but
// have to be served as static files, so mirror them into public/ — they're
// fetched on demand, never bundled into the JS.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const from = resolve(root, "node_modules/pdfjs-dist");
const to = resolve(root, "public/pdfjs");

await mkdir(to, { recursive: true });
for (const dir of ["cmaps", "standard_fonts"]) {
  await cp(resolve(from, dir), resolve(to, dir), { recursive: true });
}
console.log("pdf.js cmaps + standard_fonts copied to public/pdfjs");

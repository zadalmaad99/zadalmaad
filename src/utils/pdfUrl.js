// People naturally copy the URL out of the GitHub address bar, which is an
// HTML *page* wrapping the file — fetching it returns markup (or trips
// CORS), and any "open it anyway" fallback drops the reader on github.com
// instead of the PDF. Normalizing here means a wrong-but-understandable
// paste still works everywhere a PDF URL is consumed, instead of each
// admin having to know about raw links.
export function normalizePdfUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "github.com") {
      // /<owner>/<repo>/blob/<ref>/<path...>  ->  raw.githubusercontent.com
      const parts = u.pathname.split("/").filter(Boolean);
      const blobIdx = parts.indexOf("blob");
      if (blobIdx >= 2 && parts.length > blobIdx + 2) {
        const owner = parts[0];
        const repo = parts[1];
        const rest = parts.slice(blobIdx + 1).join("/");
        return `https://raw.githubusercontent.com/${owner}/${repo}/${rest}`;
      }
    }

    return url;
  } catch {
    return url;
  }
}

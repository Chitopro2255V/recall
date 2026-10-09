import type { PageText } from "./chunker";

/**
 * Extracts text from a PDF entirely in the browser.
 * The file never leaves the user's machine — only the extracted text
 * is sent to our API. No storage costs, no upload wait, better privacy.
 */
export async function extractPdfText(
  file: File,
  onPage?: (page: number, total: number) => void
): Promise<PageText[]> {
  const pdfjs = await import("pdfjs-dist");

  // pdf.js does its heavy lifting in a Web Worker. Loading it from a CDN
  // pinned to the exact installed version avoids bundler asset plumbing.
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;

  const pages: PageText[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    // Rebuild text: items are fragments; hasEOL marks visual line ends.
    // We separate lines with blank lines so the chunker treats each line
    // as a unit — chunks then never cut mid-sentence.
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue; // skip marked-content markers
      text += item.str;
      if (item.hasEOL) text += "\n\n";
    }
    pages.push({ page: i, text: text.replace(/[ \t]+/g, " ").trim() });
    onPage?.(i, doc.numPages);
  }

  return pages;
}
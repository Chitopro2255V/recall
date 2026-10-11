export type PageText = { page: number; text: string };
export type Chunk = { startPage: number; endPage: number; text: string };

const TARGET = 18_000; // ≈ 4.5k tokens — fewer Gemini calls per document // ≈ 4k tokens of material per Gemini call
const OVERLAP = 500;   // tail of previous chunk prepended, so concepts
                       // sitting on a boundary don't get cut in half

export function chunkPages(pages: PageText[]): Chunk[] {
  // 1. Flatten pages into paragraphs (the natural concept boundaries)
  const units: { page: number; text: string }[] = [];
  for (const { page, text } of pages) {
    for (const p of text.split(/\n\s*\n/)) {
      const t = p.trim();
      if (t) units.push({ page, text: t });
    }
  }

  // 2. Accumulate paragraphs into chunks up to TARGET chars
  const raw: Chunk[] = [];
  let buf: string[] = [];
  let startPage = 1;
  let endPage = 1;
  let len = 0;

  const flush = () => {
    if (!buf.length) return;
    raw.push({ startPage, endPage, text: buf.join("\n\n") });
    buf = [];
    len = 0;
  };

  for (const u of units) {
    // A single paragraph bigger than a whole chunk → hard-split it
    if (u.text.length > TARGET) {
      flush();
      for (let i = 0; i < u.text.length; i += TARGET) {
        raw.push({ startPage: u.page, endPage: u.page, text: u.text.slice(i, i + TARGET) });
      }
      continue;
    }
    if (len > 0 && len + u.text.length > TARGET) flush();
    if (len === 0) startPage = u.page;
    buf.push(u.text);
    endPage = u.page;
    len += u.text.length;
  }
  flush();

  // 3. Prepend overlap so each chunk carries context from the previous one
  return raw.map((c, i) =>
    i === 0 ? c : { ...c, text: raw[i - 1].text.slice(-OVERLAP) + "\n\n" + c.text }
  );
}
/**
 * Renders page one of a PDF to a PNG, in the browser.
 *
 * A letterhead is painted as a CSS background and no browser can paint a PDF
 * that way — so a PDF has to become an image before it is stored. Doing it here
 * rather than on the server means no PDF library in the backend, no conversion
 * queue, and the file that reaches storage is already the thing that will be
 * displayed. It also fails in front of the person who can fix it: they see the
 * page that was rendered before they commit to it.
 *
 * pdf.js is loaded on demand. It is roughly a megabyte, and most tenants upload
 * a PNG and never touch this path.
 */

/** 150 DPI. A4 lands near 1240×1754 — sharp in print, small enough to store. */
const TARGET_DPI = 150;
const PDF_POINTS_PER_INCH = 72;

export interface RenderedPage {
  blob: Blob;
  width: number;
  height: number;
  /** Page size in millimetres, so the guides can be expressed in real units. */
  widthMm: number;
  heightMm: number;
  pageCount: number;
}

export async function renderPdfFirstPage(file: File): Promise<RenderedPage> {
  const pdfjs: any = await import('pdfjs-dist');

  // Served from our own origin, copied into public/ at build time by
  // scripts/copy-pdf-worker.mjs. Bundler tricks for resolving a worker URL
  // behave differently across Next versions and fail at RUNTIME rather than at
  // build — the first customer to upload a PDF would watch it hang. A known
  // path cannot do that, and staying same-origin keeps it working under a
  // strict CSP and offline.
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);

  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: TARGET_DPI / PDF_POINTS_PER_INCH });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot render the PDF preview.');

  // PDFs have no background of their own. Without this the page renders onto
  // transparency, and a letterhead with white text would vanish against paper.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport, background: '#ffffff' }).promise;

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not convert the page to an image.'))), 'image/png'),
  );

  return {
    blob,
    width: canvas.width,
    height: canvas.height,
    // PDF user units are 1/72 inch; 25.4mm to the inch.
    widthMm: Math.round((base.width / PDF_POINTS_PER_INCH) * 25.4),
    heightMm: Math.round((base.height / PDF_POINTS_PER_INCH) * 25.4),
    pageCount: doc.numPages,
  };
}

/** Page dimensions of an image upload, so both paths report the same shape. */
export function measureImage(file: File): Promise<RenderedPage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      // An image carries no page size, so it is assumed to be one full page and
      // its aspect ratio decides the height. Guessing A4 for a square logo would
      // put the guides in the wrong place.
      const widthMm = 210;
      resolve({
        blob: file,
        width: img.naturalWidth,
        height: img.naturalHeight,
        widthMm,
        heightMm: Math.round((img.naturalHeight / img.naturalWidth) * widthMm),
        pageCount: 1,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image could not be read.'));
    };
    img.src = url;
  });
}

/** One entry point: PDFs are converted, images pass through measured. */
export async function prepareLetterhead(file: File): Promise<RenderedPage & { fileName: string }> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const page = isPdf ? await renderPdfFirstPage(file) : await measureImage(file);
  const fileName = isPdf ? file.name.replace(/\.pdf$/i, '') + '.png' : file.name;
  return { ...page, fileName };
}

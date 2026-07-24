// Exports a UI/UX mockup (an inert SVG string) as a downloadable single-page
// PDF, with zero external dependencies: the SVG is rasterized to a JPEG via an
// off-screen <canvas>, and a minimal PDF that embeds that JPEG (DCTDecode) is
// hand-assembled in the browser. Kept dependency-free on purpose so it works
// without adding a PDF library to the bundle.

interface RasterResult {
  jpeg: Uint8Array;
  pxWidth: number;
  pxHeight: number;
  pageWidth: number;
  pageHeight: number;
}

// Reads the logical drawing size from the SVG's viewBox (falling back to its
// width/height attributes, then the agent's standard 1200x800 canvas).
function parseSvgSize(svg: string): { width: number; height: number } {
  const viewBox = svg.match(/viewBox\s*=\s*["']\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*["']/i);
  if (viewBox) {
    const w = parseFloat(viewBox[3]);
    const h = parseFloat(viewBox[4]);
    if (w > 0 && h > 0) return { width: w, height: h };
  }
  const widthAttr = svg.match(/<svg[^>]*\bwidth\s*=\s*["']([\d.]+)/i);
  const heightAttr = svg.match(/<svg[^>]*\bheight\s*=\s*["']([\d.]+)/i);
  const w = widthAttr ? parseFloat(widthAttr[1]) : 0;
  const h = heightAttr ? parseFloat(heightAttr[1]) : 0;
  if (w > 0 && h > 0) return { width: w, height: h };
  return { width: 1200, height: 800 };
}

// Ensures the root <svg> carries explicit pixel width/height so the browser
// rasterizes it at the intended size instead of an intrinsic default.
function withExplicitSize(svg: string, width: number, height: number): string {
  return svg.replace(/<svg\b([^>]*)>/i, (match, attrs: string) => {
    let next = attrs
      .replace(/\swidth\s*=\s*["'][^"']*["']/i, '')
      .replace(/\sheight\s*=\s*["'][^"']*["']/i, '');
    if (!/xmlns\s*=/.test(next)) next += ' xmlns="http://www.w3.org/2000/svg"';
    return `<svg${next} width="${width}" height="${height}">`;
  });
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Rasterizes the SVG to a white-background JPEG at ~2x for a crisp result.
function rasterizeSvg(svg: string): Promise<RasterResult> {
  return new Promise((resolve, reject) => {
    const { width, height } = parseSvgSize(svg);
    const scale = 2;
    const pxWidth = Math.round(width * scale);
    const pxHeight = Math.round(height * scale);

    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = pxWidth;
        canvas.height = pxHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas 2D is not available in this browser.')); return; }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pxWidth, pxHeight);
        ctx.drawImage(img, 0, 0, pxWidth, pxHeight);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        resolve({ jpeg: dataUrlToBytes(dataUrl), pxWidth, pxHeight, pageWidth: width, pageHeight: height });
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to rasterize the mockup.'));
      }
    };
    img.onerror = () => reject(new Error('Failed to load the mockup image for export.'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(withExplicitSize(svg, parseSvgSize(svg).width, parseSvgSize(svg).height))}`;
  });
}

// Hand-assembles a minimal, valid single-page PDF embedding the JPEG image.
function buildImagePdf(r: RasterResult): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  let offset = 0;
  const push = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === 'string' ? encoder.encode(chunk) : chunk;
    parts.push(bytes);
    offset += bytes.length;
  };

  const objectCount = 6; // object 0 (free) + objects 1..5
  const xref: number[] = [];

  push('%PDF-1.4\n');

  xref[1] = offset;
  push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  xref[2] = offset;
  push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  xref[3] = offset;
  push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${r.pageWidth} ${r.pageHeight}] ` +
    `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );

  xref[4] = offset;
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${r.pxWidth} /Height ${r.pxHeight} ` +
    `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${r.jpeg.length} >>\nstream\n`
  );
  push(r.jpeg);
  push('\nendstream\nendobj\n');

  const content = `q\n${r.pageWidth} 0 0 ${r.pageHeight} 0 0 cm\n/Im0 Do\nQ\n`;
  xref[5] = offset;
  push(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);

  const xrefStart = offset;
  let xrefTable = `xref\n0 ${objectCount}\n0000000000 65535 f \n`;
  for (let i = 1; i < objectCount; i++) {
    xrefTable += `${String(xref[i]).padStart(10, '0')} 00000 n \n`;
  }
  push(xrefTable);
  push(`trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}

function triggerDownload(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(name: string): string {
  const base = (name || 'mockup').trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
  return `${base || 'mockup'}.pdf`;
}

// Rasterizes the given mockup SVG and downloads it as a single-page PDF named
// after the screen. Throws if the browser cannot rasterize the SVG.
export async function downloadMockupAsPdf(svg: string, screenName: string): Promise<void> {
  if (!svg?.trim()) throw new Error('This screen has no mockup to export.');
  const raster = await rasterizeSvg(svg);
  const pdf = buildImagePdf(raster);
  triggerDownload(pdf, safeFilename(screenName));
}

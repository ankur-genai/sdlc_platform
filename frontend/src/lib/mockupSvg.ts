// Shared helpers for safely rendering an LLM-produced mockup SVG as an inert
// <img> source. Used by the UI/UX studio canvas and the Frontend workspace so
// both render mockups identically (and both benefit from the control-char fix
// that stops a stray NUL from blanking the image).

export function sanitizeMockupSvg(raw: string): string {
  let svg = (raw || '').trim();
  // Drop markdown fences if the model wrapped the SVG in them.
  svg = svg.replace(/^```(?:svg|xml|html)?/i, '').replace(/```$/, '').trim();
  svg = svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '') // inline event handlers
    .replace(/(href|xlink:href)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, '')
    // Strip XML-invalid control chars (a single one makes the SVG invalid XML,
    // so the <img> renders blank/white).
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  return svg;
}

export function mockupSvgToDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitizeMockupSvg(svg))}`;
}

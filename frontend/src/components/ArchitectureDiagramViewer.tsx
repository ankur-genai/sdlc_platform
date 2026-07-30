/**
 * ArchitectureDiagramViewer.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders Mermaid architecture diagrams from the architecture_diagram artifact.
 * Supports:
 *   - Live diagram preview (rendered via Mermaid)
 *   - Click to enlarge (modal)
 *   - Download PNG (via canvas)
 *   - Download SVG (via serialization)
 *   - Download source (raw Mermaid text)
 *
 * Reuses existing architecture artifact data — does NOT regenerate diagrams.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Maximize2,
  Download,
  Image,
  FileCode,
  X,
  Loader2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiagramData {
  type: string;
  content: string;
}

interface ArchitectureDiagramViewerProps {
  diagrams: DiagramData[];
  /** Optional class name for the container */
  className?: string;
}

// ─── Mermaid source sanitization ──────────────────────────────────────────────

/**
 * LLM-generated Mermaid source (this project's diagrams are 100% LLM output,
 * never validated before storage) routinely writes bare multi-word node
 * names with no quoting/brackets — e.g. `User-->Claims Intake Service` — and
 * occasionally a malformed edge-label arrow like `-->|Submit Claim|>Target`
 * (an extra trailing `>` after the label's closing pipe). Both are syntax
 * errors Mermaid's parser correctly rejects. Rather than trying to get an
 * LLM to reliably follow strict Mermaid grammar, sanitize simple `A-->B` /
 * `A-->|label|B` edge lines here before rendering. Lines that don't match
 * this exact shape (already-bracketed nodes, subgraph/class/sequence/ER
 * syntax, etc.) pass through untouched.
 */
export function sanitizeMermaidSource(source: string): string {
  const idFor = new Map<string, string>();
  let counter = 0;
  const safeId = (label: string): string => {
    if (idFor.has(label)) return idFor.get(label)!;
    const id = `n${counter++}`;
    idFor.set(label, id);
    return id;
  };

  // A token is already a valid node when it's a plain id (letters/digits/_) or
  // it carries an explicit shape/quote/@{...} — leave those untouched. Anything
  // else that's a bare, multi-word or special-char label (e.g. "Claims Intake
  // Service", "API (v2)", "Auth/SSO") is what Mermaid's grammar rejects, so we
  // rewrite it into a quoted node `nX["label"]`.
  const isPlainId = (t: string) => /^[A-Za-z0-9_]+$/.test(t);
  const isShaped = (t: string) => /[[\](){}"]/.test(t) || t.includes('@{');
  const wrapNode = (raw: string): string => {
    const t = raw.trim();
    if (!t || isPlainId(t) || isShaped(t)) return t;
    // Quote the label; strip characters that would break out of the "..." node.
    const safeLabel = t.replace(/"/g, "'").replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();
    return `${safeId(t)}["${safeLabel}"]`;
  };

  // Common flowchart link operators (longest first), with optional |label|.
  const ARROW_RE = /\s*(<-->|-\.->|-\.-|==>|===|-->|---|--o|--x|o--o|x--x)\s*/;

  // Lines that are diagram declarations, keywords, or non-flowchart syntax must
  // pass through untouched — the edge rewrite only applies to flowchart links.
  const KEYWORD_RE = /^\s*(graph|flowchart|sequenceDiagram|classDiagram|erDiagram|stateDiagram(?:-v2)?|journey|gantt|pie|mindmap|timeline|quadrantChart|gitGraph|subgraph|end\b|class\s|classDef\s|click\s|style\s|linkStyle|direction\s|participant\s|actor\s|note\s|loop\s|alt\s|opt\s|par\s|%%)/i;

  // Strip a wrapping ```mermaid / ``` code fence if the LLM left one in.
  const cleaned = source
    .replace(/^\s*```(?:mermaid|mmd)?[ \t]*\r?\n?/i, '')
    .replace(/\r?\n?```\s*$/i, '')
    .trim();

  // For ER diagrams, some LLMs emit everything on one line. If we detect an
  // erDiagram prefix and no newlines, expand it into a multi-line block using
  // the same syntax that diagram_generator.py produces so Mermaid parses it.
  const ER_SINGLE_LINE_RE = /^\s*erDiagram\s+([A-Za-z0-9_]+)\s*\{([^}]*)\}\s+([A-Za-z0-9_]+)\s*\{([^}]*)\}\s+(.+)$/;

  if (!/\n/.test(cleaned) && cleaned.trim().toLowerCase().startsWith('erdiagram')) {
    const m = cleaned.match(ER_SINGLE_LINE_RE);
    if (m) {
      const [, t1, body1, t2, body2, rel] = m;
      const fmt = (body: string) => body
        .trim()
        .split(/\s+/)
        .reduce<string[]>((acc, token, idx) => {
          // Group as: type name [key]
          if (idx % 3 === 0) acc.push(`${token}`);
          else acc[acc.length - 1] += ` ${token}`;
          return acc;
        }, [])
        .map((line) => `    ${line}`)
        .join('\n');
      const erLines = [
        'erDiagram',
        `  ${t1} {`,
        fmt(body1),
        '  }',
        `  ${t2} {`,
        fmt(body2),
        '  }',
        `  ${rel.trim()}`,
      ];
      return erLines.join('\n');
    }
  }

  // Non-flowchart diagrams (erDiagram, sequenceDiagram, classDiagram, etc.) must not
  // undergo flowchart edge-rewriting, which corrupts ER relationships like `A ||--o{ B`.
  const firstLine = cleaned.split('\n')[0].trim().toLowerCase();
  const isFlowchart = firstLine.startsWith('graph') || firstLine.startsWith('flowchart');
  if (!isFlowchart) {
    return cleaned;
  }

  return cleaned
    .split('\n')
    .map((line) => {
      if (KEYWORD_RE.test(line)) return line;

      // Only rewrite lines with exactly ONE link operator (split → [L, op, R]).
      const parts = line.split(ARROW_RE);
      if (parts.length !== 3) return line;

      const [rawLeft, arrow, rawRight] = parts;
      const indent = (rawLeft.match(/^(\s*)/)?.[1]) ?? '';
      const left = rawLeft.trim();

      // The right side may carry a `|label|` (or a malformed `|label|>`) prefix.
      let right = rawRight.trim();
      let label: string | undefined;
      const labelMatch = right.match(/^\|([^|]*)\|>?\s*(.*)$/);
      if (labelMatch) { label = labelMatch[1].trim(); right = labelMatch[2].trim(); }
      // Strip a stray leading `>` (e.g. from `A-->|x|>B`).
      right = right.replace(/^>\s*/, '');

      if (!left || !right) return line;

      const wrapL = !isPlainId(left) && !isShaped(left);
      const wrapR = !isPlainId(right) && !isShaped(right);
      // Nothing to fix and no label to normalize → leave the line as-is.
      if (!wrapL && !wrapR && label === undefined && !/\|>/.test(line)) return line;

      const edge = label !== undefined ? `${arrow.trim()}|${label}|` : arrow.trim();
      return `${indent}${wrapNode(left)} ${edge} ${wrapNode(right)}`;
    })
    .join('\n');
}

// ─── Mermaid rendering helper ─────────────────────────────────────────────────

/**
 * Render Mermaid diagram source to an SVG string using the Mermaid API.
 * Falls back to a text representation if Mermaid is unavailable.
 */
async function renderMermaidToSvg(rawSource: string): Promise<string> {
  const source = sanitizeMermaidSource(rawSource);
  try {
    const mermaid = await import('mermaid');
    // Initialize once
    mermaid.default.initialize({
      startOnLoad: false,
      theme: 'dark',
      // Suppress Mermaid's built-in "Syntax error in text" graphic — we render
      // our own source fallback below on any parse failure.
      suppressErrorRendering: true,
      themeVariables: {
        primaryColor: '#1a1a2e',
        primaryTextColor: '#e0e0e0',
        primaryBorderColor: '#333',
        lineColor: '#f0c040',
        secondaryColor: '#16213e',
        tertiaryColor: '#0f3460',
        fontFamily: 'monospace',
      },
      securityLevel: 'loose',
    });
    // Validate first so invalid diagrams fall through to the styled text block
    // instead of throwing/drawing Mermaid's version-stamped error image.
    const valid = await mermaid.default.parse(source, { suppressErrors: true });
    if (valid === false) throw new Error('Invalid Mermaid syntax');
    const { svg } = await mermaid.default.render('mermaid-svg-' + Math.random().toString(36).slice(2), source);
    return svg;
  } catch {
    // Fallback: return a styled text block
    return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300">
      <rect width="600" height="300" fill="#1a1a2e" rx="8"/>
      <text x="20" y="30" fill="#f0c040" font-family="monospace" font-size="12">${escapeXml(source.slice(0, 200))}</text>
      <text x="20" y="280" fill="#888" font-family="monospace" font-size="10">Mermaid render unavailable — showing source</text>
    </svg>`;
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
}

// ─── Download helpers ─────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadDiagramAsPng(
  svgElement: SVGSVGElement,
  title: string,
  customFilename?: string
) {
  if (!svgElement) return;

  const displayTitle = title
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

  const cleanFilename =
    customFilename || `${displayTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;

  let width = 0;
  let height = 0;

  try {
    const bbox = svgElement.getBBox();
    if (bbox.width > 0 && bbox.height > 0) {
      width = Math.ceil(bbox.width + 40);
      height = Math.ceil(bbox.height + 40);
    }
  } catch {
    // getBBox fallback
  }

  if (!width || !height) {
    const viewBox = svgElement.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        width = Math.ceil(parts[2]);
        height = Math.ceil(parts[3]);
      }
    }
  }

  if (!width || width < 100) width = Math.max(svgElement.clientWidth || 900, 900);
  if (!height || height < 100) height = Math.max(svgElement.clientHeight || 600, 600);

  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.setAttribute('width', width.toString());
  clone.setAttribute('height', height.toString());

  const origElements = Array.from(svgElement.querySelectorAll('*'));
  const cloneElements = Array.from(clone.querySelectorAll('*'));

  for (let i = 0; i < origElements.length && i < cloneElements.length; i++) {
    const orig = origElements[i] as HTMLElement | SVGElement;
    const cln = cloneElements[i] as HTMLElement | SVGElement;
    try {
      const cs = window.getComputedStyle(orig);
      if (cs.fill && cs.fill !== 'none' && !cln.hasAttribute('fill')) {
        cln.setAttribute('fill', cs.fill);
      }
      if (cs.stroke && cs.stroke !== 'none' && !cln.hasAttribute('stroke')) {
        cln.setAttribute('stroke', cs.stroke);
      }
      if (cs.strokeWidth && !cln.hasAttribute('stroke-width')) {
        cln.setAttribute('stroke-width', cs.strokeWidth);
      }
      if (cs.fontSize && !cln.hasAttribute('font-size')) {
        cln.setAttribute('font-size', cs.fontSize);
      }
      if (cs.fontFamily && !cln.hasAttribute('font-family')) {
        cln.setAttribute('font-family', cs.fontFamily);
      }
    } catch {
      // Ignore unstylable nodes
    }
  }

  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleEl.textContent = `
    text { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif !important; fill: #F0F0F0 !important; }
    .node rect, .node circle, .node polygon, .actor { fill: #1E1E2A !important; stroke: #FFE600 !important; }
    .edgePath path, .actor-line, line { stroke: #FFE600 !important; stroke-width: 2px !important; }
    .label text, .nodeLabel, span { fill: #F0F0F0 !important; color: #F0F0F0 !important; }
  `;
  clone.insertBefore(styleEl, clone.firstChild);

  const xmlStr = new XMLSerializer().serializeToString(clone);
  const base64Data = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xmlStr)));

  const img = new window.Image();
  img.crossOrigin = 'anonymous';

  img.onload = () => {
    const scale = 2;
    const headerHeight = 85;
    const padding = 32;
    const contentWidth = Math.max(width, 700);

    const totalWidth = contentWidth + padding * 2;
    const totalHeight = height + headerHeight + padding * 2;

    const canvas = document.createElement('canvas');
    canvas.width = totalWidth * scale;
    canvas.height = totalHeight * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);

    // Dark Background Fill (#12121A)
    ctx.fillStyle = '#12121A';
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // Outer Border Box
    ctx.strokeStyle = '#262634';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding / 2, padding / 2, totalWidth - padding, totalHeight - padding);

    // Top EY Gold Accent Bar (#FFE600)
    ctx.fillStyle = '#FFE600';
    ctx.fillRect(padding / 2, padding / 2, totalWidth - padding, 4);

    // Diagram Heading Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.fillText(displayTitle, padding, padding + 28);

    // Platform Subtitle Branding
    ctx.fillStyle = '#8E8EA0';
    ctx.font = '12px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.fillText('Solution Architecture Diagram · AI SDLC Platform', padding, padding + 50);

    // Divider Line
    ctx.strokeStyle = '#262634';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding + 64);
    ctx.lineTo(totalWidth - padding, padding + 64);
    ctx.stroke();

    // Draw Diagram Image
    const dx = padding + (contentWidth - width) / 2;
    const dy = padding + headerHeight;
    ctx.drawImage(img, dx, dy, width, height);

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = cleanFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, cleanFilename);
      }, 'image/png');
    }
  };

  img.onerror = (err) => {
    console.error('Failed to load base64 SVG for PNG download:', err);
  };

  img.src = base64Data;
}

function downloadSource(source: string, filename: string) {
  const blob = new Blob([source], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, filename);
}

// ─── Single diagram card ──────────────────────────────────────────────────────

function DiagramCard({
  diagram,
  index,
  onEnlarge,
}: {
  diagram: DiagramData;
  index: number;
  onEnlarge: (svg: SVGSVGElement, title: string, source: string) => void;
}) {
  const svgRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    renderMermaidToSvg(diagram.content).then((svgStr) => {
      if (cancelled || !svgRef.current) return;
      svgRef.current.innerHTML = svgStr;
      setRendered(true);
    }).catch((e) => {
      if (!cancelled) setError(e.message || 'Render failed');
    });
    return () => { cancelled = true; };
  }, [diagram.content]);

  const handleEnlarge = () => {
    const svg = svgRef.current?.querySelector('svg');
    if (svg) onEnlarge(svg as SVGSVGElement, diagram.type, diagram.content);
  };

  const handleDownloadPng = () => {
    const svg = svgRef.current?.querySelector('svg');
    if (svg) downloadDiagramAsPng(svg as SVGSVGElement, diagram.type, `diagram_${diagram.type}.png`);
  };

  const handleDownloadSource = () => {
    downloadSource(diagram.content, `diagram_${diagram.type}.mmd`);
  };

  return (
    <div className="rounded-lg border border-dark-border bg-dark-bg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-dark-border">
        <span className="text-xs font-medium text-text-primary capitalize">
          {diagram.type.replace(/_/g, ' ')}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleEnlarge}
            disabled={!rendered}
            className="p-1 rounded hover:bg-dark-surface text-text-muted hover:text-ey-yellow transition-colors disabled:opacity-30"
            title="Enlarge"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleDownloadPng}
            disabled={!rendered}
            className="px-2 py-1 rounded bg-ey-yellow/10 hover:bg-ey-yellow text-ey-yellow hover:text-dark-bg font-bold transition-all disabled:opacity-30 flex items-center gap-1 text-[11px] cursor-pointer"
            title="Download PNG"
          >
            <Image className="h-3.5 w-3.5" />
            <span>PNG</span>
          </button>
          <button
            onClick={handleDownloadSource}
            className="p-1 rounded hover:bg-dark-surface text-text-muted hover:text-ey-yellow transition-colors"
            title="Download Source"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Diagram body */}
      <div className="p-3">
        {!rendered && !error && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-ey-yellow" />
          </div>
        )}
        {error && (
          <div className="text-xs text-status-error py-4 text-center">
            Failed to render diagram: {error}
          </div>
        )}
        <div
          ref={svgRef}
          className="w-full overflow-auto cursor-pointer hover:opacity-90 transition-opacity"
          style={{ maxHeight: '240px' }}
          onClick={handleEnlarge}
        />
      </div>
    </div>
  );
}

// ─── Enlarged modal ───────────────────────────────────────────────────────────

function EnlargedModal({
  svgElement,
  title,
  source,
  onClose,
}: {
  svgElement: SVGSVGElement | null;
  title: string;
  source: string;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !svgElement) return;
    containerRef.current.innerHTML = '';
    const clone = svgElement.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', '100%');
    clone.setAttribute('height', 'auto');
    clone.style.maxWidth = '100%';
    containerRef.current.appendChild(clone);
  }, [svgElement]);

  const handleDownloadPng = () => {
    const svg = containerRef.current?.querySelector('svg');
    if (svg) downloadDiagramAsPng(svg as SVGSVGElement, title, `diagram_${title}.png`);
  };

  const handleDownloadSource = () => {
    downloadSource(source, `diagram_${title}.mmd`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative max-w-4xl w-full mx-4 max-h-[90vh] overflow-auto rounded-xl border border-dark-border bg-dark-surface p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary capitalize">
            {title.replace(/_/g, ' ')}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPng}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ey-yellow hover:bg-ey-yellow/90 text-dark-bg font-bold text-xs transition-colors shadow cursor-pointer"
            >
              <Image className="h-3.5 w-3.5" />
              <span>Download PNG</span>
            </button>
            <button
              onClick={handleDownloadSource}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-text-muted hover:text-ey-yellow hover:bg-dark-bg transition-colors"
            >
              <Download className="h-3 w-3" /> Source
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-dark-bg text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Diagram */}
        <div ref={containerRef} className="w-full overflow-auto bg-dark-bg rounded-lg p-4" />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ArchitectureDiagramViewer({ diagrams, className = '' }: ArchitectureDiagramViewerProps) {
  const [enlarged, setEnlarged] = useState<{
    svg: SVGSVGElement | null;
    title: string;
    source: string;
  } | null>(null);

  if (!diagrams || diagrams.length === 0) {
    return (
      <div className={`rounded-lg border border-dark-border bg-dark-bg px-4 py-6 text-center ${className}`}>
        <p className="text-xs text-text-muted">No architecture diagrams available.</p>
      </div>
    );
  }

  return (
    <>
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-xs font-semibold text-text-primary">Architecture Diagrams</h3>
          <span className="text-[10px] text-text-muted">({diagrams.length} diagram{diagrams.length > 1 ? 's' : ''})</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {diagrams.map((d, i) => (
            <DiagramCard
              key={`${d.type}-${i}`}
              diagram={d}
              index={i}
              onEnlarge={(svg, title, source) => setEnlarged({ svg, title, source })}
            />
          ))}
        </div>
      </div>

      {enlarged && (
        <EnlargedModal
          svgElement={enlarged.svg}
          title={enlarged.title}
          source={enlarged.source}
          onClose={() => setEnlarged(null)}
        />
      )}
    </>
  );
}

export default ArchitectureDiagramViewer;
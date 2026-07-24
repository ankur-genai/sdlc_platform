import { useEffect, useState } from 'react';
import { Monitor, Tablet, Smartphone, Layers, Plus, ChevronUp, ChevronDown, Trash2, Edit3, Image as ImageIcon, PencilRuler, FileDown, Loader2 } from 'lucide-react';
import type { UIUXScreen, UIUXStyleOption } from '../../types/unified';
import { downloadMockupAsPdf } from '../../lib/mockupPdf';

const QUICK_INSERT_COMPONENTS = [
  'Metric Cards', 'Data Table', 'Navigation Bar', 'Form', 'Search Bar', 'Chart', 'Modal', 'Empty State',
];

// Defense-in-depth: even though an SVG loaded via <img src="data:..."> cannot
// execute scripts, we still strip anything active/external before rendering the
// LLM-produced mockup so it stays a pure, inert image.
function sanitizeMockupSvg(raw: string): string {
  let svg = raw.trim();
  // Drop markdown fences if the model wrapped the SVG in them.
  svg = svg.replace(/^```(?:svg|xml|html)?/i, '').replace(/```$/,'').trim();
  svg = svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')  // inline event handlers
    .replace(/(href|xlink:href)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, '')
    // Strip XML-invalid control chars. The model sometimes emits a stray NUL
    // (e.g. "\u0000a9" instead of "\u00a9" for ©); a single such character makes
    // the entire SVG invalid XML, so the <img> silently renders blank/white.
    // Removing them lets the real mockup load. (Keep tab, LF, CR.)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  return svg;
}

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

interface DesignCanvasProps {
  activeScreen: UIUXScreen;
  style: UIUXStyleOption | null;
  selectedCompIdx: number | null;
  onSelectComponent: (idx: number) => void;
  onRemoveComponent: (compName: string) => void;
  onMoveComponent: (idx: number, direction: 'up' | 'down') => void;
  onInsertComponent: (compName: string) => void;
  onRenameComponent: (idx: number, newName: string) => void;
}

// Ported from Bhumika's interactive wireframe canvas. Retyped from her
// closed-enum MockupScreen/DesignTokens to the real backend UIUXScreen /
// UIUXStyleOption shapes — theming is now derived from the actual selected
// style's hex/typography tokens (inline styles) instead of a fixed enum
// lookup, since the backend produces arbitrary hex values, not named presets.
export function DesignCanvas({
  activeScreen, style, selectedCompIdx, onSelectComponent, onRemoveComponent, onMoveComponent, onInsertComponent, onRenameComponent,
}: DesignCanvasProps) {
  const [deviceFrame, setDeviceFrame] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showGuides, setShowGuides] = useState<boolean>(true);
  const [newCompName, setNewCompName] = useState<string>('');
  const [editingCompIdx, setEditingCompIdx] = useState<number | null>(null);
  const [tempName, setTempName] = useState<string>('');
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const hasMockup = !!activeScreen.mockupSvg?.trim();
  // 'mockup' shows the generated SVG image; 'build' shows the editable
  // component layout. Default to the visual mockup whenever one exists.
  const [viewMode, setViewMode] = useState<'mockup' | 'build'>(hasMockup ? 'mockup' : 'build');
  useEffect(() => {
    setViewMode(hasMockup ? 'mockup' : 'build');
  }, [activeScreen.name, hasMockup]);

  const mockupSrc = hasMockup ? svgToDataUri(sanitizeMockupSvg(activeScreen.mockupSvg as string)) : '';

  const handleDownloadPdf = async () => {
    if (!hasMockup || exportingPdf) return;
    setExportError(null);
    setExportingPdf(true);
    try {
      await downloadMockupAsPdf(sanitizeMockupSvg(activeScreen.mockupSvg as string), activeScreen.name || 'mockup');
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to export the mockup as PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  const primaryHex = style?.colorPalette?.primary?.[0]?.hex || '#FFE600';
  const neutralHex = style?.colorPalette?.neutral?.[0]?.hex || '#14161f';
  const fontFamily = style?.typography?.fontFamily || 'Inter, system-ui, sans-serif';

  const handleInsert = () => {
    if (!newCompName.trim()) return;
    onInsertComponent(newCompName.trim());
    setNewCompName('');
  };

  const startEditing = (idx: number, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCompIdx(idx);
    setTempName(name);
  };

  const saveEditing = (idx: number, e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) onRenameComponent(idx, tempName.trim());
    setEditingCompIdx(null);
  };

  const components = activeScreen.components || [];

  return (
    <div className="bg-dark-card border border-dark-border rounded-2xl p-4 space-y-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dark-border pb-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-status-success animate-pulse" />
          <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider">Visual Interactive Canvas</span>
        </div>
        <div className="flex items-center gap-2.5">
          {hasMockup && (
            <div className="flex items-center bg-dark-bg border border-dark-border rounded-lg p-0.5 text-[9px] font-mono uppercase tracking-wider">
              <button
                onClick={() => setViewMode('mockup')}
                className={`flex items-center gap-1 px-2 py-1 rounded transition-all ${viewMode === 'mockup' ? 'bg-ey-yellow text-black font-bold' : 'text-text-muted hover:text-white'}`}
                title="Show the generated visual mockup"
              >
                <ImageIcon size={11} /> Mockup
              </button>
              <button
                onClick={() => setViewMode('build')}
                className={`flex items-center gap-1 px-2 py-1 rounded transition-all ${viewMode === 'build' ? 'bg-ey-yellow text-black font-bold' : 'text-text-muted hover:text-white'}`}
                title="Edit the component layout"
              >
                <PencilRuler size={11} /> Build
              </button>
            </div>
          )}
          {hasMockup && (
            <button
              onClick={handleDownloadPdf}
              disabled={exportingPdf}
              title="Download this screen's mockup as a PDF"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-mono uppercase border tracking-wider transition-all bg-dark-bg border-dark-border text-text-muted hover:text-ey-yellow hover:border-ey-yellow/40 disabled:opacity-50"
            >
              {exportingPdf ? <Loader2 size={11} className="animate-spin" /> : <FileDown size={11} />}
              {exportingPdf ? 'Exporting' : 'PDF'}
            </button>
          )}
          <button
            onClick={() => setShowGuides(!showGuides)}
            className={`px-2 py-1 rounded-lg text-[9px] font-mono uppercase border tracking-wider transition-all ${
              showGuides ? 'bg-ey-yellow/15 border-ey-yellow/30 text-ey-yellow' : 'bg-dark-bg border-dark-border text-text-muted'
            }`}
          >
            Guides: {showGuides ? 'Show' : 'Hide'}
          </button>
          <div className="flex items-center bg-dark-bg border border-dark-border rounded-lg p-0.5 text-[9px] font-mono">
            <button onClick={() => setZoomLevel((p) => Math.max(50, p - 25))} className="px-1.5 py-0.5 text-text-muted hover:text-white">-</button>
            <span className="px-1.5 text-ey-yellow font-bold">{zoomLevel}%</span>
            <button onClick={() => setZoomLevel((p) => Math.min(150, p + 25))} className="px-1.5 py-0.5 text-text-muted hover:text-white">+</button>
          </div>
          <div className="flex items-center bg-dark-bg border border-dark-border rounded-lg p-0.5">
            {[
              { id: 'desktop', icon: Monitor },
              { id: 'tablet', icon: Tablet },
              { id: 'mobile', icon: Smartphone },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => setDeviceFrame(d.id as 'desktop' | 'tablet' | 'mobile')}
                className={`p-1 rounded transition-all ${deviceFrame === d.id ? 'bg-ey-yellow text-black' : 'text-text-muted hover:text-white'}`}
              >
                <d.icon size={13} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-dark-bg border border-dark-border rounded-xl p-3 space-y-2 text-xs" hidden={viewMode !== 'build'}>
        <div className="flex items-center justify-between border-b border-dark-border/60 pb-1.5">
          <div className="flex items-center gap-1.5 font-bold text-text-primary uppercase tracking-wider text-[9px]">
            <Layers size={13} className="text-ey-yellow" />
            <span>Insert Component</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_INSERT_COMPONENTS.map((libName) => (
            <button
              key={libName}
              onClick={() => onInsertComponent(libName)}
              className="text-[9px] bg-dark-cardHover border border-dark-border hover:border-ey-yellow text-text-muted hover:text-ey-yellow px-2 py-1 rounded-lg transition-all flex items-center gap-1"
            >
              <Plus size={10} /> <span>{libName}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 pt-1.5 border-t border-dark-border/40">
          <input
            placeholder="Type a custom component name..."
            value={newCompName}
            onChange={(e) => setNewCompName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInsert()}
            className="flex-1 bg-dark-cardHover border border-dark-border px-2.5 py-1.5 rounded-lg text-[10px] text-white focus:outline-none focus:border-ey-yellow/40"
          />
          <button onClick={handleInsert} className="bg-ey-yellow text-black font-bold px-3 py-1.5 rounded-lg text-[10px] hover:opacity-90 flex items-center gap-1">
            <Plus size={11} /> <span>Insert</span>
          </button>
        </div>
      </div>

      {exportError && (
        <div className="text-[10px] text-status-error bg-status-error/10 border border-status-error/30 rounded-lg px-2.5 py-1.5">
          {exportError}
        </div>
      )}

      <div className="bg-black/40 border border-dark-border rounded-2xl p-6 flex justify-center overflow-x-auto min-h-[420px] relative">
        {showGuides && (
          <div className="absolute inset-0 grid grid-cols-12 grid-rows-12 pointer-events-none opacity-[0.06]">
            {Array.from({ length: 144 }).map((_, i) => (
              <div key={i} className="border-t border-l border-zinc-700" />
            ))}
          </div>
        )}
        <div
          className={`transition-all duration-300 relative border border-dark-border-light bg-dark-bg shadow-2xl shrink-0 ${
            deviceFrame === 'mobile' ? 'w-[320px] rounded-[36px] border-8 p-4 min-h-[500px]' : deviceFrame === 'tablet' ? 'w-[520px] rounded-[24px] border-8 p-5 min-h-[440px]' : 'w-full max-w-4xl rounded-xl p-5 min-h-[400px]'
          }`}
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center', fontFamily }}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-dark-border pb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: primaryHex }} />
                <span className="text-[11px] font-black uppercase tracking-wider text-text-primary">{activeScreen.name}</span>
              </div>
              <span className="text-[7px] font-mono px-2 py-0.5 rounded border font-bold text-text-muted border-dark-border">
                {activeScreen.type || 'page'}
              </span>
            </div>
            <p className="text-[10px] text-text-muted">{activeScreen.purpose}</p>

            {viewMode === 'mockup' && hasMockup ? (
              <div className="rounded-lg overflow-hidden border border-dark-border bg-white">
                <img
                  src={mockupSrc}
                  alt={`${activeScreen.name} mockup`}
                  className="w-full h-auto block select-none"
                  draggable={false}
                />
              </div>
            ) : (
            <div className="grid gap-4">
              {components.length === 0 && (
                <p className="text-[10px] text-text-muted italic">No components yet — insert one above.</p>
              )}
              {components.map((comp, cIdx) => {
                const isSelected = selectedCompIdx === cIdx;
                const isEditing = editingCompIdx === cIdx;
                return (
                  <div
                    key={comp + '-' + cIdx}
                    onClick={() => onSelectComponent(cIdx)}
                    className={`border p-3.5 relative group transition-all cursor-pointer rounded-lg ${
                      isSelected ? 'ring-2 ring-ey-yellow/80 border-ey-yellow' : 'border-dark-border hover:border-dark-border-light'
                    }`}
                    style={{ backgroundColor: neutralHex }}
                  >
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-black/60 p-1 rounded-lg border border-dark-border">
                      <button onClick={(e) => startEditing(cIdx, comp, e)} className="p-1 hover:text-ey-yellow text-stone-400" title="Rename"><Edit3 size={10} /></button>
                      <button onClick={(e) => { e.stopPropagation(); onMoveComponent(cIdx, 'up'); }} disabled={cIdx === 0} className="p-1 hover:text-white text-stone-400 disabled:opacity-30" title="Move up"><ChevronUp size={10} /></button>
                      <button onClick={(e) => { e.stopPropagation(); onMoveComponent(cIdx, 'down'); }} disabled={cIdx === components.length - 1} className="p-1 hover:text-white text-stone-400 disabled:opacity-30" title="Move down"><ChevronDown size={10} /></button>
                      <button onClick={(e) => { e.stopPropagation(); onRemoveComponent(comp); }} className="p-1 hover:text-status-error text-stone-400" title="Remove"><Trash2 size={10} /></button>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      {isEditing ? (
                        <form onSubmit={(e) => saveEditing(cIdx, e)} className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                          <input value={tempName} onChange={(e) => setTempName(e.target.value)} className="bg-dark-bg border border-ey-yellow text-[9px] px-1.5 py-0.5 rounded focus:outline-none text-white flex-1" />
                          <button type="submit" className="text-status-success text-[9px] font-bold">Save</button>
                        </form>
                      ) : (
                        <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-text-muted">{comp}</span>
                      )}
                    </div>
                    <p className="text-[9px] text-text-secondary leading-normal">{comp} preview — synchronized with the generated design system.</p>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

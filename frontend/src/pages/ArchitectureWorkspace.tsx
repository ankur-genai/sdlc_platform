import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Building2,
  Clock,
  CheckCircle2,
  ArrowDownUp,
  Workflow,
  GitBranch,
  ThumbsUp,
  RefreshCw,
  Download,
  Server,
  Database,
  Cloud,
  Globe,
  Box,
  FileCode,
  AlertTriangle,
  Lightbulb,
  FileJson,
  FileType,
  FileText as FileTextIcon,
  File,
  Loader2,
  Boxes,
  FileText,
  Layers,
  Sparkles,
  Send,
  User,
  Cpu,
} from 'lucide-react';
import { Card, StatusBadge } from '../components/ui/Card';
import { Markdown } from '../components/ui/Markdown';
import { ApprovalBanner, ApprovalBadge } from '../components/ui/ApprovalStatus';
import { RegenerateButton } from '../components/ui/RegenerateButton';
import { useUnifiedArtifacts } from '../lib/useUnifiedArtifacts';
import { ArchitectureDiagramViewer, DiagramData, sanitizeMermaidSource, downloadDiagramAsPng } from '../components/ArchitectureDiagramViewer';
import { getSelectedProjectId } from '../lib/projectContext';
import { buildApiUrl, fastApiRequest, AI_REQUEST_TIMEOUT_MS } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { useWorkspaceReadOnly } from '../components/WorkspaceGate';
import type { Approval, ArchitectureContent } from '../types/unified';

export function ArchitectureWorkspace() {
  const isReadOnly = useWorkspaceReadOnly();
  const [activeTab, setActiveTab] = useState<
    'system' | 'component' | 'sequence' | 'class' | 'er' | 'deployment' | 'dataflow' | 'infrastructure' | 'network' | 'decisions' | 'copilot'
  >('system');

  const [showJsonViewer, setShowJsonViewer] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [architectureApproval, setArchitectureApproval] = useState<Approval | null>(null);
  const [approving, setApproving] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const { addToast, clearToasts } = useToast();

  // Copilot State
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [sendingCopilot, setSendingCopilot] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [chatHistory, setChatHistory] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    summary?: string;
    affected_sections?: string[];
  }>>([
    {
      role: 'assistant',
      content: 'Hello! I am your Architecture Copilot. I can modify system architecture, switch patterns (e.g. Microservices to Modular Monolith), add Redis caching, API Gateways, Kafka event buses, Kubernetes deployments, CDN layers, replace database technologies, and refine scalability or security architecture.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);

  const projectId = getSelectedProjectId();
  const { getArchitecture, getRawArtifact, loading, error, reload, downloadArtifact } = useUnifiedArtifacts(projectId);

  // Auto scroll chat to bottom when chatHistory updates
  useEffect(() => {
    if (activeTab === 'copilot') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, sendingCopilot, activeTab]);

  const loadApproval = async () => {
    if (!projectId) { setArchitectureApproval(null); return; }
    try {
      const approvals = await fastApiRequest<Approval[]>(`/projects/${projectId}/approvals`);
      setArchitectureApproval(approvals.find((a) => a.artifact_type === 'architecture_diagram') || null);
    } catch (e) {
      console.error('Failed to load architecture approval status:', e);
      setArchitectureApproval(null);
    }
  };

  useEffect(() => {
    loadApproval();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleApproveArchitecture = async () => {
    if (!projectId || !architectureApproval) return;
    setApproving(true);
    try {
      await fastApiRequest(`/projects/${projectId}/approvals/${architectureApproval.id}/decide`, {
        method: 'POST',
        body: { decision: 'Approved' },
      });
      await loadApproval();
      addToast('Architecture approved', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to approve architecture', 'error');
    } finally {
      setApproving(false);
    }
  };

  const handleRegenerateDiagrams = async () => {
    if (!projectId) return;
    setRegenerating(true);
    try {
      await fastApiRequest('/generate/architecture-diagrams', {
        method: 'POST',
        body: { project_id: Number(projectId) },
        timeoutMs: AI_REQUEST_TIMEOUT_MS,
      });
      await reload();
    } catch (e) {
      console.error('Diagram regeneration failed:', e);
    } finally {
      setRegenerating(false);
    }
  };

  const handleSendCopilot = async (promptOverride?: string) => {
    const promptToUse = promptOverride || copilotPrompt;
    if (!promptToUse.trim() || !projectId || sendingCopilot) return;

    setSendingCopilot(true);
    setCopilotPrompt('');

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newHistory = [...chatHistory, { role: 'user' as const, content: promptToUse, timestamp: timeStr }];
    setChatHistory(newHistory);

    try {
      const resp = await fastApiRequest<any>('/generate/architecture-copilot', {
        method: 'POST',
        body: { project_id: Number(projectId), prompt: promptToUse },
        timeoutMs: AI_REQUEST_TIMEOUT_MS,
      });

      setChatHistory([
        ...newHistory,
        {
          role: 'assistant',
          content: resp.message || `I've updated the architecture according to your instruction: "${promptToUse}".`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          summary: resp.summary,
          affected_sections: resp.affected_sections,
        }
      ]);

      await reload();
      addToast('Architecture updated & diagrams synchronized', 'success');
    } catch (err: any) {
      setChatHistory([
        ...newHistory,
        {
          role: 'assistant',
          content: `Error processing Architecture Copilot instruction: ${err?.message || err}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setSendingCopilot(false);
    }
  };

  const archData = getArchitecture();
  const archArtifact = getRawArtifact('architecture_diagram');

  const designDecisions = useMemo(() => {
    if (!archData?.architecture_decisions) return [] as any[];
    return archData.architecture_decisions.map((d: any, i: number) => ({
      id: i,
      title: d.decision || d.title || `Decision ${i + 1}`,
      rationale: d.rationale || '',
      tradeoffs: d.consequences || d.tradeoffs || '',
      status: 'recorded',
    }));
  }, [archData]);

  const techRecommendations = useMemo(() => {
    if (!archData?.tech_stack) return [];
    return Object.entries(archData.tech_stack).map(([category, tech]) => ({
      name: category,
      category: 'Technology',
      reason: typeof tech === 'string' ? tech : '',
    }));
  }, [archData]);

  const diagrams: DiagramData[] = useMemo(() => {
    if (!archData?.diagrams) return [];
    return archData.diagrams as DiagramData[];
  }, [archData]);

  const components = useMemo(() => {
    if (!archData?.components) return [];
    return archData.components as any[];
  }, [archData]);

  const handleExport = async (format: 'json' | 'md') => {
    if (!projectId) return;
    try {
      await downloadArtifact('architecture_diagram', format);
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  const handleLegacyExport = async (format: string) => {
    if (!projectId) return;
    try {
      const url = buildApiUrl(`/documents/export-artifact?projectId=${projectId}&artifact_type=architecture_diagram&format=${format}`);
      const resp = await fetch(url, { credentials: 'include' });
      if (!resp.ok) throw new Error('Export failed');
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `architecture_${projectId}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  const quickChips = [
    '⚡ Add Redis Caching',
    '⚡ Use Kubernetes Deployment',
    '⚡ Add API Gateway',
    '⚡ Introduce Kafka Event Bus',
    '⚡ Replace PostgreSQL with MongoDB',
    '⚡ Add Authentication Service',
    '⚡ Add Load Balancer & CDN',
    '⚡ Replace Microservices with Modular Monolith',
    '⚡ Improve Scalability & Security Architecture',
    '⚡ Explain Architecture Decisions',
  ];

  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPdf = async () => {
    if (exportingPdf) return;
    const targetPid = projectId || '130';
    setExportingPdf(true);
    clearToasts();
    addToast('Generating Architecture Design Report PDF...', 'info');

    try {
      const downloadUrl = buildApiUrl(`/generate/architecture-pdf?projectId=${targetPid}`);
      const resp = await fetch(downloadUrl, { credentials: 'include' });
      if (!resp.ok) throw new Error(`Server returned HTTP ${resp.status}`);
      
      const blob = await resp.blob();
      if (blob.size === 0) throw new Error('Received empty PDF file');

      let filename = `Architecture_Design_Report_${targetPid}.pdf`;
      const disposition = resp.headers.get('content-disposition');
      if (disposition && disposition.includes('filename=')) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 1000);

      clearToasts();
      addToast('Architecture Design Report PDF downloaded successfully', 'success');
    } catch (e: any) {
      console.warn('Blob download failed, triggering direct download fallback:', e);
      try {
        const fallbackUrl = buildApiUrl(`/generate/architecture-pdf?projectId=${targetPid}`);
        window.open(fallbackUrl, '_blank');
        clearToasts();
        addToast('Architecture Design Report PDF download initiated', 'success');
      } catch (fallbackErr: any) {
        clearToasts();
        addToast(e?.message || 'Failed to generate Architecture PDF', 'error');
      }
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dark-border pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Architecture Workspace</h1>
            <ApprovalBadge status={architectureApproval?.status || null} />
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${
              architectureApproval?.status === 'Approved'
                ? 'bg-status-success/15 text-status-success border-status-success/30'
                : 'bg-status-warning/15 text-status-warning border-status-warning/30 animate-pulse'
            }`}>
              {architectureApproval?.status === 'Approved' ? 'Architecture Approved' : 'Awaiting Approval'}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Solution architecture designed by Architect Agent
          </p>
        </div>

        {/* Action Controls & Export Dropdown */}
        <div className="flex items-center gap-3">
          {archArtifact && (
            <div className="flex items-center gap-2 rounded-lg bg-dark-card border border-dark-border px-3 py-1.5">
              <Clock className="h-3.5 w-3.5 text-text-muted" />
              <span className="text-xs text-text-muted">
                Generated {new Date(archArtifact.created_at).toLocaleString()}
              </span>
            </div>
          )}

          <button
            onClick={() => reload()}
            className="btn-ghost py-2 px-3 text-xs flex items-center gap-1.5 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {architectureApproval?.status !== 'Approved' && (
            <button
              className="bg-ey-yellow hover:bg-ey-yellow/90 text-dark-bg font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleApproveArchitecture}
              disabled={approving || !architectureApproval}
              title={!architectureApproval ? 'No pending architecture approval for this project' : undefined}
            >
              <ThumbsUp className="h-4 w-4" />
              {approving ? 'Approving…' : 'Approve Architecture'}
            </button>
          )}

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              disabled={exportingPdf}
              className="bg-ey-yellow hover:bg-ey-yellow/90 text-dark-bg font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors shadow-md cursor-pointer disabled:opacity-50"
            >
              {exportingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin text-dark-bg" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>{exportingPdf ? 'Exporting PDF…' : 'Export ▼'}</span>
            </button>

            {exportDropdownOpen && (
              <div 
                className="absolute right-0 mt-2 w-56 bg-[#1A1A24] border border-dark-border rounded-xl shadow-2xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
                onMouseLeave={() => setExportDropdownOpen(false)}
              >
                {/* Active PDF Export Option */}
                <button
                  onClick={() => { setExportDropdownOpen(false); handleExportPdf(); }}
                  disabled={exportingPdf}
                  className="w-full text-left px-4 py-2 text-xs text-text-primary hover:bg-dark-surface flex items-center gap-2 font-semibold group cursor-pointer"
                >
                  <FileTextIcon className="h-4 w-4 text-ey-yellow" />
                  <span>Export as PDF</span>
                </button>

                <div className="border-t border-dark-border/40 my-1" />
                <div className="px-3 py-1 text-[9px] uppercase font-bold text-text-muted">COMING SOON</div>

                <button disabled className="w-full text-left px-4 py-1.5 text-xs text-text-muted cursor-not-allowed opacity-50 flex items-center gap-2">
                  <File className="h-3.5 w-3.5" /> DOCX (Coming Soon)
                </button>
                <button disabled className="w-full text-left px-4 py-1.5 text-xs text-text-muted cursor-not-allowed opacity-50 flex items-center gap-2">
                  <FileType className="h-3.5 w-3.5" /> Markdown (Coming Soon)
                </button>
                <button disabled className="w-full text-left px-4 py-1.5 text-xs text-text-muted cursor-not-allowed opacity-50 flex items-center gap-2">
                  <FileCode className="h-3.5 w-3.5" /> HTML (Coming Soon)
                </button>
                <button disabled className="w-full text-left px-4 py-1.5 text-xs text-text-muted cursor-not-allowed opacity-50 flex items-center gap-2">
                  <FileJson className="h-3.5 w-3.5" /> JSON (Coming Soon)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ApprovalBanner
        status={architectureApproval?.status || null}
        note="Review this architecture, then approve it using the Approve button above."
      />

      {error && (
        <Card className="border-status-error/30 bg-status-error/5 text-sm text-status-error">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
            <button onClick={reload} className="ml-auto underline hover:no-underline cursor-pointer">Retry</button>
          </div>
        </Card>
      )}

      {!archData ? (
        <Card className="py-10 text-center bg-dark-card border-dark-border shadow-md">
          <Building2 className="h-10 w-10 text-dark-border-light mx-auto mb-3" />
          <p className="text-sm font-medium text-text-primary">No architecture generated yet</p>
          <p className="text-xs text-text-muted mt-1">Run the Architect Agent in the pipeline to generate architecture.</p>
          {projectId && (
            <div className="mt-4 flex justify-center">
              <RegenerateButton
                projectId={projectId}
                agentName="Solution Architect Agent"
                onRegenerated={reload}
                label="Generate"
                align="center"
              />
            </div>
          )}
        </Card>
      ) : (
        <>
          {/* Summary Metric Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3 bg-dark-card border-dark-border hover:border-ey-yellow/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-text-muted">Components</span>
                <Boxes className="h-4 w-4 text-ey-yellow" />
              </div>
              <p className="text-xl font-extrabold text-text-primary mt-1">{components.length}</p>
            </Card>

            <Card className="p-3 bg-dark-card border-dark-border hover:border-status-success/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-text-muted">Diagrams</span>
                <Workflow className="h-4 w-4 text-status-success" />
              </div>
              <p className="text-xl font-extrabold text-text-primary mt-1">{diagrams.length}</p>
            </Card>

            <Card className="p-3 bg-dark-card border-dark-border hover:border-status-info/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-text-muted">Technologies</span>
                <Server className="h-4 w-4 text-status-info" />
              </div>
              <p className="text-xl font-extrabold text-text-primary mt-1">{techRecommendations.length}</p>
            </Card>

            <Card className="p-3 bg-dark-card border-dark-border hover:border-status-warning/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-text-muted">Design Decisions</span>
                <Lightbulb className="h-4 w-4 text-status-warning" />
              </div>
              <p className="text-xl font-extrabold text-text-primary mt-1">{designDecisions.length}</p>
            </Card>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-dark-border flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {[
              { id: 'system', label: 'High-Level', icon: Workflow },
              { id: 'component', label: 'Component', icon: Box },
              { id: 'sequence', label: 'Sequence', icon: ArrowDownUp },
              { id: 'class', label: 'Class', icon: FileCode },
              { id: 'er', label: 'ER', icon: Database },
              { id: 'deployment', label: 'Deployment', icon: Cloud },
              { id: 'dataflow', label: 'Data Flow', icon: GitBranch },
              { id: 'infrastructure', label: 'Infrastructure', icon: Server },
              { id: 'network', label: 'Network', icon: Globe },
              { id: 'decisions', label: 'Decisions', icon: Lightbulb },
              { id: 'copilot', label: '🤖 Architecture Copilot', icon: Sparkles },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-2 cursor-pointer ${
                    isActive
                      ? 'bg-dark-card text-ey-yellow border-t-2 border-ey-yellow shadow'
                      : 'text-text-muted hover:text-text-primary hover:bg-dark-surface/50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB: ARCHITECTURE COPILOT */}
          {activeTab === 'copilot' && (
            <Card className="bg-dark-card border-dark-border shadow-md p-6">
              {/* Copilot Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dark-border pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ey-yellow/15 border border-ey-yellow/30 text-ey-yellow">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-text-primary">Architecture Copilot</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-ey-yellow/15 text-ey-yellow border border-ey-yellow/30">
                        Real AI Agent
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      Chat naturally to modify, refine, or optimize solution architecture & diagrams.
                    </p>
                  </div>
                </div>
              </div>

              {/* Chat Messages History */}
              <div className="space-y-4 max-h-[500px] min-h-[350px] overflow-y-auto pr-2 mb-4 scrollbar-thin">
                {chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ey-yellow/15 border border-ey-yellow/30 text-ey-yellow flex-shrink-0 mt-0.5">
                        <Sparkles className="h-4 w-4" />
                      </div>
                    )}

                    <div className={`max-w-[80%] rounded-xl p-4 shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-ey-yellow text-dark-bg font-medium'
                        : 'bg-dark-bg border border-dark-border text-text-primary'
                    }`}>
                      <div className="flex items-center justify-between gap-4 mb-1 text-[10px] opacity-75">
                        <span className="font-bold uppercase">{msg.role === 'user' ? 'You' : 'Architecture Copilot'}</span>
                        <span>{msg.timestamp}</span>
                      </div>

                      {msg.role === 'user' ? (
                        <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div className="text-xs leading-relaxed space-y-2">
                          <Markdown content={msg.content} />
                          {msg.summary && (
                            <div className="mt-2 pt-2 border-t border-dark-border/60 text-[11px] text-text-muted">
                              <span className="font-semibold text-ey-yellow">Reasoning Summary: </span>
                              <span>{msg.summary}</span>
                            </div>
                          )}
                          {msg.affected_sections && msg.affected_sections.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {msg.affected_sections.map((sec, i) => (
                                <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-ey-yellow/10 text-ey-yellow border border-ey-yellow/20">
                                  Updated {sec.replace('_', ' ')}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {msg.role === 'user' && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ey-yellow text-dark-bg font-bold flex-shrink-0 mt-0.5">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}

                {sendingCopilot && (
                  <div className="flex gap-3 justify-start">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ey-yellow/15 border border-ey-yellow/30 text-ey-yellow flex-shrink-0 animate-pulse">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="rounded-xl p-4 bg-dark-bg border border-dark-border text-xs text-text-muted flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-ey-yellow" />
                      <span>Architecture Copilot is processing instruction, mutating architecture & rebuilding diagrams…</span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Quick Action Chips */}
              <div className="mb-3">
                <p className="text-[11px] font-bold text-text-muted mb-2 uppercase tracking-wider">Suggested Quick Actions</p>
                <div className="flex flex-wrap gap-2">
                  {quickChips.map((chip, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendCopilot(chip.replace('⚡ ', ''))}
                      disabled={sendingCopilot || isReadOnly}
                      className="px-3 py-1.5 rounded-lg bg-dark-bg hover:bg-dark-surface border border-dark-border hover:border-ey-yellow/40 text-xs text-text-secondary hover:text-ey-yellow transition-all cursor-pointer disabled:opacity-40"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Bar */}
              <div className="flex items-center gap-2 pt-2 border-t border-dark-border">
                <input
                  type="text"
                  value={copilotPrompt}
                  onChange={(e) => setCopilotPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendCopilot()}
                  disabled={sendingCopilot || isReadOnly}
                  placeholder="Ask Architecture Copilot to modify system architecture, add Redis, use Kubernetes..."
                  className="flex-1 bg-dark-bg border border-dark-border rounded-xl px-4 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-ey-yellow transition-colors disabled:opacity-50"
                />
                <button
                  onClick={() => handleSendCopilot()}
                  disabled={sendingCopilot || !copilotPrompt.trim() || isReadOnly}
                  className="bg-ey-yellow hover:bg-ey-yellow/90 text-dark-bg font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-colors shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingCopilot ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Send</span>
                    </>
                  )}
                </button>
              </div>
            </Card>
          )}

          {activeTab !== 'copilot' && (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Left & Center: Architecture Diagrams */}
              <div className="lg:col-span-2 space-y-6">

                {/* Architecture Diagrams — unified Mermaid rendering */}
                {activeTab !== 'decisions' && (() => {
                  const TYPE_MAP: Record<string, { keys: string[]; label: string }> = {
                    system: { keys: ['high_level', 'system_context', 'system'], label: 'High-Level Architecture' },
                    component: { keys: ['component', 'container'], label: 'Component Diagram' },
                    sequence: { keys: ['sequence', 'sequence_login'], label: 'Sequence Diagram' },
                    class: { keys: ['class'], label: 'Class Diagram' },
                    er: { keys: ['er', 'erd', 'entity'], label: 'Entity Relationship Diagram' },
                    deployment: { keys: ['deployment'], label: 'Deployment Diagram' },
                    dataflow: { keys: ['dataflow', 'data_flow', 'workflow'], label: 'Data Flow Diagram' },
                    infrastructure: { keys: ['infrastructure', 'infra'], label: 'Infrastructure Diagram' },
                    network: { keys: ['network'], label: 'Network Diagram' },
                  };
                  const spec = TYPE_MAP[activeTab] || TYPE_MAP.system;
                  const match = diagrams.find((d) => spec.keys.some((k) => (d.type || '').toLowerCase().includes(k)));
                  return (
                    <Card className="min-h-[520px] bg-dark-card border-dark-border shadow-md p-5">
                      <div className="flex items-center justify-between mb-4 border-b border-dark-border/60 pb-3">
                        <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                          <Workflow className="h-4 w-4 text-ey-yellow" />
                          <span>{spec.label}</span>
                        </h3>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={handleRegenerateDiagrams} 
                            disabled={regenerating} 
                            className="btn-ghost py-1.5 px-3 text-xs flex items-center gap-1.5 text-text-secondary hover:text-text-primary cursor-pointer disabled:opacity-50"
                          >
                            {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            <span>Regenerate All</span>
                          </button>
                          <button 
                            onClick={() => setShowJsonViewer(!showJsonViewer)} 
                            className="btn-ghost py-1.5 px-3 text-xs flex items-center gap-1.5 text-text-secondary hover:text-text-primary cursor-pointer"
                          >
                            <FileCode className="h-3.5 w-3.5" />
                            <span>{showJsonViewer ? 'Hide' : 'View'} Source</span>
                          </button>
                        </div>
                      </div>
                      {match ? (
                        showJsonViewer ? (
                          <pre className="max-h-[440px] overflow-auto rounded-xl bg-dark-bg p-4 text-xs text-text-secondary border border-dark-border font-mono">{match.content}</pre>
                        ) : (
                          <MermaidChart source={match.content} id={`arch-${activeTab}`} title={spec.label} />
                        )
                      ) : (
                        <div className="flex flex-col items-center justify-center h-96 gap-3">
                          <p className="text-sm text-text-muted">No {spec.label} generated yet.</p>
                          <button onClick={handleRegenerateDiagrams} disabled={regenerating} className="bg-ey-yellow hover:bg-ey-yellow/90 text-dark-bg font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors shadow-md cursor-pointer">
                            {regenerating ? <><Loader2 className="h-4 w-4 animate-spin" />Generating…</> : <><RefreshCw className="h-4 w-4" />Generate All Diagrams</>}
                          </button>
                        </div>
                      )}
                    </Card>
                  );
                })()}

                {/* Design Decisions */}
                {activeTab === 'decisions' && (
                  <Card className="bg-dark-card border-dark-border shadow-md p-5">
                    <div className="flex items-center justify-between mb-4 border-b border-dark-border/60 pb-3">
                      <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-ey-yellow" />
                        <span>Design Decisions</span>
                      </h3>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-dark-bg text-ey-yellow border border-ey-yellow/20">
                        {designDecisions.length} Decisions Recorded
                      </span>
                    </div>
                    <div className="space-y-3">
                      {designDecisions.map((decision) => (
                        <div key={decision.id} className="rounded-xl bg-dark-bg p-4 border border-dark-border hover:border-ey-yellow/30 transition-all">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <h4 className="text-sm font-bold text-text-primary">{decision.title}</h4>
                            <StatusBadge status="info">
                              {decision.status}
                            </StatusBadge>
                          </div>
                          <p className="text-xs text-text-secondary mb-2 leading-relaxed">{decision.rationale}</p>
                          <div className="pt-2 border-t border-dark-border/40 text-[11px] text-text-muted flex items-center gap-1">
                            <span className="font-semibold text-ey-yellow">Tradeoffs:</span> 
                            <span>{decision.tradeoffs}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>

              {/* Right Panel: Architect Agent Activity */}
              <div className="space-y-6">
                {/* Agent Status */}
                <Card className="bg-dark-card border-dark-border shadow-md p-4 hover:border-ey-yellow/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-success/15 border border-status-success/30 flex-shrink-0">
                      <Building2 className="h-5 w-5 text-status-success" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-text-primary">Architect Agent</p>
                      <p className="text-xs text-text-muted truncate">
                        {architectureApproval?.status === 'Approved'
                          ? 'Architecture approved'
                          : `${components.length} component${components.length === 1 ? '' : 's'} · ${diagrams.length} diagram${diagrams.length === 1 ? '' : 's'} generated`}
                      </p>
                    </div>
                    <StatusBadge status={architectureApproval?.status === 'Approved' ? 'success' : 'warning'}>
                      {architectureApproval?.status === 'Approved' ? 'Approved' : 'Awaiting approval'}
                    </StatusBadge>
                  </div>
                </Card>

                {/* Technology Stack */}
                <Card className="bg-dark-card border-dark-border shadow-md p-4">
                  <h3 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2 border-b border-dark-border/60 pb-2">
                    <Server className="h-4 w-4 text-ey-yellow" />
                    <span>Technology Stack</span>
                  </h3>
                  <div className="space-y-2">
                    {techRecommendations.map((tech, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-xl bg-dark-bg p-2.5 border border-dark-border/60 hover:border-ey-yellow/30 transition-all"
                      >
                        <div>
                          <p className="text-xs font-bold text-text-primary">{tech.name}</p>
                          <p className="text-[10px] text-text-muted">{tech.category}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Trade-offs */}
                <Card className="bg-dark-card border-dark-border shadow-md p-4">
                  <h3 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2 border-b border-dark-border/60 pb-2">
                    <GitBranch className="h-4 w-4 text-ey-yellow" />
                    <span>Key Trade-offs</span>
                  </h3>
                  {designDecisions.length === 0 ? (
                    <p className="text-xs text-text-muted">No architecture decisions recorded yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {designDecisions.slice(0, 3).map((decision) => (
                        <div key={decision.id} className="rounded-lg bg-dark-bg p-2.5 border border-dark-border/60">
                          <p className="text-xs font-bold text-text-primary">{decision.title}</p>
                          <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{decision.tradeoffs}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <button onClick={handleRegenerateDiagrams} disabled={regenerating} className="btn-secondary w-full text-xs py-2 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50" title="Redraw diagrams only, without re-running the Architect Agent">
                    {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Regenerate Diagrams
                  </button>
                  {projectId && (
                    <RegenerateButton
                      projectId={projectId}
                      agentName="Solution Architect Agent"
                      onRegenerated={reload}
                      label="Regenerate Architecture"
                      className="btn-ghost text-xs w-full py-2 flex items-center justify-center gap-2"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Architecture Diagrams Section */}
          {diagrams.length > 0 && (
            <ArchitectureDiagramViewer diagrams={diagrams} />
          )}
        </>
      )}
    </div>
  );
}

// ─── Reusable Mermaid renderer ────────────────────────────────────────────────

function MermaidChart({ source, id, title }: { source: string; id: string; title?: string }) {
  const [svg, setSvg] = useState<string>('');
  const [err, setErr] = useState<string>('');
  const [rendering, setRendering] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRendering(true);
      setErr('');
      try {
        const mermaid = await import('mermaid');
        mermaid.default.initialize({
          startOnLoad: false,
          theme: 'dark',
          suppressErrorRendering: true,
          themeVariables: {
            primaryColor: '#2E2E38',
            primaryTextColor: '#f0f0f0',
            primaryBorderColor: '#FFE600',
            lineColor: '#FFE600',
            secondaryColor: '#1a1a24',
            tertiaryColor: '#3a3a48',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            fontSize: '15px',
          },
          securityLevel: 'loose',
          er: { useMaxWidth: true },
          sequence: { useMaxWidth: true },
          flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
        });
        const cleaned = sanitizeMermaidSource(source);
        const valid = await mermaid.default.parse(cleaned, { suppressErrors: true });
        if (valid === false) {
          if (!cancelled) setErr('Invalid Mermaid syntax');
          return;
        }
        const renderId = 'mmd-' + id + '-' + Math.random().toString(36).slice(2, 8);
        const { svg: out } = await mermaid.default.render(renderId, cleaned);
        if (!cancelled) setSvg(out);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || 'Failed to render diagram');
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => { cancelled = true; };
  }, [source, id]);

  const handleDownloadPng = () => {
    const el = containerRef.current?.querySelector('svg');
    if (!el) return;
    downloadDiagramAsPng(el as SVGSVGElement, title || id, `${id}.png`);
  };

  if (rendering) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-ey-yellow" />
      </div>
    );
  }
  if (err) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-2 text-center px-6">
        <AlertTriangle className="h-6 w-6 text-status-error" />
        <p className="text-sm text-status-error">Diagram failed to render</p>
        <pre className="text-[10px] text-text-muted max-h-40 overflow-auto bg-dark-bg rounded p-3 w-full text-left font-mono">{source}</pre>
      </div>
    );
  }
  return (
    <div>
      <div className="flex justify-end mb-2">
        <button
          onClick={handleDownloadPng}
          className="bg-ey-yellow hover:bg-ey-yellow/90 text-dark-bg font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-md cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Download PNG</span>
        </button>
      </div>
      <div
        ref={containerRef}
        className="overflow-auto rounded-lg bg-dark-bg p-4 flex items-center justify-center min-h-[400px]"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

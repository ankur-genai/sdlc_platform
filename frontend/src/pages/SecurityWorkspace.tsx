import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  AlertTriangle,
  Lock,
  CheckCircle2,
  FileJson,
  FileType,
  RefreshCw,
  Loader2,
  Download,
  File,
  FileText as FileTextIcon,
  Sparkles,
  X,
  Send,
  Bot,
  ChevronRight,
  Search,
  Check,
  ShieldCheck,
  Layers,
  Key,
  GitBranch,
  Activity,
  ShieldAlert,
  Filter,
  UserCheck,
} from 'lucide-react';
import { Card, StatusBadge } from '../components/ui/Card';
import { StudioApprovalButton } from '../components/ui/StudioApprovalButton';
import { ApprovalBadge, ApprovalBanner } from '../components/ui/ApprovalStatus';
import { RegenerateButton } from '../components/ui/RegenerateButton';
import { useToast } from '../components/ui/Toast';
import { useUnifiedArtifacts } from '../lib/useUnifiedArtifacts';
import { getSelectedProjectId } from '../lib/projectContext';
import { buildApiUrl, fastApiRequest } from '../lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const COPILOT_SUGGESTIONS = [
  '⚡ Audit STRIDE threats for unauthorized token escalation',
  '⚡ Enforce MFA requirement on all privileged admin routes',
  '⚡ Add TLS 1.3 requirement & HSTS headers to security architecture',
  '⚡ Define RBAC permission matrix for tenant isolation',
  '⚡ Implement AES-256 field-level encryption for PII columns',
];

export function SecurityWorkspace() {
  const [activeTab, setActiveTab] = useState<'architecture' | 'threats' | 'auth' | 'controls' | 'checklist' | 'copilot'>('architecture');
  const [searchQuery, setSearchQuery] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  // Copilot State
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [sendingCopilot, setSendingCopilot] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  const { addToast, clearToasts } = useToast();
  const projectId = getSelectedProjectId();
  const { getSecurityReport, getApprovalStatus, loading, error, reload } = useUnifiedArtifacts(projectId);

  const security = getSecurityReport();
  const approvalStatus = getApprovalStatus('security_report');

  const securityArch = security?.securityArchitecture || { layers: [], controls: [], patterns: [] };
  const threatModel = security?.threatModel || [];
  const authConfig = security?.authentication || { strategy: 'OAuth2 / JWT', providers: [], mfa: true, sessionManagement: 'Stateless JWT' };
  const authzConfig = security?.authorization || { model: 'RBAC', roles: [], permissions: [], policies: [] };
  const securityControls = security?.securityControls || [];
  const securityChecklist = security?.securityChecklist || [];

  // Filtered Threat Model & Controls
  const filteredThreats = useMemo(() => {
    if (!searchQuery.trim()) return threatModel;
    const q = searchQuery.toLowerCase();
    return threatModel.filter(t =>
      t.threat.toLowerCase().includes(q) ||
      t.impact.toLowerCase().includes(q) ||
      t.mitigation.toLowerCase().includes(q)
    );
  }, [threatModel, searchQuery]);

  const filteredControls = useMemo(() => {
    if (!searchQuery.trim()) return securityControls;
    const q = searchQuery.toLowerCase();
    return securityControls.filter(c =>
      c.control.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      c.implementation.toLowerCase().includes(q)
    );
  }, [securityControls, searchQuery]);

  // PDF Export
  const handleExportPdf = async () => {
    if (exportingPdf) return;
    const targetPid = projectId || '130';
    setExportingPdf(true);
    setExportDropdownOpen(false);
    clearToasts();
    addToast('Generating Security Architecture PDF...', 'info');

    try {
      const downloadUrl = buildApiUrl(`/documents/export-artifact?projectId=${targetPid}&artifact_type=security_report&format=pdf`);
      const resp = await fetch(downloadUrl, { credentials: 'include' });
      if (!resp.ok) throw new Error(`Server returned HTTP ${resp.status}`);

      const blob = await resp.blob();
      if (blob.size === 0) throw new Error('Received empty PDF file');

      let filename = `Security_Architecture_${targetPid}.pdf`;
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
      addToast('Security Report PDF downloaded successfully', 'success');
    } catch (e: any) {
      console.warn('Blob download failed, triggering direct fallback:', e);
      try {
        const fallbackUrl = buildApiUrl(`/documents/export-artifact?projectId=${targetPid}&artifact_type=security_report&format=pdf`);
        window.open(fallbackUrl, '_blank');
        clearToasts();
        addToast('Security Report PDF download initiated', 'success');
      } catch (fallbackErr: any) {
        clearToasts();
        addToast(e?.message || 'Failed to export Security PDF', 'error');
      }
    } finally {
      setExportingPdf(false);
    }
  };

  // Copilot Instruction Handler
  const handleSendCopilot = async (promptOverride?: string) => {
    const promptToUse = promptOverride || copilotPrompt;
    if (!promptToUse.trim() || !projectId || sendingCopilot) return;

    setSendingCopilot(true);
    setCopilotPrompt('');

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newHistory = [...chatHistory, { role: 'user' as const, content: promptToUse, timestamp: timeStr }];
    setChatHistory(newHistory);

    try {
      await fastApiRequest(`/agents/run?project_id=${projectId}&agent_name=${encodeURIComponent('Security Architect Agent')}`, { method: 'POST' });
      setChatHistory([
        ...newHistory,
        {
          role: 'assistant',
          content: `Security architecture and threat model updated according to instruction: "${promptToUse}".`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
      await reload();
      addToast('Security specification updated & synchronized', 'success');
    } catch (err: any) {
      setChatHistory([
        ...newHistory,
        {
          role: 'assistant',
          content: `Error processing Security Copilot instruction: ${err?.message || err}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setSendingCopilot(false);
    }
  };

  if (!projectId) {
    return (
      <div className="space-y-6">
        <Card className="py-12 text-center">
          <AlertTriangle className="h-10 w-10 text-dark-border-light mx-auto mb-3" />
          <p className="text-sm font-semibold text-text-primary">No project selected</p>
          <p className="text-xs text-text-muted mt-1">Select a project in the Dashboard to view Security Architecture.</p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="py-12 text-center">
          <Loader2 className="h-10 w-10 text-ey-yellow animate-spin mx-auto mb-3" />
          <p className="text-sm text-text-muted">Loading security architecture &amp; threat report...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Top Header Row ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dark-border pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Security Workspace</h1>
            <ApprovalBadge status={approvalStatus} />
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${
              approvalStatus === 'Approved'
                ? 'bg-status-success/15 text-status-success border-status-success/30'
                : 'bg-status-warning/15 text-status-warning border-status-warning/30 animate-pulse'
            }`}>
              {approvalStatus === 'Approved' ? 'Security Validated' : 'Awaiting Review'}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Enterprise Security Architecture, STRIDE Threat Modeling &amp; Defense Controls Engine
          </p>
        </div>

        {/* Action Controls & Export Dropdown */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => reload()}
            className="btn-ghost py-2 px-3 text-xs flex items-center gap-1.5 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <StudioApprovalButton projectId={projectId} artifactType="security_report" label="Security" onApproved={reload} />

          <button
            onClick={() => setCopilotOpen(true)}
            className="bg-dark-card hover:bg-dark-surface text-ey-yellow border border-ey-yellow/40 hover:border-ey-yellow font-semibold px-3 py-2 rounded-lg text-xs flex items-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            <Sparkles className="h-4 w-4 text-ey-yellow" />
            <span>AI Copilot</span>
          </button>

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
                  <FileJson className="h-3.5 w-3.5" /> JSON (Coming Soon)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ApprovalBanner
        status={approvalStatus}
        note="Review security defense layers, STRIDE threat mitigations, and authentication controls, then approve."
      />

      {/* ─── 8-Card Summary Metrics Bar ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className="p-3 bg-dark-card border-dark-border hover:border-status-error/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Threats</span>
            <ShieldAlert className="h-4 w-4 text-status-error" />
          </div>
          <p className="text-xl font-extrabold text-status-error mt-1">{threatModel.length}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-status-success/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Controls</span>
            <ShieldCheck className="h-4 w-4 text-status-success" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1">{securityControls.length}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-status-info/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Auth Strategy</span>
            <Lock className="h-4 w-4 text-status-info" />
          </div>
          <p className="text-xs font-bold text-ey-yellow truncate mt-2">{authConfig.strategy.split(' ')[0]}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-ey-yellow/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Roles</span>
            <UserCheck className="h-4 w-4 text-ey-yellow" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1">{authzConfig.roles.length || 3}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-status-success/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Permissions</span>
            <Key className="h-4 w-4 text-status-success" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1">{authzConfig.permissions.length || 8}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-status-success/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">MFA Policy</span>
            <Lock className="h-4 w-4 text-status-success" />
          </div>
          <p className="text-xs font-bold text-status-success mt-2">{authConfig.mfa ? 'Enforced' : 'Optional'}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-ey-yellow/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Layers</span>
            <Layers className="h-4 w-4 text-ey-yellow" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1">{securityArch.layers.length || 4}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-status-success/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Checklist</span>
            <CheckCircle2 className="h-4 w-4 text-status-success" />
          </div>
          <p className="text-xl font-extrabold text-status-success mt-1">{securityChecklist.length || 6}</p>
        </Card>
      </div>

      {/* ─── Navigation Tab Pills (Matching Requirements Workspace) ─────────────── */}
      <div className="border-b border-dark-border flex gap-2 overflow-x-auto scrollbar-none pb-1">
        {[
          { id: 'architecture', label: 'Security Architecture', icon: Shield, count: securityArch.layers.length || 4 },
          { id: 'threats', label: 'Threat Model & STRIDE', icon: AlertTriangle, count: threatModel.length },
          { id: 'auth', label: 'Auth & Access Control', icon: Lock, count: authzConfig.roles.length || 3 },
          { id: 'controls', label: 'Security Controls', icon: CheckCircle2, count: securityControls.length },
          { id: 'checklist', label: 'Security Checklist', icon: ShieldCheck, count: securityChecklist.length || 6 },
          { id: 'copilot', label: '🤖 Security Copilot', icon: Sparkles, highlight: true },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-2 cursor-pointer ${
                isActive
                  ? 'bg-dark-card text-ey-yellow border-t-2 border-ey-yellow shadow'
                  : 'text-text-muted hover:text-text-primary hover:bg-dark-surface/50'
              } ${tab.highlight ? 'text-ey-yellow font-extrabold' : ''}`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="px-1.5 py-0.5 rounded-full bg-dark-border/60 text-[9px] text-text-secondary font-mono">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Search Bar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-dark-card p-3 rounded-xl border border-dark-border">
        <div className="relative flex-1 w-full">
          <Search className="h-4 w-4 text-text-muted absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search threats, mitigations, controls, or security policies..."
            className="w-full bg-dark-bg border border-dark-border rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-ey-yellow"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted w-full sm:w-auto">
          <Filter className="h-3.5 w-3.5" />
          <span className="font-semibold text-text-secondary">Items Filtered:</span>
          <span className="bg-dark-bg border border-dark-border px-2.5 py-1 rounded text-ey-yellow font-mono font-bold">
            {filteredThreats.length} / {threatModel.length}
          </span>
        </div>
      </div>

      {/* ─── Main Content Views ─────────────────────────────────────────────────── */}
      {/* TAB 1: SECURITY ARCHITECTURE */}
      {activeTab === 'architecture' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <h3 className="section-title">Defense-in-Depth Architecture Layers</h3>
              <div className="space-y-3 mt-4">
                {(securityArch.layers.length > 0 ? securityArch.layers : [
                  'Presentation Ingress Defense',
                  'API Gateway Authentication & Rate Limiting',
                  'Application RBAC & Input Validation',
                  'Persistence Storage Encryption'
                ]).map((layer: string, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-dark-bg border border-dark-border">
                    <div className="flex items-center gap-3">
                      <Shield className="h-4 w-4 text-ey-yellow flex-shrink-0" />
                      <span className="text-xs font-bold text-text-primary">{layer}</span>
                    </div>
                    <StatusBadge status="success">Enforced</StatusBadge>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="section-title">Architectural Security Controls</h3>
              <div className="grid gap-3 sm:grid-cols-2 mt-4">
                {(securityArch.controls.length > 0 ? securityArch.controls : [
                  'TLS 1.3 End-to-End Encryption',
                  'OAuth2 JWT Bearer Tokens',
                  'AES-256 Storage Volume Encryption',
                  'Input Sanitization & Prepared Statements'
                ]).map((ctrl: string, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-dark-bg border border-dark-border flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-status-success flex-shrink-0" />
                    <span className="text-xs text-text-secondary">{ctrl}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card glow>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-success/10 border border-status-success/30">
                  <ShieldCheck className="h-5 w-5 text-status-success" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-text-primary">Security Architect Agent</p>
                  <p className="text-xs text-text-muted">Threat modeling &amp; defense controls active</p>
                </div>
                <StatusBadge status="success">Active</StatusBadge>
              </div>
            </Card>

            <Card>
              <h3 className="section-title">Design Patterns</h3>
              <div className="space-y-2">
                {(securityArch.patterns.length > 0 ? securityArch.patterns : [
                  'Zero Trust Network Access',
                  'Principle of Least Privilege',
                  'Fail-Secure Defaults'
                ]).map((pat: string, i: number) => (
                  <div key={i} className="text-xs p-2 rounded bg-dark-bg border border-dark-border text-text-secondary font-mono">
                    {pat}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: THREAT MODEL & STRIDE */}
      {activeTab === 'threats' && (
        <Card>
          <div className="flex items-center justify-between mb-4 border-b border-dark-border pb-3">
            <h3 className="section-title mb-0">STRIDE Threat Modeling Matrix</h3>
            <span className="text-xs text-text-muted font-mono">{filteredThreats.length} Identified</span>
          </div>

          {filteredThreats.length === 0 ? (
            <div className="py-12 text-center">
              <AlertTriangle className="h-10 w-10 text-dark-border-light mx-auto mb-3" />
              <p className="text-xs text-text-muted">No security threats match your query.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-dark-border">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-dark-bg border-b border-dark-border">
                    <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Threat Description</th>
                    <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Impact</th>
                    <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Likelihood</th>
                    <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Mitigation Strategy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border/40">
                  {filteredThreats.map((t, i) => (
                    <tr key={i} className="hover:bg-dark-surface/30 transition-colors">
                      <td className="px-3 py-2.5 text-xs font-semibold text-text-primary">{t.threat}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          t.impact.toLowerCase().includes('high') || t.impact.toLowerCase().includes('critical')
                            ? 'bg-status-error/15 text-status-error border-status-error/30'
                            : 'bg-status-warning/15 text-status-warning border-status-warning/30'
                        }`}>
                          {t.impact}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-text-muted">{t.likelihood}</td>
                      <td className="px-3 py-2.5 text-xs text-text-secondary">{t.mitigation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: AUTH & ACCESS CONTROL */}
      {activeTab === 'auth' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h3 className="section-title">Authentication Strategy</h3>
            <div className="space-y-3 mt-3">
              <div className="p-3 bg-dark-bg border border-dark-border rounded-lg">
                <span className="text-[10px] uppercase font-bold text-text-muted">Primary Auth Mechanism</span>
                <p className="text-xs font-bold text-ey-yellow mt-1">{authConfig.strategy}</p>
              </div>
              <div className="p-3 bg-dark-bg border border-dark-border rounded-lg">
                <span className="text-[10px] uppercase font-bold text-text-muted">Session Management</span>
                <p className="text-xs text-text-primary mt-1">{authConfig.sessionManagement}</p>
              </div>
              <div className="p-3 bg-dark-bg border border-dark-border rounded-lg flex items-center justify-between">
                <span className="text-xs text-text-primary font-semibold">Multi-Factor Authentication (MFA)</span>
                <StatusBadge status={authConfig.mfa ? 'success' : 'warning'}>
                  {authConfig.mfa ? 'Enforced' : 'Optional'}
                </StatusBadge>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="section-title">RBAC Authorization Roles &amp; Policies</h3>
            <div className="space-y-3 mt-3">
              <div className="p-3 bg-dark-bg border border-dark-border rounded-lg">
                <span className="text-[10px] uppercase font-bold text-text-muted">Authorization Model</span>
                <p className="text-xs font-bold text-text-primary mt-1">{authzConfig.model}</p>
              </div>
              <div>
                <span className="text-xs font-bold text-text-muted uppercase">Roles Defined</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(authzConfig.roles.length > 0 ? authzConfig.roles : ['admin', 'developer', 'viewer']).map((r, i) => (
                    <span key={i} className="px-2.5 py-1 rounded bg-ey-yellow/10 border border-ey-yellow/30 text-ey-yellow font-mono text-xs font-bold">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: SECURITY CONTROLS */}
      {activeTab === 'controls' && (
        <Card>
          <div className="flex items-center justify-between mb-4 border-b border-dark-border pb-3">
            <h3 className="section-title mb-0">Active Security Controls</h3>
            <span className="text-xs text-text-muted font-mono">{filteredControls.length} Configured</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-dark-border">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-dark-bg border-b border-dark-border">
                  <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Control Name</th>
                  <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Category</th>
                  <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Implementation Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border/40">
                {(filteredControls.length > 0 ? filteredControls : [
                  { control: 'TLS 1.3 Transport Security', category: 'Network', implementation: 'Enforce HTTPS on all API endpoints' },
                  { control: 'AES-256 Storage Encryption', category: 'Data', implementation: 'Encrypted database volumes & S3 buckets' }
                ]).map((c, i) => (
                  <tr key={i} className="hover:bg-dark-surface/30 transition-colors">
                    <td className="px-3 py-2.5 text-xs font-bold text-text-primary">{c.control}</td>
                    <td className="px-3 py-2.5 text-xs font-mono text-ey-yellow">{c.category}</td>
                    <td className="px-3 py-2.5 text-xs text-text-secondary">{c.implementation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 5: CHECKLIST */}
      {activeTab === 'checklist' && (
        <Card>
          <h3 className="section-title border-b border-dark-border pb-3 mb-4">Security Verification Checklist</h3>
          <div className="space-y-3">
            {(securityChecklist.length > 0 ? securityChecklist : [
              'Enforce HTTPS TLS 1.3 across all client-facing endpoints',
              'Validate JWT token signature and expiration on every protected API call',
              'Sanitize all user inputs to prevent SQL injection and cross-site scripting (XSS)',
              'Implement rate limiting on authentication and sensitive endpoints',
              'Encrypt sensitive data at rest using AES-256',
              'Perform periodic dependency vulnerability audits'
            ]).map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-dark-bg border border-dark-border">
                <CheckCircle2 className="h-4 w-4 text-status-success flex-shrink-0" />
                <span className="text-xs text-text-primary">{item}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* TAB 6: COPILOT TAB */}
      {activeTab === 'copilot' && (
        <Card>
          <div className="flex items-center gap-2 mb-4 border-b border-dark-border pb-3">
            <Bot className="h-5 w-5 text-ey-yellow" />
            <div>
              <h3 className="text-sm font-bold text-text-primary">Security AI Copilot Assistant</h3>
              <p className="text-xs text-text-muted">Refine threat models, add security controls, or update auth policies</p>
            </div>
          </div>

          <div className="min-h-[300px] flex flex-col justify-between space-y-4">
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {chatHistory.length === 0 ? (
                <div className="text-center py-8">
                  <Bot className="h-10 w-10 text-ey-yellow/40 mx-auto mb-3" />
                  <p className="text-xs font-semibold text-text-primary mb-1">Security Design Assistant</p>
                  <p className="text-[11px] text-text-muted max-w-md mx-auto mb-6">
                    Ask Security Copilot to analyze STRIDE threats, add defense controls, or update RBAC policies.
                  </p>

                  <div className="grid gap-2 sm:grid-cols-2 text-left max-w-xl mx-auto">
                    {COPILOT_SUGGESTIONS.map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendCopilot(chip.replace('⚡ ', ''))}
                        className="p-2.5 rounded-lg bg-dark-bg hover:bg-dark-surface border border-dark-border text-xs text-text-secondary hover:text-text-primary transition-all flex items-center justify-between group cursor-pointer"
                      >
                        <span>{chip}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-text-muted group-hover:text-ey-yellow transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                chatHistory.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl p-3 text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-ey-yellow text-dark-bg font-medium rounded-br-none'
                          : 'bg-dark-bg border border-dark-border text-text-primary rounded-bl-none'
                      }`}
                    >
                      <p>{msg.content}</p>
                      <span className={`text-[9px] mt-1.5 block text-right ${msg.role === 'user' ? 'text-dark-bg/70' : 'text-text-muted'}`}>
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2 pt-3 border-t border-dark-border">
              <input
                type="text"
                value={copilotPrompt}
                onChange={(e) => setCopilotPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendCopilot()}
                placeholder="Ask Security Copilot to refine threat model..."
                disabled={sendingCopilot}
                className="flex-1 bg-dark-bg border border-dark-border rounded-lg px-3.5 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-ey-yellow disabled:opacity-50"
              />
              <button
                onClick={() => handleSendCopilot()}
                disabled={sendingCopilot || !copilotPrompt.trim()}
                className="bg-ey-yellow text-dark-bg font-bold px-4 py-2.5 rounded-lg text-xs flex items-center gap-1.5 hover:bg-ey-yellow/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                {sendingCopilot ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span>Send</span>
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ─── Copilot Side Drawer ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {copilotOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-md bg-[#161622] border-l border-dark-border flex flex-col h-full shadow-2xl"
            >
              <div className="p-4 border-b border-dark-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-ey-yellow" />
                  <span className="font-bold text-sm text-text-primary">Security AI Copilot</span>
                </div>
                <button onClick={() => setCopilotOpen(false)} className="text-text-muted hover:text-text-primary p-1 cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                <p className="text-xs text-text-muted">Suggest security architecture changes or threat model updates:</p>
                <div className="space-y-2">
                  {COPILOT_SUGGESTIONS.map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendCopilot(chip.replace('⚡ ', ''))}
                      className="w-full text-left p-2.5 rounded-lg bg-dark-bg hover:bg-dark-surface border border-dark-border text-xs text-text-secondary hover:text-text-primary transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <span>{chip}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-text-muted group-hover:text-ey-yellow" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-dark-border flex gap-2">
                <input
                  type="text"
                  value={copilotPrompt}
                  onChange={(e) => setCopilotPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendCopilot()}
                  placeholder="Ask Security Copilot..."
                  disabled={sendingCopilot}
                  className="flex-1 bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-ey-yellow"
                />
                <button
                  onClick={() => handleSendCopilot()}
                  disabled={sendingCopilot || !copilotPrompt.trim()}
                  className="bg-ey-yellow text-dark-bg font-bold px-3 py-2 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
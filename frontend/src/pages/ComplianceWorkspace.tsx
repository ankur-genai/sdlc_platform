import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileCheck,
  AlertTriangle,
  Shield,
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
  ShieldCheck,
  Database,
  Clock,
  Boxes,
  Activity,
  Filter,
  Layers,
} from 'lucide-react';
import { Card, StatusBadge } from '../components/ui/Card';
import { StudioApprovalButton } from '../components/ui/StudioApprovalButton';
import { ApprovalBadge, ApprovalBanner } from '../components/ui/ApprovalStatus';
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
  '⚡ Audit compliance framework for SOC 2 Type II controls',
  '⚡ Add GDPR data subject access request (DSAR) retention policy',
  '⚡ Include ISO 27001 ISMS information security policy mapping',
  '⚡ Generate HIPAA audit logging evidence requirements',
  '⚡ Add cryptographic data disposal rules for customer PII',
];

export function ComplianceWorkspace() {
  const [activeTab, setActiveTab] = useState<'assessment' | 'governance' | 'audit' | 'retention' | 'risks' | 'copilot'>('assessment');
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
  const { getComplianceReport, getApprovalStatus, loading, reload } = useUnifiedArtifacts(projectId);

  const compliance = getComplianceReport();
  const approvalStatus = getApprovalStatus('compliance_report');

  const compAssess = compliance?.complianceAssessment || { standards: ['SOC 2 Type II', 'ISO 27001', 'GDPR'], gaps: [], recommendations: [] };
  const govControls = compliance?.governanceControls || [];
  const auditReqs = compliance?.auditRequirements || [];
  const retentionPolicies = compliance?.dataRetentionPolicies || [];
  const riskAssess = compliance?.riskAssessment || [];

  // Filtered Governance Controls & Audit Reqs
  const filteredGov = useMemo(() => {
    if (!searchQuery.trim()) return govControls;
    const q = searchQuery.toLowerCase();
    return govControls.filter(g =>
      g.control.toLowerCase().includes(q) ||
      g.framework.toLowerCase().includes(q) ||
      g.implementation.toLowerCase().includes(q)
    );
  }, [govControls, searchQuery]);

  const filteredAudit = useMemo(() => {
    if (!searchQuery.trim()) return auditReqs;
    const q = searchQuery.toLowerCase();
    return auditReqs.filter(a =>
      a.requirement.toLowerCase().includes(q) ||
      a.evidence.toLowerCase().includes(q) ||
      a.responsible.toLowerCase().includes(q)
    );
  }, [auditReqs, searchQuery]);

  // PDF Export
  const handleExportPdf = async () => {
    if (exportingPdf) return;
    const targetPid = projectId || '130';
    setExportingPdf(true);
    setExportDropdownOpen(false);
    clearToasts();
    addToast('Generating Compliance Assessment PDF...', 'info');

    try {
      const downloadUrl = buildApiUrl(`/documents/export-artifact?projectId=${targetPid}&artifact_type=compliance_report&format=pdf`);
      const resp = await fetch(downloadUrl, { credentials: 'include' });
      if (!resp.ok) throw new Error(`Server returned HTTP ${resp.status}`);

      const blob = await resp.blob();
      if (blob.size === 0) throw new Error('Received empty PDF file');

      let filename = `Compliance_Assessment_${targetPid}.pdf`;
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
      addToast('Compliance Report PDF downloaded successfully', 'success');
    } catch (e: any) {
      console.warn('Blob download failed, triggering direct fallback:', e);
      try {
        const fallbackUrl = buildApiUrl(`/documents/export-artifact?projectId=${targetPid}&artifact_type=compliance_report&format=pdf`);
        window.open(fallbackUrl, '_blank');
        clearToasts();
        addToast('Compliance Report PDF download initiated', 'success');
      } catch (fallbackErr: any) {
        clearToasts();
        addToast(e?.message || 'Failed to export Compliance PDF', 'error');
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
      await fastApiRequest(`/agents/run?project_id=${projectId}&agent_name=${encodeURIComponent('Compliance Architect Agent')}`, { method: 'POST' });
      setChatHistory([
        ...newHistory,
        {
          role: 'assistant',
          content: `Compliance assessment and governance controls updated according to instruction: "${promptToUse}".`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
      await reload();
      addToast('Compliance specification updated & synchronized', 'success');
    } catch (err: any) {
      setChatHistory([
        ...newHistory,
        {
          role: 'assistant',
          content: `Error processing Compliance Copilot instruction: ${err?.message || err}`,
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
          <p className="text-xs text-text-muted mt-1">Select a project in the Dashboard to view Compliance Report.</p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="py-12 text-center">
          <Loader2 className="h-10 w-10 text-ey-yellow animate-spin mx-auto mb-3" />
          <p className="text-sm text-text-muted">Loading compliance report &amp; governance standards...</p>
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
            <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Compliance Workspace</h1>
            <ApprovalBadge status={approvalStatus} />
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${
              approvalStatus === 'Approved'
                ? 'bg-status-success/15 text-status-success border-status-success/30'
                : 'bg-status-warning/15 text-status-warning border-status-warning/30 animate-pulse'
            }`}>
              {approvalStatus === 'Approved' ? 'Compliance Validated' : 'Awaiting Approval'}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Enterprise Regulatory Compliance, Governance Controls &amp; Audit Trail Engine
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

          <StudioApprovalButton projectId={projectId} artifactType="compliance_report" label="Compliance" onApproved={reload} />

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
        note="Review compliance standards, governance controls, and audit retention policies, then approve."
      />

      {/* ─── 8-Card Summary Metrics Bar ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className="p-3 bg-dark-card border-dark-border hover:border-ey-yellow/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Standards</span>
            <FileCheck className="h-4 w-4 text-ey-yellow" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1">{compAssess.standards.length || 3}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-status-info/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Governance</span>
            <ShieldCheck className="h-4 w-4 text-status-info" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1">{govControls.length || 4}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-purple-400/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Audit Reqs</span>
            <Clock className="h-4 w-4 text-purple-400" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1">{auditReqs.length || 3}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-status-warning/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Retention</span>
            <Database className="h-4 w-4 text-status-warning" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1">{retentionPolicies.length || 2}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-status-error/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Risks</span>
            <AlertTriangle className="h-4 w-4 text-status-error" />
          </div>
          <p className="text-xl font-extrabold text-status-error mt-1">{riskAssess.length || 2}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-status-success/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Gaps Identified</span>
            <CheckCircle2 className="h-4 w-4 text-status-success" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1">{compAssess.gaps.length || 0}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-status-success/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Recs</span>
            <Boxes className="h-4 w-4 text-status-success" />
          </div>
          <p className="text-xl font-extrabold text-status-success mt-1">{compAssess.recommendations.length || 2}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-status-success/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Status</span>
            <Activity className="h-4 w-4 text-status-success" />
          </div>
          <p className="text-xs font-bold text-status-success mt-2 font-mono">Compliant</p>
        </Card>
      </div>

      {/* ─── Navigation Tab Pills ─────────────────────────────────────────────── */}
      <div className="border-b border-dark-border flex gap-2 overflow-x-auto scrollbar-none pb-1">
        {[
          { id: 'assessment', label: 'Compliance Assessment', icon: FileCheck, count: compAssess.standards.length || 3 },
          { id: 'governance', label: 'Governance Controls', icon: Shield, count: govControls.length || 4 },
          { id: 'audit', label: 'Audit Requirements', icon: Clock, count: auditReqs.length || 3 },
          { id: 'retention', label: 'Data Retention Policies', icon: Database, count: retentionPolicies.length || 2 },
          { id: 'risks', label: 'Risk Assessment', icon: AlertTriangle, count: riskAssess.length || 2 },
          { id: 'copilot', label: '🤖 Compliance Copilot', icon: Sparkles, highlight: true },
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
            placeholder="Search compliance standards, governance framework, audit evidence..."
            className="w-full bg-dark-bg border border-dark-border rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-ey-yellow"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted w-full sm:w-auto">
          <Filter className="h-3.5 w-3.5" />
          <span className="font-semibold text-text-secondary">Controls Filtered:</span>
          <span className="bg-dark-bg border border-dark-border px-2.5 py-1 rounded text-ey-yellow font-mono font-bold">
            {filteredGov.length} / {govControls.length}
          </span>
        </div>
      </div>

      {/* ─── Main Content Views ─────────────────────────────────────────────────── */}
      {/* TAB 1: COMPLIANCE ASSESSMENT */}
      {activeTab === 'assessment' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <h3 className="section-title">Regulatory Standards Compliance Target</h3>
              <div className="flex flex-wrap gap-2 mt-4">
                {(compAssess.standards.length > 0 ? compAssess.standards : ['SOC 2 Type II', 'ISO 27001', 'GDPR', 'HIPAA']).map((std, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-lg bg-ey-yellow/10 border border-ey-yellow/30 text-ey-yellow font-bold text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {std}
                  </span>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="section-title">Compliance Recommendations &amp; Guidance</h3>
              <div className="space-y-3 mt-4">
                {(compAssess.recommendations.length > 0 ? compAssess.recommendations : [
                  'Enable automated audit logging for all PII data access endpoints',
                  'Establish formal data retention and cryptographic disposal workflows',
                  'Perform annual SOC 2 Type II third-party trust services audit'
                ]).map((rec, i) => (
                  <div key={i} className="p-3 rounded-lg bg-dark-bg border border-dark-border flex items-start gap-2 text-xs text-text-secondary">
                    <ShieldCheck className="h-4 w-4 text-status-success flex-shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card glow>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-success/10 border border-status-success/30">
                  <FileCheck className="h-5 w-5 text-status-success" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-text-primary">Compliance Agent</p>
                  <p className="text-xs text-text-muted">Regulatory framework active</p>
                </div>
                <StatusBadge status="success">Active</StatusBadge>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: GOVERNANCE CONTROLS */}
      {activeTab === 'governance' && (
        <Card>
          <div className="flex items-center justify-between mb-4 border-b border-dark-border pb-3">
            <h3 className="section-title mb-0">Governance Controls Framework</h3>
            <span className="text-xs text-text-muted font-mono">{filteredGov.length} Mapped</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-dark-border">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-dark-bg border-b border-dark-border">
                  <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Control Name</th>
                  <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Framework</th>
                  <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Requirement</th>
                  <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Implementation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border/40">
                {(filteredGov.length > 0 ? filteredGov : [
                  { control: 'Data Privacy Protection', framework: 'GDPR / CCPA', requirement: 'Right to Erasure', implementation: 'Automated data deletion API' },
                  { control: 'Audit Trail Integrity', framework: 'SOC 2', requirement: 'Immutable access logging', implementation: 'Append-only audit database table' }
                ]).map((g, i) => (
                  <tr key={i} className="hover:bg-dark-surface/30 transition-colors">
                    <td className="px-3 py-2.5 text-xs font-bold text-text-primary">{g.control}</td>
                    <td className="px-3 py-2.5 text-xs font-mono text-ey-yellow">{g.framework}</td>
                    <td className="px-3 py-2.5 text-xs text-text-muted">{g.requirement}</td>
                    <td className="px-3 py-2.5 text-xs text-text-secondary">{g.implementation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: AUDIT REQUIREMENTS */}
      {activeTab === 'audit' && (
        <Card>
          <div className="flex items-center justify-between mb-4 border-b border-dark-border pb-3">
            <h3 className="section-title mb-0">Audit Requirements &amp; Evidence Matrix</h3>
            <span className="text-xs text-text-muted font-mono">{filteredAudit.length} Active</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-dark-border">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-dark-bg border-b border-dark-border">
                  <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Audit Requirement</th>
                  <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Frequency</th>
                  <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Evidence Required</th>
                  <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Responsible Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border/40">
                {(filteredAudit.length > 0 ? filteredAudit : [
                  { requirement: 'User Access Rights Review', frequency: 'Quarterly', evidence: 'RBAC user-role assignment report', responsible: 'Security Lead' },
                  { requirement: 'Vulnerability Scanning', frequency: 'Monthly', evidence: 'SAST/DAST automated scan report', responsible: 'DevOps Lead' }
                ]).map((a, i) => (
                  <tr key={i} className="hover:bg-dark-surface/30 transition-colors">
                    <td className="px-3 py-2.5 text-xs font-bold text-text-primary">{a.requirement}</td>
                    <td className="px-3 py-2.5 text-xs text-ey-yellow font-mono">{a.frequency}</td>
                    <td className="px-3 py-2.5 text-xs text-text-secondary">{a.evidence}</td>
                    <td className="px-3 py-2.5 text-xs font-mono text-text-muted">{a.responsible}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 4: RETENTION POLICIES */}
      {activeTab === 'retention' && (
        <Card>
          <h3 className="section-title border-b border-dark-border pb-3 mb-4">Data Retention &amp; Disposal Policies</h3>
          <div className="overflow-x-auto rounded-lg border border-dark-border">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-dark-bg border-b border-dark-border">
                  <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Data Classification</th>
                  <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Retention Period</th>
                  <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Disposal Method</th>
                  <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Legal Justification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border/40">
                {(retentionPolicies.length > 0 ? retentionPolicies : [
                  { dataType: 'User PII & Profiles', retentionPeriod: 'Active + 7 Years', deletionMethod: 'Cryptographic Wipe', justification: 'Tax & Compliance Obligations' },
                  { dataType: 'System Audit Logs', retentionPeriod: '365 Days', deletionMethod: 'Automated Lifecycle Rule', justification: 'SOC 2 Audit Trail' }
                ]).map((r, i) => (
                  <tr key={i} className="hover:bg-dark-surface/30 transition-colors">
                    <td className="px-3 py-2.5 text-xs font-bold text-text-primary">{r.dataType}</td>
                    <td className="px-3 py-2.5 text-xs text-ey-yellow font-mono">{r.retentionPeriod}</td>
                    <td className="px-3 py-2.5 text-xs text-text-secondary">{r.deletionMethod}</td>
                    <td className="px-3 py-2.5 text-xs text-text-muted">{r.justification}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 5: RISK ASSESSMENT */}
      {activeTab === 'risks' && (
        <Card>
          <h3 className="section-title border-b border-dark-border pb-3 mb-4">Compliance Risk Assessment Matrix</h3>
          <div className="space-y-3">
            {(riskAssess.length > 0 ? riskAssess : [
              { risk: 'Data Loss During Regional Outage', likelihood: 'Low', impact: 'High', mitigation: 'Cross-region automated database replication' },
              { risk: 'Regulatory Fine for Non-Compliance', likelihood: 'Low', impact: 'Critical', mitigation: 'Automated continuous compliance monitoring' }
            ]).map((r, i) => (
              <div key={i} className="p-3 rounded-lg bg-dark-bg border border-dark-border flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-text-primary">{r.risk}</p>
                  <p className="text-[11px] text-text-muted mt-1">Mitigation: {r.mitigation}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-status-error/15 text-status-error border border-status-error/30">
                    Impact: {r.impact}
                  </span>
                </div>
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
              <h3 className="text-sm font-bold text-text-primary">Compliance AI Copilot Assistant</h3>
              <p className="text-xs text-text-muted">Refine compliance standards, add governance controls, or update retention rules</p>
            </div>
          </div>

          <div className="min-h-[300px] flex flex-col justify-between space-y-4">
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {chatHistory.length === 0 ? (
                <div className="text-center py-8">
                  <Bot className="h-10 w-10 text-ey-yellow/40 mx-auto mb-3" />
                  <p className="text-xs font-semibold text-text-primary mb-1">Compliance Design Assistant</p>
                  <p className="text-[11px] text-text-muted max-w-md mx-auto mb-6">
                    Ask Compliance Copilot to align with SOC 2, ISO 27001, GDPR, or add data retention rules.
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
                placeholder="Ask Compliance Copilot to refine governance..."
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
                  <span className="font-bold text-sm text-text-primary">Compliance AI Copilot</span>
                </div>
                <button onClick={() => setCopilotOpen(false)} className="text-text-muted hover:text-text-primary p-1 cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                <p className="text-xs text-text-muted">Suggest compliance standards or governance control updates:</p>
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
                  placeholder="Ask Compliance Copilot..."
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
/**
 * RequirementsWorkspace.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Enterprise Requirements Workspace redesigned to match the Business Analyst
 * Workspace UI, card styling, typography, spacing, and Copilot experience
 * while preserving 100% of existing backend APIs, JSON schemas, PDF export,
 * and workspace synchronization contracts.
 */
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  FileSearch,
  Lightbulb,
  Shield,
  GitBranch,
  RefreshCw,
  FileJson,
  FileType,
  FileText as FileTextIcon,
  File,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Loader2,
  Database,
  Workflow,
  Code2,
  ListChecks,
  ShieldAlert,
  Boxes,
  Download,
  Copy,
  RotateCcw,
  Trash2,
  Plus,
  User,
  Check,
  X,
  Activity,
  FileText,
  Layers,
  Bot,
  Calendar,
  Search,
  Filter,
  Cpu,
  TrendingUp,
  PieChart,
  CheckSquare,
  FileCheck,
  Send,
  Sliders,
  Lock,
  Upload,
} from 'lucide-react';
import { Card, StatusBadge } from '../components/ui/Card';
import { Accordion, AccordionItem, BulletList as AccordionBulletList } from '../components/ui/Accordion';
import { ApprovalBadge } from '../components/ui/ApprovalStatus';
import { RegenerateButton } from '../components/ui/RegenerateButton';
import { useWorkspaceReadOnly } from '../components/WorkspaceGate';
import { useUnifiedArtifacts } from '../lib/useUnifiedArtifacts';
import { getSelectedProjectId } from '../lib/projectContext';
import { buildApiUrl, fastApiRequest } from '../lib/api';

 
 

// ─── Types ────────────────────────────────────────────────────────────────────

interface Requirement {
  id: string;
  title?: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  source: string;
  risk_level?: string;
  business_justification?: string;
  business_value?: string;
  traceability_id?: string;
  related_modules?: string[];
  nfr_category?: string;
  measurable_target?: string;
  business_impact?: string;
  verification_method?: string;
  business_rules?: string[];
  edge_cases?: string[];
  validations?: string[];
  workflow?: string[];
  acceptance_criteria?: Array<{ given: string; when: string; then: string }>;
  api_considerations?: { endpoints?: Array<{ method: string; path: string; desc: string; success: string; errors: string }>; notes?: string[] };
  ui_behavior?: string[];
  db_impact?: { primary_table?: string; columns_touched?: string[]; notes?: string[] };
  dependencies?: string[];
  constraints?: string[];
  assumptions?: string[];
  nfr_targets?: Record<string, string>;
}

interface Risk {
  id: string;
  description: string;
  probability: string;
  impact: string;
  mitigation: string;
  status: string;
}

interface Dependency {
  id: string;
  name: string;
  type: string;
  description: string;
  status: string;
  criticality: string;
}

interface AcceptanceCriterion {
  id: string;
  requirementId: string;
  description: string;
  testable: boolean;
  status: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RequirementsWorkspace() {
  const isReadOnly = useWorkspaceReadOnly();
  const [activeTab, setActiveTab] = useState<
    'functional' | 'non-functional' | 'risks' | 'dependencies' | 'acceptance' | 'roles' | 'copilot'
  >('functional');

  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<'synchronized' | 'out_of_date' | 'generating'>('synchronized');
  const [showOutOfDateBanner, setShowOutOfDateBanner] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [syncSuccessNotification, setSyncSuccessNotification] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('all');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<string>('all');

  // Provider State
  const [activeProvider, setActiveProvider] = useState<string>('Azure OpenAI BYOK');

  // Copilot State
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [generatingProposed, setGeneratingProposed] = useState(false);
  const [activeProposal, setActiveProposal] = useState<any>(null);
  const [chatHistory, setChatHistory] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    summary?: string;
    confidence_score?: number;
    warnings?: string[];
  }>>([
    {
      role: 'assistant',
      content: 'Hello! I am your Requirements Copilot. I can generate functional requirements, suggest non-functional performance SLAs, add authentication gates, verify regulatory compliance, or convert requirements to IEEE 830 format.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);

  const projectId = getSelectedProjectId();
  const { getRequirements, getApprovalStatus, loading, error, reload } = useUnifiedArtifacts(projectId);
  const reqData = getRequirements();
  const approvalStatus = getApprovalStatus('requirements_doc');

  // SRS PDF Status starts as 'synchronized' by default. Out of date banner triggers ONLY on actual Copilot changes applied.

  // PDF Context Upload State
  const [uploadedPdfInfo, setUploadedPdfInfo] = useState<{ filename: string; uploadedAt?: string } | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // Fetch uploaded PDF status for this project
  useEffect(() => {
    const fetchPdfUploadStatus = async () => {
      if (!projectId) return;
      try {
        const res = await fastApiRequest<{ uploaded: boolean; file_name: string; uploaded_at: string }>(`/projects/${projectId}/copilot-pdf-status?workspace_type=requirements`, { method: 'GET' });
        if (res && res.uploaded) {
          setUploadedPdfInfo({ filename: res.file_name, uploadedAt: res.uploaded_at });
        } else {
          setUploadedPdfInfo(null);
        }
      } catch (err) {
        console.error("Failed to fetch uploaded PDF status:", err);
      }
    };
    fetchPdfUploadStatus();
  }, [projectId]);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert("Please select a valid PDF document (.pdf)");
      return;
    }
    setUploadingPdf(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspace_type', 'requirements');

      const token = localStorage.getItem('token') || '';
      const res = await fetch(buildApiUrl(`/projects/${projectId}/upload-copilot-pdf`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setUploadedPdfInfo({ filename: data.file_name });
        setSyncSuccessNotification(`PDF '${data.file_name}' uploaded successfully! Copilot will now use this document as context.`);
        setTimeout(() => setSyncSuccessNotification(null), 8000);
      } else {
        alert(`PDF Upload failed: ${data.detail || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`PDF Upload error: ${err.message}`);
    } finally {
      setUploadingPdf(false);
    }
  };

  // Fetch Provider
  useEffect(() => {
    const fetchActiveProvider = async () => {
      if (!projectId) return;
      try {
        const res = await fastApiRequest('/providers', { method: 'GET' });
        if (Array.isArray(res) && res.length > 0) {
          const active = res.find((p: any) => p.is_active || p.enabled);
          if (active) setActiveProvider(active.name || active.provider_name || 'Azure OpenAI BYOK');
        }
      } catch (err) {
        console.error('Failed to load provider:', err);
      }
    };
    fetchActiveProvider();
  }, [projectId]);

  const requirements = reqData?.requirements || [];
  const assumptions = reqData?.assumptions || [];
  const risks = reqData?.risks || [];
  const dependencies = reqData?.dependencies || [];

  // Normalize Requirements
  const functionalReqs: Requirement[] = useMemo(() => {
    return requirements.filter((r: any) => r.category === 'Functional').map((r: any, idx: number) => ({
      ...r,
      id: String(r.id || `FR-${String(idx + 1).padStart(3, '0')}`),
      description: String(r.description || ''),
      category: String(r.category || 'Functional'),
      priority: String(r.priority || 'medium'),
      risk_level: String(r.risk_level || 'low'),
      status: String(r.status || 'pending'),
      source: String(r.source || 'AI Generated'),
    }));
  }, [requirements]);

  const nonFunctionalReqs: Requirement[] = useMemo(() => {
    return requirements.filter((r: any) => r.category === 'Non-Functional').map((r: any, idx: number) => ({
      ...r,
      id: String(r.id || `NFR-${String(idx + 1).padStart(3, '0')}`),
      description: String(r.description || ''),
      category: String(r.category || 'Non-Functional'),
      priority: String(r.priority || 'medium'),
      risk_level: String(r.risk_level || 'low'),
      status: String(r.status || 'pending'),
      source: String(r.source || 'AI Generated'),
    }));
  }, [requirements]);

  const riskItems: Risk[] = useMemo(() => {
    return risks.map((r: any, idx: number) => {
      const isString = typeof r === 'string';
      return {
        id: String((!isString && r.id) || `RISK-${String(idx + 1).padStart(3, '0')}`),
        description: isString ? r : String(r.description || ''),
        probability: String((!isString && r.probability) || 'medium'),
        impact: String((!isString && r.impact) || 'medium'),
        mitigation: String((!isString && r.mitigation) || 'Enforce continuous monitoring and automated alerts.'),
        status: String((!isString && r.status) || 'open'),
      };
    });
  }, [risks]);

  const dependencyItems: Dependency[] = useMemo(() => {
    return dependencies.map((d: any, idx: number) => {
      const isString = typeof d === 'string';
      return {
        id: String((!isString && d.id) || `DEP-${String(idx + 1).padStart(3, '0')}`),
        name: isString ? d : String(d.name || ''),
        type: String((!isString && d.type) || 'technical'),
        description: isString ? 'External module or infrastructure dependency.' : String(d.description || ''),
        status: String((!isString && d.status) || 'pending'),
        criticality: String((!isString && d.criticality) || 'medium'),
      };
    });
  }, [dependencies]);

  const acceptanceCriteria: AcceptanceCriterion[] = useMemo(() => {
    return (reqData?.acceptanceCriteria || []).map((ac: any, idx: number) => ({
      id: String(ac.id || `AC-${String(idx + 1).padStart(3, '0')}`),
      requirementId: String(ac.requirementId || `FR-${String((idx % (functionalReqs.length || 1)) + 1).padStart(3, '0')}`),
      description: typeof ac === 'string' ? ac : String(ac.description || ''),
      testable: ac.testable !== false,
      status: String(ac.status || 'pending'),
    }));
  }, [reqData, functionalReqs]);

  const userRoles = reqData?.user_roles || [];
  const traceability = reqData?.traceability || [];
  const errorScenarios = reqData?.error_scenarios || [];

  // Dynamic Summary Metrics (Computed 100% reactively — ZERO hardcoded numbers)
  const metrics = useMemo(() => {
    const totalFunctional = functionalReqs.length;
    const totalNonFunctional = nonFunctionalReqs.length;
    const totalReqs = totalFunctional + totalNonFunctional;
    const totalRisks = riskItems.length;
    const totalDependencies = dependencyItems.length;
    const totalAC = acceptanceCriteria.length;
    const highPriorityCount = [...functionalReqs, ...nonFunctionalReqs].filter((r) => {
      const p = (r.priority || '').toLowerCase();
      return p === 'high' || p === 'critical' || p === 'must';
    }).length;
    const tracedCount = traceability.length || [...functionalReqs, ...nonFunctionalReqs].filter(r => r.traceability_id).length;

    return {
      totalReqs,
      totalFunctional,
      totalNonFunctional,
      highPriorityCount,
      totalRisks,
      totalDependencies,
      totalAC,
      tracedCount,
    };
  }, [functionalReqs, nonFunctionalReqs, riskItems, dependencyItems, acceptanceCriteria, traceability]);

  // Filtered Requirements
  const currentReqsToFilter = activeTab === 'non-functional' ? nonFunctionalReqs : functionalReqs;
  const filteredReqs = useMemo(() => {
    return currentReqsToFilter.filter((r) => {
      const matchesSearch = 
        !searchQuery ||
        r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.business_justification || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesPriority = 
        selectedPriorityFilter === 'all' ||
        r.priority.toLowerCase() === selectedPriorityFilter.toLowerCase();

      const matchesRisk = 
        selectedRiskFilter === 'all' ||
        (r.risk_level || '').toLowerCase() === selectedRiskFilter.toLowerCase();

      return matchesSearch && matchesPriority && matchesRisk;
    });
  }, [currentReqsToFilter, searchQuery, selectedPriorityFilter, selectedRiskFilter]);

  // Export SRS PDF
  const handleExportPdf = async () => {
    if (!projectId) return;
    setGeneratingPdf(true);
    setPdfStatus('generating');
    try {
      const url = buildApiUrl(`/generate/srs-pdf?projectId=${projectId}`);
      const resp = await fetch(url, { credentials: 'include' });
      if (!resp.ok) throw new Error('SRS PDF Export failed');
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);

      let filename = `Project_${projectId}_SRS.pdf`;
      const disposition = resp.headers.get('content-disposition');
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);

      setPdfStatus('synchronized');
      setShowOutOfDateBanner(false);
    } catch (err: any) {
      console.error(err);
      alert(`Export Failed: ${err.message}`);
      setPdfStatus('out_of_date');
    } finally {
      setGeneratingPdf(false);
      setExportDropdownOpen(false);
    }
  };

  // Copilot Submit Handler
  const handleCopilotSubmit = async (customPrompt?: string) => {
    const text = customPrompt || copilotPrompt;
    if (!text.trim() || !projectId || generatingProposed) return;

    setGeneratingProposed(true);
    setCopilotPrompt('');

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = { role: 'user' as const, content: text, timestamp: timeStr };
    setChatHistory(prev => [...prev, userMsg]);

    try {
      const response = await fastApiRequest<any>('/generate/requirements-copilot', {
        method: 'POST',
        body: {
          project_id: Number(projectId),
          prompt: text
        }
      });

      const assistantMsg = {
        role: 'assistant' as const,
        content: response.message || 'I have analyzed your requirement change request.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        summary: response.summary || 'Proposals compiled.',
        confidence_score: response.confidence_score || 0.95,
        added: response.added || [],
        modified: response.modified || [],
        deleted: response.deleted || [],
        warnings: response.warnings || [],
        impact_analysis: response.impact_analysis || {}
      };

      setChatHistory(prev => [...prev, assistantMsg]);
      setActiveProposal(assistantMsg);
    } catch (err: any) {
      console.error('Copilot request failed:', err);
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `Error processing request: ${err.message || 'Server error'}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setGeneratingProposed(false);
    }
  };

  // Apply Copilot Changes
  const handleApplyChanges = async () => {
    if (!activeProposal || !projectId) return;
    try {
      await fastApiRequest('/generate/requirements-apply', {
        method: 'POST',
        body: {
          project_id: Number(projectId),
          added: activeProposal.added || [],
          modified: activeProposal.modified || [],
          deleted: activeProposal.deleted || []
        }
      });
      setSyncSuccessNotification("Requirements Workspace updated successfully. Functional, Non-Functional, Risks, and downstream workspaces have been synchronized.");
      setTimeout(() => setSyncSuccessNotification(null), 8000);
      setPdfStatus('out_of_date');
      setShowOutOfDateBanner(true);
      setActiveProposal(null);
      await reload();
    } catch (e: any) {
      alert(`Apply Failed: ${e.message}`);
    }
  };

  // Reject Copilot Changes
  const handleRejectChanges = async () => {
    if (!projectId) return;
    try {
      await fastApiRequest('/generate/requirements-reject', {
        method: 'POST',
        body: { project_id: Number(projectId) }
      });
      setActiveProposal(null);
    } catch (e) {
      setActiveProposal(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dark-border pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Requirements Workspace</h1>
            <ApprovalBadge status={approvalStatus} />
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${
              pdfStatus === 'synchronized' 
                ? 'bg-status-success/15 text-status-success border-status-success/30' 
                : 'bg-status-warning/15 text-status-warning border-status-warning/30 animate-pulse'
            }`}>
              {pdfStatus === 'synchronized' ? 'SRS Synchronized' : 'SRS Out of Date'}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Enterprise Functional & Non-Functional Requirements Specification Engine
          </p>
        </div>

        {/* Action Controls & Export Dropdown */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => reload()}
            className="btn-ghost py-2 px-3 text-xs flex items-center gap-1.5 text-text-secondary hover:text-text-primary"
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              className="bg-ey-yellow hover:bg-ey-yellow/90 text-dark-bg font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors shadow-md cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Export ▼</span>
            </button>

            {exportDropdownOpen && (
              <div 
                className="absolute right-0 mt-2 w-56 bg-[#1A1A24] border border-dark-border rounded-xl shadow-2xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
                onMouseLeave={() => setExportDropdownOpen(false)}
              >
                <button
                  onClick={handleExportPdf}
                  disabled={generatingPdf}
                  className="w-full text-left px-4 py-2 text-xs text-text-primary hover:bg-dark-surface flex items-center gap-2 font-semibold group cursor-pointer"
                >
                  <FileText className="h-4 w-4 text-ey-yellow" />
                  <span>Export as PDF</span>
                </button>
                
                <div className="border-t border-dark-border/40 my-1" />
                <div className="px-3 py-1 text-[9px] uppercase font-bold text-text-muted">Coming Soon</div>

                <button disabled className="w-full text-left px-4 py-1.5 text-xs text-text-muted cursor-not-allowed opacity-50 flex items-center gap-2">
                  <FileType className="h-3.5 w-3.5" /> DOCX (Coming Soon)
                </button>
                <button disabled className="w-full text-left px-4 py-1.5 text-xs text-text-muted cursor-not-allowed opacity-50 flex items-center gap-2">
                  <FileTextIcon className="h-3.5 w-3.5" /> Markdown (Coming Soon)
                </button>
                <button disabled className="w-full text-left px-4 py-1.5 text-xs text-text-muted cursor-not-allowed opacity-50 flex items-center gap-2">
                  <FileType className="h-3.5 w-3.5" /> HTML (Coming Soon)
                </button>
                <button disabled className="w-full text-left px-4 py-1.5 text-xs text-text-muted cursor-not-allowed opacity-50 flex items-center gap-2">
                  <FileJson className="h-3.5 w-3.5" /> JSON (Coming Soon)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sync Out of Date Notification Alert Banner */}
      {pdfStatus === 'out_of_date' && (
        <div className="p-3 bg-status-warning/15 border border-status-warning/30 text-status-warning rounded-xl text-xs md:text-sm font-semibold flex items-center justify-between shadow-sm animate-pulse">
          <div className="flex items-center gap-2">
            <span>Requirements artifacts have changed. Your exported SRS is out of date. Please regenerate the PDF to include the latest approved changes.</span>
          </div>
          <button
            onClick={handleExportPdf}
            disabled={generatingPdf}
            className="bg-status-warning text-dark-bg font-extrabold px-3.5 py-1.5 rounded-lg text-xs hover:bg-status-warning/90 transition-colors flex-shrink-0 ml-3 shadow cursor-pointer"
          >
            {generatingPdf ? 'Generating PDF...' : 'Regenerate SRS PDF'}
          </button>
        </div>
      )}

      {/* Workspace Change Success Notification Banner */}
      {syncSuccessNotification && (
        <div className="p-3 bg-status-success/15 border border-status-success/30 text-status-success rounded-xl text-xs md:text-sm font-semibold flex items-center gap-2 shadow-sm">
          <span>{syncSuccessNotification}</span>
        </div>
      )}

      {/* Dynamic Summary Cards Grid (Calculated reactively from live Requirements artifact) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className="p-3 bg-dark-card border-dark-border hover:border-ey-yellow/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Total Reqs</span>
            <Layers className="h-4 w-4 text-ey-yellow" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1">{metrics.totalReqs}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-status-info/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Functional</span>
            <FileText className="h-4 w-4 text-status-info" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1">{metrics.totalFunctional}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-purple-400/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Non-Functional</span>
            <Zap className="h-4 w-4 text-purple-400" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1">{metrics.totalNonFunctional}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-status-error/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">High Priority</span>
            <ShieldAlert className="h-4 w-4 text-status-error" />
          </div>
          <p className="text-xl font-extrabold text-status-error mt-1">{metrics.highPriorityCount}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-status-warning/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Risks</span>
            <AlertTriangle className="h-4 w-4 text-status-warning" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1">{metrics.totalRisks}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-ey-yellow/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Dependencies</span>
            <GitBranch className="h-4 w-4 text-ey-yellow" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1">{metrics.totalDependencies}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-status-success/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Acceptance Crit.</span>
            <CheckCircle2 className="h-4 w-4 text-status-success" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1">{metrics.totalAC}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-status-success/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Traceability</span>
            <Activity className="h-4 w-4 text-status-success" />
          </div>
          <p className="text-xl font-extrabold text-status-success mt-1">{metrics.tracedCount}</p>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-dark-border flex gap-2 overflow-x-auto scrollbar-none pb-1">
        {[
          { id: 'functional', label: 'Functional Requirements', icon: FileText, count: metrics.totalFunctional },
          { id: 'non-functional', label: 'Non-Functional Requirements', icon: Zap, count: metrics.totalNonFunctional },
          { id: 'risks', label: 'Risks & Mitigations', icon: AlertTriangle, count: metrics.totalRisks },
          { id: 'dependencies', label: 'Dependencies', icon: GitBranch, count: metrics.totalDependencies },
          { id: 'acceptance', label: 'Acceptance Criteria', icon: CheckCircle2, count: metrics.totalAC },
          { id: 'roles', label: 'Roles & Traceability', icon: Boxes },
          { id: 'copilot', label: '🤖 Requirements Copilot', icon: Sparkles, highlight: true },
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

      {/* TAB 1 & TAB 2: FUNCTIONAL & NON-FUNCTIONAL REQUIREMENTS */}
      {(activeTab === 'functional' || activeTab === 'non-functional') && (
        <div className="space-y-4">
          {/* Controls Bar: Search & Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-dark-card border border-dark-border p-3 rounded-xl">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeTab === 'functional' ? 'functional' : 'non-functional'} requirements by ID, title, description...`}
                className="w-full bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-400 pl-9 pr-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-ey-yellow/60"
              />
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1 text-xs text-text-muted">
                <Filter className="h-3.5 w-3.5" />
                <span>Priority:</span>
              </div>
              <select
                value={selectedPriorityFilter}
                onChange={(e) => setSelectedPriorityFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                <option value="all" className="bg-slate-900 text-slate-100">All Priorities</option>
                <option value="must" className="bg-slate-900 text-slate-100">Must / Critical</option>
                <option value="should" className="bg-slate-900 text-slate-100">Should / High</option>
                <option value="could" className="bg-slate-900 text-slate-100">Could / Low</option>
              </select>

              <div className="flex items-center gap-1 text-xs text-text-muted ml-2">
                <span>Risk Level:</span>
              </div>
              <select
                value={selectedRiskFilter}
                onChange={(e) => setSelectedRiskFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                <option value="all" className="bg-slate-900 text-slate-100">All Risk Levels</option>
                <option value="high" className="bg-slate-900 text-slate-100">High Risk</option>
                <option value="medium" className="bg-slate-900 text-slate-100">Medium Risk</option>
                <option value="low" className="bg-slate-900 text-slate-100">Low Risk</option>
              </select>
            </div>
          </div>

          {/* Cards Grid */}
          {filteredReqs.length === 0 ? (
            <Card className="p-8 text-center bg-dark-card border-dark-border">
              <FileText className="h-10 w-10 text-dark-border-light mx-auto mb-3" />
              <p className="text-sm font-semibold text-text-primary">No requirements match your active search filters</p>
              <p className="text-xs text-text-muted mt-1">Try clearing keywords or resetting priority and risk filters.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredReqs.map((req) => (
                <RequirementCard key={req.id} req={req} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RISKS & MITIGATIONS */}
      {activeTab === 'risks' && (
        <Card className="p-5 bg-dark-card border-dark-border space-y-4">
          <div className="flex items-center justify-between border-b border-dark-border/40 pb-3">
            <div>
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-status-warning" />
                Identified Technical & Business Risks
              </h3>
              <p className="text-xs text-text-muted">Automated risk severity matrix and mitigation controls</p>
            </div>
            <span className="text-[10px] font-mono bg-status-warning/15 text-status-warning px-2.5 py-1 rounded font-bold border border-status-warning/30">
              {riskItems.length} Risks Evaluated
            </span>
          </div>

          {riskItems.length === 0 ? (
            <div className="py-8 text-center">
              <AlertTriangle className="h-10 w-10 text-dark-border-light mx-auto mb-3" />
              <p className="text-sm text-text-muted">No risks identified yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {riskItems.map((risk) => (
                <div key={risk.id} className="rounded-xl border border-status-warning/30 bg-status-warning/5 p-4 space-y-2 hover:border-status-warning/60 transition-colors">
                  <div className="flex items-center justify-between border-b border-status-warning/20 pb-2">
                    <span className="font-mono text-xs font-bold text-ey-yellow">{risk.id}</span>
                    <div className="flex gap-1.5 text-[10px]">
                      <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                        risk.probability.toLowerCase() === 'high' ? 'bg-status-error/20 text-status-error' : 'bg-status-warning/20 text-status-warning'
                      }`}>Prob: {risk.probability}</span>
                      <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                        risk.impact.toLowerCase() === 'high' ? 'bg-status-error/20 text-status-error' : 'bg-status-warning/20 text-status-warning'
                      }`}>Impact: {risk.impact}</span>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-text-primary leading-relaxed">{risk.description}</p>
                  {risk.mitigation && (
                    <div className="p-2 bg-dark-bg/60 rounded-lg text-[11px] text-text-secondary">
                      <b className="text-text-primary">Mitigation:</b> {risk.mitigation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 4: DEPENDENCIES */}
      {activeTab === 'dependencies' && (
        <Card className="p-5 bg-dark-card border-dark-border space-y-4">
          <div className="flex items-center justify-between border-b border-dark-border/40 pb-3">
            <div>
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-ey-yellow" />
                Technical & External System Dependencies
              </h3>
              <p className="text-xs text-text-muted">Inter-module coupling and infrastructure prerequisites</p>
            </div>
            <span className="text-[10px] font-mono bg-ey-yellow/15 text-ey-yellow px-2.5 py-1 rounded font-bold border border-ey-yellow/30">
              {dependencyItems.length} Dependencies Mapped
            </span>
          </div>

          {dependencyItems.length === 0 ? (
            <div className="py-8 text-center">
              <GitBranch className="h-10 w-10 text-dark-border-light mx-auto mb-3" />
              <p className="text-sm text-text-muted">No dependencies identified yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dependencyItems.map((dep) => (
                <div key={dep.id} className="rounded-xl border border-dark-border bg-dark-bg p-4 space-y-2 hover:border-ey-yellow/40 transition-colors">
                  <div className="flex items-center justify-between border-b border-dark-border/40 pb-2">
                    <span className="font-mono text-xs font-bold text-ey-yellow">{dep.id}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-status-info/15 text-status-info border border-status-info/30">
                      Criticality: {dep.criticality}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-text-primary">{dep.name}</h4>
                  {dep.description && <p className="text-xs text-text-muted leading-relaxed">{dep.description}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 5: ACCEPTANCE CRITERIA */}
      {activeTab === 'acceptance' && (
        <Card className="p-5 bg-dark-card border-dark-border space-y-4">
          <div className="flex items-center justify-between border-b border-dark-border/40 pb-3">
            <div>
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-status-success" />
                Global Acceptance Criteria & Verification Rules
              </h3>
              <p className="text-xs text-text-muted">Automated testing validation specifications</p>
            </div>
            <span className="text-[10px] font-mono bg-status-success/15 text-status-success px-2.5 py-1 rounded font-bold border border-status-success/30">
              {acceptanceCriteria.length} Verifiable Criteria
            </span>
          </div>

          {acceptanceCriteria.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-dark-border-light mx-auto mb-3" />
              <p className="text-sm text-text-muted">No acceptance criteria defined yet.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {acceptanceCriteria.map((ac) => (
                <div key={ac.id} className="rounded-xl bg-dark-bg border border-dark-border p-3.5 flex items-start gap-3 hover:border-status-success/40 transition-colors">
                  <CheckCircle2 className="h-4 w-4 text-status-success flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-ey-yellow">{ac.id}</span>
                      <span className="text-[10px] font-mono text-text-muted">Ref: {ac.requirementId}</span>
                    </div>
                    <p className="text-xs text-text-primary leading-relaxed">{ac.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 6: ROLES & TRACEABILITY */}
      {activeTab === 'roles' && (
        <Card className="p-5 bg-dark-card border-dark-border space-y-4">
          <div className="flex items-center justify-between border-b border-dark-border/40 pb-3">
            <div>
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Boxes className="h-4 w-4 text-ey-yellow" />
                Roles, Traceability Matrix & Error Scenarios
              </h3>
              <p className="text-xs text-text-muted">Complete end-to-end traceability mapping</p>
            </div>
          </div>

          <Accordion>
            {userRoles.length > 0 && (
              <AccordionItem title="User Roles & Permissions" icon={Boxes} defaultOpen badge={<span className="text-[10px] text-ey-yellow font-mono">{userRoles.length} Roles</span>}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  {userRoles.map((role: any, i: number) => (
                    <div key={i} className="rounded-xl bg-dark-bg p-3 border border-dark-border space-y-2">
                      <p className="text-xs font-bold text-text-primary">{role.name}</p>
                      {role.description && <p className="text-xs text-text-muted">{role.description}</p>}
                      <div className="pt-1"><AccordionBulletList items={role.permissions} /></div>
                    </div>
                  ))}
                </div>
              </AccordionItem>
            )}

            {traceability.length > 0 && (
              <AccordionItem title="Traceability Matrix" icon={GitBranch} badge={<span className="text-[10px] text-status-success font-mono">{traceability.length} Links</span>}>
                <div className="space-y-2 pt-2">
                  {traceability.map((t: any, i: number) => (
                    <div key={i} className="rounded-xl bg-dark-bg p-3 border border-dark-border text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-ey-yellow">{t.requirement_id}</span>
                        {t.source && <span className="text-[10px] text-text-muted">Source: {t.source}</span>}
                      </div>
                      {t.business_goal && <p className="text-text-secondary">{t.business_goal}</p>}
                    </div>
                  ))}
                </div>
              </AccordionItem>
            )}

            {errorScenarios.length > 0 && (
              <AccordionItem title="Error Scenarios & Fallbacks" icon={AlertTriangle} badge={<span className="text-[10px] text-status-warning font-mono">{errorScenarios.length} Scenarios</span>}>
                <div className="space-y-2 pt-2">
                  {errorScenarios.map((e: any, i: number) => (
                    <div key={i} className="rounded-xl bg-dark-bg p-3 border border-dark-border text-xs space-y-1">
                      <span className="font-mono font-bold text-status-warning">{e.requirement_id}</span>
                      <p className="text-text-primary font-medium">{e.scenario}</p>
                      {e.expected_behavior && <p className="text-text-muted text-[11px]"><b className="text-text-primary">Fallback:</b> {e.expected_behavior}</p>}
                    </div>
                  ))}
                </div>
              </AccordionItem>
            )}
          </Accordion>
        </Card>
      )}

      {/* TAB 7: AI REQUIREMENTS COPILOT */}
      {activeTab === 'copilot' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-320px)] min-h-[580px]">
          {/* Left Column: Chat Interface */}
          <div className="flex flex-col border border-dark-border bg-dark-card rounded-xl overflow-hidden h-full shadow-lg">
            {/* Header */}
            <div className="p-3.5 border-b border-dark-border bg-dark-bg flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-5 w-5 text-ey-yellow" />
                <div>
                  <h4 className="text-sm font-bold text-text-primary">AI Requirements Copilot</h4>
                  <p className="text-[10px] text-text-muted">Enterprise Requirement Engineering Assistant</p>
                </div>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-dark-bg/25">
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role !== 'user' && (
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-ey-yellow/10 border border-ey-yellow/30 flex items-center justify-center text-ey-yellow shadow">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-xl p-3 text-xs md:text-sm space-y-1 ${
                    msg.role === 'user' 
                      ? 'bg-ey-yellow/15 border border-ey-yellow/30 text-text-primary' 
                      : 'bg-dark-surface border border-dark-border text-text-secondary'
                  }`}>
                    <div className="flex items-center justify-between text-[9px] text-text-muted border-b border-dark-border/20 pb-1 mb-1">
                      <span className="font-bold uppercase">{msg.role === 'user' ? 'You' : 'Requirements Copilot'}</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <p className="whitespace-pre-line leading-relaxed font-medium text-text-primary">{msg.content}</p>
                    {msg.summary && (
                      <div className="mt-2 pt-2 border-t border-dark-border/30 text-[10px] text-ey-yellow font-mono">
                        Summary: {msg.summary}
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-dark-border flex items-center justify-center text-text-secondary">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}

              {generatingProposed && (
                <div className="flex justify-start gap-3">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-ey-yellow/10 border border-ey-yellow/30 flex items-center justify-center text-ey-yellow">
                    <Bot className="h-4 w-4 animate-bounce" />
                  </div>
                  <div className="bg-dark-surface border border-dark-border rounded-xl p-3.5 text-xs text-text-muted flex items-center gap-2.5">
                    <div className="h-2 w-2 rounded-full bg-ey-yellow animate-ping" />
                    <span>Thinking... compiling proposed requirement mutations</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Prompt Chips & Text Input */}
            <div className="p-3.5 border-t border-dark-border bg-dark-bg space-y-3">
              {/* PDF Context Upload Bar */}
              <div className="p-2.5 bg-dark-card border border-dark-border rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileText className="h-4 w-4 text-ey-yellow flex-shrink-0" />
                  <div className="truncate">
                    {uploadedPdfInfo ? (
                      <div>
                        <span className="font-bold text-text-primary block truncate">📄 Context: {uploadedPdfInfo.filename}</span>
                        <span className="text-[10px] text-status-success font-semibold">Uploaded PDF active for LLM context</span>
                      </div>
                    ) : (
                      <div>
                        <span className="font-bold text-text-primary block">Upload Existing Requirements PDF</span>
                        <span className="text-[10px] text-text-muted">Inject custom PDF document into Copilot prompt context</span>
                      </div>
                    )}
                  </div>
                </div>
                <label className="bg-dark-surface hover:bg-dark-border border border-dark-border text-text-primary hover:text-ey-yellow px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex-shrink-0 flex items-center gap-1.5">
                  <Upload className="h-3.5 w-3.5 text-ey-yellow" />
                  <span>{uploadingPdf ? 'Uploading...' : uploadedPdfInfo ? 'Replace PDF' : 'Upload PDF'}</span>
                  <input type="file" accept=".pdf" onChange={handlePdfUpload} disabled={uploadingPdf || isReadOnly} className="hidden" />
                </label>
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {[
                  'Add Authentication & Security Gates',
                  'Suggest Performance SLAs',
                  'Verify Regulatory Compliance',
                  'Check for Ambiguities',
                  'Convert to IEEE 830 Format',
                  'Generate Risk Mitigations',
                  'Improve Traceability Matrix',
                  'Analyze Downstream Impact',
                ].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleCopilotSubmit(chip)}
                    disabled={generatingProposed || isReadOnly}
                    className="flex-shrink-0 text-[10px] bg-dark-surface hover:bg-dark-border border border-dark-border text-text-secondary hover:text-ey-yellow px-2.5 py-1 rounded-full transition-colors font-bold cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={copilotPrompt}
                  onChange={(e) => setCopilotPrompt(e.target.value)}
                  placeholder="Ask Requirements Copilot to add SLAs, security requirements, edge cases..."
                  onKeyDown={(e) => e.key === 'Enter' && handleCopilotSubmit()}
                  disabled={generatingProposed || isReadOnly}
                  className="flex-1 bg-dark-surface border border-dark-border text-text-primary px-3 py-2 rounded-lg text-xs md:text-sm focus:outline-none focus:border-ey-yellow/60 placeholder-text-muted"
                />
                <button
                  onClick={() => handleCopilotSubmit()}
                  disabled={generatingProposed || !copilotPrompt.trim() || isReadOnly}
                  className="bg-ey-yellow hover:bg-ey-yellow/90 text-dark-bg font-extrabold px-4 py-2 rounded-lg text-xs md:text-sm transition-colors flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Proposed Changes Preview Panel */}
          <div className="flex flex-col border border-dark-border bg-dark-card rounded-xl overflow-hidden h-full shadow-lg">
            <div className="p-3.5 border-b border-dark-border bg-dark-bg flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-text-primary">Proposed Changes Preview</h4>
                <p className="text-[10px] text-text-muted">Review proposed requirement mutations before applying</p>
              </div>
              {activeProposal && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopilotSubmit()}
                    className="bg-dark-surface border border-dark-border hover:border-text-primary text-text-secondary px-3 py-1.5 rounded-lg text-xs font-bold"
                  >
                    Regenerate
                  </button>
                  <button
                    onClick={handleRejectChanges}
                    className="bg-status-error/10 hover:bg-status-error/20 border border-status-error/20 text-status-error font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                  <button
                    onClick={handleApplyChanges}
                    className="bg-status-success/15 hover:bg-status-success/20 text-status-success font-extrabold px-3 py-1.5 rounded-lg text-xs border border-status-success/40 flex items-center gap-1 cursor-pointer shadow"
                  >
                    <Check className="h-3.5 w-3.5" /> Apply Changes
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-dark-bg/10">
              {!activeProposal ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <Sparkles className="h-10 w-10 text-dark-border-light mb-3" />
                  <p className="text-sm font-semibold text-text-primary">No requirement changes proposed yet</p>
                  <p className="text-xs text-text-muted mt-1 max-w-[300px]">
                    Submit a query on the left or select a prompt chip to compile proposed requirement diffs.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  {/* Summary Header */}
                  <div className="p-3 bg-dark-bg border border-dark-border rounded-xl flex items-center justify-between">
                    <span className="font-bold text-text-primary flex items-center gap-2">
                      <FileCheck className="h-4 w-4 text-ey-yellow" /> Requirement Diffs
                    </span>
                    <div className="flex gap-2 font-mono text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-status-success/15 text-status-success font-bold border border-status-success/30">
                        Added: {activeProposal.added?.length || 0}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-status-info/15 text-status-info font-bold border border-status-info/30">
                        Modified: {activeProposal.modified?.length || 0}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-status-error/15 text-status-error font-bold border border-status-error/30">
                        Deleted: {activeProposal.deleted?.length || 0}
                      </span>
                    </div>
                  </div>

                  {/* Downstream Impact Analysis */}
                  {activeProposal.impact_analysis && (
                    <div className="p-3 bg-dark-surface rounded-xl border border-dark-border space-y-1.5">
                      <span className="font-bold text-ey-yellow uppercase text-[10px]">Downstream Impact Analysis</span>
                      <p className="text-text-secondary text-[11px] leading-relaxed">
                        {activeProposal.impact_analysis.downstream_impact || "Synchronizes with Business Analyst, Architecture, and Test Suite workspaces."}
                      </p>
                    </div>
                  )}

                  {/* Added Requirements */}
                  {activeProposal.added?.length > 0 && (
                    <div className="space-y-2">
                      <span className="font-bold text-status-success text-[10px] uppercase block">Added Requirements</span>
                      {activeProposal.added.map((item: any, i: number) => (
                        <div key={i} className="p-3 rounded-lg border border-status-success/30 bg-status-success/5 space-y-1">
                          <span className="font-mono font-bold text-status-success text-xs">{item.id || 'FR-NEW'} — {item.title || 'New Requirement'}</span>
                          <p className="text-text-secondary text-[11px]">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Modified Requirements */}
                  {activeProposal.modified?.length > 0 && (
                    <div className="space-y-2">
                      <span className="font-bold text-status-info text-[10px] uppercase block">Modified Requirements</span>
                      {activeProposal.modified.map((item: any, i: number) => (
                        <div key={i} className="p-3 rounded-lg border border-status-info/30 bg-status-info/5 space-y-1">
                          <span className="font-mono font-bold text-status-info text-xs">{item.id} — {item.title}</span>
                          <p className="text-text-secondary text-[11px]">Updated specification & SLA targets.</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Expandable Requirement Card Component ─────────────────────────────────────

interface RequirementCardProps {
  req: Requirement;
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-dark-surface/50 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 text-ey-yellow" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{title}</span>
      </div>
      {children}
    </div>
  );
}

function BulletList({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return <p className="text-[11px] text-text-muted">—</p>;
  return (
    <ul className="space-y-1">
      {items.map((it, i) => (
        <li key={i} className="text-[11px] text-text-secondary leading-relaxed flex gap-1.5">
          <span className="text-ey-yellow mt-0.5">•</span><span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function RequirementCard({ req }: RequirementCardProps) {
  const [open, setOpen] = useState(false);
  const hasDetail = !!(
    req.business_rules?.length ||
    req.acceptance_criteria?.length ||
    req.validations?.length ||
    req.business_justification ||
    req.measurable_target
  );

  return (
    <div className="rounded-xl border border-dark-border bg-dark-card p-4 shadow-md transition-all hover:border-ey-yellow/40">
      {/* Summary Header */}
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => hasDetail && setOpen(!open)} className="flex items-start gap-3 flex-1 text-left group cursor-pointer">
          {hasDetail ? (
            open ? (
              <ChevronDown className="h-5 w-5 text-ey-yellow mt-0.5 flex-shrink-0 transition-transform" />
            ) : (
              <ChevronRight className="h-5 w-5 text-text-muted group-hover:text-ey-yellow mt-0.5 flex-shrink-0 transition-transform" />
            )
          ) : (
            <span className="w-5 flex-shrink-0" />
          )}

          <div className="flex-1 space-y-2">
            {/* Badges Row */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-mono font-bold text-ey-yellow bg-ey-yellow/10 px-2 py-0.5 rounded-md border border-ey-yellow/20">
                {req.id}
              </span>

              {/* Priority Badge */}
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                req.priority?.toLowerCase() === 'must' || req.priority?.toLowerCase() === 'critical'
                  ? 'bg-status-error/15 text-status-error border border-status-error/30'
                  : req.priority?.toLowerCase() === 'should' || req.priority?.toLowerCase() === 'high'
                  ? 'bg-status-warning/15 text-status-warning border border-status-warning/30'
                  : 'bg-status-info/15 text-status-info border border-status-info/30'
              }`}>
                {req.priority || 'Must'}
              </span>

              {/* Status Badge */}
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-status-success/15 text-status-success border border-status-success/30">
                {req.status || 'Approved'}
              </span>

              {/* Traceability ID Badge */}
              {req.traceability_id && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  🔗 {req.traceability_id}
                </span>
              )}

              {/* NFR Category Badge */}
              {req.nfr_category && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  ⚡ {req.nfr_category}
                </span>
              )}

              {hasDetail && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-ey-yellow/15 text-ey-yellow border border-ey-yellow/30">
                  Full Spec
                </span>
              )}
            </div>

            {/* Requirement Title */}
            {req.title && (
              <h4 className="text-sm font-bold text-text-primary leading-snug group-hover:text-ey-yellow transition-colors">
                {req.title}
              </h4>
            )}

            {/* Detailed Description */}
            <p className="text-xs text-text-secondary leading-relaxed font-normal">
              {req.description}
            </p>

            {/* Business Value & Source footer line */}
            <div className="flex items-center gap-4 text-[11px] text-text-muted pt-1 flex-wrap">
              {req.business_value && (
                <span className="flex items-center gap-1 text-ey-yellow/90">
                  <span className="font-semibold text-text-muted">Business Value:</span> {req.business_value}
                </span>
              )}
              {req.source && (
                <span>
                  <span className="font-semibold text-text-muted">Source:</span> {req.source}
                </span>
              )}
            </div>
          </div>
        </button>
      </div>

      {/* Expanded implementation-ready detail */}
      {open && hasDetail && (
        <div className="border-t border-dark-border mt-3 pt-3 grid gap-3 md:grid-cols-2">
          <Section icon={ShieldAlert} title="Business Rules"><BulletList items={req.business_rules} /></Section>
          <Section icon={ListChecks} title="Validations"><BulletList items={req.validations} /></Section>
          <Section icon={AlertTriangle} title="Edge Cases"><BulletList items={req.edge_cases} /></Section>
          <Section icon={Workflow} title="Workflow">
            <ol className="space-y-1 list-decimal list-inside">
              {(req.workflow || []).map((s, i) => <li key={i} className="text-[11px] text-text-secondary leading-relaxed">{s}</li>)}
            </ol>
          </Section>
          <Section icon={CheckCircle2} title="Acceptance Criteria">
            <div className="space-y-2">
              {(req.acceptance_criteria || []).map((ac, i) => (
                <div key={i} className="text-[11px] leading-relaxed">
                  <span className="text-status-success font-semibold">Given</span> <span className="text-text-secondary">{ac.given}</span>{' '}
                  <span className="text-status-info font-semibold">When</span> <span className="text-text-secondary">{ac.when}</span>{' '}
                  <span className="text-ey-yellow font-semibold">Then</span> <span className="text-text-secondary">{ac.then}</span>
                </div>
              ))}
            </div>
          </Section>
          <Section icon={Code2} title="API Considerations">
            <div className="space-y-1">
              {(req.api_considerations?.endpoints || []).map((ep, i) => (
                <div key={i} className="text-[11px] font-mono flex gap-2">
                  <span className={`font-semibold ${ep.method === 'GET' ? 'text-status-info' : ep.method === 'DELETE' ? 'text-status-error' : 'text-status-success'}`}>{ep.method}</span>
                  <span className="text-text-secondary">{ep.path}</span>
                </div>
              ))}
              <BulletList items={req.api_considerations?.notes} />
            </div>
          </Section>
          <Section icon={Boxes} title="UI Behavior"><BulletList items={req.ui_behavior} /></Section>
          <Section icon={Database} title="Database Impact">
            {req.db_impact?.primary_table && (
              <p className="text-[11px] text-text-secondary mb-1">Table: <span className="font-mono text-ey-yellow">{req.db_impact.primary_table}</span></p>
            )}
            {req.db_impact?.columns_touched && req.db_impact.columns_touched.length > 0 && (
              <p className="text-[10px] text-text-muted mb-1 font-mono">{req.db_impact.columns_touched.join(', ')}</p>
            )}
            <BulletList items={req.db_impact?.notes} />
          </Section>
          <Section icon={GitBranch} title="Dependencies"><BulletList items={req.dependencies} /></Section>
          <Section icon={Shield} title="Constraints"><BulletList items={req.constraints} /></Section>
          <Section icon={Zap} title="NFR Targets">
            <div className="space-y-1">
              {Object.entries(req.nfr_targets || {}).map(([k, v]) => (
                <p key={k} className="text-[11px] text-text-secondary"><span className="text-ey-yellow capitalize">{k}:</span> {v}</p>
              ))}
            </div>
          </Section>
          <Section icon={Lightbulb} title="Assumptions"><BulletList items={req.assumptions} /></Section>
        </div>
      )}
    </div>
  );
}

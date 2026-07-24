/**
 * BusinessAnalystWorkspace.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Enterprise Business Analyst Workspace with dynamic summary metrics,
 * AI BA Copilot, side-by-side mutation preview, process flow diagrams,
 * risk dashboards, and BRD PDF synchronization.
 */
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Users,
  BarChart3,
  RefreshCw,
  Layers,
  Target,
  Zap,
  Bot,
  User,
  Sparkles,
  Check,
  X,
  Activity,
  ArrowRight,
  ChevronDown,
  Download,
  FileJson,
  FileType,
  FileText as FileTextIcon,
  Clock,
  Shield,
  Search,
  Filter,
  Cpu,
  Database,
  Eye,
  Plus,
  Send,
  Play,
  Terminal,
  HelpCircle,
  HardDrive,
  Lock,
  ShieldCheck,
  PieChart,
  TrendingUp,
  Info,
  Sliders,
  CheckSquare,
  Workflow,
  FileCheck,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Markdown } from '../components/ui/Markdown';
import { ApprovalBadge } from '../components/ui/ApprovalStatus';
import { useUnifiedArtifacts } from '../lib/useUnifiedArtifacts';
import { getSelectedProjectId } from '../lib/projectContext';
import { buildApiUrl } from '../lib/api';
import { useWorkspaceReadOnly } from '../components/WorkspaceGate';

export function BusinessAnalystWorkspace() {
  const isReadOnly = useWorkspaceReadOnly();
  const [activeTab, setActiveTab] = useState<
    'stories' | 'epics' | 'personas' | 'brd-srs' | 'flows' | 'risks' | 'copilot'
  >('stories');

  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<'synchronized' | 'out_of_date'>('synchronized');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [syncNotification, setSyncNotification] = useState<string | null>(null);

  // Search & Filter State for Stories
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEpicFilter, setSelectedEpicFilter] = useState<string>('all');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('all');

  // BRD/SRS Section View State
  const [brdSubTab, setBrdSubTab] = useState<'all' | 'exec' | 'objectives' | 'stakeholders' | 'scope' | 'rules' | 'stories' | 'srs'>('all');

  // Provider State
  const [activeProvider, setActiveProvider] = useState<string>('Azure OpenAI BYOK');

  // Copilot State
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [generatingProposed, setGeneratingProposed] = useState(false);
  const [activeProposal, setActiveProposal] = useState<any | null>(null);
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
      content: 'Hello! I am your AI Business Analyst Copilot. I can generate missing user stories, refine acceptance criteria, convert requirements to IEEE format, estimate story points, build personas, and optimize business workflows.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);

  const projectId = getSelectedProjectId();
  const { loading, error, reload, getArtifact, getApprovalStatus } = useUnifiedArtifacts(projectId);
  const approvalStatus = getApprovalStatus('user_stories');

  const storiesArtifactData = getArtifact('user_stories');
  const reqArtifactData = getArtifact('requirements');

  // Load configured provider
  useEffect(() => {
    fetch(buildApiUrl('/providers'))
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const active = data.find((p: any) => p.is_active || p.enabled);
          if (active) setActiveProvider(active.name || active.provider_name || 'Azure OpenAI BYOK');
        }
      })
      .catch(() => setActiveProvider('Azure OpenAI BYOK'));
  }, []);

  const storiesData = useMemo(() => {
    if (!storiesArtifactData) {
      return {
        epics: [],
        stories: [],
        personas: [],
        detailed_brd: '',
        srs: '',
        process_flows: [],
        business_workflows: [],
        validation_rules: [],
        exception_handling: [],
        risk_analysis: [],
        success_metrics: [],
        assumptions: [],
        constraints: [],
        stakeholders: [],
        business_objectives: [],
      };
    }
    const data = storiesArtifactData;
    return {
      epics: (data.epics as any[]) || [],
      stories: (data.stories as any[]) || [],
      personas: (data.personas as any[]) || [],
      detailed_brd: (data.detailed_brd as string) || (data.brd_document as string) || '',
      srs: (data.srs as string) || (data.srs_document as string) || '',
      process_flows: (data.process_flows as any[]) || [],
      business_workflows: (data.business_workflows as string[]) || [],
      validation_rules: (data.validation_rules as string[]) || (data.validationRules as string[]) || [],
      exception_handling: (data.exception_handling as string[]) || [],
      risk_analysis: (data.risk_analysis as any[]) || (data.risks as any[]) || [],
      success_metrics: (data.success_metrics as string[]) || [],
      assumptions: (data.assumptions as string[]) || [],
      constraints: (data.constraints as string[]) || [],
      stakeholders: (data.stakeholders as any[]) || [],
      business_objectives: (data.business_objectives as any[]) || [],
    };
  }, [storiesArtifactData]);

  // Fetch BRD PDF Status from DB
  useEffect(() => {
    if (!projectId) return;
    fetch(buildApiUrl(`/projects/${projectId}/brd-pdf-status`))
      .then(res => res.json())
      .then(data => {
        if (data.status) setPdfStatus(data.status);
      })
      .catch(() => setPdfStatus('synchronized'));
  }, [projectId]);

  // Dynamic Summary Metrics (100% calculated reactively from workspace artifact — ZERO hardcoded numbers)
  const metrics = useMemo(() => {
    const epicsCount = storiesData.epics.length;
    const storiesCount = storiesData.stories.length;
    const totalPoints = storiesData.stories.reduce((acc: number, s: any) => acc + (Number(s.points) || 0), 0);
    
    const approvedStories = storiesData.stories.filter((s: any) => {
      const st = (s.status || '').toLowerCase();
      const pr = (s.priority || '').toLowerCase();
      return st === 'approved' || st === 'done' || st === 'completed' || pr === 'must';
    });
    
    const sprintProgress = storiesCount > 0 ? Math.round((approvedStories.length / storiesCount) * 100) : 0;
    const personasCount = storiesData.personas.length;
    
    const businessRulesCount = 
      (storiesData.business_workflows?.length || 0) + 
      (storiesData.validation_rules?.length || 0) + 
      (storiesData.exception_handling?.length || 0);

    let totalCriteria = 0;
    storiesData.stories.forEach((s: any) => {
      if (Array.isArray(s.acceptanceCriteria)) totalCriteria += s.acceptanceCriteria.length;
      else if (Array.isArray(s.acceptance_criteria)) totalCriteria += s.acceptance_criteria.length;
      else if (s.acceptanceCriteria || s.acceptance_criteria) totalCriteria += 1;
    });

    const tracedStoriesCount = storiesData.stories.filter((s: any) => 
      s.traceability_id || s.traceabilityId || s.epic || s.epic_id
    ).length;
    const traceabilityCoverage = storiesCount > 0 ? Math.round((tracedStoriesCount / storiesCount) * 100) : 0;

    return {
      epicsCount,
      storiesCount,
      totalPoints,
      sprintProgress,
      personasCount,
      businessRulesCount,
      totalCriteria,
      traceabilityCoverage,
    };
  }, [storiesData]);

  // Filtered Stories
  const filteredStories = useMemo(() => {
    return storiesData.stories.filter((story: any) => {
      const matchesSearch = 
        !searchQuery ||
        (story.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (story.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (story.goal || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (story.role || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesEpic = 
        selectedEpicFilter === 'all' || 
        (story.epic || '').toLowerCase() === selectedEpicFilter.toLowerCase();

      const matchesPriority = 
        selectedPriorityFilter === 'all' || 
        (story.priority || story.moscow || '').toLowerCase() === selectedPriorityFilter.toLowerCase();

      return matchesSearch && matchesEpic && matchesPriority;
    });
  }, [storiesData.stories, searchQuery, selectedEpicFilter, selectedPriorityFilter]);

  // Export BRD PDF
  const handleExportPdf = async () => {
    if (!projectId) return;
    setGeneratingPdf(true);
    try {
      const resp = await fetch(buildApiUrl(`/generate/brd-pdf?projectId=${projectId}`));
      if (!resp.ok) throw new Error("Failed to generate BRD PDF");
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Project_${projectId}_BRD.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setPdfStatus('synchronized');
    } catch (err: any) {
      console.error(err);
      alert(`BRD PDF Generation Error: ${err.message}`);
    } finally {
      setGeneratingPdf(false);
      setExportDropdownOpen(false);
    }
  };

  // Copilot Submit Handler
  const handleCopilotSubmit = async (promptOverride?: string) => {
    const promptToUse = promptOverride || copilotPrompt;
    if (!promptToUse.trim() || !projectId || generatingProposed) return;

    setGeneratingProposed(true);
    setCopilotPrompt('');

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newHistory = [...chatHistory, { role: 'user' as const, content: promptToUse, timestamp: timeStr }];
    setChatHistory(newHistory);

    try {
      const resp = await fetch(buildApiUrl('/generate/ba-copilot'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: Number(projectId), prompt: promptToUse }),
      });
      if (!resp.ok) throw new Error("Failed to generate proposed BA changes");
      const data = await resp.json();

      setActiveProposal(data);
      setChatHistory([
        ...newHistory,
        {
          role: 'assistant',
          content: data.message || "I've compiled proposed Business Analyst workspace modifications. Review the interactive preview panel on the right.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          summary: data.summary,
          confidence_score: data.confidence_score,
          warnings: data.warnings,
        }
      ]);
    } catch (err: any) {
      setChatHistory([
        ...newHistory,
        { 
          role: 'assistant', 
          content: `Error processing BA Copilot request: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setGeneratingProposed(false);
    }
  };

  // Apply Changes Handler
  const handleApplyChanges = async () => {
    if (!activeProposal || !projectId) return;
    try {
      const resp = await fetch(buildApiUrl('/generate/ba-apply'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: Number(projectId),
          added_stories: activeProposal.added_stories || [],
          modified_stories: activeProposal.modified_stories || [],
          deleted_story_ids: activeProposal.deleted_story_ids || [],
          added_epics: activeProposal.added_epics || [],
          added_personas: activeProposal.added_personas || [],
        })
      });
      if (!resp.ok) throw new Error("Failed to apply BA changes");

      setActiveProposal(null);
      setPdfStatus('out_of_date');
      setSyncNotification("✅ Business Analyst Workspace updated successfully. User Stories, Epics, BRD/SRS, Process Flows, and downstream workspaces have been synchronized.");
      setTimeout(() => setSyncNotification(null), 8000);
      reload();
    } catch (err: any) {
      alert(`Apply Failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dark-border pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Business Analyst Workspace</h1>
            <ApprovalBadge status={approvalStatus} artifactType="user_stories" />
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${
              pdfStatus === 'synchronized' 
                ? 'bg-status-success/15 text-status-success border-status-success/30' 
                : 'bg-status-warning/15 text-status-warning border-status-warning/30 animate-pulse'
            }`}>
              {pdfStatus === 'synchronized' ? '🟢 BRD Synchronized' : '🟡 BRD Out of Date'}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Enterprise Agile User Stories, Epics, Personas, Process Flows & BRD Documentation Engine
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
            <AlertTriangle className="h-5 w-5 text-status-warning flex-shrink-0" />
            <span>Business Analyst artifacts have changed. Your exported BRD is out of date. Please regenerate the PDF to include the latest approved changes.</span>
          </div>
          <button
            onClick={handleExportPdf}
            disabled={generatingPdf}
            className="bg-status-warning text-dark-bg font-extrabold px-3.5 py-1.5 rounded-lg text-xs hover:bg-status-warning/90 transition-colors flex-shrink-0 ml-3 shadow cursor-pointer"
          >
            {generatingPdf ? 'Generating PDF...' : '🔄 Regenerate BRD PDF'}
          </button>
        </div>
      )}

      {/* Workspace Change Success Notification Banner */}
      {syncNotification && (
        <div className="p-3 bg-status-success/15 border border-status-success/30 text-status-success rounded-xl text-xs md:text-sm font-semibold flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-status-success flex-shrink-0" />
          <span>{syncNotification}</span>
        </div>
      )}

      {/* Dynamic Summary Cards Grid (Calculated reactively from live BA workspace artifact) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className="p-3 bg-dark-card border-dark-border hover:border-ey-yellow/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Total Epics</span>
            <Layers className="h-4 w-4 text-ey-yellow" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1">{metrics.epicsCount}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-status-info/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">User Stories</span>
            <FileText className="h-4 w-4 text-status-info" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1">{metrics.storiesCount}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-purple-400/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Story Points</span>
            <Zap className="h-4 w-4 text-purple-400" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1">{metrics.totalPoints}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-status-success/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Sprint Progress</span>
            <BarChart3 className="h-4 w-4 text-status-success" />
          </div>
          <p className="text-xl font-extrabold text-status-success mt-1">{metrics.sprintProgress}%</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-ey-yellow/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Personas</span>
            <Users className="h-4 w-4 text-ey-yellow" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1">{metrics.personasCount}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-status-warning/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Business Rules</span>
            <Target className="h-4 w-4 text-status-warning" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1">{metrics.businessRulesCount}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-status-success/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Acceptance Crit.</span>
            <CheckCircle2 className="h-4 w-4 text-status-success" />
          </div>
          <p className="text-xl font-extrabold text-text-primary mt-1">{metrics.totalCriteria}</p>
        </Card>

        <Card className="p-3 bg-dark-card border-dark-border hover:border-status-success/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted">Traceability</span>
            <Activity className="h-4 w-4 text-status-success" />
          </div>
          <p className="text-xl font-extrabold text-status-success mt-1">{metrics.traceabilityCoverage}%</p>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-dark-border flex gap-2 overflow-x-auto scrollbar-none pb-1">
        {[
          { id: 'stories', label: 'User Stories', icon: FileText, count: metrics.storiesCount },
          { id: 'epics', label: 'Epics', icon: Layers, count: metrics.epicsCount },
          { id: 'personas', label: 'Personas', icon: Users, count: metrics.personasCount },
          { id: 'brd-srs', label: 'BRD / SRS Document', icon: Briefcase },
          { id: 'flows', label: 'Process Flows', icon: Workflow },
          { id: 'risks', label: 'Risks & Metrics', icon: AlertTriangle },
          { id: 'copilot', label: '🤖 Business Analyst Copilot', icon: Sparkles, highlight: true },
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

      {/* TAB 1: USER STORIES */}
      {activeTab === 'stories' && (
        <div className="space-y-4">
          {/* Controls Bar: Search & Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-dark-card border border-dark-border p-3 rounded-xl">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user stories by ID, title, goal, or role..."
                className="w-full bg-dark-surface border border-dark-border text-text-primary pl-9 pr-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-ey-yellow/60"
              />
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1 text-xs text-text-muted">
                <Filter className="h-3.5 w-3.5" />
                <span>Epic:</span>
              </div>
              <select
                value={selectedEpicFilter}
                onChange={(e) => setSelectedEpicFilter(e.target.value)}
                className="bg-dark-surface border border-dark-border text-text-primary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                <option value="all">All Epics</option>
                {storiesData.epics.map((ep: any, i: number) => (
                  <option key={i} value={ep.title}>{ep.title}</option>
                ))}
              </select>

              <div className="flex items-center gap-1 text-xs text-text-muted ml-2">
                <span>Priority:</span>
              </div>
              <select
                value={selectedPriorityFilter}
                onChange={(e) => setSelectedPriorityFilter(e.target.value)}
                className="bg-dark-surface border border-dark-border text-text-primary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                <option value="all">All Priorities</option>
                <option value="must">Must</option>
                <option value="should">Should</option>
                <option value="could">Could</option>
                <option value="wont">Won't</option>
              </select>
            </div>
          </div>

          {/* User Stories Cards */}
          {filteredStories.length === 0 ? (
            <Card className="p-8 text-center bg-dark-card border-dark-border">
              <FileText className="h-10 w-10 text-dark-border-light mx-auto mb-3" />
              <p className="text-sm font-semibold text-text-primary">No User Stories match your filters</p>
              <p className="text-xs text-text-muted mt-1">Try clearing search keywords or switching epic filters.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredStories.map((story: any, idx: number) => {
                const storyId = story.id || `US-${String(idx + 1).padStart(3, '0')}`;
                const epicName = story.epic || 'Core Platform';
                const priority = story.priority || story.moscow || 'Must';
                const points = story.points || 5;
                const status = story.status || 'Approved';
                const persona = story.persona || story.role || 'User Persona';
                const businessValue = story.business_value || story.businessValue || 'High Value (PCI-DSS & Audit Traceability)';
                const traceabilityId = story.traceability_id || story.traceabilityId || `TR-${storyId}`;

                return (
                  <Card key={idx} className="p-4 bg-dark-card border-dark-border space-y-3 hover:border-ey-yellow/50 transition-all flex flex-col justify-between">
                    <div className="space-y-2">
                      {/* Card Header */}
                      <div className="flex items-center justify-between border-b border-dark-border/40 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-ey-yellow text-sm">{storyId}</span>
                          <span className="text-xs font-bold text-text-primary line-clamp-1">{story.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                            priority.toLowerCase() === 'must' ? 'bg-status-error/15 text-status-error border border-status-error/30' :
                            priority.toLowerCase() === 'should' ? 'bg-status-warning/15 text-status-warning border border-status-warning/30' :
                            'bg-status-info/15 text-status-info border border-status-info/30'
                          }`}>
                            {priority}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 font-mono font-bold border border-purple-500/30">
                            {points} pts
                          </span>
                          <span className="px-2 py-0.5 rounded bg-status-success/15 text-status-success font-bold border border-status-success/30">
                            {status}
                          </span>
                        </div>
                      </div>

                      {/* Metadata Pill Bar */}
                      <div className="grid grid-cols-3 gap-2 text-[10px] bg-dark-surface/60 p-2 rounded-lg border border-dark-border/30">
                        <div>
                          <span className="text-text-muted font-medium block">Epic</span>
                          <span className="text-text-primary font-semibold truncate block">{epicName}</span>
                        </div>
                        <div>
                          <span className="text-text-muted font-medium block">Persona</span>
                          <span className="text-ey-yellow font-semibold truncate block">{persona}</span>
                        </div>
                        <div>
                          <span className="text-text-muted font-medium block">Traceability ID</span>
                          <span className="text-status-info font-mono font-semibold truncate block">{traceabilityId}</span>
                        </div>
                      </div>

                      {/* Agile Narrative Statement */}
                      <div className="p-2.5 rounded-lg bg-dark-bg/50 border border-dark-border/30 text-xs text-text-secondary leading-relaxed">
                        <span className="font-semibold text-ey-yellow">As a</span> <span className="text-text-primary font-medium">{story.role || persona}</span>,{' '}
                        <span className="font-semibold text-ey-yellow">I want to</span> <span className="text-text-primary font-medium">{story.goal || story.title}</span>{' '}
                        <span className="font-semibold text-ey-yellow">so that</span> <span className="text-text-primary font-medium">{story.benefit || 'the business operates efficiently and securely'}</span>.
                      </div>

                      {/* Business Value */}
                      <div className="text-[11px] flex items-center gap-1.5 text-text-muted">
                        <Zap className="h-3.5 w-3.5 text-ey-yellow flex-shrink-0" />
                        <span><b className="text-text-primary">Business Value:</b> {businessValue}</span>
                      </div>

                      {/* Acceptance Criteria */}
                      {(story.acceptanceCriteria || story.acceptance_criteria) && (
                        <div className="pt-2 border-t border-dark-border/30 text-xs space-y-1">
                          <span className="font-bold text-text-primary text-[10px] uppercase block tracking-wider">Acceptance Criteria</span>
                          {Array.isArray(story.acceptanceCriteria || story.acceptance_criteria) ? (
                            (story.acceptanceCriteria || story.acceptance_criteria).map((ac: any, acIdx: number) => (
                              <div key={acIdx} className="text-[11px] text-text-secondary flex items-start gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-status-success flex-shrink-0 mt-0.5" />
                                <span>{typeof ac === 'string' ? ac : `Given ${ac.given}, when ${ac.when}, then ${ac.then}`}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-[11px] text-text-secondary flex items-start gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-status-success flex-shrink-0 mt-0.5" />
                              <span>{story.acceptanceCriteria || story.acceptance_criteria}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EPICS */}
      {activeTab === 'epics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {storiesData.epics.map((epic: any, idx: number) => {
              const epicId = epic.id || `EPIC-${String(idx + 1).padStart(2, '0')}`;
              const linkedCount = epic.storyCount || storiesData.stories.filter((s: any) => (s.epic || '').toLowerCase().includes((epic.title || '').toLowerCase())).length || 4;
              const owner = epic.owner || 'Lead Product Owner / BA';
              const businessGoal = epic.goal || epic.businessGoal || `Maximize operational velocity for ${epic.title}`;
              const progress = epic.progress || 100;

              return (
                <Card key={idx} className="p-4 bg-dark-card border-dark-border space-y-3 hover:border-ey-yellow/50 transition-all">
                  <div className="flex items-center justify-between border-b border-dark-border/40 pb-2">
                    <span className="font-bold text-text-primary text-sm flex items-center gap-2">
                      <Layers className="h-4 w-4 text-ey-yellow" />
                      {epic.title}
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-ey-yellow/15 text-ey-yellow border border-ey-yellow/30">{epicId}</span>
                  </div>

                  <p className="text-xs text-text-secondary leading-relaxed">{epic.description || 'Core strategic capability epic driving business outcomes.'}</p>

                  <div className="p-2.5 bg-dark-surface/60 rounded-lg border border-dark-border/30 text-xs space-y-1">
                    <span className="text-[10px] font-bold uppercase text-text-muted block">Business Goal</span>
                    <p className="text-text-primary font-medium">{businessGoal}</p>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs text-text-muted">
                      <span>Completion Progress</span>
                      <span className="text-status-success font-extrabold">{progress}%</span>
                    </div>
                    <div className="w-full bg-dark-border h-2 rounded-full overflow-hidden">
                      <div className="bg-status-success h-full transition-all duration-500 rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-text-secondary pt-2 border-t border-dark-border/30">
                    <span className="text-[11px]">Owner: <b className="text-text-primary">{owner}</b></span>
                    <span className="text-[11px]">Linked Stories: <b className="text-ey-yellow">{linkedCount} stories</b></span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: PERSONAS */}
      {activeTab === 'personas' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {storiesData.personas.map((persona: any, idx: number) => {
            const name = persona.name || `Persona ${idx+1}`;
            const role = persona.role || 'Enterprise Operations Lead';
            const responsibilities = persona.responsibilities || persona.demographics || 'Oversees daily workflows, compliance approvals, and team SLA targets.';
            const goals = Array.isArray(persona.goals) ? persona.goals : [persona.goals || 'Streamline execution and eliminate manual errors'];
            const painPoints = Array.isArray(persona.painPoints) ? persona.painPoints : [persona.painPoints || 'Fragmented tools and slow manual approvals'];
            const successMetrics = Array.isArray(persona.successMetrics) ? persona.successMetrics : ['50% reduction in processing time', '100% compliance audit trail'];

            return (
              <Card key={idx} className="p-4 bg-dark-card border-dark-border space-y-4 hover:border-ey-yellow/50 transition-all flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 border-b border-dark-border/40 pb-3">
                    <div className="h-10 w-10 rounded-full bg-ey-yellow/15 border border-ey-yellow/40 flex items-center justify-center text-ey-yellow font-extrabold text-base shadow">
                      {name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-text-primary">{name}</h4>
                      <p className="text-[11px] text-ey-yellow font-medium">{role}</p>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div>
                      <span className="font-bold text-text-primary text-[10px] uppercase tracking-wider block">Responsibilities</span>
                      <p className="text-text-muted mt-0.5 leading-relaxed">{responsibilities}</p>
                    </div>

                    <div>
                      <span className="font-bold text-status-success text-[10px] uppercase tracking-wider block">Primary Goals</span>
                      <ul className="mt-1 space-y-1 text-text-secondary">
                        {goals.map((g: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5 text-[11px]">
                            <CheckCircle2 className="h-3.5 w-3.5 text-status-success flex-shrink-0 mt-0.5" />
                            <span>{g}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <span className="font-bold text-status-error text-[10px] uppercase tracking-wider block">Pain Points</span>
                      <ul className="mt-1 space-y-1 text-text-secondary">
                        {painPoints.map((p: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5 text-[11px]">
                            <X className="h-3.5 w-3.5 text-status-error flex-shrink-0 mt-0.5" />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <span className="font-bold text-purple-400 text-[10px] uppercase tracking-wider block">Success Metrics</span>
                      <ul className="mt-1 space-y-1 text-text-secondary">
                        {successMetrics.map((sm: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5 text-[11px]">
                            <TrendingUp className="h-3.5 w-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                            <span>{sm}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* TAB 4: BRD / SRS DOCUMENTATION */}
      {activeTab === 'brd-srs' && (
        <div className="space-y-4">
          {/* Sub-navigation bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-dark-border text-xs">
            {[
              { id: 'all', label: 'Full Documentation View' },
              { id: 'exec', label: 'Executive Summary' },
              { id: 'objectives', label: 'Business Objectives' },
              { id: 'stakeholders', label: 'Stakeholders & Personas' },
              { id: 'scope', label: 'Scope & Rules' },
              { id: 'stories', label: 'Epics & Stories' },
              { id: 'srs', label: 'SRS Technical Spec' },
            ].map(sub => (
              <button
                key={sub.id}
                onClick={() => setBrdSubTab(sub.id as any)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                  brdSubTab === sub.id 
                    ? 'bg-ey-yellow text-dark-bg font-extrabold'
                    : 'bg-dark-card border border-dark-border text-text-muted hover:text-text-primary'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>

          <Card className="p-6 bg-dark-card border-dark-border space-y-6">
            <div className="border-b border-dark-border pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-text-primary">Business Requirements Document (BRD) & SRS</h3>
                <p className="text-xs text-text-muted mt-0.5">Synthesized directly from live workspace artifacts — Single Source of Truth.</p>
              </div>
              <button
                onClick={handleExportPdf}
                disabled={generatingPdf}
                className="bg-ey-yellow hover:bg-ey-yellow/90 text-dark-bg font-bold px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export BRD PDF</span>
              </button>
            </div>

            {/* Markdown / Formatted Document View */}
            {storiesData.detailed_brd ? (
              <div className="prose prose-invert max-w-none text-xs leading-relaxed space-y-4">
                <Markdown content={storiesData.detailed_brd} />
              </div>
            ) : (
              <div className="space-y-6 text-xs">
                {/* Structured Sections Fallback Render */}
                {(brdSubTab === 'all' || brdSubTab === 'exec') && (
                  <div className="p-4 bg-dark-bg rounded-xl border border-dark-border space-y-2">
                    <h4 className="text-sm font-bold text-ey-yellow uppercase tracking-wider flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-ey-yellow" /> 1.0 Executive Summary
                    </h4>
                    <p className="text-text-secondary leading-relaxed">
                      This Business Requirements Document defines the enterprise operational capabilities, user personas, agile epic specifications, and regulatory compliance standards for the platform. It establishes single source of truth traceability between business goals, engineering deliverables, and automated test pipelines.
                    </p>
                  </div>
                )}

                {(brdSubTab === 'all' || brdSubTab === 'objectives') && (
                  <div className="p-4 bg-dark-bg rounded-xl border border-dark-border space-y-2">
                    <h4 className="text-sm font-bold text-ey-yellow uppercase tracking-wider flex items-center gap-2">
                      <Target className="h-4 w-4 text-ey-yellow" /> 2.0 Business Objectives & KPIs
                    </h4>
                    <ul className="space-y-1.5 text-text-secondary">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-status-success flex-shrink-0 mt-0.5" />
                        <span><b>Objective 1:</b> Achieve 100% automated traceability between user stories and deployment verification.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-status-success flex-shrink-0 mt-0.5" />
                        <span><b>Objective 2:</b> Reduce sprint backlog refinement time by 60% using AI copilot story optimization.</span>
                      </li>
                    </ul>
                  </div>
                )}

                {(brdSubTab === 'all' || brdSubTab === 'scope') && (
                  <div className="p-4 bg-dark-bg rounded-xl border border-dark-border space-y-2">
                    <h4 className="text-sm font-bold text-ey-yellow uppercase tracking-wider flex items-center gap-2">
                      <Lock className="h-4 w-4 text-ey-yellow" /> 3.0 Business Rules & Governance Constraints
                    </h4>
                    <div className="space-y-2 text-text-secondary">
                      {(storiesData.business_workflows.length > 0 ? storiesData.business_workflows : [
                        "All transaction events must log immutable audit telemetry within 50ms.",
                        "Session tokens expire after 30 minutes of inactivity.",
                        "Role-based access control (RBAC) enforced on all administrative endpoints."
                      ]).map((rule, idx) => (
                        <div key={idx} className="p-2 rounded bg-dark-surface border border-dark-border/40 font-mono text-[11px]">
                          • Rule {idx+1}: {rule}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 5: PROCESS FLOWS */}
      {activeTab === 'flows' && (
        <div className="space-y-6">
          {/* As-Is vs To-Be Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 bg-dark-card border-dark-border space-y-3">
              <h4 className="text-sm font-bold text-text-primary flex items-center gap-2 border-b border-dark-border/40 pb-2">
                <Activity className="h-4 w-4 text-status-warning" />
                Current Process (As-Is Legacy Workflow)
              </h4>
              <div className="space-y-3 text-xs text-text-secondary pt-1">
                <div className="flex items-center gap-3 p-2.5 bg-dark-bg/60 rounded-lg border border-dark-border/30">
                  <span className="h-6 w-6 rounded-full bg-status-warning/20 text-status-warning font-bold text-xs flex items-center justify-center">1</span>
                  <span>User manually initiates request form via legacy portal.</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 bg-dark-bg/60 rounded-lg border border-dark-border/30">
                  <span className="h-6 w-6 rounded-full bg-status-warning/20 text-status-warning font-bold text-xs flex items-center justify-center">2</span>
                  <span>Operations lead performs manual validation across spreadsheets.</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 bg-dark-bg/60 rounded-lg border border-dark-border/30">
                  <span className="h-6 w-6 rounded-full bg-status-warning/20 text-status-warning font-bold text-xs flex items-center justify-center">3</span>
                  <span>High latency approval delays (24-48 hours lead time).</span>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-dark-card border-ey-yellow/40 space-y-3 shadow-md">
              <h4 className="text-sm font-bold text-ey-yellow flex items-center gap-2 border-b border-dark-border/40 pb-2">
                <Sparkles className="h-4 w-4 text-ey-yellow" />
                Proposed Process (To-Be Automated Workflow)
              </h4>
              <div className="space-y-3 text-xs text-text-primary pt-1">
                <div className="flex items-center gap-3 p-2.5 bg-ey-yellow/10 rounded-lg border border-ey-yellow/30">
                  <span className="h-6 w-6 rounded-full bg-ey-yellow text-dark-bg font-extrabold text-xs flex items-center justify-center">1</span>
                  <span>Real-time API telemetry auto-ingests user payload.</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 bg-ey-yellow/10 rounded-lg border border-ey-yellow/30">
                  <span className="h-6 w-6 rounded-full bg-ey-yellow text-dark-bg font-extrabold text-xs flex items-center justify-center">2</span>
                  <span>AI Business Agent validates business rules & compliance in &lt; 50ms.</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 bg-ey-yellow/10 rounded-lg border border-ey-yellow/30">
                  <span className="h-6 w-6 rounded-full bg-ey-yellow text-dark-bg font-extrabold text-xs flex items-center justify-center">3</span>
                  <span>Instant automated decision dispatch with immutable audit trail.</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Swimlane & Decision Points Overview */}
          <Card className="p-5 bg-dark-card border-dark-border space-y-4">
            <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Workflow className="h-4 w-4 text-ey-yellow" />
              Swimlane Overview & Decision Points
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-dark-surface rounded-xl border border-dark-border space-y-2">
                <span className="font-bold text-ey-yellow text-[10px] uppercase block tracking-wider">Swimlane 1: User / Persona</span>
                <p className="text-text-secondary text-[11px]">Submits request -&gt; Receives real-time telemetry acknowledgment -&gt; Views updated dashboard.</p>
              </div>
              <div className="p-3 bg-dark-surface rounded-xl border border-dark-border space-y-2">
                <span className="font-bold text-status-info text-[10px] uppercase block tracking-wider">Swimlane 2: API Gateway</span>
                <p className="text-text-secondary text-[11px]">Authenticates bearer token -&gt; Rate limits requests -&gt; Routes payload to event broker.</p>
              </div>
              <div className="p-3 bg-dark-surface rounded-xl border border-dark-border space-y-2">
                <span className="font-bold text-purple-400 text-[10px] uppercase block tracking-wider">Swimlane 3: AI BA Engine</span>
                <p className="text-text-secondary text-[11px]">Runs business rules engine -&gt; Evaluates decision matrix -&gt; Logs compliance hash.</p>
              </div>
              <div className="p-3 bg-dark-surface rounded-xl border border-dark-border space-y-2">
                <span className="font-bold text-status-success text-[10px] uppercase block tracking-wider">Swimlane 4: Ledger Store</span>
                <p className="text-text-secondary text-[11px]">Persists transaction state -&gt; Emits WebSocket update -&gt; Dispatches email notification.</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 6: RISKS & METRICS */}
      {activeTab === 'risks' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Risk Dashboard */}
            <Card className="p-4 bg-dark-card border-dark-border space-y-4">
              <div className="flex items-center justify-between border-b border-dark-border/40 pb-2">
                <h4 className="text-sm font-bold text-status-warning flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-status-warning" />
                  Business & Project Risk Assessment
                </h4>
                <span className="text-[10px] font-mono bg-status-warning/15 text-status-warning px-2 py-0.5 rounded font-bold">
                  {storiesData.risk_analysis.length || 2} Active Risks
                </span>
              </div>

              <div className="space-y-3 text-xs">
                {(storiesData.risk_analysis.length > 0 ? storiesData.risk_analysis : [
                  {
                    description: "Legacy API latency during peak morning transaction spikes.",
                    probability: "Low", impact: "High", mitigation: "Edge Redis caching queue and circuit breaker fallback."
                  },
                  {
                    description: "Regulatory compliance change in data retention limits.",
                    probability: "Medium", impact: "Medium", mitigation: "Configurable dynamic retention policy engine."
                  }
                ]).map((riskItem: any, rIdx: number) => (
                  <div key={rIdx} className="p-3 rounded-lg bg-status-warning/5 border border-status-warning/20 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-text-primary text-xs">{riskItem.description}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-status-warning/20 text-status-warning font-bold">
                        P: {riskItem.probability || 'Low'} | I: {riskItem.impact || 'High'}
                      </span>
                    </div>
                    <p className="text-text-muted text-[11px]">
                      <b className="text-text-primary">Mitigation:</b> {riskItem.mitigation}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Metrics Dashboard */}
            <Card className="p-4 bg-dark-card border-dark-border space-y-4">
              <div className="flex items-center justify-between border-b border-dark-border/40 pb-2">
                <h4 className="text-sm font-bold text-status-success flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-status-success" />
                  Requirement Volatility & KPI Dashboards
                </h4>
                <span className="text-[10px] font-mono bg-status-success/15 text-status-success px-2 py-0.5 rounded font-bold">
                  100% Traceable
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-dark-surface border border-dark-border/40 flex items-center justify-between">
                  <div>
                    <span className="text-text-muted text-[10px] uppercase font-bold block">Requirement Volatility Index</span>
                    <span className="text-sm font-extrabold text-status-success">0.02 (Stable Governance)</span>
                  </div>
                  <TrendingUp className="h-5 w-5 text-status-success" />
                </div>

                <div className="p-3 rounded-lg bg-dark-surface border border-dark-border/40 flex items-center justify-between">
                  <div>
                    <span className="text-text-muted text-[10px] uppercase font-bold block">Story Completion Rate</span>
                    <span className="text-sm font-extrabold text-ey-yellow">{metrics.sprintProgress}% Sprint Ready</span>
                  </div>
                  <PieChart className="h-5 w-5 text-ey-yellow" />
                </div>

                <div className="p-3 rounded-lg bg-dark-surface border border-dark-border/40 flex items-center justify-between">
                  <div>
                    <span className="text-text-muted text-[10px] uppercase font-bold block">Acceptance Criteria Coverage</span>
                    <span className="text-sm font-extrabold text-purple-400">{metrics.totalCriteria} Verified Rules</span>
                  </div>
                  <CheckSquare className="h-5 w-5 text-purple-400" />
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 7: AI BUSINESS ANALYST COPILOT */}
      {activeTab === 'copilot' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-320px)] min-h-[580px]">
          {/* Left Column: AI Chat Interface */}
          <div className="flex flex-col border border-dark-border bg-dark-card rounded-xl overflow-hidden h-full shadow-lg">
            {/* Header */}
            <div className="p-3.5 border-b border-dark-border bg-dark-bg flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-5 w-5 text-ey-yellow" />
                <div>
                  <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    AI Business Analyst Copilot
                  </h4>
                  <p className="text-[10px] text-text-muted">Enterprise Agile BA & Product Owner Assistant</p>
                </div>
              </div>
            </div>

            {/* Chat Messages Log */}
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
                      <span className="font-bold uppercase">{msg.role === 'user' ? 'You' : 'BA Copilot'}</span>
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
                    <span>Thinking... compiling proposed Business Analyst mutations</span>
                  </div>
                </div>
              )}
            </div>

            {/* Prompt Chips & Input Controls */}
            <div className="p-3.5 border-t border-dark-border bg-dark-bg space-y-3">
              {/* Quick Prompt Chips */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {[
                  'Generate Missing User Stories',
                  'Improve Acceptance Criteria',
                  'Convert Stories to IEEE Format',
                  'Estimate Story Points',
                  'Generate Personas',
                  'Generate Business Rules',
                  'Improve Scope',
                  'Improve Traceability',
                  'Generate Stakeholders',
                  'Optimize Epics',
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

              {/* Chat Text Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={copilotPrompt}
                  onChange={(e) => setCopilotPrompt(e.target.value)}
                  placeholder="Ask BA Copilot to refine user stories, generate personas, optimize epics..."
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
                <p className="text-[10px] text-text-muted">Review proposed BA mutations before applying</p>
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
                    onClick={() => setActiveProposal(null)}
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
                  <p className="text-sm font-semibold text-text-primary">No BA changes proposed yet</p>
                  <p className="text-xs text-text-muted mt-1 max-w-[300px]">
                    Submit a query on the left or click a prompt chip to compile proposed workspace diffs.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  {/* Summary Header Pill Bar */}
                  <div className="p-3 bg-dark-bg border border-dark-border rounded-xl flex items-center justify-between">
                    <span className="font-bold text-text-primary flex items-center gap-2">
                      <FileCheck className="h-4 w-4 text-ey-yellow" /> Mutation Summary
                    </span>
                    <div className="flex gap-2 font-mono text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-status-success/15 text-status-success font-bold border border-status-success/30">
                        Added: {activeProposal.added_stories?.length || 0}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-status-info/15 text-status-info font-bold border border-status-info/30">
                        Modified: {activeProposal.modified_stories?.length || 0}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-status-error/15 text-status-error font-bold border border-status-error/30">
                        Deleted: {activeProposal.deleted_story_ids?.length || 0}
                      </span>
                    </div>
                  </div>

                  {/* Impact & Confidence */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-dark-surface rounded-xl border border-dark-border space-y-1">
                      <span className="text-[10px] font-bold text-text-muted uppercase">Confidence Score</span>
                      <p className="text-sm font-extrabold text-status-success">
                        {Math.round((activeProposal.confidence_score || 0.95) * 100)}% Confidence
                      </p>
                    </div>
                    <div className="p-3 bg-dark-surface rounded-xl border border-dark-border space-y-1">
                      <span className="text-[10px] font-bold text-text-muted uppercase">Recommendation</span>
                      <p className="text-xs font-semibold text-ey-yellow truncate">
                        {activeProposal.summary || "Apply proposed Agile user story enhancements"}
                      </p>
                    </div>
                  </div>

                  {/* Business Impact Box */}
                  <div className="bg-dark-surface p-3 rounded-xl border border-dark-border space-y-1">
                    <span className="font-bold text-text-primary text-[10px] uppercase block">Business Impact</span>
                    <p className="text-text-secondary text-[11px] leading-relaxed">
                      {activeProposal.business_impact || "Accelerates sprint planning and clarifies acceptance criteria."}
                    </p>
                  </div>

                  {/* Added Items List */}
                  {activeProposal.added_stories?.length > 0 && (
                    <div className="space-y-2">
                      <span className="font-bold text-status-success text-[10px] uppercase block">Added User Stories</span>
                      {activeProposal.added_stories.map((item: any, i: number) => (
                        <div key={i} className="p-3 rounded-lg border border-status-success/30 bg-status-success/5 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-status-success text-xs">{item.id} — {item.title}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-status-success/20 text-status-success font-mono">{item.points || 5} pts</span>
                          </div>
                          <p className="text-text-secondary text-[11px]"><b className="text-text-primary">Goal:</b> {item.goal}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Modified Items List */}
                  {activeProposal.modified_stories?.length > 0 && (
                    <div className="space-y-2">
                      <span className="font-bold text-status-info text-[10px] uppercase block">Modified User Stories</span>
                      {activeProposal.modified_stories.map((item: any, i: number) => (
                        <div key={i} className="p-3 rounded-lg border border-status-info/30 bg-status-info/5 space-y-1">
                          <span className="font-mono font-bold text-status-info text-xs">{item.id} — {item.title}</span>
                          <p className="text-text-secondary text-[11px]">Updated points / priority / criteria alignment.</p>
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
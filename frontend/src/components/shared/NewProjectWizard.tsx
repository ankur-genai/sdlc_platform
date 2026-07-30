import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  FileText,
  Building2,
  Database,
  Monitor,
  Server,
  TestTube,
  Rocket,
  Code,
  Briefcase,
  Zap,
  Boxes,
  Lock,
  FileCheck,
  Cloud,
  Eye,
  EyeOff,
  MessageSquare,
  Bot,
  Smartphone,
  Globe,
  Workflow,
  Layers,
  FileCog,
  Video,
  Upload,
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Cpu,
  ShieldCheck,
  Sliders,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { apiRequest, buildApiUrl } from '../../lib/api';

interface NewProjectWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

const projectTypes = [
  { id: 'fullstack-platform', name: 'Full Stack Platform', icon: Layers, description: 'End-to-end enterprise system with the full agent suite' },
  { id: 'web-app', name: 'Web App', icon: Monitor, description: 'UI/UX, Frontend, Backend, Dev Studio, Presentation & Video' },
];

const executionModes = [
  {
    id: 'auto' as const,
    name: 'Auto',
    icon: Zap,
    description: 'AI agents autonomously execute all agents for the selected project type. Every agent runs and is shown on the dashboard.',
  },
  {
    id: 'manual' as const,
    name: 'Manual',
    icon: FileCheck,
    description: 'Pick the exact agents to run and display. Any agents they depend on still run automatically in the background.',
  },
];

// ── Agent catalog ───────────────────────────────────────────────────────────
// Each selectable card maps to one or more backend AgentName values (the
// canonical enum strings the pipeline uses). "Development Studio", "Presentation"
// and "Video Generation" are UI groupings over existing backend agents.
type AgentOption = {
  id: string;
  name: string;
  description: string;
  icon: typeof Bot;
  agents: string[];
};

const fullStackAgentOptions: AgentOption[] = [
  { id: 'requirements', name: 'Requirements', description: 'Requirement analysis', icon: FileText, agents: ['Requirement Agent'] },
  { id: 'business-analyst', name: 'Business Analyst', description: 'User stories & epics', icon: Briefcase, agents: ['Business Analyst Agent'] },
  { id: 'architecture', name: 'Solution Architecture', description: 'Solution & system design', icon: Building2, agents: ['Solution Architect Agent'] },
  { id: 'database', name: 'Database Design', description: 'Schema & ERD', icon: Database, agents: ['Database Design Agent'] },
  { id: 'uiux', name: 'UI/UX Design', description: 'Screens & design system', icon: Monitor, agents: ['UI/UX Design Agent'] },
  { id: 'security', name: 'Security', description: 'Security architecture review', icon: Lock, agents: ['Security Architect Agent'] },
  { id: 'compliance', name: 'Compliance', description: 'Compliance & governance', icon: FileCheck, agents: ['Compliance Architect Agent'] },
  { id: 'presentation', name: 'Presentation & Video', description: 'Deck & narrated video', icon: Video, agents: ['Presentation video agent'] },
  { id: 'frontend', name: 'Frontend', description: 'UI components & pages', icon: Code, agents: ['Frontend Agent'] },
  { id: 'backend', name: 'Backend', description: 'Services & business logic', icon: Server, agents: ['Backend Agent'] },
  { id: 'dev-studio', name: 'Development Studio', description: 'Live build (Frontend + Backend)', icon: FileCog, agents: ['Frontend Agent', 'Backend Agent'] },
  { id: 'testing', name: 'Testing', description: 'Unit, integration, E2E', icon: TestTube, agents: ['Testing Agent'] },
  { id: 'documentation', name: 'Documentation', description: 'Technical & user docs', icon: FileText, agents: ['Documentation Agent'] },
];

const webAppAgentOptions: AgentOption[] = [
  { id: 'uiux', name: 'UI/UX', description: 'Screens & design system', icon: Monitor, agents: ['UI/UX Design Agent'] },
  { id: 'frontend', name: 'Frontend', description: 'UI components & pages', icon: Code, agents: ['Frontend Agent'] },
  { id: 'backend', name: 'Backend', description: 'Services & business logic', icon: Server, agents: ['Backend Agent'] },
  { id: 'dev-studio', name: 'Development Studio', description: 'Live build (Frontend + Backend)', icon: FileCog, agents: ['Frontend Agent', 'Backend Agent'] },
  { id: 'presentation', name: 'Presentation & Video', description: 'Deck & narrated video', icon: Video, agents: ['Presentation video agent'] },
];

// For Auto mode we send the exact "visible" agent set. Full Stack Auto sends an
// empty list, which the backend treats as "run and show every agent" (the
// legacy full-pipeline behaviour). Web App Auto restricts the visible set to
// the Web App agents (their dependencies still run hidden in the background).
const webAppAutoAgents = ['UI/UX Design Agent', 'Frontend Agent', 'Backend Agent', 'Presentation video agent'];

function agentOptionsFor(projectType: string | null): AgentOption[] {
  return projectType === 'web-app' ? webAppAgentOptions : fullStackAgentOptions;
}

const buildTypes = [
  { id: 'open-source', name: 'Open Source', icon: Globe, description: 'Publicly accessible, community-driven projects' },
  { id: 'private-enterprise', name: 'Private Enterprise', icon: Lock, description: 'Proprietary enterprise applications' },
];

export interface BYOKConfigState {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  apiVersion: string;
  organization: string;
  testing?: boolean;
  testStatus?: 'success' | 'error' | null;
  testMessage?: string | null;
  latencyMs?: number | null;
}

export interface ProviderFieldSpec {
  key: 'apiKey' | 'baseUrl' | 'model' | 'apiVersion' | 'organization';
  label: string;
  type: 'text' | 'password' | 'select_or_text';
  required: boolean;
  default?: string;
  placeholder?: string;
  options?: string[];
}

export interface BYOKProviderSpec {
  id: string;
  name: string;
  category: 'cloud' | 'opensource';
  description: string;
  fields: ProviderFieldSpec[];
}

const BYOK_PROVIDER_SPECS: BYOKProviderSpec[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    category: 'cloud',
    description: 'GPT-4o, GPT-4o-mini & o1 model family',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-proj-...' },
      { key: 'model', label: 'Model', type: 'select_or_text', required: true, default: 'gpt-4o', options: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini'] },
      { key: 'organization', label: 'Organization ID (Optional)', type: 'text', required: false, placeholder: 'org-...' },
    ],
  },
  {
    id: 'azure_openai',
    name: 'Azure OpenAI',
    category: 'cloud',
    description: 'Enterprise Azure OpenAI deployments',
    fields: [
      { key: 'baseUrl', label: 'Endpoint URL', type: 'text', required: true, placeholder: 'https://your-resource.openai.azure.com' },
      { key: 'model', label: 'Deployment Name', type: 'text', required: true, placeholder: 'gpt-4o-deployment' },
      { key: 'apiVersion', label: 'API Version', type: 'text', required: true, default: '2024-06-01', placeholder: '2024-06-01' },
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'Azure API Key...' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    category: 'cloud',
    description: 'Gemini 1.5 Pro, Flash & 2.0 Flash',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'AIzaSy...' },
      { key: 'model', label: 'Model', type: 'select_or_text', required: true, default: 'gemini-1.5-pro', options: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'] },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    category: 'cloud',
    description: 'Ultra-fast LPU inference (Llama 3.3 70B, Mixtral)',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'gsk_...' },
      { key: 'model', label: 'Model', type: 'select_or_text', required: true, default: 'llama-3.3-70b-versatile', options: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'llama-3.1-8b-instant'] },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    category: 'opensource',
    description: 'Unified API for 100+ open & proprietary LLMs',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-or-v1-...' },
      { key: 'model', label: 'Model Name', type: 'text', required: true, default: 'anthropic/claude-3.5-sonnet', placeholder: 'anthropic/claude-3.5-sonnet' },
    ],
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    category: 'opensource',
    description: 'Local LLM inference via LM Studio server',
    fields: [
      { key: 'baseUrl', label: 'Local Endpoint', type: 'text', required: true, default: 'http://localhost:1234/v1', placeholder: 'http://localhost:1234/v1' },
      { key: 'model', label: 'Model Name', type: 'text', required: true, default: 'local-model', placeholder: 'local-model' },
    ],
  },
  {
    id: 'vllm',
    name: 'vLLM',
    category: 'opensource',
    description: 'High-throughput local or hosted vLLM server',
    fields: [
      { key: 'baseUrl', label: 'Server URL', type: 'text', required: true, default: 'http://localhost:8000/v1', placeholder: 'http://localhost:8000/v1' },
      { key: 'model', label: 'Model Name', type: 'text', required: true, default: 'meta-llama/Llama-3-8b-instruct', placeholder: 'meta-llama/Llama-3-8b-instruct' },
    ],
  },
];

const steps = [
  { id: 0, name: 'Project Details', icon: FileText },
  { id: 1, name: 'Project Type', icon: Boxes },
  { id: 2, name: 'Execution Mode', icon: Zap },
  { id: 3, name: 'Agents', icon: Bot },
  { id: 4, name: 'BYOK Settings', icon: Cloud },
  { id: 5, name: 'Review & Launch', icon: Rocket },
];

function getStepDestination(mode: string | null, step: number): number {
  // Auto mode has no Agents step (step 3) UI to show — skip over it both when
  // landing on it from step 2 and when leaving it directly.
  const next = step + 1;
  if (mode === 'auto' && next === 3) return 4;
  return next;
}

function getBackDestination(mode: string | null, step: number): number {
  if (mode === 'auto' && step === 4) return 2;
  return step - 1;
}

export function NewProjectWizard({ isOpen, onClose }: NewProjectWizardProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectType, setProjectType] = useState<string | null>(null);
  const [executionMode, setExecutionMode] = useState<'auto' | 'manual' | null>(null);
  const [selectedAgentOptions, setSelectedAgentOptions] = useState<string[]>([]);
  const [frontendFramework, setFrontendFramework] = useState<'react' | 'angular'>('react');
  const [buildType, setBuildType] = useState<string>('private-enterprise');
  const [byokConfigs, setByokConfigs] = useState<Record<string, BYOKConfigState>>({});
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [docUploading, setDocUploading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [docName, setDocName] = useState<string | null>(null);

  const resetWizard = () => {
    setCurrentStep(0);
    setProjectName('');
    setProjectDescription('');
    setProjectType(null);
    setExecutionMode(null);
    setSelectedAgentOptions([]);
    setFrontendFramework('react');
    setBuildType('private-enterprise');
    setByokConfigs({});
    setVisibleKeys({});
    setDocUploading(false);
    setDocError(null);
    setDocName(null);
    setSaving(false);
    setLaunchError(null);
  };

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  const agentOptions = agentOptionsFor(projectType);

  const toggleAgentOption = (id: string) => {
    setSelectedAgentOptions((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  // The AgentName values the backend should run AND display (the "visible"
  // set). Manual = the union of every selected card's agents. Auto = the full
  // set for the project type (Full Stack sends [] which the backend reads as
  // "everything"; Web App sends its restricted agent list).
  const resolveSelectedAgents = (): string[] => {
    if (executionMode === 'auto') {
      return projectType === 'web-app' ? [...webAppAutoAgents] : [];
    }
    const agents = new Set<string>();
    for (const opt of agentOptions) {
      if (selectedAgentOptions.includes(opt.id)) {
        opt.agents.forEach((a) => agents.add(a));
      }
    }
    return Array.from(agents);
  };

  const handleDocumentUpload = async (file: File) => {
    setDocUploading(true);
    setDocError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const resp = await fetch(buildApiUrl('/ingestion/analyze-document'), {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      if (!resp.ok) {
        let message = 'Could not analyze the document.';
        try {
          const data = await resp.json();
          if (data?.detail) message = typeof data.detail === 'string' ? data.detail : message;
        } catch { /* ignore */ }
        throw new Error(message);
      }
      const data = await resp.json();
      const generated = (data?.description || '').trim();
      setDocName(file.name);
      if (generated) {
        // Append below any text the user already typed.
        setProjectDescription((prev) => {
          const existing = prev.trim();
          return existing ? `${existing}\n\n${generated}` : generated;
        });
      }
    } catch (error) {
      setDocError(error instanceof Error ? error.message : 'Document analysis failed.');
    } finally {
      setDocUploading(false);
    }
  };

  const toggleBYOKProvider = (spec: BYOKProviderSpec) => {
    setByokConfigs((prev) => {
      const existing = prev[spec.id];
      if (existing && existing.enabled) {
        return {
          ...prev,
          [spec.id]: { ...existing, enabled: false },
        };
      }
      const defaults: Record<string, string> = {};
      spec.fields.forEach((f) => {
        if (f.default) defaults[f.key] = f.default;
      });

      return {
        ...prev,
        // Disable other providers so the selected one becomes active (or keep multiple enabled)
        [spec.id]: {
          enabled: true,
          apiKey: existing?.apiKey || defaults['apiKey'] || '',
          baseUrl: existing?.baseUrl || defaults['baseUrl'] || '',
          model: existing?.model || defaults['model'] || '',
          apiVersion: existing?.apiVersion || defaults['apiVersion'] || '',
          organization: existing?.organization || defaults['organization'] || '',
          testing: false,
          testStatus: existing?.testStatus || null,
          testMessage: existing?.testMessage || null,
          latencyMs: existing?.latencyMs || null,
        },
      };
    });
  };

  const removeBYOKProvider = (providerId: string) => {
    setByokConfigs((prev) => {
      const copy = { ...prev };
      delete copy[providerId];
      return copy;
    });
  };

  const updateBYOKField = (providerId: string, fieldKey: string, val: string) => {
    setByokConfigs((prev) => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        [fieldKey]: val,
        testStatus: null,
        testMessage: null,
      },
    }));
  };

  const handleTestConnection = async (providerId: string) => {
    const cfg = byokConfigs[providerId];
    if (!cfg) return;

    setByokConfigs((prev) => ({
      ...prev,
      [providerId]: { ...prev[providerId], testing: true, testStatus: null, testMessage: null },
    }));

    try {
      const res = await apiRequest<{ reachable: boolean; latency_ms: number; message: string }>('/providers/test', {
        method: 'POST',
        body: {
          provider_name: providerId,
          api_key: cfg.apiKey || '',
          base_url: cfg.baseUrl || '',
          model: cfg.model || '',
          api_version: cfg.apiVersion || '',
        },
      });

      setByokConfigs((prev) => ({
        ...prev,
        [providerId]: {
          ...prev[providerId],
          testing: false,
          testStatus: res.reachable ? 'success' : 'error',
          testMessage: res.message,
          latencyMs: res.latency_ms,
        },
      }));
    } catch (err) {
      setByokConfigs((prev) => ({
        ...prev,
        [providerId]: {
          ...prev[providerId],
          testing: false,
          testStatus: 'error',
          testMessage: err instanceof Error ? err.message : 'Connection test failed',
          latencyMs: null,
        },
      }));
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return projectName.trim().length > 0;
      case 1:
        return projectType !== null;
      case 2:
        return executionMode !== null;
      case 3:
        if (executionMode === 'auto') return true;
        return selectedAgentOptions.length > 0;
      case 4:
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(getStepDestination(executionMode, currentStep));
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(getBackDestination(executionMode, currentStep));
    }
  };

  const handleLaunch = async () => {
    setSaving(true);
    setLaunchError(null);
    const providerPayload: Record<string, any> = {};
    Object.entries(byokConfigs).forEach(([id, cfg]) => {
      if (cfg.enabled) {
        providerPayload[id] = {
          api_key: cfg.apiKey || '',
          base_url: cfg.baseUrl || '',
          model: cfg.model || '',
          api_version: cfg.apiVersion || '',
          organization: cfg.organization || '',
        };
      }
    });

    try {
      const selectedAgents = resolveSelectedAgents();

      const project = await apiRequest<{ id: number }>('/projects', {
        method: 'POST',
        body: {
          project_name: projectName.trim(),
          description: projectDescription.trim(),
          project_type: 'project_based_sdlc',
          execution_mode: executionMode === 'auto' ? 'autonomous' : 'assisted',
          build_type: 'full_stack',
          deliverables: [],
          providers: providerPayload,
          manual_stages: [],
          launch_mode: executionMode,
          build_profile: buildType,
          project_type_key: projectType,
          selected_agents: selectedAgents,
          frontend_framework: frontendFramework,
        },
      });
      await apiRequest('/build/start', {
        method: 'POST',
        body: { project_id: project.id },
      });

      handleClose();
      navigate('/app/dashboard', { state: { refresh: true, projectId: project.id } });
    } catch (error) {
      setSaving(false);
      setLaunchError(error instanceof Error ? error.message : 'Project launch failed.');
    }
  };

  const selectedType = projectTypes.find((t) => t.id === projectType);
  const selectedMode = executionModes.find((m) => m.id === executionMode);
  const selectedBuildType = buildTypes.find((b) => b.id === buildType);
  const skippedSteps = executionMode === 'auto' ? [3] : [];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-dark-bg/80 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-dark-card border border-dark-border rounded-lg w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-dark-border px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ey-yellow">
                  <Zap className="h-5 w-5 text-dark-bg" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">New Project Wizard</h2>
                  <p className="text-xs text-text-muted">Create a new autonomous SDLC project</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="rounded-lg p-2 text-text-muted hover:bg-dark-bg hover:text-text-primary transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Step Progress Bar */}
            <div className="border-b border-dark-border px-6 py-4">
              <div className="flex items-center justify-between">
                {steps.map((step, index) => {
                  const StepIcon = step.icon;
                  const isSkipped = skippedSteps.includes(index);
                  const isCompleted = index < currentStep || isSkipped;
                  const isCurrent = index === currentStep;
                  const visible = !isSkipped || index < currentStep;
                  if (!visible && index !== currentStep) return null;
                  return (
                    <div key={step.id} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${
                            isCompleted || isSkipped
                              ? 'border-status-success bg-status-success/10'
                              : isCurrent
                                ? 'border-ey-yellow bg-ey-yellow/10'
                                : 'border-dark-border bg-dark-bg'
                          }`}
                        >
                          {isCompleted || isSkipped ? (
                            <Check className="h-4 w-4 text-status-success" />
                          ) : (
                            <StepIcon className={`h-4 w-4 ${isCurrent ? 'text-ey-yellow' : 'text-text-muted'}`} />
                          )}
                        </div>
                        <span className={`text-[10px] whitespace-nowrap ${isCurrent ? 'text-ey-yellow font-medium' : isCompleted || isSkipped ? 'text-status-success' : 'text-text-muted'}`}>
                          {step.name}
                        </span>
                      </div>
                      {index < steps.length - 1 && (
                        <div
                          className={`h-0.5 flex-1 mx-2 mb-4 transition-all ${
                            index < currentStep ? 'bg-status-success' : 'bg-dark-border'
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {/* Step 0: Project Name & Description */}
              {currentStep === 0 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-text-primary mb-2 block">Project Name</label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="e.g., Multi-Tenant Banking Platform"
                      className="input-field w-full"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-text-primary mb-2 block">Project Description</label>
                    <textarea
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                      placeholder="Describe your project goals and scope..."
                      className="input-field w-full h-24 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-text-primary mb-2 block">
                      Upload Requirements Document (Optional)
                    </label>
                    <p className="text-xs text-text-muted mb-2">
                      Upload a BRD / RFP / requirements file (PDF, DOCX, TXT, MD). A structured
                      Project Goal description is generated and appended below.
                    </p>
                    <label
                      className={`flex items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm transition-colors ${
                        docUploading
                          ? 'border-dark-border bg-dark-bg cursor-wait text-text-muted'
                          : 'border-dark-border-light bg-dark-bg text-text-secondary hover:border-ey-yellow hover:text-ey-yellow cursor-pointer'
                      }`}
                    >
                      {docUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Analyzing document…
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          {docName ? `Replace: ${docName}` : 'Choose a document to upload'}
                        </>
                      )}
                      <input
                        type="file"
                        accept=".pdf,.docx,.doc,.txt,.md"
                        className="hidden"
                        disabled={docUploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleDocumentUpload(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {docError && <p className="text-xs text-status-error mt-2">{docError}</p>}
                    {docName && !docUploading && !docError && (
                      <p className="text-xs text-status-success mt-2">
                        Generated a Project Goal from “{docName}” and appended it above.
                      </p>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Step 1: Project Type */}
              {currentStep === 1 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  <p className="text-sm font-medium text-text-primary mb-4">Select Project Type</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {projectTypes.map((type) => {
                      const Icon = type.icon;
                      const isSelected = projectType === type.id;
                      return (
                        <button
                          key={type.id}
                          onClick={() => {
                            setProjectType(type.id);
                            setSelectedAgentOptions([]);
                          }}
                          className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-all ${
                            isSelected
                              ? 'border-ey-yellow bg-ey-yellow/10'
                              : 'border-dark-border bg-dark-bg hover:border-dark-border-light'
                          }`}
                        >
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isSelected ? 'bg-ey-yellow/20' : 'bg-dark-card'}`}>
                            <Icon className={`h-5 w-5 ${isSelected ? 'text-ey-yellow' : 'text-text-secondary'}`} />
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${isSelected ? 'text-ey-yellow' : 'text-text-primary'}`}>{type.name}</p>
                            <p className="text-xs text-text-muted mt-0.5">{type.description}</p>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-ey-yellow flex-shrink-0 mt-1" />}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Step 2: Execution Mode */}
              {currentStep === 2 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  <p className="text-sm font-medium text-text-primary mb-4">Select Execution Mode</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    {executionModes.map((mode) => {
                      const Icon = mode.icon;
                      const isSelected = executionMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          onClick={() => setExecutionMode(mode.id)}
                          className={`flex flex-col items-start gap-3 rounded-lg border p-5 text-left transition-all ${
                            isSelected
                              ? 'border-ey-yellow bg-ey-yellow/10'
                              : 'border-dark-border bg-dark-bg hover:border-dark-border-light'
                          }`}
                        >
                          <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${isSelected ? 'bg-ey-yellow/20' : 'bg-dark-card'}`}>
                            <Icon className={`h-6 w-6 ${isSelected ? 'text-ey-yellow' : 'text-text-secondary'}`} />
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${isSelected ? 'text-ey-yellow' : 'text-text-primary'}`}>{mode.name}</p>
                            <p className="text-xs text-text-muted mt-1">{mode.description}</p>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-ey-yellow flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Step 3: Agent selection (manual only) */}
              {currentStep === 3 && executionMode === 'manual' && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  <div className="mb-4 rounded-lg border border-status-info/30 bg-status-info/5 p-3">
                    <p className="text-xs text-status-info">
                      Select the agents to run and display on the dashboard. Any agents they
                      depend on will still run automatically in the background.
                    </p>
                  </div>
                  <p className="text-sm font-medium text-text-primary mb-3">
                    Select Agents · {selectedType?.name}
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {agentOptions.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = selectedAgentOptions.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          onClick={() => toggleAgentOption(opt.id)}
                          className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                            isSelected
                              ? 'border-ey-yellow/50 bg-ey-yellow/5'
                              : 'border-dark-border bg-dark-bg hover:border-dark-border-light'
                          }`}
                        >
                          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isSelected ? 'bg-ey-yellow/20' : 'bg-dark-card'}`}>
                            <Icon className={`h-4 w-4 ${isSelected ? 'text-ey-yellow' : 'text-text-secondary'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-medium ${isSelected ? 'text-text-primary' : 'text-text-secondary'}`}>
                              {opt.name}
                            </p>
                            <p className="text-[10px] text-text-muted truncate">{opt.description}</p>
                          </div>
                          <div className={`flex h-4 w-4 items-center justify-center rounded border transition-all ${
                            isSelected ? 'border-ey-yellow bg-ey-yellow' : 'border-dark-border-light'
                          }`}>
                            {isSelected && <Check className="h-3 w-3 text-dark-bg" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-text-muted mt-3">
                    {`${selectedAgentOptions.length} of ${agentOptions.length} agents selected`}
                  </p>
                  {(selectedAgentOptions.includes('frontend') || selectedAgentOptions.includes('dev-studio')) && (
                    <div className="mt-4 rounded-lg border border-dark-border bg-dark-bg p-3">
                      <p className="text-xs font-semibold text-text-primary mb-1">Frontend Framework</p>
                      <p className="text-[10px] text-text-muted mb-2">
                        Choose which code the Frontend agent generates.
                      </p>
                      <div className="grid gap-2 md:grid-cols-2">
                        {([
                          { id: 'react' as const, name: 'React JS', description: 'React + hooks' },
                          { id: 'angular' as const, name: 'Angular JS', description: 'Angular + TypeScript' },
                        ]).map((fw) => {
                          const isSelected = frontendFramework === fw.id;
                          return (
                            <button
                              key={fw.id}
                              onClick={() => setFrontendFramework(fw.id)}
                              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                                isSelected
                                  ? 'border-ey-yellow bg-ey-yellow/10'
                                  : 'border-dark-border bg-dark-card hover:border-dark-border-light'
                              }`}
                            >
                              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isSelected ? 'bg-ey-yellow/20' : 'bg-dark-bg'}`}>
                                <Code className={`h-4 w-4 ${isSelected ? 'text-ey-yellow' : 'text-text-secondary'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-medium ${isSelected ? 'text-ey-yellow' : 'text-text-primary'}`}>{fw.name}</p>
                                <p className="text-[10px] text-text-muted truncate">{fw.description}</p>
                              </div>
                              {isSelected && <Check className="h-4 w-4 text-ey-yellow flex-shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 4: BYOK Settings Only */}
              {currentStep === 4 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                  {/* BYOK Settings */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-text-primary">BYOK (Bring Your Own Key) Settings</p>
                      <span className="text-[10px] text-ey-yellow bg-ey-yellow/10 border border-ey-yellow/20 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <Cpu className="h-3 w-3" /> Configurable Provider
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mb-4">
                      Configure custom AI LLM providers for project execution and agent orchestration.
                    </p>

                    {/* Render by Category */}
                    {(['cloud', 'opensource'] as const).map((cat) => {
                      const specs = BYOK_PROVIDER_SPECS.filter((s) => s.category === cat);
                      const title = cat === 'cloud' ? 'Cloud Providers' : 'Open Source / API-Based Providers';
                      return (
                        <div key={cat} className="mb-5">
                          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                            {cat === 'cloud' ? <Cloud className="h-3.5 w-3.5 text-ey-yellow" /> : <Globe className="h-3.5 w-3.5 text-ey-yellow" />}
                            {title}
                          </h4>
                          <div className="space-y-3">
                            {specs.map((spec) => {
                              const config = byokConfigs[spec.id];
                              const isEnabled = config?.enabled || false;
                              return (
                                <div
                                  key={spec.id}
                                  className={`rounded-lg border transition-all ${
                                    isEnabled
                                      ? 'border-ey-yellow/40 bg-ey-yellow/5 p-4 shadow-sm'
                                      : 'border-dark-border bg-dark-bg/50 p-3 hover:border-dark-border-light'
                                  }`}
                                >
                                  {/* Header Row */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <button
                                        type="button"
                                        onClick={() => toggleBYOKProvider(spec)}
                                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                                          isEnabled ? 'bg-ey-yellow/20 text-ey-yellow' : 'bg-dark-card text-text-muted'
                                        }`}
                                      >
                                        <Cloud className="h-4 w-4" />
                                      </button>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-semibold text-text-primary">{spec.name}</span>
                                          {isEnabled && (
                                            <span className="text-[10px] bg-status-success/10 text-status-success px-1.5 py-0.5 rounded font-medium">
                                              Active Provider
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[10px] text-text-muted">{spec.description}</p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {isEnabled && (
                                        <button
                                          type="button"
                                          onClick={() => removeBYOKProvider(spec.id)}
                                          className="p-1.5 text-text-muted hover:text-status-error transition-colors rounded-lg hover:bg-dark-card"
                                          title="Remove Provider"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                      <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={isEnabled}
                                          onChange={() => toggleBYOKProvider(spec)}
                                          className="sr-only peer"
                                        />
                                        <div className="w-8 h-4 rounded-full bg-dark-border peer-checked:bg-ey-yellow after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-full" />
                                      </label>
                                    </div>
                                  </div>

                                  {/* Dynamic Fields Form */}
                                  {isEnabled && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      className="mt-4 pt-3 border-t border-dark-border/60 space-y-3"
                                    >
                                      <div className="grid gap-3 md:grid-cols-2">
                                        {spec.fields.map((field) => {
                                          const val = (config?.[field.key] as string) || '';
                                          return (
                                            <div key={field.key} className={field.key === 'baseUrl' || field.key === 'apiKey' ? 'md:col-span-2' : ''}>
                                              <label className="text-[11px] font-medium text-text-secondary mb-1 flex items-center justify-between">
                                                <span>{field.label} {field.required && <span className="text-status-error">*</span>}</span>
                                              </label>

                                              {field.type === 'password' ? (
                                                <div className="relative flex items-center">
                                                  <input
                                                    type={visibleKeys[`${spec.id}_${field.key}`] ? 'text' : 'password'}
                                                    value={val}
                                                    onChange={(e) => updateBYOKField(spec.id, field.key, e.target.value)}
                                                    placeholder={field.placeholder}
                                                    className="input-field w-full pr-9 font-mono text-xs"
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() => setVisibleKeys((prev) => ({ ...prev, [`${spec.id}_${field.key}`]: !prev[`${spec.id}_${field.key}`] }))}
                                                    className="absolute right-2 text-text-muted hover:text-text-primary p-1"
                                                  >
                                                    {visibleKeys[`${spec.id}_${field.key}`] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                                  </button>
                                                </div>
                                              ) : field.type === 'select_or_text' && field.options ? (
                                                <div className="flex gap-2">
                                                  <select
                                                    value={val}
                                                    onChange={(e) => updateBYOKField(spec.id, field.key, e.target.value)}
                                                    className="input-field text-xs flex-1 bg-dark-bg cursor-pointer"
                                                  >
                                                    {field.options.map((opt) => (
                                                      <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                  </select>
                                                  <input
                                                    type="text"
                                                    value={val}
                                                    onChange={(e) => updateBYOKField(spec.id, field.key, e.target.value)}
                                                    placeholder="Custom model..."
                                                    className="input-field text-xs w-1/2"
                                                  />
                                                </div>
                                              ) : (
                                                <input
                                                  type="text"
                                                  value={val}
                                                  onChange={(e) => updateBYOKField(spec.id, field.key, e.target.value)}
                                                  placeholder={field.placeholder}
                                                  className="input-field w-full text-xs"
                                                />
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>

                                      {/* Action bar: Test Connection & Status */}
                                      <div className="flex items-center justify-between pt-2">
                                        <button
                                          type="button"
                                          onClick={() => handleTestConnection(spec.id)}
                                          disabled={config.testing}
                                          className="btn-ghost text-xs px-3 py-1.5 border border-ey-yellow/40 hover:border-ey-yellow text-ey-yellow rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                        >
                                          {config.testing ? (
                                            <>
                                              <Loader2 className="h-3 w-3 animate-spin" />
                                              Testing Connection...
                                            </>
                                          ) : (
                                            <>
                                              <RefreshCw className="h-3 w-3" />
                                              Test Connection
                                            </>
                                          )}
                                        </button>

                                        {/* Status indicator badge */}
                                        {config.testStatus === 'success' && (
                                          <div className="flex items-center gap-1 text-[11px] text-status-success font-medium bg-status-success/10 px-2 py-1 rounded-md border border-status-success/20">
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            <span>Tested & Verified ({config.latencyMs ?? 0}ms)</span>
                                          </div>
                                        )}
                                        {config.testStatus === 'error' && (
                                          <div className="flex items-center gap-1 text-[11px] text-status-error font-medium bg-status-error/10 px-2 py-1 rounded-md border border-status-error/20" title={config.testMessage || ''}>
                                            <XCircle className="h-3.5 w-3.5" />
                                            <span className="truncate max-w-[200px]">{config.testMessage || 'Connection Failed'}</span>
                                          </div>
                                        )}
                                        {!config.testStatus && (
                                          <span className="text-[10px] text-text-muted">Unverified — Click Test Connection to validate credentials</span>
                                        )}
                                      </div>
                                    </motion.div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Step 5: Review & Launch */}
              {currentStep === 5 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <p className="text-sm font-medium text-text-primary mb-4">Review Project Configuration</p>
                  <Card className="space-y-4">
                    <div className="flex items-start justify-between pb-3 border-b border-dark-border">
                      <div>
                        <p className="text-xs text-text-muted">Project Name</p>
                        <p className="text-sm font-medium text-text-primary mt-1">{projectName || 'Untitled Project'}</p>
                      </div>
                      <button onClick={() => setCurrentStep(0)} className="text-xs text-ey-yellow hover:text-ey-yellow/80">Edit</button>
                    </div>
                    {projectDescription && (
                      <div className="pb-3 border-b border-dark-border">
                        <p className="text-xs text-text-muted">Description</p>
                        <p className="text-sm text-text-secondary mt-1">{projectDescription}</p>
                      </div>
                    )}
                    <div className="flex items-start justify-between pb-3 border-b border-dark-border">
                      <div>
                        <p className="text-xs text-text-muted">Project Type</p>
                        <p className="text-sm font-medium text-text-primary mt-1">{selectedType?.name || '-'}</p>
                      </div>
                      <button onClick={() => setCurrentStep(1)} className="text-xs text-ey-yellow hover:text-ey-yellow/80">Edit</button>
                    </div>
                    <div className="flex items-start justify-between pb-3 border-b border-dark-border">
                      <div>
                        <p className="text-xs text-text-muted">Execution Mode</p>
                        <p className="text-sm font-medium text-text-primary mt-1 capitalize">{selectedMode?.name || '-'}</p>
                      </div>
                      <button onClick={() => setCurrentStep(2)} className="text-xs text-ey-yellow hover:text-ey-yellow/80">Edit</button>
                    </div>
                    {executionMode === 'manual' && (
                      <div className="pb-3 border-b border-dark-border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-text-muted">Selected Agents</p>
                          <button onClick={() => setCurrentStep(3)} className="text-xs text-ey-yellow hover:text-ey-yellow/80">Edit</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedAgentOptions.length > 0 ? (
                            selectedAgentOptions.map((id) => {
                              const opt = agentOptions.find((o) => o.id === id);
                              return (
                                <span key={id} className="inline-flex items-center gap-1 rounded-full bg-ey-yellow/10 px-2 py-1 text-xs text-ey-yellow">
                                  {opt?.name || id}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-xs text-text-muted">None selected</span>
                          )}
                        </div>
                      </div>
                    )}
                    {executionMode === 'manual' && (selectedAgentOptions.includes('frontend') || selectedAgentOptions.includes('dev-studio')) && (
                      <div className="flex items-start justify-between pb-3 border-b border-dark-border">
                        <div>
                          <p className="text-xs text-text-muted">Frontend Framework</p>
                          <p className="text-sm font-medium text-text-primary mt-1">
                            {frontendFramework === 'angular' ? 'Angular JS' : 'React JS'}
                          </p>
                        </div>
                        <button onClick={() => setCurrentStep(3)} className="text-xs text-ey-yellow hover:text-ey-yellow/80">Edit</button>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-text-muted mb-2">Active BYOK Provider</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(byokConfigs).filter(([, v]) => v.enabled).length > 0 ? (
                          Object.entries(byokConfigs)
                            .filter(([, v]) => v.enabled)
                            .map(([id, v]) => {
                              const spec = BYOK_PROVIDER_SPECS.find((s) => s.id === id);
                              return (
                                <div key={id} className="inline-flex items-center gap-1.5 rounded-lg border border-ey-yellow/30 bg-ey-yellow/10 px-2.5 py-1 text-xs text-ey-yellow font-medium">
                                  <Cloud className="h-3.5 w-3.5" />
                                  <span>{spec?.name || id}</span>
                                  {v.model && <span className="opacity-80 font-mono text-[10px]">({v.model})</span>}
                                  {v.testStatus === 'success' && <CheckCircle2 className="h-3 w-3 text-status-success ml-1" />}
                                </div>
                              );
                            })
                        ) : (
                          <div className="inline-flex items-center gap-1.5 rounded-lg border border-dark-border bg-dark-bg px-2.5 py-1 text-xs text-text-secondary">
                            <ShieldCheck className="h-3.5 w-3.5 text-ey-yellow" />
                            <span>Ollama (Built-in Local Provider Fallback)</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                  <div className="rounded-lg border border-ey-yellow/30 bg-ey-yellow/5 p-3">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-ey-yellow" />
                      <p className="text-xs text-ey-yellow font-medium">Ready to Launch</p>
                    </div>
                    <p className="text-[10px] text-text-muted mt-1">
                      AI agents will be initialized for {executionMode === 'auto' ? 'all agents in this project type' : `${selectedAgentOptions.length} selected agent(s)`}.
                      Governance approvals will be required at key checkpoints.
                    </p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-dark-border px-6 py-4">
              {launchError && (
                <p className="mr-4 text-xs text-status-error">{launchError}</p>
              )}
              <button
                onClick={handleBack}
                disabled={currentStep === 0}
                className={`btn-ghost text-sm ${currentStep === 0 ? 'opacity-0 pointer-events-none' : ''}`}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </button>
              {currentStep < steps.length - 1 ? (
                <button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className={`btn-primary text-sm ${!canProceed() ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </button>
              ) : (
                <button onClick={handleLaunch} disabled={saving} className="btn-primary text-sm">
                  <Rocket className="mr-2 h-4 w-4" />
                  {saving ? 'Launching...' : 'Launch Project'}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

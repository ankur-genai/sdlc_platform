import { useState, useMemo, createContext, useContext } from 'react';
import type { ReactNode } from 'react';

export const WorkspaceReadOnlyContext = createContext<boolean>(false);

export function useWorkspaceReadOnly() {
  return useContext(WorkspaceReadOnlyContext);
}
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileSearch,
  Briefcase,
  Building2,
  Database,
  Monitor,
  Shield,
  Radar,
  Layers,
  Server,
  Code,
  TestTube,
  FileText,
  PlayCircle,
  Cloud,
  Rocket,
  LockKeyhole,
  ArrowLeft,
  Check,
  AlertTriangle,
  Loader2,
  X,
  Lock,
} from 'lucide-react';
import { useAgentStatus, getTargetDeliverables, getPrerequisiteWorkspaces } from '../lib/AgentStatusService';
import { getSelectedProjectId } from '../lib/projectContext';
import { apiRequest } from '../lib/api';

const WORKSPACE_LABELS: Record<string, string> = {
  requirements: 'Requirements Workspace',
  'business-analyst': 'Business Analyst Workspace',
  architecture: 'Architecture Workspace',
  database: 'Database Workspace',
  uiux: 'UI/UX Workspace',
  security: 'Security Workspace',
  compliance: 'Compliance Workspace',
  frontend: 'Frontend Workspace',
  backend: 'Backend Workspace',
  testing: 'Testing Workspace',
  docs: 'Documentation Workspace',
  'video-generation': 'Video Generation Workspace',
  development: 'Development Studio',
  devops: 'DevOps & GitOps',
  deployment: 'Production Deploy',
};

const WORKSPACE_ICONS: Record<string, any> = {
  requirements: FileSearch,
  'business-analyst': Briefcase,
  architecture: Building2,
  database: Database,
  uiux: Monitor,
  security: Shield,
  compliance: Radar,
  frontend: Layers,
  backend: Server,
  development: Code,
  testing: TestTube,
  docs: FileText,
  'video-generation': PlayCircle,
  devops: Cloud,
  deployment: Rocket,
};

const WORKSPACE_PATHS: Record<string, string> = {
  requirements: '/app/requirements',
  'business-analyst': '/app/business-analyst',
  architecture: '/app/architecture',
  database: '/app/database',
  uiux: '/app/uiux',
  security: '/app/security',
  compliance: '/app/compliance',
  frontend: '/app/frontend',
  backend: '/app/backend',
  development: '/app/development',
  testing: '/app/testing',
  docs: '/app/docs',
  'video-generation': '/app/video-generation',
};

const pipelineAgents = [
  { id: 'Requirement Agent', name: 'Requirements Analysis', icon: FileSearch, description: 'Agent generates PRD, FRS, and SRS specifications' },
  { id: 'Business Analyst Agent', name: 'Business Analysis', icon: Briefcase, description: 'Agent writes Epics and User Stories' },
  { id: 'Solution Architect Agent', name: 'Solution Architecture', icon: Building2, description: 'Agent designs software blueprints and workflows' },
  { id: 'Database Design Agent', name: 'Database Design', icon: Database, description: 'Agent outputs ERDs and database schemas' },
  { id: 'UI/UX Design Agent', name: 'UI/UX Design', icon: Monitor, description: 'Agent designs mockup pages and UI flow states' },
  { id: 'Security Architect Agent', name: 'Security Architecture', icon: Shield, description: 'Agent audits vulnerabilities and defines threat models' },
  { id: 'Compliance Architect Agent', name: 'Compliance Assessment', icon: Radar, description: 'Agent validates regulatory compliance metrics' },
  { id: 'Frontend Agent', name: 'Frontend Development', icon: Layers, description: 'Agent generates React components and pages' },
  { id: 'Backend Agent', name: 'Backend Development', icon: Server, description: 'Agent implements API endpoints and business logic' },
  { id: 'Development Studio', name: 'Development Studio', icon: Code, description: 'Agent integrates and reconciles frontend and backend code' },
  { id: 'Testing Agent', name: 'Testing & Quality Assurance', icon: TestTube, description: 'Agent writes unit, integration, and E2E tests' },
  { id: 'Documentation Agent', name: 'Documentation Workspace', icon: FileText, description: 'Agent compiles user guides, runbooks, and developer manuals' },
  { id: 'Presentation video agent', name: 'Presentation & Video Generation', icon: PlayCircle, description: 'Agent creates audio-visual slide decks' }
];

const deliverableMap: Record<string, string> = {
  'Requirement Agent': 'SRS',
  'Business Analyst Agent': 'User Stories',
  'Solution Architect Agent': 'Architecture Documents',
  'Database Design Agent': 'Database Documents',
  'UI/UX Design Agent': 'Architecture Documents',
  'Security Architect Agent': 'Test Reports',
  'Compliance Architect Agent': 'Test Reports',
  'Presentation video agent': 'Deployment Documents',
  'Frontend Agent': 'API Documents',
  'Backend Agent': 'API Documents',
  'Development Studio': 'API Documents',
  'Testing Agent': 'Test Reports',
  'Documentation Agent': 'Deployment Documents'
};
const AGENT_DEPENDENCY_RULES: Record<string, { label: string; deps: string[] }> = {
  'Business Analyst Agent': { label: 'Requirements Analysis', deps: ['Requirement Agent'] },
  'Solution Architect Agent': { label: 'Business Analysis', deps: ['Business Analyst Agent'] },
  'Database Design Agent': { label: 'Solution Architecture', deps: ['Solution Architect Agent'] },
  'UI/UX Design Agent': { label: 'Database Design', deps: ['Database Design Agent'] },
  'Security Architect Agent': { label: 'UI/UX Design', deps: ['UI/UX Design Agent'] },
  'Compliance Architect Agent': { label: 'Security Architecture', deps: ['Security Architect Agent'] },
  'Frontend Agent': { label: 'Compliance Assessment', deps: ['Compliance Architect Agent'] },
  'Backend Agent': { label: 'Frontend Development', deps: ['Frontend Agent'] },
  'Development Studio': { label: 'Frontend & Backend Development', deps: ['Frontend Agent', 'Backend Agent'] },
  'Testing Agent': { label: 'Development Work', deps: ['Development Studio'] },
  'Documentation Agent': { label: 'Testing & QA', deps: ['Testing Agent'] },
  'Presentation video agent': { label: 'Documentation Workspace', deps: ['Documentation Agent'] },
};

function getTransitiveDependencies(agentId: string): string[] {
  const deps: string[] = [];
  const queue = [...(AGENT_DEPENDENCY_RULES[agentId]?.deps || [])];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (!deps.includes(current)) {
      deps.push(current);
      queue.push(...(AGENT_DEPENDENCY_RULES[current]?.deps || []));
    }
  }
  return deps;
}

export function WorkspaceGate({ workspace, children }: { workspace: string; children: ReactNode }) {
  const navigate = useNavigate();
  const { project, getWorkspaceState, stages, refreshStatuses, currentStage, percentage } = useAgentStatus();
  
  const [showDialog, setShowDialog] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  const wsState = getWorkspaceState(workspace);
  const isUnderDevelopment = workspace === 'devops' || workspace === 'deployment';
  const isSelected = wsState.status === 'active';

  // Modal handlers
  const openEnableDialog = () => {
    const activeKeys = stages.map((s) => s.key);
    const initialSelected = pipelineAgents
      .map((a) => a.id)
      .filter((id) => activeKeys.includes(id));
    
    setSelectedAgents(initialSelected);
    setSaveError(null);
    setShowDialog(true);
  };

  const handleToggleAgent = (id: string) => {
    setSelectedAgents((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const missingDepsReport = useMemo(() => {
    const reports: { label: string; missingLabels: string[]; missingIds: string[] }[] = [];
    for (const agentId of selectedAgents) {
      const allDeps = getTransitiveDependencies(agentId);
      const missing = allDeps.filter((depId) => !selectedAgents.includes(depId));
      if (missing.length > 0) {
        const label = pipelineAgents.find((a) => a.id === agentId)?.name || agentId;
        const missingLabels = missing.map((depId) => pipelineAgents.find((a) => a.id === depId)?.name || depId);
        reports.push({ label, missingLabels, missingIds: missing });
      }
    }
    return reports;
  }, [selectedAgents]);

  const handleAutoEnableDependencies = () => {
    const allMissingIds = Array.from(
      new Set(missingDepsReport.flatMap((r) => r.missingIds))
    );
    setSelectedAgents((prev) => Array.from(new Set([...prev, ...allMissingIds])));
  };

  const handleSaveChanges = async () => {
    const pId = getSelectedProjectId();
    if (!pId) return;

    setSaving(true);
    setSaveError(null);
    try {
      const proj = await apiRequest<any>(`/projects/${pId}`);
      const deliverables = Array.from(
        new Set(selectedAgents.map((a) => deliverableMap[a]).filter(Boolean))
      );

      await apiRequest(`/projects/${pId}`, {
        method: 'PATCH',
        body: {
          project_name: proj.name,
          description: proj.description,
          project_type: proj.project_type,
          execution_mode: proj.execution_mode,
          build_type: proj.build_type || 'full_stack',
          deliverables: deliverables,
          providers: {},
          manual_stages: selectedAgents,
          launch_mode: proj.launch_mode || (proj.execution_mode === 'autonomous' ? 'auto' : 'manual'),
        },
      });

      await refreshStatuses();
      setShowDialog(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update project configurations.');
    } finally {
      setSaving(false);
    }
  };

  // Compile list of prerequisite stages and statuses for Auto mode
  const prerequisiteList = useMemo(() => {
    if (!project) return [];
    const targets = getTargetDeliverables(project);
    const prereqKeys = getPrerequisiteWorkspaces(project, targets);
    return prereqKeys.map(key => {
      const agentId = MANUAL_STAGE_BY_WORKSPACE[key];
      const stageInfo = stages.find(s => s.key === agentId);
      const runStatus = stageInfo?.status || 'idle';
      const label = WORKSPACE_LABELS[key] || key;
      return {
        key,
        label,
        status: runStatus,
      };
    });
  }, [project, stages]);

  const handleActionClick = (key: string) => {
    if (key === workspace) {
      setUnlocked(true);
    } else {
      const path = WORKSPACE_PATHS[key];
      if (path) navigate(path);
    }
  };

  const agentId = MANUAL_STAGE_BY_WORKSPACE[workspace];
  const stageKeys = Array.isArray(agentId) ? agentId : [agentId].filter(Boolean);
  const correspondingStages = stages.filter(s => stageKeys.includes(s.key));
  const isStageCompleted = correspondingStages.length > 0 && correspondingStages.every(s => s.status === 'completed' || s.status === 'approved');
  const incompleteDeps = getTransitiveDependencies(stageKeys[0] || '').filter(
    (depId) => {
      const stage = stages.find((s) => s.key === depId);
      if (!stage) return false;
      return stage.status !== 'completed' && stage.status !== 'approved';
    }
  );
  
  const isPrerequisiteUncompleted = incompleteDeps.length > 0;
  const isPartOfPipeline = isSelected || wsState.status === 'prerequisite' || wsState.status === 'active';
  const isUnlocked = (isPartOfPipeline && !isPrerequisiteUncompleted) || unlocked;

  if (isUnlocked && !isUnderDevelopment) {
    return (
      <WorkspaceReadOnlyContext.Provider value={false}>
        {children}
      </WorkspaceReadOnlyContext.Provider>
    );
  }

  const IconComponent = WORKSPACE_ICONS[workspace] || LockKeyhole;
  const label = WORKSPACE_LABELS[workspace] || 'Workspace';
  const isAutoMode = project?.launch_mode === 'auto' || project?.execution_mode === 'autonomous';

  if (!isUnlocked && isPartOfPipeline && !isUnderDevelopment) {
    const sortedIncompleteDeps = [...incompleteDeps].sort((a, b) => {
      const idxA = pipelineAgents.findIndex(p => p.id === a);
      const idxB = pipelineAgents.findIndex(p => p.id === b);
      return idxA - idxB;
    });

    const currentPrereqId = sortedIncompleteDeps[0] || incompleteDeps[0];
    const currentPrereqStage = stages.find((s) => s.key === currentPrereqId);
    const prerequisiteName = pipelineAgents.find((a) => a.id === currentPrereqId)?.name || currentPrereqId;
    
    let liveStatus = 'Queued';
    if (currentPrereqStage) {
      if (currentPrereqStage.status === 'running') liveStatus = 'Running';
      else if (currentPrereqStage.status === 'waiting_approval') liveStatus = 'Waiting for Approval';
      else if (currentPrereqStage.status === 'completed' || currentPrereqStage.status === 'approved') liveStatus = 'Completed';
      else if (currentPrereqStage.status === 'failed') liveStatus = 'Failed';
    }

    const isPrereqRunning = currentPrereqStage?.status === 'running' || currentPrereqStage?.status === 'waiting_approval';
    const mainMsg = isPrereqRunning
      ? `${prerequisiteName} is currently running in the background.`
      : `Waiting for ${prerequisiteName} to complete.`;

    return (
      <section className="flex min-h-[80vh] items-center justify-center p-6 bg-dark-bg font-sans">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-5 gap-8 rounded-2xl border border-dark-border bg-dark-card p-8 shadow-2xl relative overflow-hidden text-left">
          {/* Accent decoration */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-ey-yellow/40 via-ey-yellow to-ey-yellow/40" />
          {/* Left panel: Info & Status */}
          <div className="md:col-span-3 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-dark-bg border border-dark-border text-status-warning">
                  <span className="h-2 w-2 rounded-full bg-status-warning animate-pulse" />
                  Pipeline Locked: Prerequisite Pending
                </div>
                {liveStatus === 'Running' && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-status-info/10 border border-status-info/20 text-status-info">
                    <span className="h-2 w-2 rounded-full bg-status-info animate-pulse" />
                    Running in Background
                  </div>
                )}
              </div>

              <h1 className="text-3xl font-extrabold text-text-primary tracking-wide">
                {label}
              </h1>

              <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
                <p className="font-semibold text-ey-yellow text-base">
                  {mainMsg}
                </p>
                <p>
                  This workspace will automatically unlock when the prerequisite stage completes.
                </p>
                <p className="font-medium text-text-muted">
                  No action is required.
                </p>
              </div>
            </div>
            {/* Live Metrics Block */}
            <div className="rounded-xl border border-dark-border bg-dark-bg/60 p-4 space-y-3.5">
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider border-b border-dark-border/40 pb-1.5">
                Live Pipeline Telemetry
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-text-muted uppercase">Prerequisite Stage</p>
                  <p className="text-xs font-semibold text-text-primary truncate">{prerequisiteName}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase">Live Status</p>
                  <p className="text-xs font-semibold text-ey-yellow">{liveStatus}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase">Executing Agent</p>
                  <p className="text-xs font-semibold text-text-primary truncate">{currentStage || 'None'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase">Approval Status</p>
                  <p className="text-xs font-semibold text-text-primary">
                    {currentPrereqStage?.status === 'waiting_approval' ? 'Awaiting Human Sign-off' : 'None Required'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase">Last Update</p>
                  <p className="text-xs font-semibold text-text-primary">
                    {new Date().toLocaleTimeString()}
                  </p>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="space-y-1 pt-1.5">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-text-muted">OVERALL PIPELINE PROGRESS</span>
                  <span className="text-text-primary font-bold">{percentage || 0}%</span>
                </div>
                <div className="w-full h-1.5 bg-dark-bg rounded-full overflow-hidden border border-dark-border">
                  <div 
                    className="h-full bg-ey-yellow transition-all duration-500 ease-out" 
                    style={{ width: `${percentage || 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right panel: SDLC Progress Visualization */}
          <div className="md:col-span-2 border-l border-dark-border/40 pl-0 md:pl-8 space-y-4">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider pb-2 border-b border-dark-border/40">
              Pipeline Stages
            </h3>
            
            <div className="relative space-y-4 pt-2">
              {/* Connector Line */}
              <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-dark-border" />

              {stages.map((stg) => {
                const isCompleted = stg.status === 'completed' || stg.status === 'approved';
                const isRunning = stg.status === 'running' || stg.status === 'waiting_approval';
                const isLocked = stg.key === stageKeys[0];
                const labelName = pipelineAgents.find(a => a.id === stg.key)?.name || stg.label;

                let iconSymbol = '○';
                let iconClass = 'bg-dark-bg text-text-muted border-dark-border';
                let labelClass = 'text-text-muted text-xs';

                if (isCompleted) {
                  iconSymbol = '✓';
                  iconClass = 'bg-status-success/20 text-status-success border-status-success/40';
                  labelClass = 'text-text-primary font-medium text-xs';
                } else if (isRunning) {
                  iconSymbol = '⏳';
                  iconClass = 'bg-status-info/20 text-status-info border-status-info/40 animate-pulse';
                  labelClass = 'text-status-info font-bold text-xs';
                } else if (isLocked) {
                  iconSymbol = '🔒';
                  iconClass = 'bg-status-warning/20 text-status-warning border-status-warning/40';
                  labelClass = 'text-status-warning font-semibold text-xs';
                }

                return (
                  <div key={stg.key} className="flex items-start gap-3 relative z-10">
                    <div className={`h-6 w-6 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 ${iconClass}`}>
                      {iconSymbol}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={labelClass}>{labelName}</p>
                      {isRunning && (
                        <span className="text-[9px] text-status-info font-mono uppercase tracking-wider">
                          Active in background
                        </span>
                      )}
                      {isLocked && (
                        <span className="text-[9px] text-status-warning font-mono uppercase tracking-wider">
                          Locked (Prerequisite)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="flex min-h-[75vh] items-center justify-center p-6 bg-dark-bg font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-xl w-full rounded-2xl border border-dark-border bg-dark-card p-8 text-center shadow-2xl relative overflow-hidden"
        >
          {/* Accent decoration */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-ey-yellow/40 via-ey-yellow to-ey-yellow/40" />

          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-ey-yellow/10 text-ey-yellow border border-ey-yellow/20">
            {isUnderDevelopment ? (
              <Lock className="h-6 w-6" />
            ) : (
              <IconComponent className="h-6 w-6" />
            )}
          </div>

          <h1 className="text-xl font-bold text-text-primary tracking-wide mb-2">
            {isUnderDevelopment
              ? label
              : isAutoMode
                ? "This Workspace Isn't Currently Available"
                : "Workspace Not Selected"}
          </h1>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-dark-bg border border-dark-border mb-6">
            {isUnderDevelopment ? (
              <span className="text-status-warning flex items-center gap-1">
                🚧 Under Development
              </span>
            ) : (
              <span className="text-text-muted">
                {wsState.badge || 'Not Active'}
              </span>
            )}
          </div>

          <p className="text-sm leading-relaxed text-text-secondary mb-8 max-w-md mx-auto">
            {isUnderDevelopment ? (
              'This workspace is currently under development and will be available in a future release.'
            ) : isAutoMode ? (
              'This workspace was not included in your initial Auto workflow. If it is required by the autonomous SDLC pipeline, prerequisite stages are executed automatically in the background. This workspace will unlock automatically when those stages are completed.'
            ) : (
              'This workspace was not selected during project creation. You can modify your selected agents from the Dashboard.'
            )}
          </p>

          {/* Dependency status block in Auto Mode */}
          {isAutoMode && !isUnderDevelopment && prerequisiteList.length > 0 && (
            <div className="mb-8 rounded-lg border border-dark-border bg-dark-bg/60 p-4 text-left space-y-3 font-sans">
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-2">Dependency Pipeline Status</h3>
              <div className="space-y-2">
                {prerequisiteList.map((prereq) => {
                  const isCompleted = prereq.status === 'completed';
                  const isRunning = prereq.status === 'running' || prereq.status === 'waiting_approval';
                  return (
                    <div key={prereq.key} className="flex items-center justify-between gap-3 text-xs py-1 border-b border-dark-border/40 last:border-b-0">
                      <div className="flex items-center gap-2">
                        {isCompleted ? (
                          <span className="text-status-success font-semibold flex items-center gap-1">✔</span>
                        ) : isRunning ? (
                          <span className="text-status-info animate-pulse">⏳</span>
                        ) : (
                          <span className="text-text-muted">·</span>
                        )}
                        <span className={isCompleted ? 'text-text-primary font-medium' : isRunning ? 'text-status-info font-medium' : 'text-text-muted'}>
                          {prereq.label} {isCompleted ? 'Completed' : isRunning ? 'Running' : 'Waiting'}
                        </span>
                      </div>
                      
                      {/* Open / View prerequisite buttons */}
                      {isCompleted ? (
                        <button
                          onClick={() => handleActionClick(prereq.key)}
                          className="px-2.5 py-1 text-[10px] font-semibold bg-ey-yellow text-dark-bg hover:bg-ey-yellow/90 rounded transition-all"
                        >
                          Open Workspace
                        </button>
                      ) : isRunning ? (
                        <button
                          onClick={() => handleActionClick(prereq.key)}
                          className="px-2.5 py-1 text-[10px] font-semibold bg-dark-card border border-dark-border text-text-primary hover:bg-dark-border-light rounded transition-all"
                        >
                          View Workspace
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {!isUnderDevelopment && !isAutoMode && (
              <button
                onClick={openEnableDialog}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-semibold bg-ey-yellow text-dark-bg hover:bg-ey-yellow/90 transition-all font-sans font-bold shadow-lg shadow-ey-yellow/10"
              >
                Manage Selected Agents
              </button>
            )}
            <button
              onClick={() => navigate('/app/dashboard')}
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-semibold border border-dark-border bg-dark-bg text-text-primary hover:bg-dark-card hover:border-dark-border-light transition-all font-sans flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Go to Dashboard
            </button>
          </div>
        </motion.div>
      </section>

      {/* Dynamic Enablement Modal */}
      <AnimatePresence>
        {showDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-dark-bg/85 backdrop-blur-md p-4 font-sans"
            onClick={() => setShowDialog(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-dark-card border border-dark-border rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-dark-border px-6 py-4 bg-dark-bg/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ey-yellow/10 text-ey-yellow border border-ey-yellow/20">
                    <Rocket className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-text-primary">Configure SDLC Deliverables</h2>
                    <p className="text-xs text-text-muted">Dynamically enable or disable workspaces</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDialog(false)}
                  className="rounded-lg p-2 text-text-muted hover:bg-dark-bg hover:text-text-primary transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Content / Agents List */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
                {/* Dependency warning banner */}
                {missingDepsReport.length > 0 && (
                  <div className="rounded-lg border border-status-warning/30 bg-status-warning/5 p-4 space-y-2">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="h-5 w-5 text-status-warning flex-shrink-0 mt-0.5" />
                      <div className="flex-1 text-xs text-text-secondary leading-relaxed">
                        {missingDepsReport.map((rep, idx) => (
                          <p key={idx} className="mb-1 last:mb-0">
                            <span className="font-semibold text-text-primary">{rep.label}</span> depends on{' '}
                            <span className="font-semibold text-ey-yellow">{rep.missingLabels.join(' and ')}</span>.
                          </p>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={handleAutoEnableDependencies}
                        className="text-xs font-bold text-ey-yellow hover:text-ey-yellow/90 hover:underline transition-all"
                      >
                        Enable Required Workspaces
                      </button>
                    </div>
                  </div>
                )}

                {saveError && (
                  <div className="rounded-lg border border-status-error/30 bg-status-error/5 p-4 flex items-center gap-2.5 text-xs text-status-error">
                    <AlertTriangle className="h-4 w-4" />
                    {saveError}
                  </div>
                )}

                <div className="grid gap-2 sm:grid-cols-2">
                  {pipelineAgents.map((agent) => {
                    const AgentIcon = agent.icon;
                    const isChecked = selectedAgents.includes(agent.id);
                    return (
                      <button
                        key={agent.id}
                        onClick={() => handleToggleAgent(agent.id)}
                        className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                          isChecked
                            ? 'border-ey-yellow/30 bg-ey-yellow/5'
                            : 'border-dark-border bg-dark-bg hover:border-dark-border-light'
                        }`}
                      >
                        <div className={`flex h-8 w-8 items-center justify-center rounded ${isChecked ? 'bg-ey-yellow/20 text-ey-yellow' : 'bg-dark-card text-text-muted'}`}>
                          <AgentIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold ${isChecked ? 'text-text-primary' : 'text-text-secondary'}`}>
                            {agent.name}
                          </p>
                          <p className="text-[9px] text-text-muted truncate mt-0.5">{agent.description}</p>
                        </div>
                        <div className={`flex h-4 w-4 items-center justify-center rounded border transition-all ${
                          isChecked ? 'border-ey-yellow bg-ey-yellow' : 'border-dark-border-light'
                        }`}>
                          {isChecked && <Check className="h-3 w-3 text-dark-bg" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-dark-border px-6 py-4 flex items-center justify-end gap-3 bg-dark-bg/30">
                <button
                  onClick={() => setShowDialog(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-dark-border bg-dark-bg text-text-primary hover:bg-dark-card hover:border-dark-border-light transition-all font-sans"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveChanges}
                  disabled={saving}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-ey-yellow text-dark-bg hover:bg-ey-yellow/90 disabled:opacity-50 transition-all font-sans font-bold flex items-center gap-2 shadow-lg shadow-ey-yellow/5"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const AGENT_KEY_TO_STAGE_KEY: Record<string, string> = {
  requirements: 'Requirement Agent',
  'business-analyst': 'Business Analyst Agent',
  architecture: 'Solution Architect Agent',
  database: 'Database Design Agent',
  uiux: 'UI/UX Design Agent',
  security: 'Security Architect Agent',
  compliance: 'Compliance Architect Agent',
  frontend: 'Frontend Agent',
  backend: 'Backend Agent',
  development: 'Development Studio',
  testing: 'Testing Agent',
  docs: 'Documentation Agent',
  'video-generation': 'Presentation video agent',
};

const MANUAL_STAGE_BY_WORKSPACE: Record<string, string | string[]> = {
  requirements: 'Requirement Agent',
  'business-analyst': 'Business Analyst Agent',
  architecture: 'Solution Architect Agent',
  database: 'Database Design Agent',
  uiux: 'UI/UX Design Agent',
  security: 'Security Architect Agent',
  compliance: 'Compliance Architect Agent',
  frontend: 'Frontend Agent',
  backend: 'Backend Agent',
  testing: 'Testing Agent',
  docs: 'Documentation Agent',
  'video-generation': 'Presentation video agent',
  development: 'Development Studio',
  devops: 'DevOps Agent',
  deployment: 'Deployment Agent',
};

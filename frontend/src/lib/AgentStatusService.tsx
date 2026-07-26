import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiRequest } from './api';
import { getSelectedProjectId, subscribeToSelectedProject } from './projectContext';
import { usePipelineUpdates } from '../hooks/usePipelineUpdates';

export type AgentStatus = 'completed' | 'running' | 'queued' | 'waiting_approval' | 'failed' | 'idle';

export interface PipelineStage {
  key: string;
  label: string;
  status: string;
}

interface PipelineStatusResponse {
  completed_stages: number;
  current_stage: string | null;
  current_agent: string | null;
  total_stages: number;
  percentage: number;
  workflow_status: string;
  stages: PipelineStage[];
}

// Maps MainLayout nav agentKey -> the exact pipeline stage key the backend
// emits (== AgentName enum values in backend/fastapi_agents/models.py, same
// strings agent_runner.py's PIPELINE list uses). Ported from Bhumika's
// AGENT_TO_ARTIFACT_MAP, but keyed against real pipeline-status stage keys
// instead of guessed artifact_type strings (her GET /projects/{id}/artifacts
// call didn't exist on any backend — this uses the real, already-working
// GET /projects/{id}/pipeline-status endpoint instead).
export const AGENT_KEY_TO_STAGE_KEY: Record<string, string> = {
  requirement: 'Requirement Agent',
  'business-analyst': 'Business Analyst Agent',
  architect: 'Solution Architect Agent',
  database: 'Database Design Agent',
  uiux: 'UI/UX Design Agent',
  security: 'Security Architect Agent',
  compliance: 'Compliance Architect Agent',
  frontend: 'Frontend Agent',
  backend: 'Backend Agent',
  development: 'Development Studio',
  testing: 'Testing Agent',
  documentation: 'Documentation Agent',
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

function mapStageStatus(status: string | undefined): AgentStatus {
  switch (status) {
    case 'completed':
    case 'running':
    case 'failed':
    case 'waiting_approval':
    case 'queued':
      return status;
    default:
      return 'idle';
  }
}

export interface WorkspaceState {
  status: 'active' | 'prerequisite' | 'not-selected' | 'under-development';
  badge: 'Pending' | 'Running' | 'Running in Background' | 'Waiting for Approval' | 'Approved' | 'Completed' | 'Failed' | 'Under Development' | 'Not Selected' | 'Waiting for Dependency' | '';
  runStatus: AgentStatus;
}
const DEPENDENCY_RULES: Record<string, string[]> = {
  'Requirement Agent': [],
  'Business Analyst Agent': ['Requirement Agent'],
  'Solution Architect Agent': ['Business Analyst Agent'],
  'Database Design Agent': ['Solution Architect Agent'],
  'UI/UX Design Agent': ['Database Design Agent'],
  'Security Architect Agent': ['UI/UX Design Agent'],
  'Compliance Architect Agent': ['Security Architect Agent'],
  'Frontend Agent': ['Compliance Architect Agent'],
  'Backend Agent': ['Frontend Agent'],
  'Development Studio': ['Frontend Agent', 'Backend Agent'],
  'Testing Agent': ['Development Studio'],
  'Documentation Agent': ['Testing Agent'],
  'Presentation video agent': ['Documentation Agent'],
};

function getTransitiveDeps(agentId: string): string[] {
  const deps: string[] = [];
  const queue = [...(DEPENDENCY_RULES[agentId] || [])];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (!deps.includes(current)) {
      deps.push(current);
      queue.push(...(DEPENDENCY_RULES[current] || []));
    }
  }
  return deps;
}

export function getTargetDeliverables(proj: any): string[] {
  if (!proj) return [];
  const mode = proj.launch_mode || (proj.execution_mode === 'autonomous' ? 'auto' : 'manual');
  if (mode === 'auto') {
    if (proj.project_type === 'web-app') {
      return ['uiux', 'frontend', 'backend', 'development', 'video-generation'];
    } else {
      return ['requirements', 'business-analyst', 'architecture', 'database', 'uiux', 'security', 'compliance', 'frontend', 'backend', 'development', 'testing', 'docs', 'video-generation'];
    }
  } else {
    const manualStages = proj.manual_stages || [];
    const out: string[] = [];
    for (const [ws, agentId] of Object.entries(MANUAL_STAGE_BY_WORKSPACE)) {
      if (Array.isArray(agentId)) {
        if (agentId.every(id => manualStages.includes(id))) out.push(ws);
      } else {
        if (manualStages.includes(agentId)) out.push(ws);
      }
    }
    return out;
  }
}

export function getPrerequisiteWorkspaces(proj: any, targets: string[]): string[] {
  if (!proj) return [];
  const prereqAgentIds = new Set<string>();
  targets.forEach(t => {
    const agentId = MANUAL_STAGE_BY_WORKSPACE[t];
    if (typeof agentId === 'string') {
      const deps = getTransitiveDeps(agentId);
      deps.forEach(d => prereqAgentIds.add(d));
    }
  });
  targets.forEach(t => {
    const agentId = MANUAL_STAGE_BY_WORKSPACE[t];
    if (typeof agentId === 'string') {
      prereqAgentIds.delete(agentId);
    }
  });
  const out: string[] = [];
  for (const [ws, agentId] of Object.entries(MANUAL_STAGE_BY_WORKSPACE)) {
    if (typeof agentId === 'string' && prereqAgentIds.has(agentId)) {
      out.push(ws);
    }
  }
  return out;
}

interface AgentStatusContextValue {
  statuses: Record<string, AgentStatus>;
  getAgentStatus: (agentKey: string) => AgentStatus;
  refreshStatuses: () => Promise<void>;
  loading: boolean;
  currentStage: string | null;
  workflowStatus: string;
  percentage: number;
  stages: PipelineStage[];
  isWorkspaceSelected: (workspace: string) => boolean;
  project: any | null;
  getWorkspaceState: (workspace: string) => WorkspaceState;
}

const AgentStatusContext = createContext<AgentStatusContextValue | undefined>(undefined);

export function AgentStatusProvider({ children }: { children: ReactNode }) {
  const [projectId, setProjectId] = useState<string | null>(() => getSelectedProjectId());
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<string>('idle');
  const [percentage, setPercentage] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState<any | null>(null);

  const refreshStatuses = useCallback(async () => {
    if (!projectId) {
      setStages([]);
      setCurrentStage(null);
      setWorkflowStatus('idle');
      setPercentage(0);
      setProject(null);
      return;
    }
    setLoading(true);
    try {
      const [statusData, projectData] = await Promise.all([
        apiRequest<PipelineStatusResponse>(`/projects/${projectId}/pipeline-status`),
        apiRequest<any>(`/projects/${projectId}`)
      ]);
      setStages(statusData.stages || []);
      setCurrentStage(statusData.current_stage);
      setWorkflowStatus(statusData.workflow_status);
      setPercentage(statusData.percentage);
      setProject(projectData);
    } catch {
      setStages([]);
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const [wsConnected, setWsConnected] = useState(false);

  usePipelineUpdates(projectId, (event) => {
    if (event.type === 'ws_status') {
      setWsConnected(event.data.connected as boolean);
    } else {
      refreshStatuses();
    }
  });

  useEffect(() => subscribeToSelectedProject(setProjectId), []);
  useEffect(() => {
    refreshStatuses();
  }, [refreshStatuses]);
  useEffect(() => {
    if (wsConnected) return;
    const interval = setInterval(refreshStatuses, 4000);
    return () => clearInterval(interval);
  }, [wsConnected, refreshStatuses]);

  const statuses = useMemo(() => {
    const byStageKey = Object.fromEntries(stages.map((s) => [s.key, s.status]));
    const out: Record<string, AgentStatus> = {};
    for (const [agentKey, stageKey] of Object.entries(AGENT_KEY_TO_STAGE_KEY)) {
      out[agentKey] = mapStageStatus(byStageKey[stageKey]);
    }
    return out;
  }, [stages]);

  const getAgentStatus = useCallback((agentKey: string) => statuses[agentKey] || 'idle', [statuses]);

  const isWorkspaceSelected = useCallback((workspace: string) => {
    if (workspace === 'devops' || workspace === 'deployment') return false;
    const targets = getTargetDeliverables(project);
    return targets.includes(workspace);
  }, [project]);

  const getWorkspaceState = useCallback((ws: string): WorkspaceState => {
    if (ws === 'devops' || ws === 'deployment') {
      return { status: 'under-development', badge: 'Under Development', runStatus: 'idle' };
    }
    
    const targets = getTargetDeliverables(project);
    const prerequisites = getPrerequisiteWorkspaces(project, targets);
    
    const isTarget = targets.includes(ws);
    const isPrereq = prerequisites.includes(ws);
    
    const agentId = MANUAL_STAGE_BY_WORKSPACE[ws];
    const backendStage = stages.find(s => s.key === agentId);
    const runStatus = mapStageStatus(backendStage?.status);
    
    let statusVal: 'active' | 'prerequisite' | 'not-selected' | 'under-development' = 'not-selected';
    let badgeVal: 'Pending' | 'Running' | 'Running in Background' | 'Waiting for Approval' | 'Approved' | 'Completed' | 'Failed' | 'Under Development' | 'Not Selected' | 'Waiting for Dependency' | '' = '';
    
    if (isTarget) {
      statusVal = 'active';
    } else if (isPrereq) {
      statusVal = 'prerequisite';
    }
    
    if (backendStage) {
      const bs = backendStage.status; // pending, running, completed, failed, waiting_approval, queued, approved
      if (bs === 'completed') {
        badgeVal = 'Completed';
      } else if (bs === 'running') {
        badgeVal = isTarget ? 'Running' : 'Running in Background';
      } else if (bs === 'waiting_approval') {
        badgeVal = 'Waiting for Approval';
      } else if (bs === 'failed') {
        badgeVal = 'Failed';
      } else if (bs === 'queued') {
        badgeVal = 'Waiting for Dependency';
      } else if (bs === 'pending') {
        badgeVal = 'Pending';
      } else if (bs === 'approved') {
        badgeVal = 'Approved';
      }
    } else {
      if (!isTarget && !isPrereq) {
        badgeVal = 'Not Selected';
      } else if (isTarget) {
        badgeVal = 'Pending';
      }
    }
    
    return { status: statusVal, badge: badgeVal, runStatus };
  }, [project, stages]);

  const value: AgentStatusContextValue = {
    statuses, getAgentStatus, refreshStatuses, loading, currentStage, workflowStatus, percentage, stages, isWorkspaceSelected, project, getWorkspaceState
  };

  return <AgentStatusContext.Provider value={value}>{children}</AgentStatusContext.Provider>;
}

export function useAgentStatus(): AgentStatusContextValue {
  const ctx = useContext(AgentStatusContext);
  if (!ctx) throw new Error('useAgentStatus must be used within an AgentStatusProvider');
  return ctx;
}

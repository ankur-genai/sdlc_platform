import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FolderKanban,
  Plus,
  Search,
  Clock,
  Zap,
  LayoutGrid,
  List,
  Trash2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Card, StatusBadge, ProgressBar } from '../components/ui/Card';
import { NewProjectWizard } from '../components/shared/NewProjectWizard';
import { apiRequest } from '../lib/api';

const statusFilters = ['all', 'active', 'paused', 'completed', 'archived'];

type BackendProject = {
  id: number;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
};

type ProjectView = {
  id: string;
  name: string;
  description: string;
  status: string;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
  agents: { status: string }[];
};

export function Projects() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showWizard, setShowWizard] = useState(false);
  const [projects, setProjects] = useState<ProjectView[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProjectView | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiRequest<{ projects?: BackendProject[] } | BackendProject[]>('/projects')
      .then((data) => {
        if (!active) return;
        setLoadError(null);
        const rows = Array.isArray(data) ? data : (Array.isArray(data?.projects) ? data.projects : []);
        const mapped = rows.map((p) => ({
          id: String(p.id),
          name: p.name,
          description: p.description || '',
          status: p.status === 'in_progress' ? 'active' : p.status,
          progress: p.status === 'completed' ? 100 : (p.status === 'in_progress' ? 34 : 0),
          createdAt: new Date(p.created_at),
          updatedAt: new Date(p.created_at),
          agents: [],
        }));
        setProjects(mapped);
      })
      .catch((err) => {
        if (active) setLoadError(err instanceof Error ? err.message : 'Failed to load projects');
      });
    return () => { active = false; };
  }, []);

  const filteredProjects = projects.filter((project) => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await apiRequest(`/projects/${pendingDelete.id}`, { method: 'DELETE' });
      setProjects((prev) => prev.filter((p) => p.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Projects</h1>
          <p className="mt-1 text-sm text-text-muted">Manage and view all your SDLC projects</p>
        </div>
        <button onClick={() => setShowWizard(true)} className="btn-primary text-sm">
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-64 pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            {statusFilters.map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  statusFilter === status
                    ? 'bg-ey-yellow/20 text-ey-yellow border border-ey-yellow/30'
                    : 'bg-dark-card border border-dark-border text-text-secondary hover:text-text-primary'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-ey-yellow/10 text-ey-yellow' : 'text-text-muted hover:text-text-primary'}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-ey-yellow/10 text-ey-yellow' : 'text-text-muted hover:text-text-primary'}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Projects Grid/List */}
      {loadError && (
        <Card className="border-status-error/30 bg-status-error/5 text-sm text-status-error">
          Unable to load projects: {loadError}
        </Card>
      )}
      {viewMode === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                hover
                className="cursor-pointer"
                onClick={() => navigate('/app/dashboard', { state: { projectId: String(project.id) } })}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ey-yellow/10">
                      <FolderKanban className="h-5 w-5 text-ey-yellow" />
                    </div>
                    <div>
                      <h3 className="font-medium text-text-primary">{project.name}</h3>
                      <p className="text-xs text-text-muted">{project.agents.filter((a: { status: string }) => a.status === 'running').length} agents active</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteError(null); setPendingDelete(project); }}
                    className="p-1 rounded text-text-muted hover:text-status-error hover:bg-status-error/10"
                    title="Delete project and its files"
                    aria-label={`Delete ${project.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <p className="text-xs text-text-secondary mb-4 line-clamp-2">{project.description}</p>

                <div className="flex items-center justify-between mb-3">
                  <StatusBadge status={project.status === 'active' ? 'success' : project.status === 'paused' ? 'warning' : 'idle'}>
                    {project.status}
                  </StatusBadge>
                  <span className="text-sm font-semibold text-ey-yellow">{project.progress}%</span>
                </div>

                <ProgressBar value={project.progress} color="yellow" />

                <div className="flex items-center justify-between mt-4 text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {project.updatedAt.toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {project.agents.length} agents
                  </span>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="text-left text-xs font-medium text-text-muted pb-3">Project</th>
                  <th className="text-left text-xs font-medium text-text-muted pb-3">Status</th>
                  <th className="text-left text-xs font-medium text-text-muted pb-3">Progress</th>
                  <th className="text-left text-xs font-medium text-text-muted pb-3">Agents</th>
                  <th className="text-left text-xs font-medium text-text-muted pb-3">Last Updated</th>
                  <th className="text-right text-xs font-medium text-text-muted pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project, index) => (
                  <motion.tr
                    key={project.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-dark-border/50 hover:bg-dark-cardHover cursor-pointer"
                    onClick={() => navigate('/app/dashboard', { state: { projectId: String(project.id) } })}
                  >
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ey-yellow/10">
                          <FolderKanban className="h-4 w-4 text-ey-yellow" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary">{project.name}</p>
                          <p className="text-xs text-text-muted truncate max-w-xs">{project.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      <StatusBadge status={project.status === 'active' ? 'success' : project.status === 'paused' ? 'warning' : 'idle'}>
                        {project.status}
                      </StatusBadge>
                    </td>
                    <td className="py-4">
                      <div className="w-32">
                        <ProgressBar value={project.progress} color="yellow" showLabel />
                      </div>
                    </td>
                    <td className="py-4 text-sm text-text-secondary">{project.agents.length}</td>
                    <td className="py-4 text-sm text-text-muted">{project.updatedAt.toLocaleDateString()}</td>
                    <td className="py-4 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteError(null); setPendingDelete(project); }}
                        className="p-1.5 rounded text-text-muted hover:text-status-error hover:bg-status-error/10"
                        title="Delete project and its files"
                        aria-label={`Delete ${project.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {filteredProjects.length === 0 && (
        <Card className="py-12 text-center">
          <FolderKanban className="h-12 w-12 text-dark-border-light mx-auto mb-4" />
          <h3 className="text-lg font-medium text-text-primary">No projects found</h3>
          <p className="text-sm text-text-muted mt-1">Try adjusting your search or filters</p>
          <button onClick={() => setShowWizard(true)} className="btn-primary text-sm mt-4 mx-auto">
            <Plus className="mr-2 h-4 w-4" />
            Create New Project
          </button>
        </Card>
      )}

      <NewProjectWizard isOpen={showWizard} onClose={() => setShowWizard(false)} />

      {/* Delete confirmation */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !deleteBusy && setPendingDelete(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-dark-border bg-dark-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-status-error/10">
                <AlertTriangle className="h-5 w-5 text-status-error" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-text-primary">Delete project?</h3>
                <p className="mt-1 text-sm text-text-secondary">
                  This permanently deletes <span className="font-medium text-text-primary">{pendingDelete.name}</span> and
                  all of its files, artifacts, documents, and history. This action cannot be undone.
                </p>
              </div>
            </div>

            {deleteError && (
              <p className="mt-3 text-xs text-status-error">{deleteError}</p>
            )}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setPendingDelete(null)}
                disabled={deleteBusy}
                className="rounded-lg border border-dark-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteBusy}
                className="flex items-center rounded-lg bg-status-error px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                {deleteBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                {deleteBusy ? 'Deleting…' : 'Delete project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

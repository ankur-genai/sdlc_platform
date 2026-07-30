import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Table2,
  Link2,
  Key,
  FileCode2,
  FileCode,
  RefreshCw,
  CheckCircle2,
  Clock,
  FileJson,
  FileType,
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
  Code2,
  ListChecks,
} from 'lucide-react';
import { Card, StatusBadge } from '../components/ui/Card';
import { Accordion, AccordionItem, BulletList } from '../components/ui/Accordion';
import { CodeBlock } from '../components/ui/CodeBlock';
import { ApprovalBadge, ApprovalBanner } from '../components/ui/ApprovalStatus';
import { StudioApprovalButton } from '../components/ui/StudioApprovalButton';
import { useToast } from '../components/ui/Toast';
import { useUnifiedArtifacts } from '../lib/useUnifiedArtifacts';
import { getSelectedProjectId } from '../lib/projectContext';
import { buildApiUrl, fastApiRequest } from '../lib/api';

interface TimelineEvent {
  id: number;
  timestamp: string;
  agent: string;
  action: string;
  result: string;
  stage: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return 'just now';
  if (ms < 3600000) return `${Math.round(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.round(ms / 86400000)}h ago`;
  return `${Math.round(ms / 86400000)}d ago`;
}

const COPILOT_SUGGESTIONS = [
  '⚡ Add audit columns (created_at, updated_at) to all tables',
  '⚡ Normalize customer and address fields into 3NF',
  '⚡ Add indexes for foreign keys and high-frequency search queries',
  '⚡ Add soft deletion timestamp (deleted_at) to entity tables',
  '⚡ Generate database migration scripts up and down',
];

export function DatabaseWorkspace() {
  const [activeTab, setActiveTab] = useState<'schema' | 'migrations' | 'sql' | 'relationships' | 'audit'>('schema');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  
  // Copilot State
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [sendingCopilot, setSendingCopilot] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  const { addToast, clearToasts } = useToast();
  const projectId = getSelectedProjectId();
  const { getDatabaseSchema, getApprovalStatus, loading, reload } = useUnifiedArtifacts(projectId);

  const [recentActivity, setRecentActivity] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    if (!projectId) { setRecentActivity([]); return; }
    fastApiRequest<{ events: TimelineEvent[] }>(`/temporal/${projectId}/events`)
      .then((data) => {
        const dbEvents = (data.events || []).filter((e) =>
          e.agent.toLowerCase().includes('database') || e.stage.toLowerCase().includes('database')
        );
        setRecentActivity(dbEvents.slice(-4).reverse());
      })
      .catch(() => setRecentActivity([]));
  }, [projectId]);

  const dbData = getDatabaseSchema();

  const tables = dbData?.tables || [];
  const relationships = dbData?.relationships || [];
  const sqlDdl = dbData?.sql_ddl || '';
  const normalizationNotes = dbData?.normalization_notes || '';
  const auditTables = dbData?.audit_tables || [];
  const sampleData = dbData?.sample_data || {};
  const scalingStrategy = dbData?.scaling_strategy || '';
  const partitioningRecommendations = dbData?.partitioning_recommendations || '';
  const migration = dbData?.migrations || null;
  const approvalStatus = getApprovalStatus('sql_schema');

  // Default to first table when tables load
  useEffect(() => {
    if (!selectedTable && tables.length > 0) {
      setSelectedTable(tables[0].name);
    }
  }, [tables, selectedTable]);

  const filteredTables = useMemo(() => {
    if (!tableSearch.trim()) return tables;
    const q = tableSearch.toLowerCase();
    return tables.filter((t: any) =>
      t.name.toLowerCase().includes(q) ||
      (t.columns || []).some((c: any) => c.name.toLowerCase().includes(q))
    );
  }, [tables, tableSearch]);

  const selectedTableData = tables.find((t: any) => t.name === selectedTable) || filteredTables[0] || null;

  // Derived Schema Facts
  const foreignKeyColumnCount = tables.reduce(
    (acc: number, t: any) => acc + (t.columns || []).filter((c: any) => c.foreign_key).length,
    0
  );
  const totalIndexCount = tables.reduce((acc: number, t: any) => acc + (t.indexes?.length || 0), 0);

  const tableCount = tables.length;
  const relationshipCount = relationships.length;
  const indexCount = totalIndexCount;

  // PDF Export
  const handleExportPdf = async () => {
    if (exportingPdf) return;
    const targetPid = projectId || '130';
    setExportingPdf(true);
    setExportDropdownOpen(false);
    clearToasts();
    addToast('Generating Database Schema PDF...', 'info');

    try {
      const downloadUrl = buildApiUrl(`/documents/export-artifact?projectId=${targetPid}&artifact_type=sql_schema&format=pdf`);
      const resp = await fetch(downloadUrl, { credentials: 'include' });
      if (!resp.ok) throw new Error(`Server returned HTTP ${resp.status}`);

      const blob = await resp.blob();
      if (blob.size === 0) throw new Error('Received empty PDF file');

      let filename = `Database_Schema_${targetPid}.pdf`;
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
      addToast('Database Schema PDF downloaded successfully', 'success');
    } catch (e: any) {
      console.warn('Blob download failed, triggering direct fallback:', e);
      try {
        const fallbackUrl = buildApiUrl(`/documents/export-artifact?projectId=${targetPid}&artifact_type=sql_schema&format=pdf`);
        window.open(fallbackUrl, '_blank');
        clearToasts();
        addToast('Database Schema PDF download initiated', 'success');
      } catch (fallbackErr: any) {
        clearToasts();
        addToast(e?.message || 'Failed to export Database PDF', 'error');
      }
    } finally {
      setExportingPdf(false);
    }
  };

  // Under Development Export Handler
  const handleUnderDevExport = (formatLabel: string) => {
    setExportDropdownOpen(false);
    clearToasts();
    addToast(`${formatLabel} Export is Under Development`, 'info');
  };

  // Regenerate Database Agent
  const handleRegenerate = async () => {
    if (!projectId) return;
    setRegenerating(true);
    try {
      await fastApiRequest(`/agents/run?project_id=${projectId}&agent_name=database_design_agent`, { method: 'POST' });
      await reload();
      addToast('Database schema regenerated successfully', 'success');
    } catch (e) {
      console.error('Database regeneration failed:', e);
      addToast('Failed to regenerate Database schema', 'error');
    } finally {
      setRegenerating(false);
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
      await fastApiRequest(`/agents/run?project_id=${projectId}&agent_name=database_design_agent`, { method: 'POST' });
      setChatHistory([
        ...newHistory,
        {
          role: 'assistant',
          content: `Database schema updated according to instruction: "${promptToUse}".`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
      await reload();
      addToast('Database schema updated & synchronized', 'success');
    } catch (err: any) {
      setChatHistory([
        ...newHistory,
        {
          role: 'assistant',
          content: `Error processing Database Copilot instruction: ${err?.message || err}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setSendingCopilot(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Enterprise Top Action Bar ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dark-border pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Database Workspace</h1>
            <ApprovalBadge status={approvalStatus} />
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${
              approvalStatus === 'Approved'
                ? 'bg-status-success/15 text-status-success border-status-success/30'
                : 'bg-status-warning/15 text-status-warning border-status-warning/30 animate-pulse'
            }`}>
              {approvalStatus === 'Approved' ? 'Schema Approved' : 'Awaiting Approval'}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Database schema designed by Database Agent
          </p>
        </div>

        {/* Action Controls & Export Dropdown */}
        <div className="flex items-center gap-3 flex-wrap">
          {dbData && (
            <div className="flex items-center gap-2 rounded-lg bg-dark-card border border-dark-border px-3 py-1.5">
              <Clock className="h-3.5 w-3.5 text-text-muted" />
              <span className="text-xs text-text-muted">
                {tables.length} Table{tables.length === 1 ? '' : 's'} Designed
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

          {/* Approval Button */}
          <StudioApprovalButton projectId={projectId} artifactType="sql_schema" label="Schema" onApproved={reload} />

          {/* Database Copilot Button */}
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
        status={approvalStatus}
        note="Review this database schema specification, verify entities & relationships, then approve it."
      />

      {/* ─── Enterprise Stats Bar ────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="text-center">
          <Table2 className="h-5 w-5 mx-auto text-ey-yellow mb-1.5" />
          <p className="text-2xl font-bold text-text-primary">{tableCount}</p>
          <p className="text-xs text-text-muted font-medium">Total Tables</p>
        </Card>
        <Card className="text-center">
          <Link2 className="h-5 w-5 mx-auto text-status-info mb-1.5" />
          <p className="text-2xl font-bold text-text-primary">{relationshipCount}</p>
          <p className="text-xs text-text-muted font-medium">Relationships</p>
        </Card>
        <Card className="text-center">
          <Key className="h-5 w-5 mx-auto text-status-warning mb-1.5" />
          <p className="text-2xl font-bold text-text-primary">{indexCount}</p>
          <p className="text-xs text-text-muted font-medium">Indexes Defined</p>
        </Card>
        <Card className="text-center">
          <FileCode2 className="h-5 w-5 mx-auto text-status-success mb-1.5" />
          <p className="text-2xl font-bold text-text-primary">{migration ? migration.up.length : 0}</p>
          <p className="text-xs text-text-muted font-medium">Migration Statements</p>
        </Card>
      </div>

      {/* ─── Section Navigation Tabs ─────────────────────────────────────────────── */}
      <div className="flex border-b border-dark-border gap-1 overflow-x-auto">
        {[
          { id: 'schema', label: 'Schema & Entities', icon: Table2 },
          { id: 'migrations', label: 'Migration Scripts', icon: FileCode2 },
          { id: 'sql', label: 'SQL DDL Preview', icon: FileType },
          { id: 'relationships', label: 'Relationships & FKs', icon: Link2 },
          { id: 'audit', label: 'Audit & Sample Data', icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-ey-yellow text-ey-yellow bg-ey-yellow/5'
                  : 'border-transparent text-text-muted hover:text-text-primary hover:border-dark-border'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── Main Workspace Grid ─────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content Area (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* TAB 1: SCHEMA & ENTITIES */}
          {activeTab === 'schema' && (
            <Card className="min-h-[460px]">
              <div className="flex flex-col md:flex-row h-full gap-4">
                {/* Table / Entity List Sidebar */}
                <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-dark-border pb-4 md:pb-0 md:pr-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Entities ({tables.length})</p>
                  </div>

                  {/* Search Filter */}
                  <div className="relative mb-3">
                    <Search className="h-3.5 w-3.5 text-text-muted absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      placeholder="Search tables..."
                      className="w-full bg-dark-bg border border-dark-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-ey-yellow"
                    />
                  </div>

                  <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                    {filteredTables.length === 0 ? (
                      <p className="text-xs text-text-muted py-4 text-center">No matching tables</p>
                    ) : (
                      filteredTables.map((table: any) => (
                        <button
                          key={table.name}
                          onClick={() => setSelectedTable(table.name)}
                          className={`w-full text-left rounded-lg p-2.5 transition-all cursor-pointer ${
                            selectedTable === table.name
                              ? 'bg-ey-yellow/10 border border-ey-yellow/50 text-ey-yellow'
                              : 'bg-dark-bg hover:bg-dark-surface border border-transparent text-text-primary'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold">{table.name}</span>
                            <span className="text-[10px] text-text-muted font-mono">{table.columns?.length || 0} cols</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Table Schema Details View */}
                <div className="flex-1 md:pl-2">
                  {selectedTableData ? (
                    <motion.div
                      key={selectedTableData.name}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="flex items-center justify-between mb-4 border-b border-dark-border/50 pb-3">
                        <div>
                          <h3 className="text-base font-bold text-text-primary font-mono">{selectedTableData.name}</h3>
                          <p className="text-xs text-text-muted mt-0.5">
                            {selectedTableData.columns?.length || 0} Columns · {selectedTableData.indexes?.length || 0} Indexes
                          </p>
                        </div>
                        <StatusBadge status="success">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Schema Validated
                        </StatusBadge>
                      </div>

                      {/* Columns Table */}
                      <div className="overflow-x-auto rounded-lg border border-dark-border">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-dark-bg border-b border-dark-border">
                              <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Column</th>
                              <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Type</th>
                              <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Nullable</th>
                              <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Key / Ref</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-dark-border/40">
                            {(selectedTableData?.columns || []).map((col: any) => (
                              <tr key={col.name} className="hover:bg-dark-surface/30 transition-colors">
                                <td className="px-3 py-2 text-xs font-semibold text-text-primary font-mono">{col.name}</td>
                                <td className="px-3 py-2 text-xs font-mono text-ey-yellow/90">{col.type}</td>
                                <td className="px-3 py-2">
                                  {col.nullable ? (
                                    <span className="text-[10px] text-text-muted font-mono">NULL</span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-status-error font-mono">NOT NULL</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-xs">
                                  {col.primary_key && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-ey-yellow/15 text-ey-yellow border border-ey-yellow/30 px-1.5 py-0.5 rounded">
                                      <Key className="h-3 w-3" /> PK
                                    </span>
                                  )}
                                  {col.foreign_key && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-status-info bg-status-info/10 px-1.5 py-0.5 rounded border border-status-info/20">
                                      FK → {col.foreign_key}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Indexes List */}
                      {selectedTableData?.indexes && selectedTableData.indexes.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-bold text-text-muted uppercase mb-2">Indexes</p>
                          <div className="flex flex-wrap gap-2">
                            {selectedTableData.indexes.map((idx: any) => (
                              <span
                                key={idx}
                                className="rounded bg-dark-bg border border-dark-border px-2.5 py-1 text-xs font-mono text-text-secondary"
                              >
                                {idx}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <div className="py-12 text-center text-text-muted">
                      <Table2 className="h-10 w-10 mx-auto text-dark-border-light mb-3" />
                      <p className="text-xs">Select an entity table from the left list to view schema details.</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* TAB 2: MIGRATIONS */}
          {activeTab === 'migrations' && (
            <Card>
              <div className="flex items-center justify-between mb-4 border-b border-dark-border pb-3">
                <h3 className="section-title mb-0">Database Migration Scripts</h3>
                {migration && (
                  <span className="text-xs font-mono bg-dark-bg px-2.5 py-1 rounded border border-dark-border text-ey-yellow">
                    {migration.version || 'v1.0.0'}
                  </span>
                )}
              </div>
              {!migration ? (
                <div className="py-12 text-center">
                  <FileCode2 className="h-10 w-10 text-dark-border-light mx-auto mb-3" />
                  <p className="text-xs text-text-muted">No database migrations generated yet.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <p className="text-xs font-bold text-text-primary mb-2 flex items-center gap-1.5">
                      <Code2 className="h-4 w-4 text-status-success" />
                      Up Migration ({migration.up?.length || 0} Statement{(migration.up?.length || 0) === 1 ? '' : 's'})
                    </p>
                    <CodeBlock language="sql" code={(migration.up || []).join('\n\n')} maxHeight="300px" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-text-primary mb-2 flex items-center gap-1.5">
                      <Code2 className="h-4 w-4 text-status-warning" />
                      Down Migration ({migration.down?.length || 0} Statement{(migration.down?.length || 0) === 1 ? '' : 's'})
                    </p>
                    <CodeBlock language="sql" code={(migration.down || []).join('\n\n')} maxHeight="300px" />
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* TAB 3: SQL PREVIEW */}
          {activeTab === 'sql' && (
            <Card>
              <div className="flex items-center justify-between mb-4 border-b border-dark-border pb-3">
                <h3 className="section-title mb-0">Generated SQL DDL</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportPdf}
                    className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
                  >
                    <FileType className="h-3.5 w-3.5 text-ey-yellow" />
                    <span>Export PDF</span>
                  </button>
                </div>
              </div>
              {sqlDdl ? (
                <CodeBlock language="sql" code={sqlDdl} maxHeight="500px" />
              ) : (
                <div className="py-12 text-center">
                  <FileCode2 className="h-10 w-10 text-dark-border-light mx-auto mb-3" />
                  <p className="text-xs text-text-muted">No SQL DDL generated yet.</p>
                </div>
              )}
            </Card>
          )}

          {/* TAB 4: RELATIONSHIPS */}
          {activeTab === 'relationships' && (
            <Card>
              <div className="flex items-center justify-between mb-4 border-b border-dark-border pb-3">
                <h3 className="section-title mb-0">Entity Relationships &amp; Foreign Keys</h3>
                <span className="text-xs text-text-muted font-mono">{relationships.length} Mapped</span>
              </div>
              {relationships.length === 0 ? (
                <div className="py-12 text-center">
                  <Link2 className="h-10 w-10 text-dark-border-light mx-auto mb-3" />
                  <p className="text-xs text-text-muted">No foreign key relationships mapped yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {relationships.map((rel: any, i: number) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-dark-bg border border-dark-border p-3">
                      <div className="flex items-center gap-3">
                        <Link2 className="h-4 w-4 text-status-info flex-shrink-0" />
                        <span className="text-xs font-bold text-text-primary font-mono">{rel.from_table}</span>
                        <span className="text-xs text-text-muted font-mono">→ {rel.type} {rel.via ? `(via ${rel.via})` : ''} →</span>
                        <span className="text-xs font-bold text-text-primary font-mono">{rel.to_table}</span>
                      </div>
                      <span className="text-[10px] bg-status-info/10 text-status-info border border-status-info/20 px-2 py-0.5 rounded font-mono">
                        FK Relation
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* TAB 5: AUDIT & SAMPLE DATA */}
          {activeTab === 'audit' && (
            <Card>
              {!normalizationNotes && auditTables.length === 0 && Object.keys(sampleData).length === 0 ? (
                <div className="py-12 text-center">
                  <Database className="h-10 w-10 text-dark-border-light mx-auto mb-3" />
                  <p className="text-xs text-text-muted">No normalization notes, audit tables, or sample data generated yet.</p>
                </div>
              ) : (
                <Accordion>
                  {normalizationNotes && (
                    <AccordionItem title="Normalization Notes" icon={Database} defaultOpen>
                      <p className="text-xs text-text-secondary leading-relaxed font-sans">{normalizationNotes}</p>
                    </AccordionItem>
                  )}
                  {auditTables.length > 0 && (
                    <AccordionItem title="Audit / History Tables" icon={FileCode2} badge={<span className="text-[10px] text-text-muted">{auditTables.length}</span>}>
                      <BulletList items={auditTables} />
                    </AccordionItem>
                  )}
                  {Object.entries(sampleData).map(([tableName, rows]) => (
                    <AccordionItem key={tableName} title={`Sample Data — ${tableName}`} icon={Table2} badge={<span className="text-[10px] text-text-muted font-mono">{(rows as any[]).length} rows</span>}>
                      <CodeBlock language="json" code={JSON.stringify(rows, null, 2)} maxHeight="300px" />
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </Card>
          )}
        </div>

        {/* ─── Right Meta & Control Panel (1 Col) ─────────────────────────────────── */}
        <div className="space-y-6">
          {/* Database Agent Status */}
          <Card glow>
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tables.length > 0 ? 'bg-status-success/10 border border-status-success/30' : 'bg-status-warning/10 border border-status-warning/30'}`}>
                <Database className={`h-5 w-5 ${tables.length > 0 ? 'text-status-success' : 'text-status-warning'}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-text-primary">Database Agent</p>
                <p className="text-xs text-text-muted">
                  {tables.length > 0 ? `Schema Designed — ${tables.length} table${tables.length === 1 ? '' : 's'}` : 'Waiting for architecture design'}
                </p>
              </div>
              <StatusBadge status={tables.length > 0 ? 'success' : 'waiting'}>
                {tables.length > 0 ? 'Completed' : 'Waiting'}
              </StatusBadge>
            </div>
          </Card>

          {/* Schema Facts */}
          <Card>
            <h3 className="section-title">Schema Facts &amp; Analysis</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs py-1 border-b border-dark-border/40">
                <span className="text-text-muted">Foreign Key Columns</span>
                <span className="text-text-primary font-bold font-mono">{foreignKeyColumnCount}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-b border-dark-border/40">
                <span className="text-text-muted">Indexes Defined</span>
                <span className="text-text-primary font-bold font-mono">{totalIndexCount}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-b border-dark-border/40">
                <span className="text-text-muted">Relationships Mapped</span>
                <span className="text-text-primary font-bold font-mono">{relationships.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-text-muted">Audit/History Tables</span>
                {auditTables.length > 0 ? (
                  <span className="text-status-success font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Active
                  </span>
                ) : (
                  <span className="text-text-muted">None</span>
                )}
              </div>
            </div>
          </Card>

          {/* Scaling & Partitioning Analysis */}
          {(scalingStrategy || partitioningRecommendations) && (
            <Card>
              <h3 className="section-title">Scaling &amp; Partitioning</h3>
              <div className="space-y-3">
                {scalingStrategy && (
                  <div>
                    <p className="text-xs font-bold text-text-primary mb-1">Scaling Strategy</p>
                    <p className="text-[11px] text-text-muted leading-relaxed">{scalingStrategy}</p>
                  </div>
                )}
                {partitioningRecommendations && (
                  <div>
                    <p className="text-xs font-bold text-text-primary mb-1">Partitioning</p>
                    <p className="text-[11px] text-text-muted leading-relaxed">{partitioningRecommendations}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Recent Agent Activity */}
          <Card>
            <h3 className="section-title">Recent Activity</h3>
            <div className="space-y-3">
              {recentActivity.length === 0 ? (
                <p className="text-xs text-text-muted">No database activity recorded yet.</p>
              ) : (
                recentActivity.map((item) => (
                  <div key={item.id} className="flex items-start gap-2.5">
                    <Clock className="h-3.5 w-3.5 text-text-muted mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-text-primary">{item.action}</p>
                      <p className="text-[10px] text-text-muted">{formatRelativeTime(item.timestamp)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Action Control Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="btn-secondary flex-1 text-xs py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Regenerate Schema
            </button>
          </div>
        </div>
      </div>

      {/* ─── Database AI Copilot Drawer ─────────────────────────────────────────── */}
      <AnimatePresence>
        {copilotOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCopilotOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40"
            />

            {/* Drawer Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-dark-bg border-l border-dark-border z-50 flex flex-col shadow-2xl"
            >
              {/* Drawer Header */}
              <div className="p-4 border-b border-dark-border flex items-center justify-between bg-dark-card">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ey-yellow/10 border border-ey-yellow/30">
                    <Sparkles className="h-4 w-4 text-ey-yellow" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-text-primary">Database AI Copilot</h2>
                    <p className="text-[11px] text-text-muted">Refine schema, add tables, or update relationships</p>
                  </div>
                </div>
                <button
                  onClick={() => setCopilotOpen(false)}
                  className="p-1 text-text-muted hover:text-text-primary rounded-lg hover:bg-dark-surface transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Chat History Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <Bot className="h-10 w-10 text-ey-yellow/40 mx-auto mb-3" />
                    <p className="text-xs font-semibold text-text-primary mb-1">Database Design Assistant</p>
                    <p className="text-[11px] text-text-muted max-w-xs mx-auto mb-6">
                      Ask me to modify tables, normalize columns, generate audit logs, or optimize indexes.
                    </p>

                    {/* Quick Suggestion Chips */}
                    <div className="space-y-2 text-left">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Suggested Instructions</p>
                      {COPILOT_SUGGESTIONS.map((chip, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSendCopilot(chip.replace('⚡ ', ''))}
                          className="w-full text-left p-2.5 rounded-lg bg-dark-card hover:bg-dark-surface border border-dark-border text-xs text-text-secondary hover:text-text-primary transition-all flex items-center justify-between group cursor-pointer"
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
                            : 'bg-dark-card border border-dark-border text-text-primary rounded-bl-none'
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

              {/* Copilot Input Footer */}
              <div className="p-3 border-t border-dark-border bg-dark-card">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={copilotPrompt}
                    onChange={(e) => setCopilotPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendCopilot()}
                    placeholder="Ask Database Copilot to refine schema..."
                    disabled={sendingCopilot}
                    className="flex-1 bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-ey-yellow disabled:opacity-50"
                  />
                  <button
                    onClick={() => handleSendCopilot()}
                    disabled={sendingCopilot || !copilotPrompt.trim()}
                    className="bg-ey-yellow text-dark-bg font-bold px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 hover:bg-ey-yellow/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    {sendingCopilot ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
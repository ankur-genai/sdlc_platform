import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, ThumbsUp } from 'lucide-react';
import { StatusBadge } from './Card';
import { apiRequest } from '../../lib/api';
import { useToast } from './Toast';
import type { Approval, ArtifactType } from '../../types/unified';

/**
 * Self-contained approval control for an individual studio/agent workspace.
 *
 * Approvals are performed at the studio itself (there is no central Approval
 * Center). Drop this into a workspace header (top-right); it loads the pending
 * approval for its `artifactType`, renders an "Approve" button while pending,
 * an "Approved" badge once decided, and nothing when no approval applies.
 */
interface StudioApprovalButtonProps {
  projectId: string | null;
  artifactType: ArtifactType;
  /** Human label used in the button and toast, e.g. "Requirements". */
  label?: string;
  /** Called after a successful approval so the parent can refresh its data. */
  onApproved?: () => void;
}

export function StudioApprovalButton({
  projectId,
  artifactType,
  label = 'Output',
  onApproved,
}: StudioApprovalButtonProps) {
  const [approval, setApproval] = useState<Approval | null>(null);
  const [approving, setApproving] = useState(false);
  const { addToast } = useToast();

  const load = useCallback(async () => {
    if (!projectId) {
      setApproval(null);
      return;
    }
    try {
      const approvals = await apiRequest<Approval[]>(`/projects/${projectId}/approvals`);
      // An artifact_type can accrue more than one Approval row over a project's
      // lifetime (e.g. a reject + resubmit) — take the highest id (latest).
      const matches = (approvals || []).filter((a) => a.artifact_type === artifactType);
      const latest = matches.length
        ? matches.reduce((acc, a) => (Number(a.id) > Number(acc.id) ? a : acc))
        : null;
      setApproval(latest);
    } catch {
      setApproval(null);
    }
  }, [projectId, artifactType]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async () => {
    if (!projectId || !approval) return;
    setApproving(true);
    try {
      await apiRequest(`/projects/${projectId}/approvals/${approval.id}/decide`, {
        method: 'POST',
        body: { decision: 'Approved' },
      });
      await load();
      onApproved?.();
      addToast(`${label} approved`, 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : `Failed to approve ${label}`, 'error');
    } finally {
      setApproving(false);
    }
  };

  // No approval record for this artifact — nothing to show.
  if (!approval) return null;

  if (approval.status === 'Approved') {
    return (
      <StatusBadge status="success">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Approved
      </StatusBadge>
    );
  }

  return (
    <button
      className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      onClick={handleApprove}
      disabled={approving}
    >
      <ThumbsUp className="mr-2 h-4 w-4" />
      {approving ? 'Approving…' : `Approve ${label}`}
    </button>
  );
}

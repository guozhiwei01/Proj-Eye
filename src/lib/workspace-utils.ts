import { WorkspaceNodeId, WorkspaceNodeKind } from "../types/workspace";

/**
 * Generate a unique workspace node ID
 */
export function generateNodeId(kind: WorkspaceNodeKind, projectId: string): WorkspaceNodeId {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${kind}-${projectId}-${timestamp}-${random}`;
}

/**
 * Parse node ID to extract kind and project ID
 */
export function parseNodeId(nodeId: WorkspaceNodeId): {
  kind: WorkspaceNodeKind;
  projectId: string;
} | null {
  const parts = nodeId.split("-");
  if (parts.length < 2) return null;

  const kind = parts[0] as WorkspaceNodeKind;
  const projectId = parts[1];

  return { kind, projectId };
}

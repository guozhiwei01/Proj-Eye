// Example integration: Using workspace nodes in terminal tab creation
// This demonstrates how to migrate from direct sessionId usage to nodeId-based approach

import { useWorkspaceNodes } from "../store/workspace-nodes";
import { generateNodeId } from "../lib/workspace-utils";
import { WorkspaceNodeKind, WorkspaceNodeState } from "../types/workspace";
import { registerWorkspaceNode, bindNodeToSession } from "../lib/backend";

/**
 * Example: Create a terminal tab with workspace node abstraction
 *
 * Before (direct sessionId):
 *   const result = await createTerminalTab(projectId, currentCount);
 *   // UI directly uses result.session.id
 *
 * After (with nodeId):
 *   const nodeId = await createTerminalTabWithNode(projectId, currentCount);
 *   // UI uses nodeId, backend maps to sessionId
 */
export async function createTerminalTabWithNode(
  projectId: string,
  currentCount: number,
): Promise<string> {
  const { registerNode, bindNodeToSession: bindNode, updateNodeState } = useWorkspaceNodes.getState();

  // 1. Generate stable node ID
  const nodeId = generateNodeId(WorkspaceNodeKind.Terminal, projectId);

  // 2. Register node in frontend store
  registerNode({
    id: nodeId,
    projectId,
    kind: WorkspaceNodeKind.Terminal,
    title: `Terminal ${currentCount + 1}`,
    state: WorkspaceNodeState.Connecting,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  });

  // 3. Register node in backend
  await registerWorkspaceNode(nodeId, projectId, WorkspaceNodeKind.Terminal);

  // 4. Create actual terminal session (existing backend call)
  const { createTerminalTab } = await import("../lib/backend");
  const result = await createTerminalTab(projectId, currentCount);
  const sessionId = result.session.id;

  // 5. Bind node to session
  bindNode(nodeId, sessionId);
  await bindNodeToSession(nodeId, sessionId);

  // 6. Update node state
  updateNodeState(nodeId, WorkspaceNodeState.Active);

  return nodeId;
}

/**
 * Example: Write terminal input using nodeId
 *
 * Before:
 *   await writeSessionInput(sessionId, data);
 *
 * After:
 *   await writeTerminalInputByNode(nodeId, data);
 */
export async function writeTerminalInputByNode(
  nodeId: string,
  data: string,
): Promise<void> {
  const { getSessionIdByNode } = useWorkspaceNodes.getState();
  const sessionId = getSessionIdByNode(nodeId);

  if (!sessionId) {
    throw new Error(`No session bound to node: ${nodeId}`);
  }

  const { writeSessionInput } = await import("../lib/backend");
  await writeSessionInput(sessionId, data);
}

/**
 * Example: Resize terminal using nodeId
 */
export async function resizeTerminalByNode(
  nodeId: string,
  cols: number,
  rows: number,
): Promise<void> {
  const { getSessionIdByNode } = useWorkspaceNodes.getState();
  const sessionId = getSessionIdByNode(nodeId);

  if (!sessionId) {
    throw new Error(`No session bound to node: ${nodeId}`);
  }

  const { resizeSession } = await import("../lib/backend");
  await resizeSession(sessionId, cols, rows);
}

/**
 * Example: Close terminal using nodeId
 */
export async function closeTerminalByNode(nodeId: string): Promise<void> {
  const { getSessionIdByNode, removeNode } = useWorkspaceNodes.getState();
  const sessionId = getSessionIdByNode(nodeId);

  if (!sessionId) {
    throw new Error(`No session bound to node: ${nodeId}`);
  }

  const { closeSession } = await import("../lib/backend");
  await closeSession(sessionId);

  // Clean up node
  removeNode(nodeId);
}

import { create } from "zustand";
import {
  WorkspaceNode,
  WorkspaceNodeId,
  WorkspaceNodeKind,
  WorkspaceNodeState,
  NodeSessionBinding,
} from "../types/workspace";

interface WorkspaceNodesState {
  // Node registry
  nodes: Map<WorkspaceNodeId, WorkspaceNode>;

  // Node -> Session binding
  bindings: Map<WorkspaceNodeId, NodeSessionBinding>;

  // Session -> Node reverse lookup
  sessionToNode: Map<string, WorkspaceNodeId>;

  // Actions
  registerNode: (node: WorkspaceNode) => void;
  updateNodeState: (nodeId: WorkspaceNodeId, state: WorkspaceNodeState) => void;
  bindNodeToSession: (nodeId: WorkspaceNodeId, sessionId: string) => void;
  unbindNode: (nodeId: WorkspaceNodeId) => void;
  removeNode: (nodeId: WorkspaceNodeId) => void;
  getNodeBySessionId: (sessionId: string) => WorkspaceNode | undefined;
  getSessionIdByNode: (nodeId: WorkspaceNodeId) => string | undefined;
  getNodesByProject: (projectId: string) => WorkspaceNode[];
  clearProjectNodes: (projectId: string) => void;
}

export const useWorkspaceNodes = create<WorkspaceNodesState>((set, get) => ({
  nodes: new Map(),
  bindings: new Map(),
  sessionToNode: new Map(),

  registerNode: (node) => {
    set((state) => {
      const newNodes = new Map(state.nodes);
      newNodes.set(node.id, node);
      return { nodes: newNodes };
    });
  },

  updateNodeState: (nodeId, newState) => {
    set((state) => {
      const node = state.nodes.get(nodeId);
      if (!node) return state;

      const newNodes = new Map(state.nodes);
      newNodes.set(nodeId, {
        ...node,
        state: newState,
        lastActiveAt: Date.now(),
      });
      return { nodes: newNodes };
    });
  },

  bindNodeToSession: (nodeId, sessionId) => {
    set((state) => {
      const node = state.nodes.get(nodeId);
      if (!node) return state;

      const binding: NodeSessionBinding = {
        nodeId,
        sessionId,
        boundAt: Date.now(),
      };

      const newNodes = new Map(state.nodes);
      newNodes.set(nodeId, {
        ...node,
        backingSessionId: sessionId,
        lastActiveAt: Date.now(),
      });

      const newBindings = new Map(state.bindings);
      newBindings.set(nodeId, binding);

      const newSessionToNode = new Map(state.sessionToNode);
      newSessionToNode.set(sessionId, nodeId);

      return {
        nodes: newNodes,
        bindings: newBindings,
        sessionToNode: newSessionToNode,
      };
    });
  },

  unbindNode: (nodeId) => {
    set((state) => {
      const binding = state.bindings.get(nodeId);
      if (!binding) return state;

      const node = state.nodes.get(nodeId);
      if (!node) return state;

      const newNodes = new Map(state.nodes);
      newNodes.set(nodeId, {
        ...node,
        backingSessionId: undefined,
      });

      const newBindings = new Map(state.bindings);
      newBindings.delete(nodeId);

      const newSessionToNode = new Map(state.sessionToNode);
      newSessionToNode.delete(binding.sessionId);

      return {
        nodes: newNodes,
        bindings: newBindings,
        sessionToNode: newSessionToNode,
      };
    });
  },

  removeNode: (nodeId) => {
    set((state) => {
      const binding = state.bindings.get(nodeId);

      const newNodes = new Map(state.nodes);
      newNodes.delete(nodeId);

      const newBindings = new Map(state.bindings);
      newBindings.delete(nodeId);

      const newSessionToNode = new Map(state.sessionToNode);
      if (binding) {
        newSessionToNode.delete(binding.sessionId);
      }

      return {
        nodes: newNodes,
        bindings: newBindings,
        sessionToNode: newSessionToNode,
      };
    });
  },

  getNodeBySessionId: (sessionId) => {
    const nodeId = get().sessionToNode.get(sessionId);
    if (!nodeId) return undefined;
    return get().nodes.get(nodeId);
  },

  getSessionIdByNode: (nodeId) => {
    const binding = get().bindings.get(nodeId);
    return binding?.sessionId;
  },

  getNodesByProject: (projectId) => {
    return Array.from(get().nodes.values()).filter(
      (node) => node.projectId === projectId
    );
  },

  clearProjectNodes: (projectId) => {
    set((state) => {
      const projectNodes = Array.from(state.nodes.values()).filter(
        (node) => node.projectId === projectId
      );

      const newNodes = new Map(state.nodes);
      const newBindings = new Map(state.bindings);
      const newSessionToNode = new Map(state.sessionToNode);

      projectNodes.forEach((node) => {
        newNodes.delete(node.id);
        const binding = state.bindings.get(node.id);
        if (binding) {
          newBindings.delete(node.id);
          newSessionToNode.delete(binding.sessionId);
        }
      });

      return {
        nodes: newNodes,
        bindings: newBindings,
        sessionToNode: newSessionToNode,
      };
    });
  },
}));

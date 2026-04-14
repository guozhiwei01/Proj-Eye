/**
 * Connection Runtime Integration Example
 *
 * 演示如何使用 ConnectionRuntime 和 SessionRegistry
 */

import { useConnectionRuntime } from "../store/connection-runtime";
import { useSessionRegistry } from "../store/session-registry";
import { ConnectionState } from "../types/connection";

export function ConnectionRuntimeExample() {
  const connectionRuntime = useConnectionRuntime();
  const sessionRegistry = useSessionRegistry();

  const handleConnect = async (projectId: string) => {
    try {
      // 1. 注册连接上下文
      const context = await connectionRuntime.register(projectId);
      console.log("Connection registered:", context);

      // 2. 更新状态为 Connecting
      await connectionRuntime.updateState(projectId, ConnectionState.Connecting);

      // 3. 创建 SSH session (假设)
      const sessionId = `session_${Date.now()}`;
      await sessionRegistry.register(sessionId, projectId);

      // 4. 绑定 session 到连接
      await connectionRuntime.bindSession(projectId, sessionId);

      // 5. 更新状态为 Active
      await connectionRuntime.updateState(projectId, ConnectionState.Active);

      console.log("Connection established successfully");
    } catch (error) {
      console.error("Connection failed:", error);
      await connectionRuntime.setError(
        projectId,
        error instanceof Error ? error.message : "Unknown error"
      );
      await connectionRuntime.updateState(projectId, ConnectionState.Degraded);
    }
  };

  const handleDisconnect = async (projectId: string) => {
    try {
      // 1. 解绑 session
      await connectionRuntime.unbindSession(projectId);

      // 2. 更新状态为 Closed
      await connectionRuntime.updateState(projectId, ConnectionState.Closed);

      // 3. 移除连接上下文
      await connectionRuntime.remove(projectId);

      console.log("Connection closed successfully");
    } catch (error) {
      console.error("Disconnect failed:", error);
    }
  };

  const handleReconnect = async (projectId: string) => {
    try {
      // 1. 更新状态为 Reconnecting
      await connectionRuntime.updateState(projectId, ConnectionState.Reconnecting);

      // 2. 创建新 session
      const sessionId = `session_${Date.now()}`;
      await sessionRegistry.register(sessionId, projectId);

      // 3. 绑定新 session
      await connectionRuntime.bindSession(projectId, sessionId);

      // 4. 更新状态为 Active
      await connectionRuntime.updateState(projectId, ConnectionState.Active);

      console.log("Reconnection successful");
    } catch (error) {
      console.error("Reconnection failed:", error);
      await connectionRuntime.setError(
        projectId,
        error instanceof Error ? error.message : "Reconnection failed"
      );
      await connectionRuntime.updateState(projectId, ConnectionState.Degraded);
    }
  };

  const handleListConnections = async () => {
    try {
      const connections = await connectionRuntime.listAll();
      console.log("All connections:", connections);
      return connections;
    } catch (error) {
      console.error("Failed to list connections:", error);
      return [];
    }
  };

  const handleListActiveSessions = async (projectId: string) => {
    try {
      const sessions = await sessionRegistry.listByProject(projectId);
      console.log(`Sessions for project ${projectId}:`, sessions);
      return sessions;
    } catch (error) {
      console.error("Failed to list sessions:", error);
      return [];
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Connection Runtime Example</h2>

      <div className="space-y-2">
        <button
          onClick={() => handleConnect("project_1")}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Connect to Project 1
        </button>

        <button
          onClick={() => handleDisconnect("project_1")}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Disconnect from Project 1
        </button>

        <button
          onClick={() => handleReconnect("project_1")}
          className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
        >
          Reconnect to Project 1
        </button>

        <button
          onClick={handleListConnections}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          List All Connections
        </button>

        <button
          onClick={() => handleListActiveSessions("project_1")}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          List Sessions for Project 1
        </button>
      </div>

      <div className="mt-4 p-4 bg-gray-100 rounded">
        <h3 className="font-bold mb-2">Current State:</h3>
        <div className="space-y-1">
          <p>Connections: {connectionRuntime.connections.size}</p>
          <p>Sessions: {sessionRegistry.sessions.size}</p>
          <p>Loading: {connectionRuntime.loading ? "Yes" : "No"}</p>
          {connectionRuntime.error && (
            <p className="text-red-500">Error: {connectionRuntime.error}</p>
          )}
        </div>
      </div>

      <div className="mt-4 p-4 bg-blue-50 rounded">
        <h3 className="font-bold mb-2">Connection Details:</h3>
        <div className="space-y-2">
          {Array.from(connectionRuntime.connections.values()).map((conn) => (
            <div key={conn.project_id} className="p-2 bg-white rounded border">
              <p className="font-semibold">Project: {conn.project_id}</p>
              <p>State: {conn.state}</p>
              <p>Session: {conn.session_id || "None"}</p>
              {conn.error && <p className="text-red-500">Error: {conn.error}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

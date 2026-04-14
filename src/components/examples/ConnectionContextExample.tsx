/**
 * ConnectionContext Extension Example
 *
 * Demonstrates the extended ConnectionContext features:
 * - Multiple nodes sharing a connection
 * - Connection health metrics
 * - Server/database associations
 * - Multi-session support
 */

import { useEffect, useState } from "react";
import { useConnectionRuntime } from "@/store/connection-runtime";
import type { ConnectionContext } from "@/types/connection";

export function ConnectionContextExample() {
  const store = useConnectionRuntime();
  const [projectId] = useState("demo-project");
  const [connection, setConnection] = useState<ConnectionContext | null>(null);

  useEffect(() => {
    initConnection();
  }, []);

  const initConnection = async () => {
    try {
      // Register a new connection
      const ctx = await store.register(projectId);
      setConnection(ctx);
    } catch (error) {
      console.error("Failed to initialize connection:", error);
    }
  };

  const addNode = async () => {
    try {
      const nodeId = `node-${Date.now()}`;
      await store.addNode(projectId, nodeId);
      const updated = await store.get(projectId);
      setConnection(updated);
    } catch (error) {
      console.error("Failed to add node:", error);
    }
  };

  const removeNode = async (nodeId: string) => {
    try {
      await store.removeNode(projectId, nodeId);
      const updated = await store.get(projectId);
      setConnection(updated);
    } catch (error) {
      console.error("Failed to remove node:", error);
    }
  };

  const recordSuccess = async () => {
    try {
      const latency = Math.floor(Math.random() * 100) + 10;
      await store.recordSuccess(projectId, latency);
      const updated = await store.get(projectId);
      setConnection(updated);
    } catch (error) {
      console.error("Failed to record success:", error);
    }
  };

  const simulateError = async () => {
    try {
      await store.setError(projectId, "Simulated connection error");
      const updated = await store.get(projectId);
      setConnection(updated);
    } catch (error) {
      console.error("Failed to set error:", error);
    }
  };

  const updateHealthCheck = async () => {
    try {
      await store.updateHealthCheck(projectId);
      const updated = await store.get(projectId);
      setConnection(updated);
    } catch (error) {
      console.error("Failed to update health check:", error);
    }
  };

  if (!connection) {
    return <div className="p-4">Loading connection...</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Connection Context Extension Demo</h2>

      {/* Connection Info */}
      <div className="border rounded p-4 space-y-2">
        <h3 className="font-semibold">Connection Info</h3>
        <div className="text-sm space-y-1">
          <div>Project ID: {connection.projectId}</div>
          <div>State: {connection.state}</div>
          <div>Server ID: {connection.serverId || "N/A"}</div>
          <div>Database ID: {connection.databaseId || "N/A"}</div>
          <div>Primary Session: {connection.primarySessionId || "N/A"}</div>
          <div>Active Sessions: {connection.sessionIds.length}</div>
          <div>Active Nodes: {connection.nodeIds.length}</div>
        </div>
      </div>

      {/* Health Metrics */}
      <div className="border rounded p-4 space-y-2">
        <h3 className="font-semibold">Health Metrics</h3>
        <div className="text-sm space-y-1">
          <div>
            Status:{" "}
            <span className={connection.health.isHealthy ? "text-green-600" : "text-red-600"}>
              {connection.health.isHealthy ? "Healthy" : "Unhealthy"}
            </span>
          </div>
          <div>Success Count: {connection.health.successCount}</div>
          <div>Failure Count: {connection.health.failureCount}</div>
          <div>Avg Latency: {connection.health.avgLatencyMs ? `${connection.health.avgLatencyMs}ms` : "N/A"}</div>
          <div>
            Last Check: {connection.health.lastCheckAt ? new Date(connection.health.lastCheckAt).toLocaleTimeString() : "Never"}
          </div>
        </div>
      </div>

      {/* Active Nodes */}
      <div className="border rounded p-4 space-y-2">
        <h3 className="font-semibold">Active Nodes</h3>
        {connection.nodeIds.length === 0 ? (
          <div className="text-sm text-gray-500">No active nodes</div>
        ) : (
          <div className="space-y-1">
            {connection.nodeIds.map((nodeId) => (
              <div key={nodeId} className="flex items-center justify-between text-sm">
                <span>{nodeId}</span>
                <button
                  onClick={() => removeNode(nodeId)}
                  className="text-red-600 hover:text-red-800 text-xs"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={addNode}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
        >
          Add Node
        </button>
        <button
          onClick={recordSuccess}
          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
        >
          Record Success
        </button>
        <button
          onClick={simulateError}
          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
        >
          Simulate Error
        </button>
        <button
          onClick={updateHealthCheck}
          className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
        >
          Health Check
        </button>
      </div>

      {/* Error Display */}
      {connection.lastError && (
        <div className="border border-red-300 rounded p-3 bg-red-50">
          <div className="text-sm font-semibold text-red-800">Last Error:</div>
          <div className="text-sm text-red-600">{connection.lastError}</div>
        </div>
      )}
    </div>
  );
}

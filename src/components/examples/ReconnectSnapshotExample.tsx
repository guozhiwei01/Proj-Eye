import React, { useEffect, useState } from "react";
import { useSnapshotStore } from "../../store/snapshot";
import type { TerminalTabSnapshot } from "../../lib/backend";

/**
 * Example component demonstrating ReconnectSnapshot usage
 *
 * This shows how to:
 * 1. Save snapshots when disconnecting
 * 2. Restore snapshots when reconnecting
 * 3. List and manage snapshots
 * 4. Cleanup expired snapshots
 */
export function ReconnectSnapshotExample() {
  const snapshotStore = useSnapshotStore();
  const [projectId, setProjectId] = useState("project-1");
  const [maxAge, setMaxAge] = useState(3600000); // 1 hour

  // Load snapshots on mount
  useEffect(() => {
    snapshotStore.loadAllSnapshots();
  }, []);

  // Example: Save snapshot on disconnect
  const handleSaveSnapshot = async () => {
    const terminalTabs: TerminalTabSnapshot[] = [
      {
        nodeId: "node-1",
        title: "Terminal 1",
        cwd: "/home/user",
        lastCommand: "ls -la",
        index: 0,
      },
      {
        nodeId: "node-2",
        title: "Terminal 2",
        cwd: "/var/log",
        lastCommand: "tail -f app.log",
        index: 1,
      },
    ];

    await snapshotStore.saveSnapshot(projectId, "disconnect", {
      serverId: "server-1",
      databaseId: "db-1",
      activeNodeIds: ["node-1", "node-2"],
      terminalTabs,
      activeLogSources: ["/var/log/app.log", "/var/log/error.log"],
      lastAiPrompt: "Analyze the error logs",
      lastConnectionState: "active",
    });

    console.log("Snapshot saved for project:", projectId);
  };

  // Example: Restore snapshot on reconnect
  const handleRestoreSnapshot = async () => {
    const snapshot = await snapshotStore.getSnapshot(projectId);
    if (snapshot) {
      console.log("Restoring snapshot:", snapshot);

      // Restore terminal tabs
      snapshot.terminalTabs.forEach((tab) => {
        console.log(`Restore terminal: ${tab.title} at ${tab.cwd}`);
        // TODO: Call terminal restoration API
      });

      // Restore log sources
      snapshot.activeLogSources.forEach((source) => {
        console.log(`Restore log source: ${source}`);
        // TODO: Call log restoration API
      });

      // Restore AI context
      if (snapshot.lastAiPrompt) {
        console.log(`Restore AI prompt: ${snapshot.lastAiPrompt}`);
        // TODO: Call AI context restoration API
      }
    } else {
      console.log("No snapshot found for project:", projectId);
    }
  };

  // Example: Cleanup expired snapshots
  const handleCleanup = async () => {
    const count = await snapshotStore.cleanupExpired(maxAge);
    console.log(`Cleaned up ${count} expired snapshots`);
  };

  // Example: Remove specific snapshot
  const handleRemoveSnapshot = async () => {
    await snapshotStore.removeSnapshot(projectId);
    console.log("Snapshot removed for project:", projectId);
  };

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h2>ReconnectSnapshot Example</h2>

      {/* Controls */}
      <div style={{ marginBottom: "20px" }}>
        <label>
          Project ID:
          <input
            type="text"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            style={{ marginLeft: "10px", padding: "5px" }}
          />
        </label>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label>
          Max Age (ms):
          <input
            type="number"
            value={maxAge}
            onChange={(e) => setMaxAge(Number(e.target.value))}
            style={{ marginLeft: "10px", padding: "5px" }}
          />
        </label>
      </div>

      {/* Actions */}
      <div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
        <button onClick={handleSaveSnapshot}>Save Snapshot</button>
        <button onClick={handleRestoreSnapshot}>Restore Snapshot</button>
        <button onClick={handleRemoveSnapshot}>Remove Snapshot</button>
        <button onClick={handleCleanup}>Cleanup Expired</button>
        <button onClick={() => snapshotStore.loadAllSnapshots()}>
          Refresh List
        </button>
      </div>

      {/* Loading/Error State */}
      {snapshotStore.isLoading && <div>Loading...</div>}
      {snapshotStore.error && (
        <div style={{ color: "red" }}>Error: {snapshotStore.error}</div>
      )}

      {/* Snapshot List */}
      <div>
        <h3>Snapshots ({snapshotStore.snapshots.size})</h3>
        {Array.from(snapshotStore.snapshots.values()).map((snapshot) => {
          const age = Date.now() - snapshot.capturedAt;
          const ageMinutes = Math.floor(age / 60000);
          const isValid = snapshotStore.isSnapshotValid(snapshot.projectId, maxAge);

          return (
            <div
              key={snapshot.projectId}
              style={{
                border: "1px solid #ccc",
                padding: "10px",
                marginBottom: "10px",
                backgroundColor: isValid ? "#f0f8ff" : "#fff0f0",
              }}
            >
              <div>
                <strong>Project:</strong> {snapshot.projectId}
              </div>
              <div>
                <strong>Reason:</strong> {snapshot.reason}
              </div>
              <div>
                <strong>Age:</strong> {ageMinutes} minutes{" "}
                {isValid ? "(valid)" : "(expired)"}
              </div>
              <div>
                <strong>Connection State:</strong> {snapshot.lastConnectionState}
              </div>
              <div>
                <strong>Active Nodes:</strong> {snapshot.activeNodeIds.join(", ")}
              </div>
              <div>
                <strong>Terminal Tabs:</strong> {snapshot.terminalTabs.length}
              </div>
              <div>
                <strong>Log Sources:</strong> {snapshot.activeLogSources.length}
              </div>
              {snapshot.lastAiPrompt && (
                <div>
                  <strong>Last AI Prompt:</strong> {snapshot.lastAiPrompt}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Usage Guide */}
      <div style={{ marginTop: "30px", padding: "15px", backgroundColor: "#f5f5f5" }}>
        <h3>Usage Guide</h3>
        <ol>
          <li>
            <strong>Save Snapshot:</strong> Call when connection is about to disconnect
            to preserve state
          </li>
          <li>
            <strong>Restore Snapshot:</strong> Call when reconnecting to restore previous
            state
          </li>
          <li>
            <strong>Cleanup Expired:</strong> Periodically remove old snapshots to save
            memory
          </li>
          <li>
            <strong>Integration Points:</strong>
            <ul>
              <li>ConnectionRuntime: Auto-save on disconnect</li>
              <li>Terminal Panel: Restore tabs and state</li>
              <li>Logs Panel: Restore log sources and positions</li>
              <li>AI Context: Restore last prompt and context</li>
            </ul>
          </li>
        </ol>
      </div>
    </div>
  );
}

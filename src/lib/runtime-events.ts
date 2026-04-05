import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { LogChunk, SessionSummary, TerminalTab } from "../types/models";
import { useWorkspaceStore } from "../store/workspace";

interface RuntimeConnectionPayload {
  session: SessionSummary;
  tab: TerminalTab;
  logs?: LogChunk[];
}

interface RuntimeSessionEvent {
  kind: "connected" | "tab-opened";
  projectId: string;
  payload: RuntimeConnectionPayload;
}

interface RuntimeLogEvent {
  kind: "seeded" | "appended";
  projectId: string;
  logs: LogChunk[];
}

let bindPromise: Promise<void> | null = null;
let activeUnlisten: UnlistenFn | null = null;
let subscriberCount = 0;

async function bindListeners(): Promise<UnlistenFn> {
  const unlistenSession = await listen<RuntimeSessionEvent>("proj-eye://runtime/session", (event) => {
    useWorkspaceStore.getState().ingestRuntimeConnection(event.payload.payload);
  });

  const unlistenLogs = await listen<RuntimeLogEvent>("proj-eye://runtime/logs", (event) => {
    useWorkspaceStore.getState().ingestLogs(event.payload.logs);
  });

  return () => {
    unlistenSession();
    unlistenLogs();
  };
}

function releaseListener(): void {
  subscriberCount = Math.max(0, subscriberCount - 1);
  if (subscriberCount === 0 && activeUnlisten) {
    activeUnlisten();
    activeUnlisten = null;
  }
}

export async function ensureRuntimeListeners(): Promise<UnlistenFn> {
  subscriberCount += 1;

  if (activeUnlisten) {
    return releaseListener;
  }

  if (!bindPromise) {
    bindPromise = bindListeners()
      .then((unlisten) => {
        activeUnlisten = unlisten;
      })
      .catch(() => {
        subscriberCount = Math.max(0, subscriberCount - 1);
      })
      .finally(() => {
        bindPromise = null;
      });
  }

  await bindPromise;
  return releaseListener;
}

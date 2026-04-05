import { create } from "zustand";
import { BottomPanelKey, type BottomPanelKey as BottomPanelKeyValue } from "../types/models";

interface PanelsState {
  activeBottomPanel: BottomPanelKeyValue | null;
  isAiOpen: boolean;
  toggleBottomPanel: (panel: BottomPanelKeyValue) => void;
  closeBottomPanel: () => void;
  toggleAiOverlay: () => void;
  setAiOverlay: (isOpen: boolean) => void;
}

export const usePanelsStore = create<PanelsState>((set) => ({
  activeBottomPanel: BottomPanelKey.Logs,
  isAiOpen: true,
  toggleBottomPanel: (panel) =>
    set((state) => ({
      activeBottomPanel: state.activeBottomPanel === panel ? null : panel,
    })),
  closeBottomPanel: () => set({ activeBottomPanel: null }),
  toggleAiOverlay: () => set((state) => ({ isAiOpen: !state.isAiOpen })),
  setAiOverlay: (isAiOpen) => set({ isAiOpen }),
}));

export const panelOrder = [BottomPanelKey.Logs, BottomPanelKey.Database, BottomPanelKey.Cron] as const;

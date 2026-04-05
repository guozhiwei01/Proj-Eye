import type { ReactNode } from "react";
import ProjectDialog from "./dialogs/ProjectDialog";
import ServerDialog from "./dialogs/ServerDialog";
import DatabaseDialog from "./dialogs/DatabaseDialog";
import ProviderDialog from "./dialogs/ProviderDialog";
import SettingsDialog from "./dialogs/SettingsDialog";

export type WorkbenchDialogState =
  | { kind: null }
  | { kind: "project"; entityId?: string; initialPath?: string[] }
  | { kind: "server"; entityId?: string }
  | { kind: "database"; entityId?: string }
  | { kind: "provider"; entityId?: string }
  | { kind: "settings" };

interface ManagementDialogsProps {
  dialog: WorkbenchDialogState;
  onClose: () => void;
}

export default function ManagementDialogs({ dialog, onClose }: ManagementDialogsProps): ReactNode {
  return (
    <>
      <ProjectDialog
        open={dialog.kind === "project"}
        entityId={dialog.kind === "project" ? dialog.entityId : undefined}
        initialPath={dialog.kind === "project" ? dialog.initialPath : undefined}
        onClose={onClose}
      />
      <ServerDialog
        open={dialog.kind === "server"}
        entityId={dialog.kind === "server" ? dialog.entityId : undefined}
        onClose={onClose}
      />
      <DatabaseDialog
        open={dialog.kind === "database"}
        entityId={dialog.kind === "database" ? dialog.entityId : undefined}
        onClose={onClose}
      />
      <ProviderDialog
        open={dialog.kind === "provider"}
        entityId={dialog.kind === "provider" ? dialog.entityId : undefined}
        onClose={onClose}
      />
      <SettingsDialog open={dialog.kind === "settings"} onClose={onClose} />
    </>
  );
}

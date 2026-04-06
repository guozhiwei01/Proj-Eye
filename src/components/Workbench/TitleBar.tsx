import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { useI18n } from "../../lib/i18n";
import { type Project } from "../../types/models";

const win = typeof window !== "undefined" && (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  ? getCurrentWindow()
  : null;

function IconMinimize() {
  return (
    <svg viewBox="0 0 10 1" className="h-[1.5px] w-3.5 fill-current">
      <rect width="10" height="1" />
    </svg>
  );
}

function IconMaximize({ isMaximized }: { isMaximized: boolean }) {
  if (isMaximized) {
    return (
      <svg viewBox="0 0 10 10" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.1">
        <rect x="2" y="0" width="8" height="8" />
        <rect x="0" y="2" width="8" height="8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 10 10" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.1">
      <rect x="0.5" y="0.5" width="9" height="9" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg viewBox="0 0 10 10" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.3">
      <path d="M1 1l8 8M9 1l-8 8" />
    </svg>
  );
}

interface TitleBarProps {
  activeProject: Project | null;
  onOpenSettings: () => void;
}

export default function TitleBar({ activeProject, onOpenSettings }: TitleBarProps) {
  const { locale } = useI18n();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!win) return;

    void win.isMaximized().then(setIsMaximized);

    const unlisten = win.onResized(() => {
      void win.isMaximized().then(setIsMaximized);
    });

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const handleMinimize = () => void win?.minimize();
  const handleMaximize = () => void win?.toggleMaximize();
  const handleClose = () => void win?.close();

  return (
    <div className="flex h-[40px] shrink-0 select-none items-center border-b border-white/6 bg-[#161618]" data-tauri-drag-region>
      {/* Left: app name + active project */}
      <div className="flex items-center gap-0 px-5" data-tauri-drag-region>
        <span className="text-[13px] font-semibold tracking-[0.04em] text-white/85">Proj-Eye</span>

        {activeProject && (
          <>
            <span className="mx-2.5 text-[13px] text-white/20">/</span>
            <span className="max-w-[220px] truncate text-[13px] text-white/65">
              {activeProject.name}
            </span>
          </>
        )}
      </div>

      {/* Drag region filler */}
      <div className="flex-1" data-tauri-drag-region />

      {/* Right: settings + window controls */}
      <div className="flex items-center">
        {/* Settings */}
        <button
          type="button"
          onClick={onOpenSettings}
          title={locale === "zh-CN" ? "设置" : "Settings"}
          className="flex h-[40px] w-11 items-center justify-center text-white/40 transition hover:bg-white/6 hover:text-white/75"
        >
          <svg viewBox="0 0 1024 1024" className="h-[18px] w-[18px] fill-current">
            <path d="M512 512m-79.2 0a79.2 79.2 0 1 0 158.4 0 79.2 79.2 0 1 0-158.4 0Z" />
            <path d="M512 62C263.6 62 62 263.6 62 512s201.6 450 450 450 450-201.6 450-450S760.4 62 512 62z m239.4 511.2c-5.4 22.5-14.4 44.1-26.1 63-2.7 4.5-6.3 8.1-10.8 9.9l-2.7-2.7c-18.9-18.9-49.5-18.9-68.4 0-18.9 18.9-18.9 49.5 0 68.4l2.7 2.7c-1.8 4.5-5.4 8.1-9.9 10.8-19.8 11.7-40.5 20.7-63 26.1-4.5 0.9-9 0.9-13.5 0v-3.6c0-27-21.6-48.6-48.6-48.6-27 0-48.6 21.6-48.6 48.6v4.5c-4.5 0.9-9 1.8-13.5 0-22.5-5.4-44.1-14.4-63-26.1-4.5-2.7-8.1-6.3-9.9-10.8l2.7-2.7c18.9-18.9 18.9-49.5 0-68.4-18.9-18.9-49.5-18.9-68.4 0l-2.7 2.7c-4.5-1.8-8.1-5.4-10.8-9.9-11.7-19.8-20.7-40.5-26.1-63-0.9-4.5-0.9-9 0-13.5h3.6c27 0 48.6-21.6 48.6-48.6 0-27-21.6-48.6-48.6-48.6h-4.5c-0.9-4.5-1.8-9 0-13.5 5.4-22.5 14.4-44.1 26.1-63 2.7-4.5 6.3-8.1 10.8-9.9l2.7 2.7c18.9 18.9 49.5 18.9 68.4 0 18.9-18.9 18.9-49.5 0-68.4l-2.7-2.7c1.8-4.5 5.4-8.1 9.9-10.8 19.8-11.7 40.5-20.7 63-26.1 4.5-0.9 9-0.9 13.5 0v4.5c0 27 21.6 48.6 48.6 48.6 27 0 48.6-21.6 48.6-48.6v-4.5c4.5-0.9 9-1.8 13.5 0 22.5 5.4 44.1 14.4 63 26.1 4.5 2.7 8.1 6.3 9.9 10.8l-2.7 2.7c-18.9 18.9-18.9 49.5 0 68.4 18.9 18.9 49.5 18.9 68.4 0l2.7-2.7c4.5 1.8 8.1 5.4 10.8 9.9 11.7 19.8 20.7 40.5 26.1 63 0.9 4.5 0.9 9 0 13.5h-3.6c-27 0-48.6 21.6-48.6 48.6s21.6 48.6 48.6 48.6h4.5c0.9 3.6 0.9 8.1 0 12.6z" />
          </svg>
        </button>

        {/* Separator */}
        <div className="mx-1 h-5 w-px bg-white/10" />

        {/* Minimize */}
        <button
          type="button"
          onClick={handleMinimize}
          className="flex h-[40px] w-11 items-center justify-center text-white/40 transition hover:bg-white/6 hover:text-white/75"
        >
          <IconMinimize />
        </button>

        {/* Maximize / Restore */}
        <button
          type="button"
          onClick={handleMaximize}
          className="flex h-[40px] w-11 items-center justify-center text-white/40 transition hover:bg-white/6 hover:text-white/75"
        >
          <IconMaximize isMaximized={isMaximized} />
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={handleClose}
          className="flex h-[40px] w-11 items-center justify-center text-white/40 transition hover:bg-red-500/80 hover:text-white"
        >
          <IconClose />
        </button>
      </div>
    </div>
  );
}

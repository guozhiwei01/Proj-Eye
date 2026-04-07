import type { TerminalTab } from "../../types/models";

interface TerminalTabsProps {
  tabs: TerminalTab[];
  projectName: string;
  onSelect: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
}

function TerminalGlyph() {
  return (
    <svg viewBox="0 0 1024 1024" className="h-3 w-3 flex-none fill-current" aria-hidden="true">
      <path d="M128 128h768a42.666667 42.666667 0 0 1 42.666667 42.666667v682.666666a42.666667 42.666667 0 0 1-42.666667 42.666667H128a42.666667 42.666667 0 0 1-42.666667-42.666667V170.666667a42.666667 42.666667 0 0 1 42.666667-42.666667z m384 512v85.333333h256v-85.333333h-256z m-153.002667-128l-120.661333 120.661333L298.666667 693.034667 479.701333 512 298.666667 330.965333 238.336 391.338667 358.997333 512z" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 1024 1024" className="h-3 w-3 flex-none fill-current" aria-hidden="true">
      <path d="M0 0h1024v1024H0z" fillOpacity="0" />
      <path d="M240.448 168l2.346667 2.154667 289.92 289.941333 279.253333-279.253333a42.666667 42.666667 0 0 1 62.506667 58.026666l-2.133334 2.346667-279.296 279.210667 279.274667 279.253333a42.666667 42.666667 0 0 1-58.005333 62.528l-2.346667-2.176-279.253333-279.253333-289.92 289.962666a42.666667 42.666667 0 0 1-62.506667-58.005333l2.154667-2.346667 289.941333-289.962666-289.92-289.92a42.666667 42.666667 0 0 1 57.984-62.506667z" />
    </svg>
  );
}

function resolveTabLabel(tab: TerminalTab, projectName: string, index: number) {
  if (!/^shell(?:-\d+)?$/i.test(tab.title)) {
    return tab.title;
  }

  return index === 0 ? projectName : `${projectName} ${index + 1}`;
}

export default function TerminalTabs({ tabs, projectName, onSelect, onCloseTab }: TerminalTabsProps) {
  return (
    <div className="flex h-[30px] min-h-[30px] max-h-[30px] items-stretch overflow-x-auto overflow-y-hidden box-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          className={`group box-border flex h-[30px] min-h-[30px] max-h-[30px] min-w-[76px] max-w-[160px] flex-none items-stretch border-r border-white/8 ${
            tab.active ? "bg-[#202226] text-[#f4efe2]" : "bg-[#17191c] text-white/46 hover:bg-[#1b1d21] hover:text-white/82"
          }`}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onCloseTab(tab.id);
            }}
            className={`flex h-full w-5 flex-none items-center justify-end pr-0.5 leading-none transition ${
              tab.active ? "text-white/42 hover:bg-white/6 hover:text-white/82" : "text-white/22 hover:bg-white/4 hover:text-white/64"
            }`}
            aria-label={`Close ${tab.title}`}
            title={`Close ${tab.title}`}
          >
            <CloseGlyph />
          </button>
          <button
            type="button"
            onClick={() => onSelect(tab.id)}
            className="flex h-full min-w-0 flex-1 items-center gap-0.5 px-1 text-left leading-none transition"
            aria-current={tab.active ? "page" : undefined}
          >
            <span
              className={`transition ${tab.active ? "text-white/82" : "text-white/42 group-hover:text-white/74"}`}
              aria-hidden="true"
            >
              <TerminalGlyph />
            </span>
            <span className="truncate text-[11px] font-semibold tracking-[0.01em]">
              {resolveTabLabel(tab, projectName, index)}
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}

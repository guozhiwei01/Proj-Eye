import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/app.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Proj-Eye failed to find the root element.");
}

const root = ReactDOM.createRoot(rootElement);

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return [error.name, error.message, error.stack].filter(Boolean).join("\n\n");
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

function StartupScreen({
  title,
  description,
  detail,
}: {
  title: string;
  description: string;
  detail?: string;
}) {
  return (
    <React.StrictMode>
      <div
        data-theme="teal"
        className="min-h-screen bg-[var(--bg0)] px-6 py-10 text-[var(--text0)]"
      >
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center justify-center">
          <div className="w-full max-w-2xl rounded-[32px] border border-white/8 bg-[color-mix(in_srgb,var(--panel)_92%,#0b1020_8%)] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.32)]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-[var(--accent)]">
              Proj-Eye
            </div>
            <h1 className="text-3xl font-semibold">{title}</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--text1)]">{description}</p>
            {detail ? (
              <pre className="mt-6 overflow-auto rounded-3xl border border-white/8 bg-black/30 p-4 text-xs leading-6 text-[var(--text1)]">
                {detail}
              </pre>
            ) : null}
          </div>
        </div>
      </div>
    </React.StrictMode>
  );
}

function renderStartupScreen(title: string, description: string, detail?: string): void {
  root.render(<StartupScreen title={title} description={description} detail={detail} />);
}

renderStartupScreen(
  "Starting Proj-Eye",
  "Loading the desktop UI. If startup fails, the error details will be shown here instead of a blank window.",
);

window.addEventListener("error", (event) => {
  renderStartupScreen(
    "Startup error",
    "Proj-Eye hit an unhandled browser error during startup.",
    formatError(event.error ?? event.message),
  );
});

window.addEventListener("unhandledrejection", (event) => {
  renderStartupScreen(
    "Startup rejection",
    "Proj-Eye hit an unhandled promise rejection during startup.",
    formatError(event.reason),
  );
});

async function bootstrap(): Promise<void> {
  try {
    const { default: App } = await import("./App");
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  } catch (error) {
    renderStartupScreen(
      "Application load failed",
      "Proj-Eye could not finish loading the React application.",
      formatError(error),
    );
  }
}

void bootstrap();

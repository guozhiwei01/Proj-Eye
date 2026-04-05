import { useEffect, type PropsWithChildren, type ReactNode } from "react";

interface ModalProps extends PropsWithChildren {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  footer?: ReactNode;
  maxWidthClassName?: string;
}

export default function Modal({
  open,
  title,
  description,
  onClose,
  footer,
  maxWidthClassName = "max-w-5xl",
  children,
}: ModalProps) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-black/72 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 flex max-h-[calc(100vh-3rem)] w-full flex-col overflow-hidden rounded-[18px] border border-white/10 bg-[#232325] shadow-[0_24px_90px_rgba(0,0,0,0.46)] ${maxWidthClassName}`}
      >
        <div className="border-b border-white/8 bg-[#1b1b1d] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Proj-Eye</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text0)]">{title}</h2>
              {description ? (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/62">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-white/62 transition hover:border-white/20 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
        {footer ? <div className="border-t border-white/8 bg-[#1b1b1d] px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

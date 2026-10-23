import { useState, useCallback } from "react";
import { AlertTriangle, Check, X } from "lucide-react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

let resolveFn: ((value: boolean) => void) | null = null;
let pendingOpts: ConfirmOptions | null = null;
let openFn: ((opts: ConfirmOptions | null) => void) | null = null;

export function showConfirmDialog(options: ConfirmOptions): Promise<boolean> {
  pendingOpts = options;
  openFn?.(options);
  return new Promise((resolve) => {
    resolveFn = resolve;
  });
}

export function ConfirmDialogProvider() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);

  const handleAnswer = useCallback((value: boolean) => {
    setOpts(null);
    resolveFn?.(value);
    resolveFn = null;
    pendingOpts = null;
  }, []);

  openFn = setOpts;
  void pendingOpts;

  return (
    <>
      {opts && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1100] flex items-end lg:items-center justify-center animate-fade-in" onClick={() => handleAnswer(false)}>
          <div className="bg-[var(--card-bg)] rounded-t-2xl lg:rounded-2xl w-full max-w-[420px] mx-4 px-4 pt-[18px] pb-[22px] animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-[var(--border)] rounded-full mx-auto mb-[14px] lg:hidden" />
            <div className={`w-11 h-11 rounded-full flex items-center justify-center mb-3 ${
              opts.danger ? "bg-red-100 dark:bg-red-950/40" : "bg-amber-100 dark:bg-amber-950/40"
            }`}>
              <AlertTriangle size={22} className={opts.danger ? "text-[#ef4444]" : "text-[#f59e0b]"} />
            </div>
            <div className="text-[0.9rem] font-bold mb-2 text-[var(--text)]">{opts.title}</div>
            <p className="text-[var(--text-light)] text-[0.78rem] mb-[18px] leading-relaxed">{opts.message}</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleAnswer(false)}
                className="flex-1 flex items-center justify-center gap-[6px] py-[11px] px-[14px] rounded-[12px] border-[1.5px] border-[var(--border)] bg-[var(--card-bg)] text-[var(--text)] font-bold text-[0.82rem] cursor-pointer"
              >
                <X size={15} /> {opts.cancelText || "Batal"}
              </button>
              <button
                onClick={() => handleAnswer(true)}
                className={`flex-1 flex items-center justify-center gap-[6px] py-[11px] px-[14px] rounded-[12px] text-white font-bold text-[0.82rem] cursor-pointer border-none ${
                  opts.danger
                    ? "bg-gradient-to-r from-[#ef4444] to-[#dc2626]"
                    : "bg-gradient-to-r from-[#2563eb] to-[#1d4ed8]"
                }`}
              >
                <Check size={15} /> {opts.confirmText || "Lanjutkan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

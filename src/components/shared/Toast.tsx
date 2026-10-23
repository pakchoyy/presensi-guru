import { useState, createContext, useContext, useCallback, useRef, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, X, Info, Loader2 } from "lucide-react";

type ToastType = "success" | "error" | "info" | "loading";

interface ToastItem {
  id: number;
  msg: string;
  type: ToastType;
}

interface ToastCtx {
  toast: (msg: string, type?: ToastType) => void;
}

const ToastCtx = createContext<ToastCtx>({ toast: () => {} });

const TOAST_STYLE: Record<
  ToastType,
  { icon: ReactNode; iconBg: string; accent: string; ring: string }
> = {
  success: {
    icon: <CheckCircle2 size={20} className="text-white" />,
    iconBg: "bg-[#16a34a]",
    accent: "bg-[#16a34a]",
    ring: "border-green-100 dark:border-green-900/60",
  },
  error: {
    icon: <AlertTriangle size={20} className="text-white" />,
    iconBg: "bg-[#dc2626]",
    accent: "bg-[#dc2626]",
    ring: "border-red-100 dark:border-red-900/60",
  },
  info: {
    icon: <Info size={20} className="text-white" />,
    iconBg: "bg-[var(--brand)]",
    accent: "bg-[var(--brand)]",
    ring: "border-blue-100 dark:border-blue-900/60",
  },
  loading: {
    icon: <Loader2 size={20} className="text-white animate-spin" />,
    iconBg: "bg-[var(--brand)]",
    accent: "bg-[var(--brand)]",
    ring: "border-blue-100 dark:border-blue-900/60",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idCounterRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (msg: string, type: ToastType = "info") => {
      idCounterRef.current += 1;
      const id = idCounterRef.current;
      setToasts((prev) => [{ id, msg, type }, ...prev].slice(0, 5));
      if (type !== "loading") {
        setTimeout(() => remove(id), 3200);
      }
    },
    [remove]
  );

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      {/* Dropdown toast — menggantung dari atas, anchor header 58px */}
      <div className="fixed top-[66px] right-3 left-3 sm:left-auto z-[1000] flex flex-col gap-2 w-[min(100%,380px)] sm:w-[380px] ml-auto pointer-events-none">
        {toasts.map((t) => {
          const s = TOAST_STYLE[t.type];
          return (
            <div
              key={t.id}
              className={`relative overflow-hidden bg-white dark:bg-[#1e293b] border ${s.ring} shadow-xl rounded-2xl py-[12px] pr-[12px] pl-[14px] flex items-center gap-[12px] pointer-events-auto animate-toast-drop`}
              style={{ boxShadow: "0 12px 32px rgba(13,148,136,.18)" }}
            >
              {/* Accent bar kiri */}
              <span className={`absolute left-0 top-0 bottom-0 w-[4px] ${s.accent}`} />
              <span
                className={`flex-shrink-0 w-[36px] h-[36px] rounded-full ${s.iconBg} flex items-center justify-center shadow-sm`}
              >
                {s.icon}
              </span>
              <span className="text-[0.82rem] font-semibold text-[var(--text)] flex-1 leading-snug break-words">
                {t.msg}
              </span>
              <button
                onClick={() => remove(t.id)}
                className="w-7 h-7 flex-shrink-0 rounded-full text-[var(--text-light)] hover:text-[var(--text)] hover:bg-[var(--input-bg)] cursor-pointer bg-transparent border-none flex items-center justify-center"
                aria-label="Tutup"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

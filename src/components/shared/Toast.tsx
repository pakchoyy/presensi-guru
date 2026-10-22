import { useState, createContext, useContext, useCallback, type ReactNode } from "react";
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

const TOAST_STYLE: Record<ToastType, { icon: ReactNode; iconBg: string; ring: string }> = {
  success: {
    icon: <CheckCircle2 size={22} className="text-[#16a34a]" />,
    iconBg: "bg-green-500/15",
    ring: "border-green-200 dark:border-green-800",
  },
  error: {
    icon: <AlertTriangle size={22} className="text-[#ef4444]" />,
    iconBg: "bg-red-500/15",
    ring: "border-red-200 dark:border-red-800",
  },
  info: {
    icon: <Info size={22} className="text-[#1e40af]" />,
    iconBg: "bg-teal-500/15",
    ring: "border-teal-200 dark:border-teal-800",
  },
  loading: {
    icon: <Loader2 size={22} className="text-[#1e40af] animate-spin" />,
    iconBg: "bg-teal-500/15",
    ring: "border-teal-200 dark:border-teal-800",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  let idCounter = 0;

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((msg: string, type: ToastType = "info") => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, msg, type }]);
    if (type !== "loading") {
      setTimeout(() => remove(id), 3000);
    }
  }, [remove]);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] flex flex-col gap-3 w-[min(94%,430px)] pointer-events-none">
        {toasts.map((t) => {
          const s = TOAST_STYLE[t.type];
          return (
            <div
              key={t.id}
              className={`relative overflow-hidden bg-white dark:bg-[#1e293b] border ${s.ring} shadow-2xl rounded-[16px] py-[14px] pr-[14px] pl-[14px] flex items-center gap-[12px] pointer-events-auto animate-slide-down`}
            >
              <span className={`flex-shrink-0 w-[42px] h-[42px] rounded-full ${s.iconBg} flex items-center justify-center`}>
                {s.icon}
              </span>
              <span className="text-[0.85rem] font-bold text-[var(--text)] flex-1 leading-snug">{t.msg}</span>
              <button
                onClick={() => remove(t.id)}
                className="text-[var(--text-light)] hover:text-[var(--text)] cursor-pointer bg-transparent border-none p-0"
              >
                <X size={16} />
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

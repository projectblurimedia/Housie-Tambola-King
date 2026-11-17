import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

type ShowToast = (message: string, isError?: boolean) => void;
const ToastContext = createContext<ShowToast>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null);
  const show = useCallback<ShowToast>((message, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 3500);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? <div className={toast.isError ? 'toast err' : 'toast'}>{toast.message}</div> : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

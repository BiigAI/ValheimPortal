import React, { createContext, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheckCircle, FiAlertCircle, FiInfo } from 'react-icons/fi';

interface Toast {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info';
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-5 right-6 z-[9999] flex flex-col space-y-2.5 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -20, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.92, transition: { duration: 0.15 } }}
              className={`flex items-center space-x-3 px-5 py-3.5 rounded-xl shadow-2xl border pointer-events-auto backdrop-blur-xl ${
                t.type === 'success'
                  ? 'bg-gray-900/95 border-emerald-500/40 text-emerald-300 shadow-[0_10px_25px_rgba(16,185,129,0.2)]'
                  : t.type === 'error'
                  ? 'bg-gray-900/95 border-red-500/40 text-red-300 shadow-[0_10px_25px_rgba(239,68,68,0.2)]'
                  : 'bg-gray-900/95 border-orange-500/40 text-orange-300 shadow-[0_10px_25px_rgba(249,115,22,0.2)]'
              }`}
            >
              {t.type === 'success' && <FiCheckCircle className="text-emerald-400 text-lg flex-shrink-0" />}
              {t.type === 'error' && <FiAlertCircle className="text-red-400 text-lg flex-shrink-0" />}
              {t.type === 'info' && <FiInfo className="text-orange-400 text-lg flex-shrink-0" />}
              <span className="text-xs font-semibold text-gray-100">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

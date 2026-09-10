import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

interface HeaderActionsContextType {
  headerActions: React.ReactNode;
  setHeaderActions: (actions: React.ReactNode) => void;
  registerSaveHandler: (handler: (() => void) | null) => void;
}

const HeaderActionsContext = createContext<HeaderActionsContextType>({
  headerActions: null,
  setHeaderActions: () => {},
  registerSaveHandler: () => {},
});

export const HeaderActionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [headerActions, setHeaderActions] = useState<React.ReactNode>(null);
  const saveHandlerRef = useRef<(() => void) | null>(null);

  const registerSaveHandler = (handler: (() => void) | null) => {
    saveHandlerRef.current = handler;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        if (saveHandlerRef.current) {
          e.preventDefault();
          saveHandlerRef.current();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <HeaderActionsContext.Provider
      value={{
        headerActions,
        setHeaderActions,
        registerSaveHandler,
      }}
    >
      {children}
    </HeaderActionsContext.Provider>
  );
};

export const useHeaderActions = () => useContext(HeaderActionsContext);

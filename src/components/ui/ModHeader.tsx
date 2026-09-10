import React, { useEffect } from 'react';
import { type IconType } from 'react-icons';
import { FiRefreshCw, FiCheck, FiLoader } from 'react-icons/fi';
import SimpleAdvancedToggle, { type ModeType } from './SimpleAdvancedToggle';
import { useHeaderActions } from '../../context/HeaderActionsContext';

export interface ModHeaderProps {
  icon?: IconType;
  title?: string;
  description?: string;
  mode?: ModeType;
  onModeChange?: (mode: ModeType) => void;
  tabId?: string;
  accentColor?: 'orange' | 'amber' | 'cyan' | 'red' | 'indigo' | 'emerald';
  statusBadge?: string;
  metadata?: Array<{ label: string; value: React.ReactNode }>;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onSave?: () => void;
  isSaving?: boolean;
  saveLabel?: string;
  children?: React.ReactNode;
}

const accentGradients = {
  orange: {
    ambient: 'bg-orange-500/5',
    iconBox: 'from-orange-500/20 via-amber-500/10 to-transparent border-orange-500/30 text-orange-400',
    saveBtn: 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/25',
  },
  amber: {
    ambient: 'bg-amber-500/5',
    iconBox: 'from-amber-500/20 via-orange-500/10 to-transparent border-amber-500/30 text-amber-400',
    saveBtn: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/25',
  },
  cyan: {
    ambient: 'bg-cyan-500/5',
    iconBox: 'from-cyan-500/20 via-blue-500/10 to-transparent border-cyan-500/30 text-cyan-400',
    saveBtn: 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-cyan-600/25',
  },
  red: {
    ambient: 'bg-red-500/5',
    iconBox: 'from-red-500/20 via-rose-500/10 to-transparent border-red-500/30 text-red-400',
    saveBtn: 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-red-600/25',
  },
  indigo: {
    ambient: 'bg-indigo-500/5',
    iconBox: 'from-indigo-500/20 via-purple-500/10 to-transparent border-indigo-500/30 text-indigo-400',
    saveBtn: 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-600/25',
  },
  emerald: {
    ambient: 'bg-emerald-500/5',
    iconBox: 'from-emerald-500/20 via-teal-500/10 to-transparent border-emerald-500/30 text-emerald-400',
    saveBtn: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/25',
  },
};

export default function ModHeader({
  mode,
  onModeChange,
  tabId = 'mod',
  accentColor = 'orange',
  onRefresh,
  isRefreshing = false,
  onSave,
  isSaving = false,
  saveLabel = 'Save Configuration',
  children,
}: ModHeaderProps) {
  const styles = accentGradients[accentColor] || accentGradients.orange;
  const { setHeaderActions, registerSaveHandler } = useHeaderActions();

  useEffect(() => {
    registerSaveHandler(onSave || null);
    return () => registerSaveHandler(null);
  }, [onSave, registerSaveHandler]);

  useEffect(() => {
    setHeaderActions(
      <div className="flex items-center space-x-2.5">
        {mode !== undefined && onModeChange && (
          <SimpleAdvancedToggle
            mode={mode}
            onChange={onModeChange}
            accentColor={accentColor}
            idPrefix={tabId}
          />
        )}

        {children}

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-900/90 hover:bg-gray-800 border border-gray-700/80 hover:border-gray-600 rounded-xl text-xs font-semibold text-gray-200 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title="Reload from server"
          >
            <FiRefreshCw
              size={13}
              className={isRefreshing ? 'animate-spin text-orange-400' : 'text-gray-400'}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        )}

        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-xl text-xs font-bold text-white transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${styles.saveBtn}`}
            title="Save Configuration (⌘S / Ctrl+S)"
          >
            {isSaving ? (
              <FiLoader className="animate-spin text-sm" />
            ) : (
              <FiCheck className="text-sm" />
            )}
            <span>{isSaving ? 'Saving...' : saveLabel}</span>
            <span className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-bold bg-black/30 border border-white/20 rounded text-white/90">
              ⌘S
            </span>
          </button>
        )}
      </div>
    );

    return () => {
      setHeaderActions(null);
    };
  }, [
    mode,
    onModeChange,
    tabId,
    accentColor,
    onRefresh,
    isRefreshing,
    onSave,
    isSaving,
    saveLabel,
    children,
    styles.saveBtn,
    setHeaderActions,
  ]);

  return null;
}

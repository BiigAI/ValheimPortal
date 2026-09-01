import React from 'react';
import { type IconType } from 'react-icons';
import { FiRefreshCw, FiCheck, FiLoader } from 'react-icons/fi';
import SimpleAdvancedToggle, { type ModeType } from './SimpleAdvancedToggle';

interface ModHeaderProps {
  icon: IconType;
  title: string;
  description: string;
  mode?: ModeType;
  onModeChange?: (mode: ModeType) => void;
  tabId?: string;
  accentColor?: 'orange' | 'amber' | 'cyan' | 'red' | 'indigo' | 'emerald';
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onSave?: () => void;
  isSaving?: boolean;
  saveLabel?: string;
  children?: React.ReactNode;
}

const accentGradients = {
  orange: {
    iconBg: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    saveBtn: 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/25',
  },
  amber: {
    iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    saveBtn: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/25',
  },
  cyan: {
    iconBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    saveBtn: 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-cyan-600/25',
  },
  red: {
    iconBg: 'bg-red-500/10 text-red-400 border-red-500/20',
    saveBtn: 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 shadow-red-600/25',
  },
  indigo: {
    iconBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    saveBtn: 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-600/25',
  },
  emerald: {
    iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    saveBtn: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/25',
  },
};

export default function ModHeader({
  icon: Icon,
  title,
  description,
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

  return (
    <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 p-5 sm:p-6 rounded-2xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      {/* Left side: Icon & Title */}
      <div className="flex items-center space-x-3.5 min-w-0">
        <div className={`p-3 rounded-xl border flex-shrink-0 ${styles.iconBg}`}>
          <Icon size={22} />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-gray-100 tracking-tight truncate">
            {title}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed line-clamp-2 sm:line-clamp-none">
            {description}
          </p>
        </div>
      </div>

      {/* Right side: Mode Toggle, Refresh, Save & Extra buttons */}
      <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto flex-shrink-0">
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
            className="p-2.5 bg-gray-800/80 hover:bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700/80 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Reload from server"
          >
            <FiRefreshCw
              size={15}
              className={isRefreshing ? 'animate-spin text-gray-300' : ''}
            />
          </button>
        )}

        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className={`text-white px-5 py-2.5 rounded-xl font-medium text-xs transition-all shadow-lg flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed ${styles.saveBtn}`}
          >
            {isSaving ? (
              <FiLoader className="animate-spin text-sm" />
            ) : (
              <FiCheck className="text-sm" />
            )}
            <span>{isSaving ? 'Saving...' : saveLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}

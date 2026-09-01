import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiAlertTriangle, 
  FiZap, 
  FiClock, 
  FiChevronDown, 
  FiChevronUp, 
  FiTrash2, 
  FiCheckCircle, 
  FiSliders, 
  FiXCircle
} from 'react-icons/fi';
import { api, type PendingConfigChange, type ScheduledRestartInfo } from '../api/client';
import { useToast } from '../context/ToastContext';

interface PendingChangesBannerProps {
  pendingChanges: PendingConfigChange[];
  scheduledRestart: ScheduledRestartInfo | null;
  onRefreshRestartStatus: () => void;
  onNavigateTab: (tabId: string) => void;
}

export default function PendingChangesBanner({
  pendingChanges,
  scheduledRestart,
  onRefreshRestartStatus,
  onNavigateTab,
}: PendingChangesBannerProps) {
  const { showToast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const hasPending = pendingChanges.length > 0;
  const isRestartActive = scheduledRestart && scheduledRestart.active;

  // If nothing is pending and no restart is in progress, do not render
  if (!hasPending && !isRestartActive) {
    return null;
  }

  const handleInstantRestart = async () => {
    setIsRestarting(true);
    try {
      // 1 minute (60s) restart countdown with in-game broadcast
      await api.scheduleRestart(1, 'Applying staged mod configurations');
      showToast('⚡ Server restart initiated (60s countdown with world save & player broadcast)!', 'info');
      onRefreshRestartStatus();
    } catch (err) {
      showToast('Failed to trigger server restart', 'error');
    } finally {
      setIsRestarting(false);
    }
  };

  const handleCancelRestart = async () => {
    setIsCancelling(true);
    try {
      await api.cancelRestart();
      showToast('Scheduled restart cancelled.', 'info');
      onRefreshRestartStatus();
    } catch (err) {
      showToast('Failed to cancel restart', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleClearChanges = async () => {
    setIsClearing(true);
    try {
      await api.clearPendingChanges();
      showToast('Pending changes list cleared.', 'info');
      onRefreshRestartStatus();
      setIsExpanded(false);
    } catch (err) {
      showToast('Failed to clear pending changes', 'error');
    } finally {
      setIsClearing(false);
    }
  };

  // Format remaining seconds into MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -20, height: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="w-full z-10"
    >
      <div className={`px-8 py-3.5 border-b backdrop-blur-xl transition-colors duration-300 ${
        isRestartActive
          ? 'bg-red-950/40 border-red-500/30 text-red-100 shadow-[0_4px_25px_rgba(239,68,68,0.12)]'
          : 'bg-amber-950/35 border-amber-500/30 text-amber-100 shadow-[0_4px_25px_rgba(245,158,11,0.12)]'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          
          {/* Left: Summary & Status */}
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className={`p-2 rounded-xl border shrink-0 ${
              isRestartActive
                ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
            }`}>
              {isRestartActive ? <FiClock size={18} /> : <FiAlertTriangle size={18} />}
            </div>

            <div className="min-w-0">
              <div className="flex items-center space-x-2.5">
                <span className="font-semibold text-sm tracking-tight text-white flex items-center space-x-2">
                  {isRestartActive ? (
                    <>
                      <span className="text-red-400 font-bold font-mono">RESTART IN PROGRESS</span>
                      <span className="text-xs text-red-300 bg-red-900/60 px-2 py-0.5 rounded font-mono font-semibold border border-red-700/50">
                        {formatTime(scheduledRestart.remainingSeconds)} remaining
                      </span>
                    </>
                  ) : (
                    <>
                      <span>Configuration Changes Saved to Disk</span>
                      <span className="text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                        {pendingChanges.length} {pendingChanges.length === 1 ? 'Module' : 'Modules'} Pending Restart
                      </span>
                    </>
                  )}
                </span>
              </div>

              <p className="text-xs text-gray-300/80 truncate mt-0.5 font-sans">
                {isRestartActive ? (
                  <span>Reason: <strong className="text-white">{scheduledRestart.reason}</strong> • Auto world save &amp; player notifications are active.</span>
                ) : (
                  <span>
                    Staged updates: <strong className="text-amber-300">{pendingChanges.map(c => c.moduleName).join(', ')}</strong>. A server restart is required for changes to take effect in-game.
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center space-x-2.5 shrink-0">
            {isRestartActive ? (
              <button
                onClick={handleCancelRestart}
                disabled={isCancelling}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold font-mono tracking-wide transition-all shadow-md shadow-red-600/30 flex items-center space-x-1.5"
              >
                <FiXCircle size={14} />
                <span>{isCancelling ? 'Cancelling...' : 'Abort Restart'}</span>
              </button>
            ) : (
              <>
                {hasPending && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="px-3 py-1.5 bg-gray-900/80 hover:bg-gray-800 text-amber-200 hover:text-white border border-amber-500/30 hover:border-amber-400/50 rounded-xl text-xs font-medium transition-all flex items-center space-x-1.5"
                  >
                    <span>{isExpanded ? 'Hide Details' : 'View Changes'}</span>
                    {isExpanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                  </button>
                )}

                <button
                  onClick={handleInstantRestart}
                  disabled={isRestarting}
                  className="px-4 py-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-400 hover:to-red-400 text-gray-950 font-bold rounded-xl text-xs tracking-wide transition-all shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 flex items-center space-x-1.5 active:scale-95"
                >
                  <FiZap size={14} className="fill-current" />
                  <span>{isRestarting ? 'Scheduling...' : 'Restart Server (60s)'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Expandable Staged Changes Details Drawer */}
        <AnimatePresence>
          {isExpanded && hasPending && !isRestartActive && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-3.5 pt-3.5 border-t border-amber-500/20"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs mb-3 text-amber-200/90">
                <span className="font-semibold uppercase tracking-wider font-mono text-[11px] text-amber-400">
                  Staged Module Configurations Awaiting Reload ({pendingChanges.length})
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onNavigateTab('dashboard')}
                    className="text-gray-300 hover:text-white underline underline-offset-2 transition-colors"
                  >
                    Manage Full Restart Strategy on Dashboard
                  </button>
                  <span className="text-gray-500">•</span>
                  <button
                    onClick={handleClearChanges}
                    disabled={isClearing}
                    className="text-red-400 hover:text-red-300 flex items-center space-x-1 transition-colors"
                    title="Dismiss and clear pending changes badge"
                  >
                    <FiTrash2 size={12} />
                    <span>{isClearing ? 'Clearing...' : 'Dismiss / Clear List'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {pendingChanges.map((item) => (
                  <div
                    key={item.module}
                    className="p-3 bg-gray-950/80 border border-amber-500/20 rounded-xl flex items-center justify-between group hover:border-amber-500/40 transition-all"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg">
                        <FiSliders size={14} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-100 text-xs truncate">
                          {item.moduleName}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          Saved: {item.timestamp || 'Recently'}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigateTab(item.module)}
                      className="text-[10px] font-mono px-2 py-1 rounded-lg bg-gray-900 hover:bg-amber-500/20 text-gray-400 hover:text-amber-300 border border-gray-800 transition-all shrink-0 ml-2"
                    >
                      Open Tab
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400 bg-gray-950/60 px-3.5 py-2 rounded-xl border border-gray-800/80">
                <span className="flex items-center space-x-1.5">
                  <FiCheckCircle className="text-emerald-400 shrink-0" />
                  <span>Config files are safely saved on the server host. Clicking <strong>Restart Server (60s)</strong> sends automated in-game chat warnings and executes a clean world save before rebooting.</span>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

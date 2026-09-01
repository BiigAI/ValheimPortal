import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiHome, FiUsers, FiSliders, FiClock, FiShield, FiLogOut, FiActivity, FiServer, FiFeather, FiCompass, FiPackage, FiExternalLink } from 'react-icons/fi';
import DashboardTab from './tabs/DashboardTab';
import CharactersVaultTab from './tabs/CharactersVaultTab';
import ValgrindTab from './tabs/ValgrindTab';
import DagrAndNottTab from './tabs/DagrAndNottTab';
import SkaldTab from './tabs/SkaldTab';
import NjororTab from './tabs/NjororTab';
import OtherModsTab from './tabs/OtherModsTab';
import PendingChangesBanner from './components/PendingChangesBanner';
import LoginScreen from './components/LoginScreen';
import ReconnectingOverlay from './components/ReconnectingOverlay';
import { ToastProvider, useToast } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { api, type PendingConfigChange, type ScheduledRestartInfo } from './api/client';

const THUNDERSTORE_BASE = 'https://thunderstore.io/c/valheim/p/BigAI';

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: FiHome, tag: 'Core', component: DashboardTab, thunderstoreUrl: null },
  { id: 'othermods', label: 'Other Mods', icon: FiPackage, tag: '3rd Party', component: OtherModsTab, thunderstoreUrl: null },
  { id: 'charvault', label: 'Characters Vault', icon: FiUsers, tag: 'Module', component: CharactersVaultTab, thunderstoreUrl: `${THUNDERSTORE_BASE}/CharactersVault/` },
  { id: 'valgrind', label: 'Valgrind', icon: FiSliders, tag: 'Module', component: ValgrindTab, thunderstoreUrl: `${THUNDERSTORE_BASE}/Valgrind/` },
  { id: 'dagrnott', label: 'Dagr & Nott', icon: FiClock, tag: 'Module', component: DagrAndNottTab, thunderstoreUrl: `${THUNDERSTORE_BASE}/DagrNott_CustomDayCycle/` },
  { id: 'skald', label: 'Skald Killfeed', icon: FiFeather, tag: 'Module', component: SkaldTab, thunderstoreUrl: `${THUNDERSTORE_BASE}/Skald_VikingKillFeed/` },
  { id: 'njoror', label: 'Njörðr', icon: FiCompass, tag: 'Module', component: NjororTab, thunderstoreUrl: `${THUNDERSTORE_BASE}/Njoror_FairWinds/` },
];

function MainLayout({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [installedModules, setInstalledModules] = useState<Set<string>>(new Set(['dashboard']));
  const [pendingChanges, setPendingChanges] = useState<PendingConfigChange[]>([]);
  const [scheduledRestart, setScheduledRestart] = useState<ScheduledRestartInfo | null>(null);
  const [tickRate, setTickRate] = useState('—');
  const [isDisconnected, setIsDisconnected] = useState(false);
  const failCountRef = useRef(0);
  const { showToast } = useToast();

  const fetchRestartStatus = useCallback(() => {
    api.getRestartStatus()
      .then((res) => {
        setScheduledRestart(res.scheduledRestart);
        setPendingChanges(res.pendingChanges || []);
        // Reconnected!
        if (isDisconnected) {
          setIsDisconnected(false);
          showToast('Reconnected to server.', 'success');
        }
        failCountRef.current = 0;
      })
      .catch(() => {
        failCountRef.current += 1;
        if (failCountRef.current >= 3) {
          setIsDisconnected(true);
        }
      });
  }, [isDisconnected, showToast]);

  // Lightweight telemetry poll for header tick rate
  useEffect(() => {
    const fetchTelemetry = () => {
      api.getTelemetry()
        .then((tel) => {
          setTickRate(tel.tickRate || '—');
        })
        .catch(() => {});
    };
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    api.getInstalledModules()
      .then(({ installed }) => {
        // Dashboard and Other Mods are always available
        setInstalledModules(new Set(['dashboard', 'othermods', ...installed]));
      })
      .catch(() => {
        // On failure, assume all installed to avoid blocking the UI
        setInstalledModules(new Set(tabs.map(t => t.id)));
      });

    fetchRestartStatus();
  }, [fetchRestartStatus]);

  // Periodic polling for restart countdowns and pending changes sync
  useEffect(() => {
    const pollInterval = scheduledRestart?.active ? 1000 : 3500;
    const interval = setInterval(fetchRestartStatus, pollInterval);
    return () => clearInterval(interval);
  }, [fetchRestartStatus, scheduledRestart?.active]);

  const handleDisconnect = () => {
    onLogout();
  };

  const handleTabClick = (tabId: string, isInstalled: boolean) => {
    if (!isInstalled) {
      showToast('This module is not installed on the server.', 'error');
      return;
    }
    setActiveTab(tabId);
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden font-sans select-none">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -260 }}
        animate={{ x: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-72 bg-gray-900/95 border-r border-gray-800/80 flex flex-col backdrop-blur-xl z-20"
      >
        <div className="p-6 border-b border-gray-800/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 via-amber-500 to-yellow-400 p-0.5 shadow-lg shadow-orange-500/20">
              <div className="w-full h-full bg-gray-900 rounded-[10px] flex items-center justify-center">
                <FiServer className="text-orange-400 text-xl" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-200 tracking-tight">
                Bigfrost
              </h1>
              <p className="text-xs text-gray-400 font-mono tracking-wide">v1.0.0 • Dedicated</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="px-4 pt-6 pb-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2 font-mono">
            Navigation
          </p>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isInstalled = tab.tag === 'Core' || tab.tag === '3rd Party' || installedModules.has(tab.id);
            const isPending = pendingChanges.some(
              (c) => c.module.toLowerCase() === tab.id.toLowerCase()
            );

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id, isInstalled)}
                title={!isInstalled ? `${tab.label} is not installed on this server` : isPending ? `${tab.label} has changes pending server restart` : undefined}
                className={`w-full group flex items-center justify-between px-3.5 py-3 rounded-xl transition-all duration-200 text-sm font-medium ${!isInstalled
                    ? 'text-gray-600 border border-transparent cursor-not-allowed opacity-60'
                    : isActive
                      ? 'bg-gradient-to-r from-orange-500/20 via-orange-500/10 to-transparent text-orange-300 border border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.15)]'
                      : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200 border border-transparent'
                  }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon size={19} className={`transition-transform duration-200 ${!isInstalled ? 'text-gray-600' : isActive ? 'text-orange-400 scale-110' : 'text-gray-400 group-hover:text-gray-300'
                    }`} />
                  <span className={!isInstalled ? 'line-through decoration-gray-700' : ''}>{tab.label}</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  {isPending && (
                    <span 
                      className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-pulse" 
                      title="Configuration modified • Restart pending"
                    />
                  )}
                  {isInstalled ? (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${isActive ? 'bg-orange-500/20 text-orange-300' : 'bg-gray-800 text-gray-400 group-hover:bg-gray-700'
                      }`}>
                      {tab.tag}
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium bg-gray-900 text-gray-600 border border-gray-800 flex items-center space-x-1">
                      <FiPackage size={9} />
                      <span>Not Installed</span>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Server Status footer */}
        <div className="p-4 m-4 rounded-xl bg-gray-950/60 border border-gray-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 flex items-center space-x-1.5 font-medium">
              <FiShield className="text-emerald-400" />
              <span>BepInEx Bridge</span>
            </span>
            <span className="text-[10px] font-mono bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Active
            </span>
          </div>
          <div className="text-xs text-gray-400 font-mono">Port: 8080 (HTTP)</div>
        </div>

        <div className="p-4 border-t border-gray-800/50">
          <button
            onClick={handleDisconnect}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20"
          >
            <FiLogOut size={16} />
            <span>Disconnect Session</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-gray-800/60 backdrop-blur-xl bg-gray-950/60 flex items-center justify-between px-8 z-10 shrink-0">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-gray-100 tracking-tight">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
          </div>

          <div className="flex items-center space-x-4">
            {pendingChanges.length > 0 && !scheduledRestart?.active && (
              <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-full animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span className="text-xs text-amber-300 font-semibold font-mono uppercase tracking-wider">
                  {pendingChanges.length} Restart Pending
                </span>
              </div>
            )}

            <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs text-emerald-400 font-semibold font-mono uppercase tracking-wider">Server Online</span>
            </div>

            <div className="h-4 w-px bg-gray-800"></div>

            <div className="flex items-center space-x-2 text-xs font-mono text-gray-400 bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg">
              <FiActivity className="text-orange-400" />
              <span>Tick: {tickRate}</span>
            </div>
          </div>
        </header>

        {/* Global Pending Changes / Restart Notification Banner */}
        <PendingChangesBanner
          pendingChanges={pendingChanges}
          scheduledRestart={scheduledRestart}
          onRefreshRestartStatus={fetchRestartStatus}
          onNavigateTab={setActiveTab}
        />

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-8 z-0">
          <AnimatePresence mode="wait">
            {tabs.map((tab) => {
              if (tab.id !== activeTab) return null;
              const Component = tab.component;
              const isInstalled = tab.tag === 'Core' || installedModules.has(tab.id);

              if (!isInstalled) {
                return (
                  <motion.div
                    key={tab.id}
                    initial={{ opacity: 0, y: 12, scale: 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12, scale: 0.99 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="w-full flex items-center justify-center"
                    style={{ minHeight: 'calc(100vh - 12rem)' }}
                  >
                    <div className="flex flex-col items-center space-y-6 text-center max-w-md">
                      <div className="p-6 bg-gray-900/60 border border-gray-800/80 rounded-2xl">
                        <FiPackage size={48} className="text-gray-700 mx-auto" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-gray-500 mb-2">{tab.label}</h3>
                        <p className="text-gray-600 text-sm leading-relaxed">
                          This module is not currently installed on the server.<br />
                          Install it via BepInEx to unlock this panel.
                        </p>
                      </div>
                      {tab.thunderstoreUrl ? (
                        <a
                          href={tab.thunderstoreUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-2 text-xs font-mono font-semibold px-4 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-orange-500/40 text-gray-500 hover:text-orange-300 rounded-full transition-all group"
                        >
                          <FiPackage size={12} className="group-hover:text-orange-400 transition-colors" />
                          <span>Not Installed — Get on Thunderstore</span>
                          <FiExternalLink size={11} className="group-hover:text-orange-400 transition-colors" />
                        </a>
                      ) : (
                        <span className="inline-flex items-center space-x-2 text-xs font-mono font-semibold px-4 py-2 bg-gray-900 border border-gray-800 text-gray-600 rounded-full">
                          <FiPackage size={12} />
                          <span>Not Installed</span>
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={tab.id}
                  initial={{ opacity: 0, y: 12, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.99 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="w-full"
                >
                  <Component onSaved={fetchRestartStatus} />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </main>

      {/* Reconnecting Overlay */}
      <AnimatePresence>
        {isDisconnected && <ReconnectingOverlay />}
      </AnimatePresence>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-gray-950 flex items-center justify-center font-sans select-none">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-orange-600 via-amber-500 to-yellow-400 p-0.5 shadow-lg shadow-orange-500/20 animate-pulse">
            <div className="w-full h-full bg-gray-900 rounded-[10px] flex items-center justify-center">
              <FiServer className="text-orange-400 text-2xl" />
            </div>
          </div>
          <span className="text-gray-400 text-sm font-mono">Verifying Session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <MainLayout onLogout={logout} />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  FiServer, FiUsers, FiCpu, FiHardDrive, FiTerminal, FiRadio, 
  FiClock, FiAlertTriangle, FiX, FiCheck, FiCalendar, FiSettings,
  FiChevronDown, FiChevronUp, FiHeart, FiShield, FiActivity,
  FiSlash, FiSearch, FiPlus
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../context/ToastContext';
import { 
  api, type ServerTelemetry, type PlayerInfo, type BannedPlayer, 
  type ConsoleLogEntry, type ScheduledRestartInfo, type DailyRestartInfo, 
  type LifecycleConfig 
} from '../api/client';

export default function DashboardTab() {
  const { showToast } = useToast();
  const [telemetry, setTelemetry] = useState<ServerTelemetry>({
    uptime: '14h 22m',
    uptimeSeconds: 51720,
    onlineCount: 3,
    maxPlayers: 10,
    fps: 59.8,
    tickRate: '20.0ms',
    activeZdos: 42189,
    memoryMb: 1420,
  });
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [bannedPlayers, setBannedPlayers] = useState<BannedPlayer[]>([]);
  const [playerTab, setPlayerTab] = useState<'online' | 'banned'>('online');
  const [banSearchTerm, setBanSearchTerm] = useState('');
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  
  const [logs, setLogs] = useState<ConsoleLogEntry[]>([]);
  const [cmdInput, setCmdInput] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  // Ban Modals
  const [showManualBanModal, setShowManualBanModal] = useState(false);
  const [manualBanSteamId, setManualBanSteamId] = useState('');
  const [manualBanName, setManualBanName] = useState('');
  const [manualBanReason, setManualBanReason] = useState('Banned by Admin');

  const [banTargetPlayer, setBanTargetPlayer] = useState<PlayerInfo | null>(null);
  const [playerBanReason, setPlayerBanReason] = useState('Rule violation / Base griefing');

  // Scheduled Restart & Strategy States
  const [scheduledRestart, setScheduledRestart] = useState<ScheduledRestartInfo | null>(null);
  const [dailyRestart, setDailyRestart] = useState<DailyRestartInfo>({ enabled: true, time: '04:00' });
  const [lifecycleConfig, setLifecycleConfig] = useState<LifecycleConfig>({ mode: 'ExitOnly', scriptPath: './start_server.sh' });
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  
  const [restartMinutes, setRestartMinutes] = useState(10);
  const [restartReason, setRestartReason] = useState('Routine Server Maintenance & Backup');
  const [dailyTimeInput, setDailyTimeInput] = useState('04:00');
  const [dailyEnabledInput, setDailyEnabledInput] = useState(true);
  const [strategyModeInput, setStrategyModeInput] = useState<'ExitOnly' | 'SpawnProcess'>('ExitOnly');
  const [scriptPathInput, setScriptPathInput] = useState('./start_server.sh');

  // Poll telemetry, players, bans, logs, and restart schedules from server
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const [tel, pls, bns, lgs, rst] = await Promise.all([
          api.getTelemetry(),
          api.getPlayers(),
          api.getBans(),
          api.getLogs(),
          api.getRestartStatus(),
        ]);
        if (isMounted) {
          setTelemetry(tel);
          setPlayers(pls);
          setBannedPlayers(bns);
          setLogs(lgs);
          setScheduledRestart(rst.scheduledRestart);
          setDailyRestart(rst.dailyRestart);
          if (rst.lifecycleConfig) {
            setLifecycleConfig(rst.lifecycleConfig);
            setStrategyModeInput(rst.lifecycleConfig.mode);
            setScriptPathInput(rst.lifecycleConfig.scriptPath);
          }
        }
      } catch (err) {
        console.error('Failed to fetch from Valheim server API:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleExecuteCmd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmdInput.trim()) return;

    try {
      const res = await api.executeCommand(cmdInput.trim());
      showToast(res.output, 'info');
      setCmdInput('');
      const updatedLogs = await api.getLogs();
      setLogs(updatedLogs);
    } catch (err) {
      showToast('Failed to execute server command', 'error');
    }
  };

  const handleKickPlayer = async (name: string) => {
    try {
      await api.kickPlayer(name);
      setPlayers(prev => prev.filter(p => p.name !== name));
      showToast(`Player "${name}" was kicked from the server.`, 'error');
    } catch (err) {
      showToast('Failed to kick player', 'error');
    }
  };

  const handleConfirmBanPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banTargetPlayer) return;

    try {
      await api.banPlayer(banTargetPlayer.name, playerBanReason);
      setPlayers(prev => prev.filter(p => p.name !== banTargetPlayer.name));
      const updatedBans = await api.getBans();
      setBannedPlayers(updatedBans);
      showToast(`Player "${banTargetPlayer.name}" banned and added to ban list.`, 'error');
      setBanTargetPlayer(null);
      setPlayerBanReason('Rule violation / Base griefing');
    } catch (err) {
      showToast('Failed to ban player', 'error');
    }
  };

  const handleUnban = async (steamId: string, name: string) => {
    try {
      await api.unbanPlayer(steamId);
      setBannedPlayers(prev => prev.filter(b => b.steamId !== steamId));
      showToast(`Unbanned SteamID ${steamId} (${name}).`, 'success');
      const updatedLogs = await api.getLogs();
      setLogs(updatedLogs);
    } catch (err) {
      showToast('Failed to unban player', 'error');
    }
  };

  const handleAddManualBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBanSteamId.trim()) return;

    try {
      await api.addManualBan(manualBanSteamId.trim(), manualBanName.trim() || 'Offline Player', manualBanReason.trim());
      const updatedBans = await api.getBans();
      setBannedPlayers(updatedBans);
      showToast(`Banned SteamID ${manualBanSteamId.trim()}`, 'error');
      setShowManualBanModal(false);
      setManualBanSteamId('');
      setManualBanName('');
      setManualBanReason('Banned by Admin');
    } catch (err) {
      showToast('Failed to add manual ban', 'error');
    }
  };

  const handleForceSave = async () => {
    try {
      const res = await api.forceSave();
      showToast(res.message, 'success');
      const updatedLogs = await api.getLogs();
      setLogs(updatedLogs);
    } catch (err) {
      showToast('Failed to trigger world save', 'error');
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;

    try {
      await api.broadcast(broadcastMsg.trim());
      showToast(`Broadcast sent: "${broadcastMsg}"`, 'info');
      setShowBroadcastModal(false);
      setBroadcastMsg('');
      const updatedLogs = await api.getLogs();
      setLogs(updatedLogs);
    } catch (err) {
      showToast('Failed to send broadcast', 'error');
    }
  };

  const handleScheduleRestart = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.scheduleRestart(restartMinutes, restartReason);
      showToast(`Server restart scheduled in ${restartMinutes} minutes!`, 'error');
      setShowScheduleModal(false);
      const rst = await api.getRestartStatus();
      setScheduledRestart(rst.scheduledRestart);
    } catch (err) {
      showToast('Failed to schedule server restart', 'error');
    }
  };

  const handleCancelRestart = async () => {
    try {
      await api.cancelRestart();
      showToast('Scheduled restart cancelled.', 'info');
      setScheduledRestart(null);
    } catch (err) {
      showToast('Failed to cancel restart', 'error');
    }
  };

  const handleSaveDailySchedule = async () => {
    try {
      const res = await api.updateDailyRestart(dailyEnabledInput, dailyTimeInput);
      setDailyRestart(res.dailyRestart);
      showToast(`Daily restart ${dailyEnabledInput ? `set for ${dailyTimeInput}` : 'disabled'}.`, 'success');
    } catch (err) {
      showToast('Failed to update daily restart schedule', 'error');
    }
  };

  const handleSaveStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.saveLifecycleConfig({
        mode: strategyModeInput,
        scriptPath: scriptPathInput,
      });
      setLifecycleConfig(res.lifecycleConfig);
      setShowStrategyModal(false);
      showToast(`Restart strategy saved: ${res.lifecycleConfig.mode}`, 'success');
    } catch (err) {
      showToast('Failed to save restart strategy', 'error');
    }
  };

  const togglePlayerDropdown = (id: string) => {
    setExpandedPlayerId(prev => prev === id ? null : id);
  };

  const formatRemainingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  };

  const filteredBans = bannedPlayers.filter(b => 
    b.name.toLowerCase().includes(banSearchTerm.toLowerCase()) ||
    b.steamId.includes(banSearchTerm) ||
    b.reason.toLowerCase().includes(banSearchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Active Scheduled Restart Alert Banner */}
      <AnimatePresence>
        {scheduledRestart && scheduledRestart.active && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            className="p-5 rounded-2xl bg-gradient-to-r from-red-950/80 via-red-900/60 to-orange-950/80 border border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)] flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-xl"
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-red-500/20 text-red-400 rounded-xl border border-red-500/40 animate-pulse">
                <FiAlertTriangle size={26} />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full border border-red-500/30">
                    Scheduled Restart Pending
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    Target: {scheduledRestart.targetTimestamp ? new Date(scheduledRestart.targetTimestamp).toLocaleTimeString() : ''}
                  </span>
                </div>
                <h4 className="text-base font-bold text-gray-100 mt-1">
                  Reason: <span className="text-orange-300 font-normal">{scheduledRestart.reason}</span>
                </h4>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-[11px] font-mono text-red-300 uppercase tracking-wider">Time Remaining</p>
                <div className="text-2xl font-bold font-mono text-red-200 tracking-wider">
                  {formatRemainingTime(scheduledRestart.remainingSeconds)}
                </div>
              </div>
              <button
                onClick={handleCancelRestart}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 border border-red-500/40 text-red-300 hover:text-red-200 rounded-xl text-xs font-bold transition-all shadow-md shadow-red-950/50 flex items-center space-x-1.5"
              >
                <FiX />
                <span>Cancel Restart</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Telemetry Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl p-5 flex items-center space-x-4 shadow-lg hover:border-gray-700 transition-all">
          <div className="p-3.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <FiServer size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Server Uptime</p>
            <h3 className="text-2xl font-bold text-gray-100 font-mono mt-0.5">{telemetry.uptime}</h3>
          </div>
        </div>

        <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl p-5 flex items-center space-x-4 shadow-lg hover:border-gray-700 transition-all">
          <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <FiUsers size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Online Players</p>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <h3 className="text-2xl font-bold text-gray-100 font-mono">{telemetry.onlineCount}</h3>
              <span className="text-xs text-gray-400 font-mono">/ {telemetry.maxPlayers}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl p-5 flex items-center space-x-4 shadow-lg hover:border-gray-700 transition-all">
          <div className="p-3.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <FiCpu size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Tick Rate / FPS</p>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <h3 className="text-2xl font-bold text-gray-100 font-mono">{telemetry.fps}</h3>
              <span className="text-xs text-gray-400 font-mono">fps</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl p-5 flex items-center space-x-4 shadow-lg hover:border-gray-700 transition-all">
          <div className="p-3.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <FiHardDrive size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Active ZDOs</p>
            <h3 className="text-2xl font-bold text-gray-100 font-mono mt-0.5">{telemetry.activeZdos.toLocaleString()}</h3>
          </div>
        </div>
      </div>

      {/* Players & Ban List Management Card */}
      <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-gray-800/80 bg-gray-900/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Segmented View Switcher */}
          <div className="flex items-center space-x-2 bg-gray-950 p-1 rounded-xl border border-gray-800">
            <button
              onClick={() => setPlayerTab('online')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                playerTab === 'online'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Online Players ({players.length})</span>
            </button>

            <button
              onClick={() => setPlayerTab('banned')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                playerTab === 'banned'
                  ? 'bg-red-500/15 text-red-300 border border-red-500/30 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <FiSlash className="text-red-400" />
              <span>Server Ban List ({bannedPlayers.length})</span>
            </button>
          </div>

          {/* Action Header Items */}
          {playerTab === 'online' ? (
            <span className="text-xs text-gray-500 font-mono">Click a row to expand player telemetry</span>
          ) : (
            <div className="flex items-center space-x-3">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs" />
                <input
                  type="text"
                  value={banSearchTerm}
                  onChange={(e) => setBanSearchTerm(e.target.value)}
                  placeholder="Search bans by SteamID, Name, Reason..."
                  className="bg-gray-950 border border-gray-700/80 rounded-lg pl-8 pr-3 py-1 text-xs font-mono text-gray-200 focus:outline-none focus:border-red-500 w-64"
                />
              </div>
              <button
                onClick={() => setShowManualBanModal(true)}
                className="px-3 py-1 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5"
              >
                <FiPlus />
                <span>Ban SteamID</span>
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: Online Players Table */}
        {playerTab === 'online' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-950/60 text-gray-400 font-mono text-xs uppercase tracking-wider">
                <tr>
                  <th className="w-8 px-4 py-3.5"></th>
                  <th className="px-5 py-3.5 font-medium">Character</th>
                  <th className="px-5 py-3.5 font-medium">Steam ID</th>
                  <th className="px-5 py-3.5 font-medium">Biome / Zone</th>
                  <th className="px-5 py-3.5 font-medium">Health</th>
                  <th className="px-5 py-3.5 font-medium">Ping</th>
                  <th className="px-5 py-3.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50 text-gray-300">
                {players.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-400 font-mono text-xs">
                      No players currently connected.
                    </td>
                  </tr>
                ) : (
                  players.map((p) => {
                    const isExpanded = expandedPlayerId === p.id;
                    const healthPercent = Math.min(100, Math.round((p.health / (p.maxHealth || 1)) * 100));

                    return (
                      <React.Fragment key={p.id}>
                        <tr 
                          onClick={() => togglePlayerDropdown(p.id)}
                          className={`cursor-pointer transition-colors ${
                            isExpanded ? 'bg-gray-800/40' : 'hover:bg-gray-800/25'
                          }`}
                        >
                          <td className="px-4 py-3.5 text-gray-500">
                            {isExpanded ? <FiChevronUp size={16} className="text-orange-400" /> : <FiChevronDown size={16} />}
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-gray-100 flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>{p.name}</span>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs text-gray-400">{p.steamId}</td>
                          <td className="px-5 py-3.5">
                            <span className="bg-gray-800/80 px-2.5 py-1 rounded-md text-xs text-gray-300 border border-gray-700/50">
                              {p.zone}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-xs text-red-300 font-semibold">{p.health}/{p.maxHealth}</span>
                              <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-red-500 to-emerald-400 rounded-full" 
                                  style={{ width: `${healthPercent}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs text-emerald-400">{p.ping}</td>
                          <td className="px-5 py-3.5 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleKickPlayer(p.name)}
                              className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-medium transition-colors"
                            >
                              Kick
                            </button>
                            <button
                              onClick={() => setBanTargetPlayer(p)}
                              className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-medium transition-colors"
                            >
                              Ban
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Player Details Row */}
                        {isExpanded && (
                          <tr className="bg-gray-950/80 border-b border-gray-800/80">
                            <td colSpan={7} className="px-6 py-4">
                              <motion.div
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-gray-900/80 border border-gray-800"
                              >
                                {/* Health / Max Health */}
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-1.5 text-xs text-gray-400 font-medium">
                                    <FiHeart className="text-red-400" />
                                    <span>Health & Vitality</span>
                                  </div>
                                  <div className="flex items-baseline space-x-2">
                                    <span className="text-lg font-bold font-mono text-red-300">{p.health}</span>
                                    <span className="text-xs text-gray-500 font-mono">/ {p.maxHealth} HP ({healthPercent}%)</span>
                                  </div>
                                  <div className="w-full h-2 bg-gray-950 rounded-full overflow-hidden border border-gray-800">
                                    <div 
                                      className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-emerald-400 transition-all duration-300"
                                      style={{ width: `${healthPercent}%` }}
                                    ></div>
                                  </div>
                                </div>

                                {/* Ping / Latency */}
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-1.5 text-xs text-gray-400 font-medium">
                                    <FiActivity className="text-emerald-400" />
                                    <span>Network Latency</span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <span className="text-lg font-bold font-mono text-emerald-400">{p.ping}</span>
                                    <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                      Stable
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-gray-500 font-mono">Peer Socket: Active</p>
                                </div>

                                {/* PVP Status */}
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-1.5 text-xs text-gray-400 font-medium">
                                    <FiShield className={p.pvp ? "text-amber-400" : "text-emerald-400"} />
                                    <span>PVP Status</span>
                                  </div>
                                  <div>
                                    <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold font-mono border ${
                                      p.pvp 
                                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' 
                                        : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    }`}>
                                      <span>{p.pvp ? '⚔️ PVP ENABLED' : '🛡️ PVP DISABLED'}</span>
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-gray-500 font-mono">
                                    {p.pvp ? 'Can damage & be damaged by players' : 'Friendly fire protected'}
                                  </p>
                                </div>

                                {/* In-Game Days Survived & Coords */}
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-1.5 text-xs text-gray-400 font-medium">
                                    <FiCalendar className="text-orange-400" />
                                    <span>Days Survived & Position</span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <span className="text-lg font-bold font-mono text-orange-300">Day {p.daysSurvived}</span>
                                  </div>
                                  <p className="text-[11px] text-gray-400 font-mono truncate" title={p.pos}>
                                    Coords: {p.pos}
                                  </p>
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Server Ban List Table */}
        {playerTab === 'banned' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-950/60 text-gray-400 font-mono text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5 font-medium">Steam ID</th>
                  <th className="px-6 py-3.5 font-medium">Last Known Alias</th>
                  <th className="px-6 py-3.5 font-medium">Date Banned</th>
                  <th className="px-6 py-3.5 font-medium">Ban Reason</th>
                  <th className="px-6 py-3.5 font-medium">Banned By</th>
                  <th className="px-6 py-3.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50 text-gray-300">
                {filteredBans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-500 font-mono text-xs">
                      {bannedPlayers.length === 0 ? 'No players currently banned on this server.' : 'No bans match your search query.'}
                    </td>
                  </tr>
                ) : (
                  filteredBans.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-red-400 flex items-center space-x-2 font-semibold">
                        <FiSlash className="text-red-400 flex-shrink-0" />
                        <span>{b.steamId}</span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-200">{b.name}</td>
                      <td className="px-6 py-4 text-xs font-mono text-gray-400">{b.bannedAt}</td>
                      <td className="px-6 py-4 text-xs">
                        <span className="bg-red-500/10 text-red-300 border border-red-500/20 px-2.5 py-1 rounded-md">
                          {b.reason}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-gray-400">{b.bannedBy}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleUnban(b.steamId, b.name)}
                          className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold transition-all shadow-sm"
                        >
                          Unban
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Main Console and Lifecycle Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Console Stream */}
        <div className="lg:col-span-2 bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl flex flex-col shadow-xl overflow-hidden h-[480px]">
          <div className="px-5 py-3.5 border-b border-gray-800/80 flex justify-between items-center bg-gray-900/90">
            <div className="flex items-center space-x-2.5">
              <FiTerminal className="text-orange-400" />
              <h3 className="font-semibold text-gray-200 text-sm">Server Console & BepInEx Logs</h3>
            </div>
            <button
              onClick={() => setLogs([])}
              className="text-xs text-gray-400 hover:text-gray-200 px-2.5 py-1 rounded-md bg-gray-800/80 hover:bg-gray-800 border border-gray-700/50 transition-colors font-mono"
            >
              Clear
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-1.5 bg-gray-950/80">
            {logs.map((l, i) => (
              <div key={i} className="flex items-start space-x-2 leading-relaxed">
                <span className="text-gray-400 select-none">[{l.time}]</span>
                <span className={`font-semibold ${
                  l.level === 'success' ? 'text-emerald-400' :
                  l.level === 'cmd' ? 'text-orange-400' :
                  l.level === 'warn' ? 'text-amber-400' :
                  l.level === 'error' ? 'text-red-400' :
                  'text-blue-400'
                }`}>
                  [{l.source}]
                </span>
                <span className={l.level === 'cmd' ? 'text-orange-200 font-semibold' : 'text-gray-300'}>
                  {l.text}
                </span>
              </div>
            ))}
          </div>

          <form onSubmit={handleExecuteCmd} className="p-3 border-t border-gray-800/80 bg-gray-900/90 flex space-x-2">
            <input
              type="text"
              value={cmdInput}
              onChange={(e) => setCmdInput(e.target.value)}
              placeholder="Type command (e.g. save, event wolves, ban SteamID)..."
              className="flex-1 bg-gray-950 border border-gray-700/80 rounded-xl px-4 py-2.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-orange-500/80 focus:ring-1 focus:ring-orange-500/50 transition-all placeholder:text-gray-600"
            />
            <button
              type="submit"
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-5 py-2.5 rounded-xl font-medium text-xs transition-all shadow-md shadow-orange-500/20"
            >
              Send
            </button>
          </form>
        </div>

        {/* Server Lifecycle & Scheduled Restarts Panel */}
        <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl p-6 flex flex-col justify-between shadow-xl space-y-5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-gray-100 tracking-tight">Server Lifecycle</h3>
              <button
                onClick={() => setShowStrategyModal(true)}
                className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-orange-300 rounded-lg border border-gray-700 transition-colors"
                title="Configure Restart Strategy (Docker vs Spawn Process)"
              >
                <FiSettings size={15} />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Strategy: <span className="font-mono text-orange-400 font-medium">{lifecycleConfig.mode}</span>
            </p>

            <div className="space-y-2.5">
              <button
                onClick={handleForceSave}
                className="w-full bg-gray-800/80 hover:bg-gray-800 border border-gray-700/80 text-gray-200 py-2.5 px-4 rounded-xl text-xs font-medium transition-all flex items-center justify-center space-x-2 hover:border-gray-600"
              >
                <FiHardDrive className="text-blue-400" />
                <span>Force World Save</span>
              </button>

              <button
                onClick={() => setShowBroadcastModal(true)}
                className="w-full bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 text-amber-300 py-2.5 px-4 rounded-xl text-xs font-medium transition-all flex items-center justify-center space-x-2"
              >
                <FiRadio className="text-amber-400" />
                <span>Broadcast Server Shout</span>
              </button>
            </div>

            {/* Daily Automated Schedule Box */}
            <div className="mt-4 p-3.5 bg-gray-950/70 rounded-xl border border-gray-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300 flex items-center space-x-1.5">
                  <FiCalendar className="text-orange-400" />
                  <span>Daily Auto-Restart</span>
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={dailyEnabledInput}
                    onChange={(e) => setDailyEnabledInput(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="time"
                  value={dailyTimeInput}
                  disabled={!dailyEnabledInput}
                  onChange={(e) => setDailyTimeInput(e.target.value)}
                  className="bg-gray-900 border border-gray-700/80 rounded-lg px-2.5 py-1 text-xs font-mono text-gray-200 focus:outline-none focus:border-orange-500 disabled:opacity-40"
                />
                <button
                  onClick={handleSaveDailySchedule}
                  className="flex-1 px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-all border border-gray-700"
                >
                  Save Time
                </button>
              </div>
              <p className="text-[10px] text-gray-400">
                {dailyRestart.enabled ? `Active: Daily at ${dailyRestart.time} with warning shouts.` : 'Automated daily restart disabled.'}
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-800/80">
            <button
              onClick={() => setShowScheduleModal(true)}
              className="w-full bg-gradient-to-r from-red-600/20 to-orange-600/20 hover:from-red-600/30 hover:to-orange-600/30 border border-red-500/40 text-red-300 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
            >
              <FiClock className="text-red-400 text-sm" />
              <span>Schedule Restart with Warnings...</span>
            </button>
          </div>
        </div>
      </div>

      {/* Manual Ban Modal */}
      <AnimatePresence>
        {showManualBanModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-gray-900 border border-gray-700/80 rounded-2xl p-6 max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-rose-500"></div>

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-red-500/15 text-red-400 rounded-xl border border-red-500/30">
                    <FiSlash size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-100">Add Server Ban</h3>
                    <p className="text-xs text-gray-400">Permanently block SteamID from server</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowManualBanModal(false)}
                  className="p-1 text-gray-400 hover:text-gray-200"
                >
                  <FiX size={18} />
                </button>
              </div>

              <form onSubmit={handleAddManualBan} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1 font-mono">
                    Steam ID (Required)
                  </label>
                  <input
                    type="text"
                    required
                    value={manualBanSteamId}
                    onChange={(e) => setManualBanSteamId(e.target.value)}
                    placeholder="e.g. 76561198011223344"
                    className="w-full bg-gray-950 border border-gray-700/80 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-red-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1 font-mono">
                    Player Alias / Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={manualBanName}
                    onChange={(e) => setManualBanName(e.target.value)}
                    placeholder="e.g. GriefPlayer"
                    className="w-full bg-gray-950 border border-gray-700/80 rounded-xl px-3.5 py-2 text-xs text-gray-200 focus:outline-none focus:border-red-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1 font-mono">
                    Ban Reason
                  </label>
                  <input
                    type="text"
                    value={manualBanReason}
                    onChange={(e) => setManualBanReason(e.target.value)}
                    placeholder="e.g. Toxic behavior / Exploiting"
                    className="w-full bg-gray-950 border border-gray-700/80 rounded-xl px-3.5 py-2 text-xs text-gray-200 focus:outline-none focus:border-red-500 transition-all"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowManualBanModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-600/30 flex items-center space-x-1.5"
                  >
                    <FiSlash />
                    <span>Apply Ban</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Online Player Ban Confirmation Modal */}
      <AnimatePresence>
        {banTargetPlayer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-gray-900 border border-gray-700/80 rounded-2xl p-6 max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-rose-500"></div>

              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2.5 bg-red-500/15 text-red-400 rounded-xl border border-red-500/30">
                  <FiSlash size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-100">Ban "{banTargetPlayer.name}"?</h3>
                  <p className="text-xs font-mono text-gray-400">SteamID: {banTargetPlayer.steamId}</p>
                </div>
              </div>

              <form onSubmit={handleConfirmBanPlayer} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1 font-mono">
                    Reason for Ban
                  </label>
                  <input
                    type="text"
                    value={playerBanReason}
                    onChange={(e) => setPlayerBanReason(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-700/80 rounded-xl px-3.5 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-red-500 transition-all"
                  />
                </div>

                <p className="text-xs text-gray-400 bg-gray-950 p-3 rounded-xl border border-gray-800">
                  The player will be immediately kicked and their SteamID added to the server's permanent <code className="text-red-300">bannedlist.txt</code>.
                </p>

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setBanTargetPlayer(null)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-600/30 flex items-center space-x-1.5"
                  >
                    <FiSlash />
                    <span>Confirm Ban</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Restart Strategy Configuration Modal */}
      <AnimatePresence>
        {showStrategyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-gray-900 border border-gray-700/80 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400"></div>

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-orange-500/15 text-orange-400 rounded-xl border border-orange-500/30">
                    <FiSettings size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-100">Restart Strategy & Host Environment</h3>
                    <p className="text-xs text-gray-400">Configures how the server process boots back up upon exit</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowStrategyModal(false)}
                  className="p-1 text-gray-400 hover:text-gray-200"
                >
                  <FiX size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveStrategy} className="space-y-4">
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider font-mono">
                    Host Restart Mode
                  </label>
                  
                  {/* ExitOnly Option */}
                  <div
                    onClick={() => setStrategyModeInput('ExitOnly')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      strategyModeInput === 'ExitOnly'
                        ? 'bg-orange-500/10 border-orange-500/50 shadow-md shadow-orange-950/40'
                        : 'bg-gray-950 border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-gray-100 flex items-center space-x-2">
                        <span>🐳 Container / Supervisor (`ExitOnly`)</span>
                      </span>
                      {strategyModeInput === 'ExitOnly' && <FiCheck className="text-orange-400 text-base" />}
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Calls <code className="text-orange-300 bg-gray-900 px-1 py-0.5 rounded">Application.Quit()</code>. Perfect for Docker (<code className="text-gray-300">restart: unless-stopped</code>), systemd, LinuxGSM, G-Portal, and Nitrado hosts.
                    </p>
                  </div>

                  {/* SpawnProcess Option */}
                  <div
                    onClick={() => setStrategyModeInput('SpawnProcess')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      strategyModeInput === 'SpawnProcess'
                        ? 'bg-orange-500/10 border-orange-500/50 shadow-md shadow-orange-950/40'
                        : 'bg-gray-950 border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-gray-100 flex items-center space-x-2">
                        <span>⚙️ Process Spawner (`SpawnProcess`)</span>
                      </span>
                      {strategyModeInput === 'SpawnProcess' && <FiCheck className="text-orange-400 text-base" />}
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Launches a detached process executing your startup script before killing the old server process. Best for standalone Windows/Linux batch setups without Docker.
                    </p>
                  </div>
                </div>

                {strategyModeInput === 'SpawnProcess' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1 font-mono">
                      Startup Script Path
                    </label>
                    <input
                      type="text"
                      value={scriptPathInput}
                      onChange={(e) => setScriptPathInput(e.target.value)}
                      placeholder="e.g. start_headless_server.bat or ./start_server.sh"
                      className="w-full bg-gray-950 border border-gray-700/80 rounded-xl px-3.5 py-2.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-orange-500 transition-all"
                    />
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowStrategyModal(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-orange-500/30 flex items-center space-x-1.5"
                  >
                    <FiCheck />
                    <span>Save Host Strategy</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Schedule Restart Modal */}
      <AnimatePresence>
        {showScheduleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-gray-900 border border-gray-700/80 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-orange-500 to-amber-500"></div>

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-red-500/15 text-red-400 rounded-xl border border-red-500/30">
                    <FiClock size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-100">Schedule Server Restart</h3>
                    <p className="text-xs text-gray-400">Automated in-game countdown & graceful reboot</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="p-1 text-gray-400 hover:text-gray-200"
                >
                  <FiX size={18} />
                </button>
              </div>

              <form onSubmit={handleScheduleRestart} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 font-mono">
                    Countdown Duration
                  </label>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {[5, 10, 15, 30].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setRestartMinutes(m)}
                        className={`py-2 text-xs font-mono font-medium rounded-xl border transition-all ${
                          restartMinutes === m
                            ? 'bg-red-500/20 border-red-500/50 text-red-300 shadow-md shadow-red-950/40'
                            : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700'
                        }`}
                      >
                        {m} min
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center space-x-3 bg-gray-950 p-3 rounded-xl border border-gray-800">
                    <span className="text-xs text-gray-400">Custom:</span>
                    <input
                      type="range"
                      min="1"
                      max="60"
                      value={restartMinutes}
                      onChange={(e) => setRestartMinutes(parseInt(e.target.value))}
                      className="flex-1 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                    />
                    <span className="text-xs font-bold font-mono text-red-400 w-12 text-right">
                      {restartMinutes}m
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1 font-mono">
                    Restart Reason
                  </label>
                  <input
                    type="text"
                    value={restartReason}
                    onChange={(e) => setRestartReason(e.target.value)}
                    placeholder="e.g. Scheduled Memory Maintenance & Mod Sync"
                    className="w-full bg-gray-950 border border-gray-700/80 rounded-xl px-3.5 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-red-500 transition-all"
                  />
                </div>

                <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl text-xs text-gray-400 space-y-1">
                  <span className="font-semibold text-red-300 flex items-center space-x-1">
                    <FiAlertTriangle />
                    <span>Automated Warning Protocol</span>
                  </span>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Global in-game announcements will be broadcast at 15m, 10m, 5m, 2m, and 1m intervals. World save will execute automatically before restart using strategy: <strong className="text-orange-300">{lifecycleConfig.mode}</strong>.
                  </p>
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-600/30 flex items-center space-x-1.5"
                  >
                    <FiCheck />
                    <span>Initiate Restart Countdown</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Broadcast Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-100 mb-1 flex items-center space-x-2">
              <FiRadio className="text-amber-400" />
              <span>Broadcast Announcement</span>
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Sends an in-game global shout visible to all active players.
            </p>
            <form onSubmit={handleSendBroadcast}>
              <textarea
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                placeholder="e.g. Server restart in 10 minutes! Please head to base."
                rows={3}
                className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3 text-sm text-gray-200 focus:outline-none focus:border-amber-500 transition-all mb-4"
              />
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium shadow-md shadow-amber-500/20"
                >
                  Broadcast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

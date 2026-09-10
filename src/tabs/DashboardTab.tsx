import React, { useState, useEffect, useRef } from 'react';
import {
  FiServer,
  FiUsers,
  FiCpu,
  FiHardDrive,
  FiTerminal,
  FiRadio,
  FiAlertTriangle,
  FiSettings,
  FiChevronDown,
  FiChevronUp,
  FiShield,
  FiActivity,
  FiSlash,
  FiSearch,
  FiPlus,
  FiSend,
  FiLock,
  FiArrowDown,
  FiBell,
  FiZap,
  FiUserMinus,
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useToast } from '../context/ToastContext';
import {
  api,
  type ServerTelemetry,
  type PlayerInfo,
  type BannedPlayer,
  type ConsoleLogEntry,
  type DiscordConfig,
} from '../api/client';
import KpiGaugeCard from '../components/ui/KpiGaugeCard';

interface DashboardTabProps {
  onOpenSettings?: () => void;
}

export default function DashboardTab({ onOpenSettings }: DashboardTabProps = {}) {
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
  const [discordConfig, setDiscordConfig] = useState<DiscordConfig | null>(null);

  const [playerTab, setPlayerTab] = useState<'online' | 'banned'>('online');
  const [banSearchTerm, setBanSearchTerm] = useState('');
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  // Quick Action States
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isSavingWorld, setIsSavingWorld] = useState(false);
  const [isTestingDiscord, setIsTestingDiscord] = useState(false);

  // Ban Modals
  const [showManualBanModal, setShowManualBanModal] = useState(false);
  const [manualBanSteamId, setManualBanSteamId] = useState('');
  const [manualBanName, setManualBanName] = useState('');
  const [manualBanReason, setManualBanReason] = useState('Banned by Admin');

  const [banTargetPlayer, setBanTargetPlayer] = useState<PlayerInfo | null>(null);
  const [playerBanReason, setPlayerBanReason] = useState('Rule violation / Base griefing');

  // Logs & Console State
  const [logs, setLogs] = useState<ConsoleLogEntry[]>([]);
  const [cmdInput, setCmdInput] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [logFilter, setLogFilter] = useState<'all' | 'cmd' | 'warn_error' | 'events'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadLogsCount, setUnreadLogsCount] = useState(0);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Poll server data
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const [tel, pls, bns, lgs, disc] = await Promise.all([
          api.getTelemetry(),
          api.getPlayers(),
          api.getBans(),
          api.getLogs(),
          api.getDiscordConfig().catch(() => null),
        ]);

        if (isMounted) {
          setTelemetry(tel);
          setPlayers(pls);
          setBannedPlayers(bns);
          setLogs(lgs);
          if (disc) setDiscordConfig(disc);
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

  // Smart Auto-Scroll Behavior
  const handleLogScroll = () => {
    if (!logContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 40;
    setIsAtBottom(atBottom);
    if (atBottom) {
      setUnreadLogsCount(0);
    }
  };

  useEffect(() => {
    if (autoScroll && isAtBottom) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnreadLogsCount(0);
    } else if (!isAtBottom) {
      setUnreadLogsCount((prev) => prev + 1);
    }
  }, [logs.length, autoScroll, isAtBottom]);

  const scrollToBottom = () => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsAtBottom(true);
    setUnreadLogsCount(0);
  };

  // Command Execution
  const handleExecuteCmd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmdInput.trim()) return;

    try {
      const res = await api.executeCommand(cmdInput.trim());
      showToast(res.output, 'info');
      setCmdInput('');
      const updatedLogs = await api.getLogs();
      setLogs(updatedLogs);
      scrollToBottom();
    } catch {
      showToast('Failed to execute server command', 'error');
    }
  };

  // Broadcast
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;

    setIsBroadcasting(true);
    try {
      await api.broadcast(broadcastMsg.trim());
      showToast('Announcement sent to all players!', 'success');
      setBroadcastMsg('');
      const updatedLogs = await api.getLogs();
      setLogs(updatedLogs);
    } catch {
      showToast('Failed to broadcast message', 'error');
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Force Save
  const handleForceSave = async () => {
    setIsSavingWorld(true);
    try {
      const res = await api.forceSave();
      showToast(res.message || 'World save triggered successfully!', 'success');
      const updatedLogs = await api.getLogs();
      setLogs(updatedLogs);
    } catch {
      showToast('Failed to trigger world save', 'error');
    } finally {
      setIsSavingWorld(false);
    }
  };

  // Test Discord Webhook Shortcut
  const handleTestDiscord = async () => {
    setIsTestingDiscord(true);
    try {
      const res = await api.testDiscordWebhook('server_online');
      if (res.success) {
        showToast('Discord test notification dispatched!', 'success');
      } else {
        showToast(`Discord test: ${res.message}`, 'error');
      }
    } catch {
      showToast('Failed to dispatch Discord test', 'error');
    } finally {
      setIsTestingDiscord(false);
    }
  };

  // Kick Player
  const handleKickPlayer = async (name: string) => {
    try {
      await api.kickPlayer(name);
      setPlayers((prev) => prev.filter((p) => p.name !== name));
      showToast(`Player "${name}" was kicked from the server.`, 'error');
      const updatedLogs = await api.getLogs();
      setLogs(updatedLogs);
    } catch {
      showToast('Failed to kick player', 'error');
    }
  };

  // Confirm Ban
  const handleConfirmBanPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banTargetPlayer) return;

    try {
      await api.banPlayer(banTargetPlayer.name, playerBanReason);
      setPlayers((prev) => prev.filter((p) => p.name !== banTargetPlayer.name));
      const updatedBans = await api.getBans();
      setBannedPlayers(updatedBans);
      showToast(`Player "${banTargetPlayer.name}" banned.`, 'error');
      setBanTargetPlayer(null);
      setPlayerBanReason('Rule violation / Base griefing');
      const updatedLogs = await api.getLogs();
      setLogs(updatedLogs);
    } catch {
      showToast('Failed to ban player', 'error');
    }
  };

  // Manual Ban
  const handleManualBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBanSteamId.trim()) return;

    try {
      await api.banPlayer(manualBanSteamId.trim(), manualBanReason);
      const updatedBans = await api.getBans();
      setBannedPlayers(updatedBans);
      showToast(`Player ID ${manualBanSteamId} added to ban list.`, 'error');
      setShowManualBanModal(false);
      setManualBanSteamId('');
      setManualBanName('');
      setManualBanReason('Banned by Admin');
      const updatedLogs = await api.getLogs();
      setLogs(updatedLogs);
    } catch {
      showToast('Failed to add player to ban list', 'error');
    }
  };

  // Unban
  const handleUnban = async (steamId: string, name: string) => {
    try {
      await api.unbanPlayer(steamId);
      setBannedPlayers((prev) => prev.filter((b) => b.steamId !== steamId));
      showToast(`Unbanned ${name || steamId}.`, 'success');
      const updatedLogs = await api.getLogs();
      setLogs(updatedLogs);
    } catch {
      showToast('Failed to unban player', 'error');
    }
  };

  // Biome badge helper
  const getBiomeBadgeStyle = (biome: string) => {
    switch (biome?.toLowerCase()) {
      case 'meadows':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'blackforest':
      case 'black forest':
        return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
      case 'swamp':
        return 'bg-amber-900/30 text-amber-300 border-amber-600/30';
      case 'mountain':
        return 'bg-sky-500/15 text-sky-200 border-sky-400/30';
      case 'plains':
        return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
      case 'mistlands':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'ashlands':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      case 'ocean':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      default:
        return 'bg-gray-800 text-gray-300 border-gray-700';
    }
  };

  // Filter logs
  const filteredLogs = logs.filter((l) => {
    if (logFilter === 'cmd' && l.level !== 'cmd') return false;
    if (logFilter === 'warn_error' && l.level !== 'warn' && l.level !== 'error') return false;
    if (logFilter === 'events' && l.level !== 'info' && l.level !== 'success') return false;

    if (logSearch.trim()) {
      const q = logSearch.toLowerCase();
      return (
        l.text.toLowerCase().includes(q) ||
        l.source.toLowerCase().includes(q) ||
        l.time.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredBans = bannedPlayers.filter((b) => {
    if (!banSearchTerm.trim()) return true;
    const q = banSearchTerm.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      b.steamId.toLowerCase().includes(q) ||
      b.reason.toLowerCase().includes(q)
    );
  });

  const playerCapacityPercent = Math.min(100, Math.round((telemetry.onlineCount / (telemetry.maxPlayers || 10)) * 100));
  const memoryUtilizationPercent = Math.min(100, Math.round((telemetry.memoryMb / 4096) * 100));

  return (
    <div className="space-y-6 pb-12">
      {/* ── 1. Top Hero Server Status Bar ── */}
      <div className="bg-gray-950/70 backdrop-blur-xl border border-gray-800/80 rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500/20 via-amber-500/10 to-transparent border border-orange-500/30 flex items-center justify-center text-orange-400 shadow-inner">
              <FiServer size={24} />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl font-bold text-gray-100 tracking-tight">Valheim Dedicated Server</h1>
                <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>LIVE & ONLINE</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 mt-1 font-mono">
                <span>Uptime: <strong className="text-gray-200">{telemetry.uptime}</strong></span>
                <span>•</span>
                <span>Game Port: <strong className="text-gray-200">2456</strong></span>
                <span>•</span>
                <span>Portal: <strong className="text-gray-200">v1.1.0</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 self-start lg:self-auto">
            <button
              onClick={handleForceSave}
              disabled={isSavingWorld}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-900/90 hover:bg-gray-800 border border-gray-700/80 hover:border-gray-600 rounded-xl text-xs font-semibold text-gray-200 transition-all shadow-sm disabled:opacity-50"
              title="Trigger World Save to Disk"
            >
              <FiHardDrive className={isSavingWorld ? 'animate-spin text-orange-400' : 'text-blue-400'} size={14} />
              <span>{isSavingWorld ? 'Saving...' : 'Force Save'}</span>
            </button>

            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-orange-500/20 to-amber-500/20 hover:from-orange-500/30 hover:to-amber-500/30 border border-orange-500/30 rounded-xl text-xs font-semibold text-orange-300 transition-all shadow-sm"
              >
                <FiSettings size={14} />
                <span>Settings</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Top Visual Telemetry Gauges (4 Cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiGaugeCard
          icon={FiUsers}
          label="Active Vikings"
          value={telemetry.onlineCount}
          unit={`/ ${telemetry.maxPlayers} slots`}
          progressPercent={playerCapacityPercent}
          progressGradient="from-orange-500 to-amber-400"
          accentColor="orange"
        />

        <KpiGaugeCard
          icon={FiCpu}
          label="Tickrate & FPS"
          value={telemetry.fps.toFixed(1)}
          unit={`FPS (${telemetry.tickRate})`}
          progressPercent={Math.min(100, (telemetry.fps / 60) * 100)}
          progressGradient="from-emerald-500 to-teal-400"
          accentColor="emerald"
        />

        <KpiGaugeCard
          icon={FiActivity}
          label="RAM Footprint"
          value={telemetry.memoryMb.toLocaleString()}
          unit="MB"
          progressPercent={memoryUtilizationPercent}
          progressGradient="from-cyan-500 to-blue-500"
          accentColor="cyan"
        />

        <KpiGaugeCard
          icon={FiServer}
          label="World ZDOs"
          value={telemetry.activeZdos.toLocaleString()}
          unit="Entities"
          progressPercent={Math.min(100, (telemetry.activeZdos / 60000) * 100)}
          progressGradient="from-purple-500 to-indigo-500"
          accentColor="indigo"
        />
      </div>

      {/* ── 3. Middle Split Command Center ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Column 1: Live Viking Player Hub (7 cols) */}
        <div className="lg:col-span-7 bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl shadow-xl flex flex-col overflow-hidden">
          {/* Header with Player Tabs */}
          <div className="px-5 py-4 border-b border-gray-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-900/90">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPlayerTab('online')}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  playerTab === 'online'
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                <FiUsers size={14} />
                <span>Online ({players.length})</span>
              </button>

              <button
                onClick={() => setPlayerTab('banned')}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  playerTab === 'banned'
                    ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                <FiSlash size={14} />
                <span>Banned ({bannedPlayers.length})</span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
              {playerTab === 'banned' && (
                <div className="relative">
                  <FiSearch className="absolute left-3 top-2.5 text-gray-500 text-xs" />
                  <input
                    type="text"
                    placeholder="Filter bans..."
                    value={banSearchTerm}
                    onChange={(e) => setBanSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-gray-950 border border-gray-700/80 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-red-500"
                  />
                </div>
              )}

              <button
                onClick={() => setShowManualBanModal(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg border border-gray-700 text-xs font-semibold transition-all"
                title="Ban Offline Player by Steam ID"
              >
                <FiPlus size={13} />
                <span>Ban ID</span>
              </button>
            </div>
          </div>

          {/* Body: Active Players or Bans */}
          <div className="p-4 flex-1 overflow-y-auto max-h-[380px] custom-scrollbar">
            {playerTab === 'online' ? (
              players.length === 0 ? (
                <div className="py-16 text-center text-gray-500 font-mono text-xs flex flex-col items-center justify-center space-y-2">
                  <FiUsers size={28} className="text-gray-600" />
                  <p>No players currently online.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {players.map((p) => {
                    const isExpanded = expandedPlayerId === p.id;
                    const hpPercent = Math.min(100, Math.max(0, Math.round((p.health / (p.maxHealth || 25)) * 100)));
                    const biomeStyle = getBiomeBadgeStyle(p.zone);

                    return (
                      <div
                        key={p.id}
                        className="bg-gray-950/70 border border-gray-800/90 rounded-xl p-3.5 hover:border-gray-700/80 transition-all shadow-sm space-y-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-gray-800 to-gray-700 flex items-center justify-center text-orange-400 font-bold text-xs shrink-0 border border-gray-700">
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-gray-100 text-sm truncate">{p.name}</span>
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${biomeStyle}`}>
                                  {p.zone}
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-gray-500 truncate">{p.steamId}</div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            {/* Health badge */}
                            <div className="hidden sm:flex flex-col items-end mr-1">
                              <span className="text-xs font-mono font-bold text-red-300">
                                {p.health} / {p.maxHealth} HP
                              </span>
                              <div className="w-20 h-1.5 bg-gray-900 rounded-full mt-1 overflow-hidden border border-gray-800">
                                <div
                                  className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-emerald-400 rounded-full"
                                  style={{ width: `${hpPercent}%` }}
                                />
                              </div>
                            </div>

                            {/* Ping badge */}
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-gray-900 text-emerald-400 border border-gray-800">
                              {p.ping}
                            </span>

                            {/* Actions */}
                            <button
                              onClick={() => handleKickPlayer(p.name)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                              title={`Kick ${p.name}`}
                            >
                              <FiUserMinus size={15} />
                            </button>

                            <button
                              onClick={() => setBanTargetPlayer(p)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title={`Ban ${p.name}`}
                            >
                              <FiSlash size={15} />
                            </button>

                            <button
                              onClick={() => setExpandedPlayerId(isExpanded ? null : p.id)}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 transition-colors"
                              title="Toggle Player Telemetry"
                            >
                              {isExpanded ? <FiChevronUp size={15} /> : <FiChevronDown size={15} />}
                            </button>
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="pt-3 border-t border-gray-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono"
                          >
                            <div className="bg-gray-900/60 p-2 rounded-lg border border-gray-800">
                              <span className="text-gray-500 block text-[10px]">PvP Status</span>
                              <span className={p.pvp ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                                {p.pvp ? '⚔️ Enabled' : '🛡️ Protected'}
                              </span>
                            </div>

                            <div className="bg-gray-900/60 p-2 rounded-lg border border-gray-800">
                              <span className="text-gray-500 block text-[10px]">Days Survived</span>
                              <span className="text-orange-300 font-bold">Day {p.daysSurvived}</span>
                            </div>

                            <div className="bg-gray-900/60 p-2 rounded-lg border border-gray-800 col-span-2">
                              <span className="text-gray-500 block text-[10px]">Coordinates</span>
                              <span className="text-gray-300 truncate block" title={p.pos}>{p.pos}</span>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* Banned Players Tab */
              filteredBans.length === 0 ? (
                <div className="py-16 text-center text-gray-500 font-mono text-xs flex flex-col items-center justify-center space-y-2">
                  <FiShield size={28} className="text-gray-600" />
                  <p>No banned players listed.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredBans.map((b) => (
                    <div
                      key={b.id}
                      className="bg-gray-950/70 border border-gray-800/80 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-gray-200">{b.name || 'Unknown'}</span>
                          <span className="text-[10px] font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 truncate max-w-[150px]">
                            {b.reason}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-gray-500 mt-0.5">
                          {b.steamId} • {b.bannedAt}
                        </div>
                      </div>

                      <button
                        onClick={() => handleUnban(b.steamId, b.name)}
                        className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold transition-all shrink-0"
                      >
                        Unban
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* Column 2: Operations & Discord Webhook Station (5 cols) */}
        <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
          {/* Card A: Quick Global Announcement */}
          <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center space-x-2.5 border-b border-gray-800/80 pb-3">
              <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400">
                <FiRadio size={16} />
              </div>
              <div>
                <h3 className="font-bold text-gray-200 text-sm">Server Announcement</h3>
                <p className="text-[11px] text-gray-400">Broadcast center banner & chat shout to all players</p>
              </div>
            </div>

            <form onSubmit={handleSendBroadcast} className="space-y-2.5">
              <input
                type="text"
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                placeholder="Type global announcement..."
                className="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-orange-500/80"
              />
              <button
                type="submit"
                disabled={isBroadcasting || !broadcastMsg.trim()}
                className="w-full flex items-center justify-center space-x-2 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-orange-500/20 disabled:opacity-50"
              >
                <FiSend size={13} />
                <span>{isBroadcasting ? 'Broadcasting...' : 'Broadcast to Server'}</span>
              </button>
            </form>
          </div>

          {/* Card B: Discord Webhook Bridge Status */}
          <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <FiBell size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-200 text-sm">Discord Bridge</h3>
                  <p className="text-[11px] text-gray-400">Automatic event webhook notifications</p>
                </div>
              </div>

              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${
                  discordConfig?.enabled
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-gray-800 text-gray-400 border-gray-700'
                }`}
              >
                {discordConfig?.enabled ? 'Active' : 'Disabled'}
              </span>
            </div>

            <div className="text-xs text-gray-400 space-y-1">
              <p>
                Bot: <strong className="text-gray-200">{discordConfig?.botUsername || 'Bifrostheim Herald'}</strong>
              </p>
              <p className="text-[11px] text-gray-500 truncate">
                Target: {discordConfig?.webhookUrl ? 'URL configured' : 'No Webhook URL set'}
              </p>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={handleTestDiscord}
                disabled={isTestingDiscord || !discordConfig?.webhookUrl}
                className="flex-1 flex items-center justify-center space-x-1.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-xs font-semibold border border-gray-700 transition-all disabled:opacity-40"
              >
                <FiZap size={13} className="text-amber-400" />
                <span>{isTestingDiscord ? 'Sending...' : 'Test Webhook'}</span>
              </button>

              {onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-semibold transition-all"
                >
                  Configure
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Bottom Full-Width High-Tech Console Terminal ── */}
      <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-800/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden h-[460px]">
        {/* Terminal Header & Filter Controls */}
        <div className="px-5 py-3 border-b border-gray-800/80 bg-gray-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2.5">
            <FiTerminal className="text-orange-400 text-base" />
            <h3 className="font-bold text-gray-200 text-sm">Server Console & BepInEx Logs</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
              {filteredLogs.length} / {logs.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <FiSearch className="absolute left-2.5 top-2 text-gray-500 text-xs" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Search logs..."
                className="pl-7 pr-2.5 py-1 bg-gray-950 border border-gray-700/80 rounded-lg text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-orange-500 w-36 sm:w-48"
              />
            </div>

            {/* Category Filters */}
            <div className="flex items-center space-x-1 bg-gray-950 p-0.5 rounded-lg border border-gray-800 text-[11px] font-mono">
              <button
                onClick={() => setLogFilter('all')}
                className={`px-2 py-0.5 rounded ${logFilter === 'all' ? 'bg-gray-800 text-white font-bold' : 'text-gray-400 hover:text-gray-200'}`}
              >
                All
              </button>
              <button
                onClick={() => setLogFilter('cmd')}
                className={`px-2 py-0.5 rounded ${logFilter === 'cmd' ? 'bg-orange-500/20 text-orange-300 font-bold' : 'text-gray-400 hover:text-gray-200'}`}
              >
                Cmds
              </button>
              <button
                onClick={() => setLogFilter('warn_error')}
                className={`px-2 py-0.5 rounded ${logFilter === 'warn_error' ? 'bg-red-500/20 text-red-300 font-bold' : 'text-gray-400 hover:text-gray-200'}`}
              >
                Alerts
              </button>
              <button
                onClick={() => setLogFilter('events')}
                className={`px-2 py-0.5 rounded ${logFilter === 'events' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-gray-400 hover:text-gray-200'}`}
              >
                Events
              </button>
            </div>

            {/* Auto-scroll Toggle */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                autoScroll
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-gray-800 text-gray-400 border-gray-700'
              }`}
              title="Toggle automatic lock to bottom on new log arrival"
            >
              <FiLock size={11} />
              <span>Scroll: {autoScroll ? 'ON' : 'OFF'}</span>
            </button>

            {/* Clear Button */}
            <button
              onClick={() => setLogs([])}
              className="text-xs text-gray-400 hover:text-gray-200 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 font-mono transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Terminal Log Container */}
        <div
          ref={logContainerRef}
          onScroll={handleLogScroll}
          className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-1.5 bg-gray-950/95 relative custom-scrollbar select-text"
        >
          {filteredLogs.length === 0 ? (
            <div className="py-20 text-center text-gray-600 font-mono text-xs">
              No log messages match the current filter.
            </div>
          ) : (
            filteredLogs.map((l, i) => (
              <div key={i} className="flex items-start space-x-2 leading-relaxed">
                <span className="text-gray-500 select-none shrink-0">[{l.time}]</span>
                <span
                  className={`font-semibold shrink-0 ${
                    l.level === 'success'
                      ? 'text-emerald-400'
                      : l.level === 'cmd'
                      ? 'text-orange-400'
                      : l.level === 'warn'
                      ? 'text-amber-400'
                      : l.level === 'error'
                      ? 'text-red-400'
                      : 'text-blue-400'
                  }`}
                >
                  [{l.source}]
                </span>
                <span
                  className={
                    l.level === 'cmd'
                      ? 'text-orange-200 font-semibold break-all'
                      : l.level === 'error'
                      ? 'text-red-300 break-all'
                      : 'text-gray-300 break-all'
                  }
                >
                  {l.text}
                </span>
              </div>
            ))
          )}
          <div ref={logEndRef} />

          {/* Floating Jump to Latest Button */}
          {!isAtBottom && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={scrollToBottom}
              className="sticky bottom-3 float-right flex items-center space-x-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-xs font-bold font-mono shadow-xl transition-all z-20"
            >
              <FiArrowDown size={13} />
              <span>Jump to Latest {unreadLogsCount > 0 && `(${unreadLogsCount} new)`}</span>
            </motion.button>
          )}
        </div>

        {/* Command Runner Form */}
        <form onSubmit={handleExecuteCmd} className="p-3 border-t border-gray-800/80 bg-gray-900/90 flex space-x-2 shrink-0">
          <input
            type="text"
            value={cmdInput}
            onChange={(e) => setCmdInput(e.target.value)}
            placeholder="Type server command (e.g. save, event wolves, heal, pos, kick Name)..."
            className="flex-1 bg-gray-950 border border-gray-700/80 rounded-xl px-4 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-orange-500/80 focus:ring-1 focus:ring-orange-500/50 transition-all placeholder:text-gray-600"
          />
          <button
            type="submit"
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-5 py-2 rounded-xl font-bold text-xs transition-all shadow-md shadow-orange-500/20 shrink-0"
          >
            Execute
          </button>
        </form>
      </div>

      {/* ── Modals ── */}
      {/* Ban Target Player Modal */}
      {banTargetPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-red-400 flex items-center space-x-2">
              <FiAlertTriangle />
              <span>Ban Player: {banTargetPlayer.name}</span>
            </h3>
            <p className="text-xs text-gray-400">
              This will immediately disconnect the player and permanently add their Steam ID ({banTargetPlayer.steamId}) to the server ban list.
            </p>
            <form onSubmit={handleConfirmBanPlayer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Reason for Ban</label>
                <input
                  type="text"
                  value={playerBanReason}
                  onChange={(e) => setPlayerBanReason(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-red-500"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBanTargetPlayer(null)}
                  className="px-4 py-2 text-xs text-gray-400 hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs shadow-lg shadow-red-600/20"
                >
                  Confirm Ban
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Ban Offline Player Modal */}
      {showManualBanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-gray-100 flex items-center space-x-2">
              <FiSlash className="text-red-400" />
              <span>Ban Player by Steam ID</span>
            </h3>
            <form onSubmit={handleManualBan} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-300 mb-1">Steam ID / Platform ID *</label>
                <input
                  type="text"
                  value={manualBanSteamId}
                  onChange={(e) => setManualBanSteamId(e.target.value)}
                  placeholder="76561198000000000"
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-200 font-mono focus:outline-none focus:border-red-500"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-300 mb-1">Alias / Character Name</label>
                <input
                  type="text"
                  value={manualBanName}
                  onChange={(e) => setManualBanName(e.target.value)}
                  placeholder="Optional player name"
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-300 mb-1">Ban Reason</label>
                <input
                  type="text"
                  value={manualBanReason}
                  onChange={(e) => setManualBanReason(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowManualBanModal(false)}
                  className="px-4 py-2 text-xs text-gray-400 hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs shadow-lg shadow-red-600/20"
                >
                  Add to Ban List
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

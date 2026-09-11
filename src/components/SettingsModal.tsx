import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX,
  FiSettings,
  FiBell,
  FiServer,
  FiCheck,
  FiAlertCircle,
  FiLoader,
  FiUserCheck,
  FiUserMinus,
  FiActivity,
  FiClock,
  FiAward,
  FiShield,
  FiMessageSquare,
  FiCompass,
  FiZap,
  FiSun,
  FiChevronDown,
  FiChevronUp,
  FiSave,
} from 'react-icons/fi';
import { GiVikingHelmet, GiBroadsword, GiSkullCrossedBones, GiDragonHead } from 'react-icons/gi';
import { useToast } from '../context/ToastContext';
import { api, type DiscordConfig, type LifecycleConfig, type DailyRestartInfo } from '../api/client';
import SettingsCard from './ui/SettingsCard';
import SettingRow from './ui/SettingRow';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

type SettingsTab = 'discord' | 'server';

interface EventTestItem {
  type: string;
  name: string;
  desc: string;
  icon: React.ReactNode;
  category: 'lifecycle' | 'combat' | 'world' | 'admin' | 'chat';
  badgeColor: string;
}

const TEST_EVENTS: EventTestItem[] = [
  {
    type: 'join',
    name: 'Player Joined',
    desc: 'Ragnar entered the 10th world',
    icon: <FiUserCheck className="text-emerald-400" />,
    category: 'lifecycle',
    badgeColor: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10',
  },
  {
    type: 'leave',
    name: 'Player Left',
    desc: 'Lagertha departed after 1h 42m',
    icon: <FiUserMinus className="text-sky-400" />,
    category: 'lifecycle',
    badgeColor: 'border-sky-500/30 text-sky-300 bg-sky-500/10',
  },
  {
    type: 'server_online',
    name: 'Server Online',
    desc: 'Dedicated server ready on port 2456',
    icon: <FiActivity className="text-emerald-400" />,
    category: 'lifecycle',
    badgeColor: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10',
  },
  {
    type: 'server_restart',
    name: 'Restart Warning',
    desc: 'Server restart in 5 minutes',
    icon: <FiClock className="text-amber-400" />,
    category: 'lifecycle',
    badgeColor: 'border-amber-500/30 text-amber-300 bg-amber-500/10',
  },
  {
    type: 'death_generic',
    name: 'Generic Death',
    desc: 'Bjorn met end in Swamp',
    icon: <GiSkullCrossedBones className="text-red-400" />,
    category: 'combat',
    badgeColor: 'border-red-500/30 text-red-300 bg-red-500/10',
  },
  {
    type: 'death_skald',
    name: 'Skald Lore Death',
    desc: 'Crushed by 2-Star Troll in Black Forest',
    icon: <GiVikingHelmet className="text-rose-400" />,
    category: 'combat',
    badgeColor: 'border-rose-500/30 text-rose-300 bg-rose-500/10',
  },
  {
    type: 'pvp',
    name: 'PvP Duel Slaying',
    desc: 'Ragnar vanquished Ivar in Plains',
    icon: <GiBroadsword className="text-red-400" />,
    category: 'combat',
    badgeColor: 'border-red-500/30 text-red-300 bg-red-500/10',
  },
  {
    type: 'boss_summon',
    name: 'Boss Summoned',
    desc: 'Moder awakened in Mountain',
    icon: <GiDragonHead className="text-amber-400" />,
    category: 'world',
    badgeColor: 'border-amber-500/30 text-amber-300 bg-amber-500/10',
  },
  {
    type: 'boss_defeat',
    name: 'Boss Defeated',
    desc: 'Moder slain by brave Vikings',
    icon: <FiAward className="text-yellow-400" />,
    category: 'world',
    badgeColor: 'border-yellow-500/30 text-yellow-300 bg-yellow-500/10',
  },
  {
    type: 'raid_start',
    name: 'Raid Started',
    desc: '"The ground is shaking" in Black Forest',
    icon: <FiZap className="text-orange-400" />,
    category: 'world',
    badgeColor: 'border-orange-500/30 text-orange-300 bg-orange-500/10',
  },
  {
    type: 'raid_end',
    name: 'Raid Ended',
    desc: 'Tremors subside, raid repelled',
    icon: <FiSun className="text-sky-400" />,
    category: 'world',
    badgeColor: 'border-sky-500/30 text-sky-300 bg-sky-500/10',
  },
  {
    type: 'admin_kick',
    name: 'Admin Kick / Ban',
    desc: 'Player punished by Moderator',
    icon: <FiShield className="text-purple-400" />,
    category: 'admin',
    badgeColor: 'border-purple-500/30 text-purple-300 bg-purple-500/10',
  },
  {
    type: 'shout',
    name: 'In-Game Shout',
    desc: '"To the longships! Serpents approach!"',
    icon: <FiMessageSquare className="text-slate-400" />,
    category: 'chat',
    badgeColor: 'border-slate-500/30 text-slate-300 bg-slate-500/10',
  },
];

export default function SettingsModal({ isOpen, onClose, onSaved }: SettingsModalProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>('discord');

  // Discord Config State
  const [discordConfig, setDiscordConfig] = useState<DiscordConfig>({
    enabled: false,
    webhookUrl: '',
    overrideChatWebhookUrl: '',
    overrideAdminWebhookUrl: '',
    botUsername: 'Bifrostheim Herald',
    botAvatarUrl: '',
    useRichEmbeds: true,
    notifyPlayerJoin: true,
    notifyPlayerLeave: true,
    notifyPlayerDeath: true,
    notifyServerLifecycle: true,
    notifyWorldEvents: true,
    notifyBossMilestones: true,
    notifyAdminActions: true,
    notifyChatShouts: false,
  });

  // Server Ops State
  const [lifecycleConfig, setLifecycleConfig] = useState<LifecycleConfig>({
    mode: 'ExitOnly',
    scriptPath: './start_server.sh',
  });
  const [dailyRestart, setDailyRestart] = useState<DailyRestartInfo>({
    enabled: false,
    time: '04:00',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showOverrides, setShowOverrides] = useState(false);

  // Per-event test dispatch status tracker: { [eventType]: 'loading' | 'success' | 'error' }
  const [testStatuses, setTestStatuses] = useState<Record<string, 'loading' | 'success' | 'error'>>({});
  const [testErrorMessages, setTestErrorMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const [dc, restartStatus] = await Promise.all([
        api.getDiscordConfig(),
        api.getRestartStatus().catch(() => null),
      ]);
      setDiscordConfig(dc);
      if (restartStatus) {
        if (restartStatus.lifecycleConfig) setLifecycleConfig(restartStatus.lifecycleConfig);
        if (restartStatus.dailyRestart) setDailyRestart(restartStatus.dailyRestart);
      }
    } catch {
      showToast('Failed to load server settings', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDiscord = async () => {
    try {
      setIsSaving(true);
      const res = await api.saveDiscordConfig(discordConfig);
      setDiscordConfig(res.config);
      if (!res.config.enabled) {
        showToast('Settings saved! Note: Discord Notifications switch is currently Disabled.', 'info');
      } else {
        showToast('Discord webhook configuration saved and Active!', 'success');
      }
      onSaved?.();
    } catch {
      showToast('Failed to save Discord webhook settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveServer = async () => {
    try {
      setIsSaving(true);
      await Promise.all([
        api.saveLifecycleConfig(lifecycleConfig),
        api.updateDailyRestart(dailyRestart.enabled, dailyRestart.time),
      ]);
      showToast('Server lifecycle settings saved!', 'success');
      onSaved?.();
    } catch {
      showToast('Failed to save server settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerTest = async (eventType: string) => {
    const url = discordConfig.webhookUrl?.trim();
    if (!url) {
      showToast('Please enter a Discord Webhook URL first.', 'info');
      return;
    }

    setTestStatuses((prev) => ({ ...prev, [eventType]: 'loading' }));
    setTestErrorMessages((prev) => ({ ...prev, [eventType]: '' }));

    try {
      const res = await api.testDiscordWebhook(eventType, url);
      if (res.success) {
        setTestStatuses((prev) => ({ ...prev, [eventType]: 'success' }));
        showToast(`Test '${eventType}' delivered to Discord!`, 'success');
        setTimeout(() => {
          setTestStatuses((prev) => {
            const next = { ...prev };
            delete next[eventType];
            return next;
          });
        }, 4000);
      } else {
        setTestStatuses((prev) => ({ ...prev, [eventType]: 'error' }));
        setTestErrorMessages((prev) => ({ ...prev, [eventType]: res.message }));
        showToast(`Test failed: ${res.message}`, 'error');
      }
    } catch (err: any) {
      setTestStatuses((prev) => ({ ...prev, [eventType]: 'error' }));
      const msg = err?.message || 'Connection error';
      setTestErrorMessages((prev) => ({ ...prev, [eventType]: msg }));
      showToast(`Test failed: ${msg}`, 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', duration: 0.3, bounce: 0.15 }}
          className="relative w-full max-w-4xl bg-gray-950/95 border border-gray-800/90 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800/80 bg-gray-900/40 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shadow-inner">
                <FiSettings size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-100 flex items-center space-x-2">
                  <span>Server & Webhook Settings</span>
                </h2>
                <p className="text-xs text-gray-400">
                  Configure Discord alerts, live webhooks, and core Bifrostheim server settings
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-gray-800/80 transition-colors"
              title="Close"
            >
              <FiX size={20} />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center space-x-2 px-6 pt-4 border-b border-gray-800/60 bg-gray-950/40 shrink-0">
            <button
              onClick={() => setActiveTab('discord')}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
                activeTab === 'discord'
                  ? 'border-orange-500 text-orange-400 bg-orange-500/10'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-900/50'
              }`}
            >
              <FiBell size={15} />
              <span>Discord Webhooks</span>
              {discordConfig.enabled && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 ml-1.5 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('server')}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
                activeTab === 'server'
                  ? 'border-orange-500 text-orange-400 bg-orange-500/10'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-900/50'
              }`}
            >
              <FiServer size={15} />
              <span>Server Lifecycle</span>
            </button>
          </div>

          {/* Modal Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {isLoading ? (
              <div className="py-16 flex flex-col items-center justify-center space-y-3 text-gray-400">
                <FiLoader className="animate-spin text-orange-400" size={32} />
                <p className="text-xs">Loading settings from dedicated server...</p>
              </div>
            ) : activeTab === 'discord' ? (
              <>
                {/* Master Switch Card */}
                <SettingsCard
                  title="Discord Webhook Integration"
                  subtitle="Broadcast server telemetry, player combat, and Viking milestones directly to Discord"
                  icon={FiBell}
                  accentColor="orange"
                  badge={
                    <span
                      className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border ${
                        discordConfig.enabled
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-gray-800 text-gray-400 border-gray-700'
                      }`}
                    >
                      {discordConfig.enabled ? 'Active' : 'Disabled (Default)'}
                    </span>
                  }
                >
                  <SettingRow
                    label="Enable Discord Notifications"
                    description="Opt-in to automated webhook dispatching for Valheim server events."
                    checked={discordConfig.enabled}
                    onChange={(checked) => setDiscordConfig((prev) => ({ ...prev, enabled: checked }))}
                    accentColor="emerald"
                  />
                </SettingsCard>

                {/* Webhook URLs Card */}
                <SettingsCard
                  title="Webhook Routing & Endpoints"
                  subtitle="Paste your Discord channel webhook URL(s)"
                  icon={FiCompass}
                  accentColor="cyan"
                >
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                        Primary Webhook URL <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="password"
                        value={discordConfig.webhookUrl}
                        onChange={(e) => setDiscordConfig((prev) => ({ ...prev, webhookUrl: e.target.value }))}
                        placeholder="https://discord.com/api/webhooks/1234567890/abcdef..."
                        className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-orange-500/60 transition-colors"
                      />
                      <p className="text-[11px] text-gray-500 mt-1">
                        All enabled notifications will be dispatched here unless an override URL is specified below.
                      </p>
                    </div>

                    {/* Collapsible Override URLs */}
                    <div className="border border-gray-800/80 rounded-xl p-3 bg-gray-950/40">
                      <button
                        type="button"
                        onClick={() => setShowOverrides(!showOverrides)}
                        className="w-full flex items-center justify-between text-xs font-semibold text-gray-400 hover:text-gray-200 transition-colors"
                      >
                        <span className="flex items-center space-x-2">
                          <span>Dedicated Channel Overrides (Optional)</span>
                          {(discordConfig.overrideChatWebhookUrl || discordConfig.overrideAdminWebhookUrl) && (
                            <span className="w-2 h-2 rounded-full bg-cyan-400" />
                          )}
                        </span>
                        {showOverrides ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                      </button>

                      {showOverrides && (
                        <div className="mt-3 space-y-3 pt-3 border-t border-gray-800/60">
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                              Chat / Shout Relay Channel URL
                            </label>
                            <input
                              type="password"
                              value={discordConfig.overrideChatWebhookUrl}
                              onChange={(e) =>
                                setDiscordConfig((prev) => ({ ...prev, overrideChatWebhookUrl: e.target.value }))
                              }
                              placeholder="Optional dedicated webhook for /s shouts"
                              className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500/60 transition-colors"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                              Admin Actions & Punishment Channel URL
                            </label>
                            <input
                              type="password"
                              value={discordConfig.overrideAdminWebhookUrl}
                              onChange={(e) =>
                                setDiscordConfig((prev) => ({ ...prev, overrideAdminWebhookUrl: e.target.value }))
                              }
                              placeholder="Optional dedicated webhook for kick/ban alerts"
                              className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500/60 transition-colors"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </SettingsCard>

                {/* Bot Profile & Format Card */}
                <SettingsCard
                  title="Bot Profile & Appearance"
                  subtitle="Customize how notifications present in Discord channels"
                  icon={GiVikingHelmet}
                  accentColor="amber"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                        Bot Display Name
                      </label>
                      <input
                        type="text"
                        value={discordConfig.botUsername}
                        onChange={(e) => setDiscordConfig((prev) => ({ ...prev, botUsername: e.target.value }))}
                        placeholder="Bifrostheim Herald"
                        className="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-orange-500/60"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                        Bot Avatar Image URL (Optional)
                      </label>
                      <input
                        type="text"
                        value={discordConfig.botAvatarUrl}
                        onChange={(e) => setDiscordConfig((prev) => ({ ...prev, botAvatarUrl: e.target.value }))}
                        placeholder="https://example.com/avatar.png"
                        className="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-orange-500/60"
                      />
                    </div>
                  </div>

                  <SettingRow
                    label="Use Rich Discord Embeds"
                    description="When enabled, messages feature Viking-themed colored sidebar cards, fields, and timestamps. Set to false for minimalist plain text."
                    checked={discordConfig.useRichEmbeds}
                    onChange={(checked) => setDiscordConfig((prev) => ({ ...prev, useRichEmbeds: checked }))}
                    accentColor="amber"
                  />
                </SettingsCard>

                {/* Subscribed Events Card */}
                <SettingsCard
                  title="Subscribed Event Categories"
                  subtitle="Select which server events trigger a Discord notification"
                  icon={FiShield}
                  accentColor="emerald"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SettingRow
                      label="Player Joins"
                      description="Viking arrived in the 10th realm"
                      checked={discordConfig.notifyPlayerJoin}
                      onChange={(c) => setDiscordConfig((prev) => ({ ...prev, notifyPlayerJoin: c }))}
                      accentColor="emerald"
                    />

                    <SettingRow
                      label="Player Leaves"
                      description="Viking departed with play session duration"
                      checked={discordConfig.notifyPlayerLeave}
                      onChange={(c) => setDiscordConfig((prev) => ({ ...prev, notifyPlayerLeave: c }))}
                      accentColor="cyan"
                    />

                    <SettingRow
                      label="Player Deaths & PvP"
                      description="Fallen warriors with biome & Skald lore"
                      checked={discordConfig.notifyPlayerDeath}
                      onChange={(c) => setDiscordConfig((prev) => ({ ...prev, notifyPlayerDeath: c }))}
                      accentColor="red"
                    />

                    <SettingRow
                      label="Server Lifecycle"
                      description="Online status & restart countdown warnings"
                      checked={discordConfig.notifyServerLifecycle}
                      onChange={(c) => setDiscordConfig((prev) => ({ ...prev, notifyServerLifecycle: c }))}
                      accentColor="orange"
                    />

                    <SettingRow
                      label="World Raids & Invasions"
                      description="Announces raid starts and conclusions"
                      checked={discordConfig.notifyWorldEvents}
                      onChange={(c) => setDiscordConfig((prev) => ({ ...prev, notifyWorldEvents: c }))}
                      accentColor="amber"
                    />

                    <SettingRow
                      label="Boss Milestones"
                      description="Forsaken boss summons and triumphs"
                      checked={discordConfig.notifyBossMilestones}
                      onChange={(c) => setDiscordConfig((prev) => ({ ...prev, notifyBossMilestones: c }))}
                      accentColor="amber"
                    />

                    <SettingRow
                      label="Admin Punishments"
                      description="Moderator kicks and bans"
                      checked={discordConfig.notifyAdminActions}
                      onChange={(c) => setDiscordConfig((prev) => ({ ...prev, notifyAdminActions: c }))}
                      accentColor="indigo"
                    />

                    <SettingRow
                      label="Chat Shouts Relay"
                      description="Relays in-game /s shout broadcasts to Discord"
                      checked={discordConfig.notifyChatShouts}
                      onChange={(c) => setDiscordConfig((prev) => ({ ...prev, notifyChatShouts: c }))}
                      accentColor="orange"
                    />
                  </div>
                </SettingsCard>

                {/* Interactive Event Test Station */}
                <div className="bg-gray-900/70 border border-orange-500/20 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 rounded-lg bg-orange-500/15 text-orange-400">
                        <FiZap size={18} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-100 text-sm">Interactive Event Test Station</h3>
                        <p className="text-xs text-gray-400">
                          Click any event below to send a live mock notification to your Discord channel and preview its look.
                        </p>
                      </div>
                    </div>
                  </div>

                  {!discordConfig.enabled && (
                    <div className="flex items-start space-x-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                      <FiAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                      <div>
                        <span className="font-semibold text-amber-200">Discord Integration is currently Disabled:</span> Real in-game server events will <strong>not</strong> be posted to Discord until you toggle <em>"Enable Discord Notifications"</em> ON above and click <em>"Save Discord Settings"</em> below. (Test buttons below will still send immediate test payloads so you can verify URL connectivity).
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {TEST_EVENTS.map((event) => {
                      const status = testStatuses[event.type];
                      const errorMsg = testErrorMessages[event.type];

                      return (
                        <button
                          key={event.type}
                          type="button"
                          disabled={status === 'loading'}
                          onClick={() => handleTriggerTest(event.type)}
                          className={`flex flex-col p-3 rounded-xl border text-left transition-all relative overflow-hidden group ${
                            status === 'success'
                              ? 'bg-emerald-950/30 border-emerald-500/40'
                              : status === 'error'
                              ? 'bg-red-950/30 border-red-500/40'
                              : 'bg-gray-950/60 border-gray-800/80 hover:border-gray-700 hover:bg-gray-900/80'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center space-x-2">
                              <span className="text-base">{event.icon}</span>
                              <span className="text-xs font-semibold text-gray-200 group-hover:text-white transition-colors">
                                {event.name}
                              </span>
                            </div>

                            {/* Status Indicator */}
                            {status === 'loading' ? (
                              <FiLoader className="animate-spin text-orange-400" size={14} />
                            ) : status === 'success' ? (
                              <span className="flex items-center space-x-1 text-[10px] font-mono text-emerald-400 font-bold">
                                <FiCheck size={12} />
                                <span>Delivered</span>
                              </span>
                            ) : status === 'error' ? (
                              <span className="flex items-center space-x-1 text-[10px] font-mono text-red-400 font-bold" title={errorMsg}>
                                <FiAlertCircle size={12} />
                                <span>Failed</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-gray-500 group-hover:text-orange-400 transition-colors">
                                Test →
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-gray-400 line-clamp-1">{event.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              /* Server & Lifecycle Tab */
              <div className="space-y-6">
                <SettingsCard
                  title="Server Process Restart Strategy"
                  subtitle="Configure how Bigfrost triggers automated or remote restarts"
                  icon={FiServer}
                  accentColor="cyan"
                >
                  <div className="space-y-4">
                    <SettingRow
                      label="Restart Execution Mode"
                      description="ExitOnly cleanly exits the dedicated server process (best for Docker/systemd supervisors). SpawnProcess launches a custom script."
                      accentColor="cyan"
                    >
                      <select
                        value={lifecycleConfig.mode}
                        onChange={(e) =>
                          setLifecycleConfig((prev) => ({
                            ...prev,
                            mode: e.target.value as 'ExitOnly' | 'SpawnProcess',
                          }))
                        }
                        className="bg-gray-900 border border-gray-700 text-xs text-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="ExitOnly">ExitOnly (Clean Exit)</option>
                        <option value="SpawnProcess">SpawnProcess (Execute Script)</option>
                      </select>
                    </SettingRow>

                    {lifecycleConfig.mode === 'SpawnProcess' && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                          Restart Script Path
                        </label>
                        <input
                          type="text"
                          value={lifecycleConfig.scriptPath}
                          onChange={(e) =>
                            setLifecycleConfig((prev) => ({ ...prev, scriptPath: e.target.value }))
                          }
                          placeholder="./start_server.sh"
                          className="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs font-mono text-gray-200"
                        />
                      </div>
                    )}
                  </div>
                </SettingsCard>

                <SettingsCard
                  title="Automated Daily Maintenance Restart"
                  subtitle="Schedule a recurring daily restart countdown with player alerts"
                  icon={FiClock}
                  accentColor="orange"
                >
                  <SettingRow
                    label="Enable Daily Restart"
                    description="Automatically triggers a 5-minute countdown and server reboot at a fixed time each day."
                    checked={dailyRestart.enabled}
                    onChange={(checked) => setDailyRestart((prev) => ({ ...prev, enabled: checked }))}
                    accentColor="orange"
                  />

                  {dailyRestart.enabled && (
                    <div className="pt-2">
                      <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                        Restart Time (24h Format HH:mm)
                      </label>
                      <input
                        type="time"
                        value={dailyRestart.time}
                        onChange={(e) => setDailyRestart((prev) => ({ ...prev, time: e.target.value }))}
                        className="px-4 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs font-mono text-gray-200"
                      />
                    </div>
                  )}
                </SettingsCard>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800/80 bg-gray-900/40 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors"
            >
              Close
            </button>

            <button
              onClick={activeTab === 'discord' ? handleSaveDiscord : handleSaveServer}
              disabled={isSaving}
              className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <FiLoader className="animate-spin" size={14} />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <FiSave size={14} />
                  <span>Save Configuration</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

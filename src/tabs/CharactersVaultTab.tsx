import { useState, useEffect, useMemo } from 'react';
import {
  FiTrash2,
  FiAlertTriangle,
  FiSearch,
  FiUserCheck,
  FiKey,
  FiLink,
  FiShield,
  FiExternalLink,
  FiClock,
  FiActivity,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../context/ToastContext';
import { api, type CharacterBinding, type PlayerInfo } from '../api/client';
import { useTabMode } from '../hooks/useTabMode';
import ModHeader from '../components/ui/ModHeader';
import KpiGaugeCard from '../components/ui/KpiGaugeCard';
import SettingsCard from '../components/ui/SettingsCard';

export default function CharactersVaultTab() {
  const { showToast } = useToast();
  const [mode, setMode] = useTabMode('charvault');

  const [bindings, setBindings] = useState<CharacterBinding[]>([]);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [unbindTarget, setUnbindTarget] = useState<{ steamId: string; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBindings = async () => {
    try {
      setIsLoading(true);
      const [bindingsData, playersData] = await Promise.all([
        api.getCharacterBindings(),
        api.getPlayers().catch(() => []),
      ]);
      setBindings(bindingsData);
      setPlayers(playersData);
    } catch {
      showToast('Failed to load character vault bindings', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBindings();
  }, []);

  const onlineSteamIds = useMemo(
    () => new Set(players.map((p) => p.steamId?.replace(/^Steam_/i, ''))),
    [players]
  );
  const onlineNames = useMemo(
    () => new Set(players.map((p) => p.name?.toLowerCase())),
    [players]
  );

  const currentlyOnlineCount = useMemo(() => {
    return bindings.filter((b) => {
      const normId = b.steamId?.replace(/^Steam_/i, '');
      const charName =
        typeof b.characterName === 'string'
          ? b.characterName.toLowerCase()
          : typeof b.characterName === 'object' && b.characterName !== null
          ? (b.characterName as any).characterName?.toLowerCase() || ''
          : '';
      return (
        (normId && onlineSteamIds.has(normId)) ||
        (charName && onlineNames.has(charName))
      );
    }).length;
  }, [bindings, onlineSteamIds, onlineNames]);

  const filteredBindings = bindings.filter((b) => {
    const charName =
      typeof b.characterName === 'string'
        ? b.characterName
        : typeof b.characterName === 'object' && b.characterName !== null
        ? (b.characterName as any).characterName || ''
        : '';
    const steamId = typeof b.steamId === 'string' ? b.steamId : '';
    const q = searchTerm.toLowerCase();
    return charName.toLowerCase().includes(q) || steamId.toLowerCase().includes(q);
  });

  const handleUnbind = async (steamId: string, name: string) => {
    try {
      const displayName = typeof name === 'string' && name ? name : 'Character';
      await api.unbindCharacter(steamId, displayName);
      setBindings((prev) => prev.filter((b) => b.steamId !== steamId));
      setUnbindTarget(null);
      showToast(`Unbound character "${displayName}" from SteamID ${steamId}.`, 'info');
    } catch {
      showToast('Failed to unbind character', 'error');
    }
  };

  const handleWipeAll = async () => {
    try {
      const res = await api.wipeCharacters();
      setBindings([]);
      setShowWipeConfirm(false);
      showToast(res.message, 'error');
    } catch {
      showToast('Failed to wipe character bindings', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── 1. Top Hero Header ── */}
      <ModHeader
        icon={FiKey}
        title="Characters Vault Enforcements"
        mode={mode}
        onModeChange={setMode}
        tabId="charvault"
        accentColor="emerald"
        onRefresh={fetchBindings}
        isRefreshing={isLoading}
      />

      {/* ── 2. Top Visual Telemetry Gauges ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiGaugeCard
          icon={FiLink}
          label="Total Bound Characters"
          value={bindings.length}
          unit="Profiles"
          accentColor="emerald"
        />

        <KpiGaugeCard
          icon={FiUserCheck}
          label="Currently Online"
          value={currentlyOnlineCount}
          unit={currentlyOnlineCount === 1 ? 'Warrior' : 'Warriors'}
          progressPercent={
            bindings.length > 0
              ? Math.min(100, Math.round((currentlyOnlineCount / bindings.length) * 100))
              : 0
          }
          progressGradient="from-emerald-500 to-cyan-400"
          accentColor="emerald"
        />
      </div>

      {/* ── 3. Advanced Mode: Danger Zone & Diagnostics ── */}
      <AnimatePresence>
        {mode === 'advanced' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <SettingsCard
              title="Vault Administration & Emergency Operations"
              subtitle="Perform emergency vault wipes and inspection tasks"
              icon={FiShield}
              accentColor="emerald"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-950/70 border border-gray-800 rounded-xl">
                  <span className="text-xs text-gray-400 font-mono block">Enforcement Hook</span>
                  <span className="text-sm font-bold text-gray-100 block mt-1">ZNet.RPC_CharacterID</span>
                  <span className="text-[11px] text-gray-500 block mt-0.5">Intercepts on character join</span>
                </div>

                <div className="p-4 bg-gray-950/70 border border-gray-800 rounded-xl">
                  <span className="text-xs text-gray-400 font-mono block">Database Storage</span>
                  <span className="text-sm font-bold text-gray-100 block mt-1">BepInEx/config/CharactersVault/</span>
                  <span className="text-[11px] text-gray-500 block mt-0.5">Local JSON identity ledger</span>
                </div>

                <div className="p-4 bg-red-950/20 border border-red-900/40 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs text-red-400 font-bold block">Danger Zone</span>
                    <span className="text-[11px] text-gray-400 block mt-0.5">Irreversible vault purge</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWipeConfirm(true)}
                    disabled={bindings.length === 0}
                    className="px-3.5 py-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 font-semibold rounded-xl text-xs transition-all shadow-md shadow-red-950/50 disabled:opacity-40"
                  >
                    <FiTrash2 className="inline mr-1.5" size={13} />
                    Wipe Vault
                  </button>
                </div>
              </div>
            </SettingsCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 4. Main Character Bindings List ── */}
      <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl shadow-xl flex flex-col overflow-hidden">
        {/* Toolbar Header */}
        <div className="p-4 sm:p-5 border-b border-gray-800/80 bg-gray-900/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FiUserCheck size={16} />
            </div>
            <div>
              <h3 className="font-bold text-gray-100 text-sm">Enforced Character Bindings</h3>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative w-full sm:w-72">
              <FiSearch className="absolute left-3 top-2.5 text-gray-500 text-xs" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search character or SteamID..."
                className="w-full bg-gray-950 border border-gray-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <span className="text-[11px] font-mono text-gray-400 px-2.5 py-1 rounded-lg bg-gray-950 border border-gray-800 shrink-0">
              {filteredBindings.length} / {bindings.length}
            </span>
          </div>
        </div>

        {/* Bindings List View */}
        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto max-h-[580px] custom-scrollbar">
          {isLoading ? (
            <div className="py-20 text-center text-gray-500 font-mono text-xs flex flex-col items-center justify-center space-y-2">
              <FiActivity size={28} className="text-emerald-500/50 animate-pulse" />
              <p>Loading Character Vault records from server...</p>
            </div>
          ) : filteredBindings.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center space-y-3 bg-gray-950/40 border border-dashed border-gray-800 rounded-2xl p-8">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <FiKey size={22} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-gray-200">
                  {bindings.length === 0
                    ? 'No Bound Characters Yet'
                    : `No bindings match "${searchTerm}"`}
                </h4>
                <p className="text-xs text-gray-400 max-w-sm font-sans">
                  {bindings.length === 0
                    ? 'Character identities will automatically pair with player SteamIDs when they connect to the server.'
                    : 'Try searching with a different character name or Steam64 ID.'}
                </p>
              </div>
            </div>
          ) : (
            filteredBindings.map((b) => {
              const displayName =
                typeof b.characterName === 'string' && b.characterName.trim().length > 0
                  ? b.characterName
                  : typeof b.characterName === 'object' && b.characterName !== null
                  ? (b.characterName as any).characterName ||
                    (b.characterName as any).name ||
                    'Unknown'
                  : String(b.characterName || 'Unknown');

              const numericSteamId = b.steamId.replace(/^Steam_/i, '');
              const steamUrl = `https://steamcommunity.com/profiles/${numericSteamId}`;

              const isOnline =
                onlineSteamIds.has(numericSteamId) ||
                onlineNames.has(displayName.toLowerCase()) ||
                (b.lastLogin &&
                  typeof b.lastLogin === 'string' &&
                  b.lastLogin.toLowerCase().includes('online'));

              return (
                <div
                  key={b.steamId}
                  className="bg-gray-950/70 border border-gray-800/90 rounded-xl p-4 hover:border-gray-700/80 transition-all shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                >
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-950/60 to-gray-800 flex items-center justify-center text-emerald-400 font-bold text-sm shrink-0 border border-emerald-500/20 shadow-inner">
                      {displayName.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-gray-100 text-sm truncate">
                          {displayName}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-gray-400 mt-1">
                        <a
                          href={steamUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 hover:text-emerald-300 transition-colors"
                          title="Open Steam Profile"
                        >
                          <span>{b.steamId}</span>
                          <FiExternalLink size={11} className="opacity-70" />
                        </a>
                        <span>•</span>
                        <span className="text-gray-500">Bound: {b.created || 'Initial'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 self-end sm:self-auto shrink-0">
                    <div className="text-right font-mono text-xs hidden md:block">
                      <span className="text-gray-500 block text-[10px] uppercase">Status</span>
                      {isOnline ? (
                        <span className="text-emerald-400 font-bold flex items-center space-x-1.5 justify-end">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Online Now</span>
                        </span>
                      ) : (
                        <span className="text-gray-400 flex items-center space-x-1 justify-end">
                          <FiClock size={11} className="text-gray-500" />
                          <span>{b.lastLogin || 'Offline'}</span>
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setUnbindTarget({ steamId: b.steamId, name: displayName })}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5"
                    >
                      <FiTrash2 size={12} />
                      <span>Unbind</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Unbind Target Confirmation Modal ── */}
      <AnimatePresence>
        {unbindTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <h3 className="text-base font-bold text-red-400 flex items-center space-x-2">
                <FiAlertTriangle />
                <span>Unbind Character: {unbindTarget.name}</span>
              </h3>
              <p className="text-xs text-gray-300 leading-relaxed bg-gray-950 p-3.5 rounded-xl border border-gray-800">
                Removing this binding will allow the player with SteamID{' '}
                <strong className="text-emerald-400 font-mono">{unbindTarget.steamId}</strong> to select or create a new character upon their next login.
              </p>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUnbindTarget(null)}
                  className="px-4 py-2 text-xs text-gray-400 hover:text-gray-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleUnbind(unbindTarget.steamId, unbindTarget.name)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs shadow-lg shadow-red-600/20"
                >
                  Confirm Unbind
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Wipe Confirmation Modal ── */}
      <AnimatePresence>
        {showWipeConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative overflow-hidden space-y-4"
            >
              <div className="flex items-center space-x-3.5">
                <div className="p-3 bg-red-500/15 text-red-400 rounded-xl border border-red-500/30">
                  <FiAlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-100">Wipe All Character Bindings?</h3>
                  <p className="text-xs text-gray-400">Irreversible vault purge operation</p>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-gray-300 bg-gray-950 p-3.5 rounded-xl border border-gray-800">
                This will delete all <strong className="text-orange-400">CharactersVault</strong> profile pairings on the server. All players will be prompted to create fresh character bindings when connecting.
              </p>

              <div className="flex space-x-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowWipeConfirm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-gray-300 hover:text-gray-100 hover:bg-gray-800 border border-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleWipeAll}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg shadow-red-600/30"
                >
                  Confirm Full Wipe
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useState, useEffect } from 'react';
import {
  FiTrash2,
  FiAlertTriangle,
  FiSearch,
  FiUserCheck,
  FiKey,
  FiLink,
  FiShield,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../context/ToastContext';
import { api, type CharacterBinding } from '../api/client';
import { useTabMode } from '../hooks/useTabMode';
import ModHeader from '../components/ui/ModHeader';

export default function CharactersVaultTab() {
  const { showToast } = useToast();
  const [mode, setMode] = useTabMode('charvault');

  const [bindings, setBindings] = useState<CharacterBinding[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBindings = async () => {
    try {
      setIsLoading(true);
      const data = await api.getCharacterBindings();
      setBindings(data);
    } catch {
      showToast('Failed to load character vault bindings', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBindings();
  }, []);

  const filteredBindings = bindings.filter((b) => {
    const charName =
      typeof b.characterName === 'string' ? b.characterName : '';
    const steamId = typeof b.steamId === 'string' ? b.steamId : '';
    return (
      charName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      steamId.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleUnbind = async (steamId: string, name: string) => {
    try {
      const displayName =
        typeof name === 'string' && name ? name : 'Character';
      await api.unbindCharacter(steamId, displayName);
      setBindings((prev) => prev.filter((b) => b.steamId !== steamId));
      showToast(
        `Unbound character "${displayName}" from SteamID ${steamId}.`,
        'info'
      );
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
    <div className="space-y-6 h-full flex flex-col">
      {/* Mod Header */}
      <ModHeader
        icon={FiKey}
        title="Characters Vault Enforcements"
        description="Strict server-side SteamID to character pairing and anti-cheat binding."
        mode={mode}
        onModeChange={setMode}
        tabId="charvault"
        accentColor="orange"
        onRefresh={fetchBindings}
        isRefreshing={isLoading}
      />

      {/* Advanced Mode: Admin Vault Diagnostics & Danger Zone */}
      <AnimatePresence>
        {mode === 'advanced' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-6 overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl flex items-center space-x-3 shadow-lg">
                <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
                  <FiShield size={20} />
                </div>
                <div>
                  <div className="text-xs text-gray-400 font-mono">Vault Mode</div>
                  <div className="text-sm font-bold text-gray-100">
                    Strict SteamID Lock
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl flex items-center space-x-3 shadow-lg">
                <div className="p-3 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-xl">
                  <FiLink size={20} />
                </div>
                <div>
                  <div className="text-xs text-gray-400 font-mono">Total Paired</div>
                  <div className="text-sm font-bold text-gray-100">
                    {bindings.length} Characters
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-900/60 backdrop-blur-md border border-red-900/30 rounded-2xl flex items-center justify-between shadow-lg">
                <div>
                  <div className="text-xs text-red-400 font-semibold">Danger Zone</div>
                  <div className="text-[11px] text-gray-400">Purge entire vault</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWipeConfirm(true)}
                  disabled={bindings.length === 0}
                  className="bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed border border-red-500/30 text-red-300 px-4 py-2 rounded-xl transition-all font-medium text-xs flex items-center space-x-1.5 shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.25)]"
                >
                  <FiTrash2 size={14} />
                  <span>Wipe All</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Table View */}
      <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-xl">
        <div className="p-4 border-b border-gray-800/80 bg-gray-900/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Character Name or SteamID..."
              className="w-full bg-gray-950 border border-gray-700/80 rounded-xl pl-10 pr-4 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-orange-500/80 focus:ring-1 focus:ring-orange-500/50 transition-all placeholder:text-gray-600"
            />
          </div>
          <div className="flex items-center space-x-2 text-xs font-mono text-gray-400">
            <FiLink className="text-orange-400" />
            <span>
              {filteredBindings.length} / {bindings.length} Enforced
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-gray-950/60 text-gray-400 font-mono text-xs uppercase tracking-wider sticky top-0 backdrop-blur-md">
              <tr>
                <th className="px-6 py-3.5 font-medium">Steam ID</th>
                <th className="px-6 py-3.5 font-medium">Bound Character</th>
                <th className="px-6 py-3.5 font-medium">Binding Date</th>
                <th className="px-6 py-3.5 font-medium">Last Login</th>
                <th className="px-6 py-3.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50 text-gray-300">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-400 font-mono text-xs"
                  >
                    Loading Character Vault bindings from server...
                  </td>
                </tr>
              ) : filteredBindings.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-500 font-mono text-xs"
                  >
                    {bindings.length === 0
                      ? 'No character bindings on record.'
                      : 'No bindings match your search query.'}
                  </td>
                </tr>
              ) : (
                filteredBindings.map((b) => (
                  <tr
                    key={b.steamId}
                    className="hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-6 py-4 font-mono text-xs text-gray-400 flex items-center space-x-2">
                      <FiUserCheck className="text-emerald-400 flex-shrink-0" />
                      <span>{b.steamId}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-gray-100">
                          {typeof b.characterName === 'string' &&
                          b.characterName.trim().length > 0
                            ? b.characterName
                            : typeof b.characterName === 'object' &&
                              b.characterName !== null
                            ? (b.characterName as any).characterName ||
                              (b.characterName as any).name ||
                              (b.characterName as any).playerName ||
                              JSON.stringify(b.characterName)
                            : String(b.characterName || 'Unknown')}
                        </span>
                        {b.status && (
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                              b.status.toLowerCase() === 'active' ||
                              b.status.toLowerCase() === 'bound'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                            }`}
                          >
                            {b.status}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-500">
                      {b.created &&
                      b.created !== 'N/A' &&
                      b.created !== 'Unknown' &&
                      b.created !== '—'
                        ? b.created
                        : '—'}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">
                      {b.lastLogin &&
                      b.lastLogin !== 'N/A' &&
                      b.lastLogin !== 'Unknown' &&
                      b.lastLogin !== 'Never' &&
                      b.lastLogin !== '—' ? (
                        b.lastLogin.toLowerCase().includes('online') ? (
                          <span className="text-emerald-400 font-medium flex items-center space-x-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>{b.lastLogin}</span>
                          </span>
                        ) : (
                          b.lastLogin
                        )
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleUnbind(b.steamId, b.characterName)}
                        className="text-xs text-red-300 hover:text-red-200 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all font-medium"
                      >
                        Unbind
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Wipe Confirmation Modal */}
      <AnimatePresence>
        {showWipeConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-gray-900 border border-gray-700/80 rounded-2xl p-6 max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-orange-500 to-amber-500"></div>

              <div className="flex items-center space-x-3.5 mb-4">
                <div className="p-3 bg-red-500/15 text-red-400 rounded-xl border border-red-500/30">
                  <FiAlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-100">
                    Wipe All Characters?
                  </h3>
                  <p className="text-xs text-gray-400">
                    Irreversible vault purge
                  </p>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-gray-300 mb-6 bg-gray-950/60 p-3.5 rounded-xl border border-gray-800">
                This will delete all{' '}
                <strong className="text-orange-400">CharactersVault</strong>{' '}
                profile bindings and local metadata on the server. Players
                connecting subsequently will be prompted to create fresh
                characters.
              </p>

              <div className="flex space-x-3 justify-end">
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
                  className="px-5 py-2 rounded-xl text-xs font-medium bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg shadow-red-600/30"
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

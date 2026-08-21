import { useState, useEffect } from 'react';
import { FiTrash2, FiAlertTriangle, FiSearch, FiUserCheck, FiKey, FiLink, FiRefreshCw } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../context/ToastContext';
import { api, type CharacterBinding } from '../api/client';

export default function CharactersVaultTab() {
  const { showToast } = useToast();
  const [bindings, setBindings] = useState<CharacterBinding[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBindings = async () => {
    try {
      const data = await api.getCharacterBindings();
      setBindings(data);
    } catch (err) {
      showToast('Failed to load character vault bindings', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBindings();
  }, []);

  const filteredBindings = bindings.filter((b) => 
    b.characterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.steamId.includes(searchTerm)
  );

  const handleUnbind = async (steamId: string, name: string) => {
    try {
      await api.unbindCharacter(steamId, name);
      setBindings((prev) => prev.filter((b) => b.steamId !== steamId));
      showToast(`Unbound character "${name}" from SteamID ${steamId}.`, 'info');
    } catch (err) {
      showToast('Failed to unbind character', 'error');
    }
  };

  const handleWipeAll = async () => {
    try {
      const res = await api.wipeCharacters();
      setBindings([]);
      setShowWipeConfirm(false);
      showToast(res.message, 'error');
    } catch (err) {
      showToast('Failed to wipe character bindings', 'error');
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-900/60 backdrop-blur-md border border-gray-800/80 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-xl">
            <FiKey size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-100">Characters Vault Enforcements</h2>
            <p className="text-xs text-gray-400 mt-0.5">Strict server-side SteamID to character pairing and anti-cheat binding.</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchBindings}
            className="p-2.5 bg-gray-800/80 hover:bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700/80 rounded-xl transition-all"
            title="Refresh bindings"
          >
            <FiRefreshCw size={16} />
          </button>
          <button 
            onClick={() => setShowWipeConfirm(true)}
            disabled={bindings.length === 0}
            className="bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed border border-red-500/30 text-red-300 px-6 py-2.5 rounded-xl transition-all font-medium text-xs flex items-center space-x-2 shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.25)]"
          >
            <FiTrash2 size={16} />
            <span>Wipe All Bindings</span>
          </button>
        </div>
      </div>

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
            <span>{filteredBindings.length} / {bindings.length} Enforced</span>
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
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-mono text-xs">
                    Loading Character Vault bindings from server...
                  </td>
                </tr>
              ) : filteredBindings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-mono text-xs">
                    {bindings.length === 0 ? 'No character bindings on record.' : 'No bindings match your search query.'}
                  </td>
                </tr>
              ) : (
                filteredBindings.map((b) => (
                  <tr key={b.steamId} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-gray-400 flex items-center space-x-2">
                      <FiUserCheck className="text-emerald-400 flex-shrink-0" />
                      <span>{b.steamId}</span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-100">{b.characterName}</td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-500">{b.created}</td>
                    <td className="px-6 py-4 text-xs text-gray-400">{b.lastLogin}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
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
                  <h3 className="text-lg font-bold text-gray-100">Wipe All Characters?</h3>
                  <p className="text-xs text-gray-400">Irreversible vault purge</p>
                </div>
              </div>
              
              <p className="text-xs leading-relaxed text-gray-300 mb-6 bg-gray-950/60 p-3.5 rounded-xl border border-gray-800">
                This will delete all <strong className="text-orange-400">CharactersVault</strong> profile bindings and local metadata on the server. Players connecting subsequently will be prompted to create fresh characters.
              </p>

              <div className="flex space-x-3 justify-end">
                <button 
                  onClick={() => setShowWipeConfirm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-gray-300 hover:text-gray-100 hover:bg-gray-800 border border-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
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

import React, { useState, useEffect } from 'react';
import { 
  FiFeather, FiCheck, FiRefreshCw, 
  FiVolume2, FiPlus, FiTrash2, FiPlay, FiList, FiSettings 
} from 'react-icons/fi';
import { useToast } from '../context/ToastContext';
import { api, type SkaldConfig, type SkaldDeathRecord } from '../api/client';

export default function SkaldTab() {
  const { showToast } = useToast();
  const [config, setConfig] = useState<SkaldConfig>({
    enabled: true,
    enablePvp: true,
    enableBosses: true,
    includeBiome: true,
    logToConsole: true,
    monsterTemplates: '{victim} was slain by a {killer} in the {biome};{victim} was torn apart by a {killer};A {killer} claimed the soul of {victim}',
    bossTemplates: '{victim} was annihilated by the mythical {killer}!;The legendary {killer} crushed {victim} into dust',
    treeTemplates: '{victim} was crushed by a falling log!;{victim} learned that lumberjacking is deadly in Valheim',
    drowningTemplates: '{victim} ran out of stamina and drowned in cold waters;The sea claimed {victim} to the deep',
    freezingTemplates: '{victim} froze to death in the blizzard of the {biome};The bitter cold claimed {victim}',
    burningTemplates: '{victim} burned to ashes in the {biome};The flames consumed {victim}',
    poisonTemplates: '{victim} succumbed to deadly poison in the {biome};Venom ended {victim}\'s journey',
    fallDamageTemplates: '{victim} plummeted to their death from high cliffs;Gravity showed no mercy to {victim}',
    pvpTemplates: '{victim} was vanquished by {killer} in glorious combat!;{killer} struck down {victim} with honor',
  });

  const [chronicle, setChronicle] = useState<SkaldDeathRecord[]>([]);
  const [activeCategory, setActiveCategory] = useState<'monster' | 'boss' | 'tree' | 'drowning' | 'freezing' | 'pvp' | 'burning' | 'poison' | 'fallDamage'>('monster');
  const [subTab, setSubTab] = useState<'chronicle' | 'templates' | 'settings'>('chronicle');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Test broadcast state
  const [testVictim, setTestVictim] = useState('Ragnar');
  const [testKiller, setTestKiller] = useState('1-Star Troll');
  const [testBiome, setTestBiome] = useState('Black Forest');

  const fetchSkaldData = async () => {
    try {
      const [cfg, chn] = await Promise.all([
        api.getSkaldConfig(),
        api.getSkaldChronicle(),
      ]);
      setConfig(cfg);
      setChronicle(chn);
    } catch (err) {
      showToast('Failed to fetch Skald chronicle from server', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSkaldData();
  }, []);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const res = await api.saveSkaldConfig(config);
      setConfig(res.config);
      showToast('Skald Viking chronicle configuration synchronized.', 'success');
    } catch (err) {
      showToast('Failed to save Skald configuration', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.testDeathAnnouncement(testVictim, testKiller, activeCategory, testBiome);
      setChronicle(prev => [res.record, ...prev]);
      showToast(`Test announcement broadcast: "${res.record.formattedMessage}"`, 'info');
    } catch (err) {
      showToast('Failed to trigger test death broadcast', 'error');
    }
  };

  const getTemplateString = () => {
    switch (activeCategory) {
      case 'monster': return config.monsterTemplates;
      case 'boss': return config.bossTemplates;
      case 'tree': return config.treeTemplates;
      case 'drowning': return config.drowningTemplates;
      case 'freezing': return config.freezingTemplates;
      case 'burning': return config.burningTemplates;
      case 'poison': return config.poisonTemplates;
      case 'fallDamage': return config.fallDamageTemplates;
      case 'pvp': return config.pvpTemplates;
      default: return config.monsterTemplates;
    }
  };

  const setTemplateString = (val: string) => {
    switch (activeCategory) {
      case 'monster': setConfig({ ...config, monsterTemplates: val }); break;
      case 'boss': setConfig({ ...config, bossTemplates: val }); break;
      case 'tree': setConfig({ ...config, treeTemplates: val }); break;
      case 'drowning': setConfig({ ...config, drowningTemplates: val }); break;
      case 'freezing': setConfig({ ...config, freezingTemplates: val }); break;
      case 'burning': setConfig({ ...config, burningTemplates: val }); break;
      case 'poison': setConfig({ ...config, poisonTemplates: val }); break;
      case 'fallDamage': setConfig({ ...config, fallDamageTemplates: val }); break;
      case 'pvp': setConfig({ ...config, pvpTemplates: val }); break;
    }
  };

  const currentTemplateList = getTemplateString().split(';').filter(t => t.trim().length > 0);

  const handleAddTemplate = (newTemplate: string) => {
    if (!newTemplate.trim()) return;
    const current = getTemplateString();
    const updated = current ? `${current};${newTemplate.trim()}` : newTemplate.trim();
    setTemplateString(updated);
  };

  const handleDeleteTemplate = (index: number) => {
    const list = [...currentTemplateList];
    list.splice(index, 1);
    setTemplateString(list.join(';'));
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header Banner */}
      <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl">
            <FiFeather size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-100">Skald Viking Chronicle & Killfeed</h2>
            <p className="text-xs text-gray-400 mt-0.5">Server-side in-game death announcements, RPC shouts, and Valhalla ledger.</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchSkaldData}
            className="p-2.5 bg-gray-800/80 hover:bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700/80 rounded-xl transition-all"
            title="Reload Skald data"
          >
            <FiRefreshCw size={16} />
          </button>
          <button
            onClick={handleSaveConfig}
            disabled={isSaving || isLoading}
            className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white px-6 py-2.5 rounded-xl font-medium text-xs transition-all shadow-lg shadow-red-600/25 flex items-center space-x-2"
          >
            <FiCheck />
            <span>{isSaving ? 'Saving...' : 'Save & Apply Config'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center space-x-2 bg-gray-900/60 backdrop-blur-md border border-gray-800/80 p-1.5 rounded-2xl w-fit">
        <button
          onClick={() => setSubTab('chronicle')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            subTab === 'chronicle'
              ? 'bg-red-500/20 text-red-300 border border-red-500/30 shadow-md'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <FiList />
          <span>Obituary Chronicle ({chronicle.length})</span>
        </button>

        <button
          onClick={() => setSubTab('templates')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            subTab === 'templates'
              ? 'bg-red-500/20 text-red-300 border border-red-500/30 shadow-md'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <FiVolume2 />
          <span>Message Template Pools</span>
        </button>

        <button
          onClick={() => setSubTab('settings')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            subTab === 'settings'
              ? 'bg-red-500/20 text-red-300 border border-red-500/30 shadow-md'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <FiSettings />
          <span>Broadcast Settings</span>
        </button>
      </div>

      {/* View 1: Obituary Chronicle */}
      {subTab === 'chronicle' && (
        <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-gray-800/80 bg-gray-900/90 flex items-center justify-between">
            <h3 className="font-semibold text-gray-100 text-sm">Recent Server Death Records</h3>
            <span className="text-xs text-gray-400 font-mono">Synchronized from in-game Player.OnDeath hooks</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-950/60 text-gray-400 font-mono text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5 font-medium">Time</th>
                  <th className="px-6 py-3.5 font-medium">Victim</th>
                  <th className="px-6 py-3.5 font-medium">Killer / Cause</th>
                  <th className="px-6 py-3.5 font-medium">Biome</th>
                  <th className="px-6 py-3.5 font-medium">In-Game Broadcast</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50 text-gray-300">
                {chronicle.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-mono text-xs">
                      No deaths recorded in the chronicle yet.
                    </td>
                  </tr>
                ) : (
                  chronicle.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4 text-xs font-mono text-gray-400">{c.timestamp}</td>
                      <td className="px-6 py-4 font-semibold text-gray-100">{c.victimName}</td>
                      <td className="px-6 py-4">
                        <span className="bg-red-500/10 text-red-300 border border-red-500/20 px-2.5 py-1 rounded-md text-xs font-medium">
                          {c.killerName}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-400">{c.biome}</td>
                      <td className="px-6 py-4 text-xs italic text-gray-300 font-serif">
                        "{c.formattedMessage}"
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View 2: Template Pool Editor */}
      {subTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Category Selector */}
          <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl p-4 space-y-1 shadow-xl h-fit">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2 font-mono">
              Entity / Damage Types
            </h4>
            {[
              { id: 'monster', label: '👹 Monsters & Creatures' },
              { id: 'boss', label: '👑 Legendary Bosses' },
              { id: 'tree', label: '🌲 Falling Tree Logs' },
              { id: 'drowning', label: '🌊 Drowning (Zero Stamina)' },
              { id: 'freezing', label: '❄️ Freezing & Blizzard' },
              { id: 'burning', label: '🔥 Fire & Burning' },
              { id: 'poison', label: '🧪 Toxic Venom & Poison' },
              { id: 'fallDamage', label: '⛰️ Fall Damage / Cliffs' },
              { id: 'pvp', label: '⚔️ PvP Combat' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as any)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  activeCategory === cat.id
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Template Pool Card */}
          <div className="lg:col-span-2 bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-5">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-100 text-base capitalize">
                  {activeCategory} Announcement Pool
                </h3>
                <span className="text-xs font-mono text-gray-400">
                  {currentTemplateList.length} Variations
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Available Tokens: <code className="text-orange-300 bg-gray-950 px-1 py-0.5 rounded">{'{victim}'}</code>, <code className="text-orange-300 bg-gray-950 px-1 py-0.5 rounded">{'{killer}'}</code>, <code className="text-orange-300 bg-gray-950 px-1 py-0.5 rounded">{'{biome}'}</code>
              </p>
            </div>

            <div className="space-y-2.5">
              {currentTemplateList.map((tpl, idx) => (
                <div key={idx} className="flex items-center justify-between p-3.5 bg-gray-950/80 rounded-xl border border-gray-800 text-xs">
                  <span className="text-gray-200 italic font-serif">"{tpl}"</span>
                  <button
                    onClick={() => handleDeleteTemplate(idx)}
                    className="p-1.5 text-gray-500 hover:text-red-400 transition-colors ml-3"
                    title="Remove template"
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Template input */}
            <div className="pt-3 border-t border-gray-800">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = (e.currentTarget.elements.namedItem('newTpl') as HTMLInputElement).value;
                  handleAddTemplate(input);
                  (e.currentTarget.elements.namedItem('newTpl') as HTMLInputElement).value = '';
                }}
                className="flex space-x-2"
              >
                <input
                  type="text"
                  name="newTpl"
                  placeholder={`e.g. {victim} was destroyed by {killer} in the {biome}...`}
                  className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2 text-xs text-gray-200 focus:outline-none focus:border-red-500 transition-all placeholder:text-gray-600"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 rounded-xl text-xs font-bold transition-all flex items-center space-x-1"
                >
                  <FiPlus />
                  <span>Add Template</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View 3: Broadcast Settings & Test Shout */}
      {subTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="font-semibold text-gray-100 text-sm">Server Broadcast Toggles</h3>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-gray-950/70 rounded-xl border border-gray-800 cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-gray-200 block">Master Death Announcements</span>
                  <span className="text-[11px] text-gray-400">Broadcasts in-game global shouts on player deaths</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                  className="accent-red-500 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-gray-950/70 rounded-xl border border-gray-800 cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-gray-200 block">PvP Death Announcements</span>
                  <span className="text-[11px] text-gray-400">Broadcast when players slay one another</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.enablePvp}
                  onChange={(e) => setConfig({ ...config, enablePvp: e.target.checked })}
                  className="accent-red-500 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-gray-950/70 rounded-xl border border-gray-800 cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-gray-200 block">Boss Summon & Defeat Shouts</span>
                  <span className="text-[11px] text-gray-400">Broadcast mythical boss triumphs server-wide</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.enableBosses}
                  onChange={(e) => setConfig({ ...config, enableBosses: e.target.checked })}
                  className="accent-red-500 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-gray-950/70 rounded-xl border border-gray-800 cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-gray-200 block">Include World Biome</span>
                  <span className="text-[11px] text-gray-400">Appends the zone name where death occurred</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.includeBiome}
                  onChange={(e) => setConfig({ ...config, includeBiome: e.target.checked })}
                  className="accent-red-500 w-4 h-4 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Test Shout Trigger */}
          <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-gray-100 text-sm flex items-center space-x-2">
                <FiPlay className="text-red-400" />
                <span>Simulate In-Game Death Shout</span>
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Fires a test announcement to verify template formatting in the server console and chronicle.
              </p>

              <form onSubmit={handleTestBroadcast} className="space-y-3 mt-4">
                <div>
                  <label className="block text-[11px] font-mono text-gray-400 mb-1">Victim Name</label>
                  <input
                    type="text"
                    value={testVictim}
                    onChange={(e) => setTestVictim(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-700/80 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-gray-400 mb-1">Killer / Cause</label>
                  <input
                    type="text"
                    value={testKiller}
                    onChange={(e) => setTestKiller(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-700/80 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-gray-400 mb-1">Biome</label>
                  <input
                    type="text"
                    value={testBiome}
                    onChange={(e) => setTestBiome(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-700/80 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-red-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-2.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-md shadow-red-950/40"
                >
                  <FiVolume2 />
                  <span>Fire Simulated Shout</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

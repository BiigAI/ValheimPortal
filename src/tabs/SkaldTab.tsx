import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiFeather,
  FiVolume2,
  FiPlus,
  FiTrash2,
  FiPlay,
  FiList,
  FiSettings,
  FiRadio,
} from 'react-icons/fi';
import { useToast } from '../context/ToastContext';
import { api, type SkaldConfig, type SkaldDeathRecord } from '../api/client';
import { useTabMode } from '../hooks/useTabMode';
import ModHeader from '../components/ui/ModHeader';
import SettingsCard from '../components/ui/SettingsCard';
import SettingRow from '../components/ui/SettingRow';

interface SkaldTabProps {
  onSaved?: () => void;
}

export default function SkaldTab({ onSaved }: SkaldTabProps = {}) {
  const { showToast } = useToast();
  const [mode, setMode] = useTabMode('skald');

  const [config, setConfig] = useState<SkaldConfig>({
    enabled: true,
    enableBosses: true,
    includeBiome: true,
    logToConsole: true,
    monsterTemplates:
      '{victim} was slain by a {killer} in the {biome};{victim} was torn apart by a {killer};A {killer} claimed the soul of {victim}',
    bossTemplates:
      '{victim} was annihilated by the mythical {killer}!;The legendary {killer} crushed {victim} into dust',
    overwhelmedMessages:
      '{victim} was defeated in glorious battle against a horde in the {biome};{victim} fell fighting valiantly against overwhelming odds',
    genericDeathMessages:
      "{victim} has departed for the halls of Valhalla;The Norns have cut the thread of {victim}'s life;{victim} died in the {biome}",
  });

  const [chronicle, setChronicle] = useState<SkaldDeathRecord[]>([]);
  const [activeCategory, setActiveCategory] = useState<
    'monster' | 'boss' | 'overwhelmed' | 'generic'
  >('monster');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Test broadcast state
  const [testVictim, setTestVictim] = useState('Ragnar');
  const [testKiller, setTestKiller] = useState('1-Star Troll');
  const [testBiome, setTestBiome] = useState('Black Forest');

  const fetchSkaldData = async () => {
    try {
      setIsLoading(true);
      const [cfg, chn] = await Promise.all([
        api.getSkaldConfig(),
        api.getSkaldChronicle(),
      ]);
      setConfig(cfg);
      setChronicle(chn);
    } catch {
      showToast('Failed to load Skald chronicle and settings', 'error');
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
      showToast(
        'Skald Viking chronicle configuration saved (Restart pending).',
        'success'
      );
      onSaved?.();
    } catch {
      showToast('Failed to save Skald configuration', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.testDeathAnnouncement(
        testVictim,
        testKiller,
        activeCategory,
        testBiome
      );
      setChronicle((prev) => [res.record, ...prev]);
      showToast(
        `Test announcement broadcast: "${res.record.formattedMessage}"`,
        'info'
      );
    } catch {
      showToast('Failed to trigger test death broadcast', 'error');
    }
  };

  const getTemplateString = () => {
    switch (activeCategory) {
      case 'monster':
        return config.monsterTemplates;
      case 'boss':
        return config.bossTemplates;
      case 'overwhelmed':
        return config.overwhelmedMessages;
      case 'generic':
        return config.genericDeathMessages;
      default:
        return config.monsterTemplates;
    }
  };

  const setTemplateString = (val: string) => {
    switch (activeCategory) {
      case 'monster':
        setConfig({ ...config, monsterTemplates: val });
        break;
      case 'boss':
        setConfig({ ...config, bossTemplates: val });
        break;
      case 'overwhelmed':
        setConfig({ ...config, overwhelmedMessages: val });
        break;
      case 'generic':
        setConfig({ ...config, genericDeathMessages: val });
        break;
    }
  };

  const currentTemplateList = getTemplateString()
    .split(';')
    .filter((t) => t.trim().length > 0);

  const handleAddTemplate = (newTemplate: string) => {
    if (!newTemplate.trim()) return;
    const current = getTemplateString();
    const updated = current
      ? `${current};${newTemplate.trim()}`
      : newTemplate.trim();
    setTemplateString(updated);
  };

  const handleDeleteTemplate = (index: number) => {
    const list = [...currentTemplateList];
    list.splice(index, 1);
    setTemplateString(list.join(';'));
  };

  const categories = [
    { id: 'monster', label: 'Monsters & Creatures' },
    { id: 'boss', label: 'Legendary Bosses' },
    { id: 'overwhelmed', label: 'Overwhelmed / Swarmed' },
    { id: 'generic', label: 'Generic / Fallback' },
  ];

  return (
    <div className="space-y-6 w-full">
      {/* Mod Header */}
      <ModHeader
        icon={FiFeather}
        title="Skald Viking Chronicle & Killfeed"
        description="Server-side in-game death announcements, RPC shouts, and Valhalla ledger."
        mode={mode}
        onModeChange={setMode}
        tabId="skald"
        accentColor="red"
        onRefresh={fetchSkaldData}
        isRefreshing={isLoading}
        onSave={handleSaveConfig}
        isSaving={isSaving}
      />

      {/* Broadcast Quick Settings & Test Simulator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Broadcast Toggles */}
        <SettingsCard
          title="Server Broadcast Rules"
          subtitle="Configure which categories of deaths trigger in-game broadcast shouts"
          icon={FiRadio}
          accentColor="red"
        >
          <div className="space-y-3">
            <SettingRow
              label="Master Death Announcements"
              description="Broadcasts in-game global shouts on player deaths across all biomes"
              checked={config.enabled}
              disabled={isLoading}
              onChange={(c) => setConfig({ ...config, enabled: c })}
              accentColor="red"
            />

            <SettingRow
              label="Boss Defeat Announcements"
              description="Broadcast when legendary bosses are summoned or defeated server-wide"
              checked={config.enableBosses}
              disabled={isLoading}
              onChange={(c) => setConfig({ ...config, enableBosses: c })}
              accentColor="red"
            />
          </div>
        </SettingsCard>

        {/* Test Shout Trigger */}
        <SettingsCard
          title="Simulate In-Game Death Shout"
          subtitle="Fires a test announcement to verify formatting in the console & chronicle"
          icon={FiPlay}
          accentColor="red"
        >
          <form onSubmit={handleTestBroadcast} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-gray-400 mb-1">
                  Victim Name
                </label>
                <input
                  type="text"
                  value={testVictim}
                  onChange={(e) => setTestVictim(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700/80 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-red-500/80 transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-gray-400 mb-1">
                  Killer / Cause
                </label>
                <input
                  type="text"
                  value={testKiller}
                  onChange={(e) => setTestKiller(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700/80 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-red-500/80 transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-gray-400 mb-1">
                Biome
              </label>
              <input
                type="text"
                value={testBiome}
                onChange={(e) => setTestBiome(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700/80 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-red-500/80 transition-all font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-1 py-2.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-md shadow-red-950/40"
            >
              <FiVolume2 size={15} />
              <span>Fire Simulated Shout</span>
            </button>
          </form>
        </SettingsCard>
      </div>

      {/* Advanced Mode: Template Pools & Formatting */}
      <AnimatePresence>
        {mode === 'advanced' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-6 overflow-hidden"
          >
            <SettingsCard
              title="Custom Death Template Pool Editor"
              subtitle="Customize randomized in-game broadcast formats for each damage type"
              icon={FiVolume2}
              accentColor="red"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Category Selector */}
                <div className="space-y-1.5 bg-gray-950/70 p-3 rounded-xl border border-gray-800 h-fit">
                  <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2 font-mono">
                    Death Category
                  </h4>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id as any)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        activeCategory === cat.id
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900/60'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Template Pool Editor */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-200 text-sm capitalize">
                        {activeCategory} Message Variations
                      </h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Tokens: <code className="text-orange-300 bg-gray-950 px-1 py-0.5 rounded font-mono">{'{victim}'}</code>, <code className="text-orange-300 bg-gray-950 px-1 py-0.5 rounded font-mono">{'{killer}'}</code>, <code className="text-orange-300 bg-gray-950 px-1 py-0.5 rounded font-mono">{'{biome}'}</code>
                      </p>
                    </div>
                    <span className="text-xs font-mono text-gray-400">
                      {currentTemplateList.length} Variations
                    </span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {currentTemplateList.map((tpl, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-gray-950/80 rounded-xl border border-gray-800 text-xs"
                      >
                        <span className="text-gray-200 italic font-serif leading-relaxed">
                          "{tpl}"
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(idx)}
                          className="p-1.5 text-gray-500 hover:text-red-400 transition-colors ml-3 flex-shrink-0"
                          title="Remove template"
                        >
                          <FiTrash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add Template Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const input = (form.elements.namedItem('newTpl') as HTMLInputElement).value;
                      handleAddTemplate(input);
                      (form.elements.namedItem('newTpl') as HTMLInputElement).value = '';
                    }}
                    className="flex space-x-2 pt-2 border-t border-gray-800"
                  >
                    <input
                      type="text"
                      name="newTpl"
                      placeholder="e.g. {victim} was destroyed by {killer} in the {biome}..."
                      className="flex-1 bg-gray-950 border border-gray-700/80 rounded-xl px-3.5 py-2 text-xs text-gray-200 focus:outline-none focus:border-red-500 transition-all placeholder:text-gray-600"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 flex-shrink-0"
                    >
                      <FiPlus size={14} />
                      <span>Add</span>
                    </button>
                  </form>
                </div>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Advanced Formatting & Logging"
              subtitle="Control metadata appending and server console synchronization"
              icon={FiSettings}
              accentColor="red"
            >
              <div className="space-y-3">
                <SettingRow
                  label="Include World Biome"
                  description="Appends the world zone name where the death occurred to the broadcast message"
                  checked={config.includeBiome}
                  disabled={isLoading}
                  onChange={(c) => setConfig({ ...config, includeBiome: c })}
                  accentColor="red"
                />

                <SettingRow
                  label="Log to Server Console"
                  description="Print all formatted killfeed broadcasts to the server console log"
                  checked={config.logToConsole}
                  disabled={isLoading}
                  onChange={(c) => setConfig({ ...config, logToConsole: c })}
                  accentColor="red"
                />
              </div>
            </SettingsCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Obituary Chronicle Table */}
      <SettingsCard
        title="Valhalla Obituary Chronicle"
        subtitle="Recent synchronized server death records from in-game hooks"
        icon={FiList}
        badge={
          <span className="text-xs font-mono text-gray-400 bg-gray-950 px-2.5 py-1 rounded-lg border border-gray-800">
            {chronicle.length} Records
          </span>
        }
        accentColor="red"
      >
        <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-950/40">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-950/80 text-gray-400 font-mono text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Victim</th>
                <th className="px-5 py-3 font-medium">Killer / Cause</th>
                <th className="px-5 py-3 font-medium">Biome</th>
                <th className="px-5 py-3 font-medium">In-Game Broadcast</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50 text-gray-300">
              {chronicle.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-500 font-mono text-xs"
                  >
                    No deaths recorded in the chronicle yet.
                  </td>
                </tr>
              ) : (
                chronicle.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-5 py-3 text-xs font-mono text-gray-400">
                      {c.timestamp}
                    </td>
                    <td className="px-5 py-3 font-semibold text-gray-100">
                      {c.victimName}
                    </td>
                    <td className="px-5 py-3">
                      <span className="bg-red-500/10 text-red-300 border border-red-500/20 px-2.5 py-0.5 rounded-md text-xs font-medium">
                        {c.killerName}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">{c.biome}</td>
                    <td className="px-5 py-3 text-xs italic text-gray-300 font-serif">
                      "{c.formattedMessage}"
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SettingsCard>
    </div>
  );
}

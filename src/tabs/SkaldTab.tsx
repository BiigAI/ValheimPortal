import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiFeather,
  FiVolume2,
  FiPlus,
  FiTrash2,
  FiPlay,
  FiRadio,
  FiClock,
  FiSearch,
} from 'react-icons/fi';
import { GiSkullCrossedBones, GiVikingHelmet, GiBroadsword } from 'react-icons/gi';
import { useToast } from '../context/ToastContext';
import { api, type SkaldConfig, type SkaldDeathRecord } from '../api/client';
import { useTabMode } from '../hooks/useTabMode';
import ModHeader from '../components/ui/ModHeader';
import KpiGaugeCard from '../components/ui/KpiGaugeCard';
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
  const [searchTerm, setSearchTerm] = useState('');
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

  const filteredChronicle = chronicle.filter((c) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      c.victimName.toLowerCase().includes(q) ||
      c.killerName.toLowerCase().includes(q) ||
      c.biome.toLowerCase().includes(q) ||
      c.formattedMessage.toLowerCase().includes(q)
    );
  });

  const getDeathIcon = (killer: string) => {
    const k = killer.toLowerCase();
    if (k.includes('boss') || k.includes('eikthyr') || k.includes('moder') || k.includes('bonemass') || k.includes('yagluth') || k.includes('queen') || k.includes('fader')) {
      return <GiVikingHelmet className="text-amber-400" size={18} />;
    }
    if (k.includes('player') || k.includes('pvp') || k.includes('arrow') || k.includes('sword') || k.includes('axe')) {
      return <GiBroadsword className="text-rose-400" size={18} />;
    }
    return <GiSkullCrossedBones className="text-red-400" size={18} />;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── 1. Top Hero Header ── */}
      <ModHeader
        icon={FiFeather}
        title="Skald Viking Chronicle & Killfeed"
        mode={mode}
        onModeChange={setMode}
        tabId="skald"
        accentColor="red"
        onRefresh={fetchSkaldData}
        isRefreshing={isLoading}
        onSave={handleSaveConfig}
        isSaving={isSaving}
      />

      {/* ── 2. Top Visual Telemetry Gauges ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiGaugeCard
          icon={GiSkullCrossedBones}
          label="Valhalla Ledger"
          value={chronicle.length}
          unit="Fallen Warriors"
          accentColor="red"
        />

        <KpiGaugeCard
          icon={FiVolume2}
          label="Lore Templates"
          value={currentTemplateList.length}
          unit="Active Variations"
          accentColor="red"
        />
      </div>

      {/* ── 3. Broadcast Rules & Test Shout Simulator Grid ── */}
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

            <SettingRow
              label="Include World Biome Name"
              description="Appends the world zone name where the death occurred to the shout"
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

        {/* Test Shout Trigger */}
        <SettingsCard
          title="Simulate In-Game Death Shout"
          subtitle="Fires a test announcement to verify formatting in console and chronicle"
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
                  className="w-full bg-gray-950 border border-gray-700/80 rounded-xl px-3.5 py-2 text-xs text-gray-200 focus:outline-none focus:border-red-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-gray-400 mb-1">
                  Killer / Monster
                </label>
                <input
                  type="text"
                  value={testKiller}
                  onChange={(e) => setTestKiller(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700/80 rounded-xl px-3.5 py-2 text-xs text-gray-200 focus:outline-none focus:border-red-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-gray-400 mb-1">
                World Biome
              </label>
              <input
                type="text"
                value={testBiome}
                onChange={(e) => setTestBiome(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700/80 rounded-xl px-3.5 py-2 text-xs text-gray-200 focus:outline-none focus:border-red-500 font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 shadow-lg shadow-red-600/25"
            >
              <FiVolume2 size={14} />
              <span>Fire Simulated Shout</span>
            </button>
          </form>
        </SettingsCard>
      </div>

      {/* ── 4. Advanced Mode: Template Pools & Formatting ── */}
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
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm font-bold'
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

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {currentTemplateList.map((tpl, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-gray-950/80 rounded-xl border border-gray-800 text-xs"
                      >
                        <span className="text-gray-200 italic font-serif leading-relaxed">
                          &ldquo;{tpl}&rdquo;
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(idx)}
                          className="p-1.5 text-gray-500 hover:text-red-400 transition-colors ml-3 shrink-0"
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
                      className="px-4 py-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shrink-0"
                    >
                      <FiPlus size={14} />
                      <span>Add</span>
                    </button>
                  </form>
                </div>
              </div>
            </SettingsCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 5. Valhalla Ledger Killfeed Stream (Interactive Card Stream) ── */}
      <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl shadow-xl flex flex-col overflow-hidden">
        {/* Header Toolbar */}
        <div className="p-4 sm:p-5 border-b border-gray-800/80 bg-gray-900/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <GiSkullCrossedBones size={16} />
            </div>
            <div>
              <h3 className="font-bold text-gray-100 text-sm">Valhalla Obituary Chronicle</h3>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative w-full sm:w-64">
              <FiSearch className="absolute left-3 top-2.5 text-gray-500 text-xs" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter deaths by name, killer, biome..."
                className="w-full bg-gray-950 border border-gray-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-red-500"
              />
            </div>
            <span className="text-[11px] font-mono text-gray-400 px-2.5 py-1 rounded-lg bg-gray-950 border border-gray-800 shrink-0">
              {filteredChronicle.length} / {chronicle.length}
            </span>
          </div>
        </div>

        {/* Death Chronicle Stream */}
        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto max-h-[580px] custom-scrollbar">
          {chronicle.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center space-y-3 bg-gray-950/40 border border-dashed border-gray-800 rounded-2xl p-8">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <GiSkullCrossedBones size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-gray-200">
                  The Halls of Valhalla Are Quiet
                </h4>
                <p className="text-xs text-gray-400 max-w-sm font-sans">
                  No warrior deaths have been chronicled yet. Slayings will be broadcast server-wide and recorded live in this ledger as they occur.
                </p>
              </div>
            </div>
          ) : filteredChronicle.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center space-y-3 bg-gray-950/40 border border-dashed border-gray-800 rounded-2xl p-8">
              <div className="w-12 h-12 rounded-2xl bg-gray-800/60 border border-gray-700/60 flex items-center justify-center text-gray-400">
                <FiSearch size={22} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-gray-200">
                  No Records Found
                </h4>
                <p className="text-xs text-gray-400 max-w-sm font-sans">
                  No chronicle slayings match &ldquo;{searchTerm}&rdquo;. Try filtering by warrior name, monster, or biome.
                </p>
              </div>
            </div>
          ) : (
            filteredChronicle.map((c) => (
              <div
                key={c.id}
                className="bg-gray-950/70 border border-gray-800/90 rounded-xl p-4 hover:border-gray-700/80 transition-all shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="flex items-start sm:items-center space-x-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-950/60 to-gray-800 flex items-center justify-center shrink-0 border border-red-500/20 shadow-inner">
                    {getDeathIcon(c.killerName)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-gray-100 text-sm truncate">
                        {c.victimName}
                      </span>
                      <span className="text-xs text-gray-500">slain by</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-red-500/10 text-red-300 border border-red-500/20">
                        {c.killerName}
                      </span>
                      {c.biome && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-gray-900 text-gray-300 border-gray-700">
                          {c.biome}
                        </span>
                      )}
                    </div>

                    <p className="text-xs italic text-gray-300 font-serif mt-1 leading-relaxed">
                      &ldquo;{c.formattedMessage}&rdquo;
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-xs font-mono text-gray-500 self-end sm:self-auto shrink-0">
                  <FiClock size={12} />
                  <span>{c.timestamp}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

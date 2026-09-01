import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSliders,
  FiShield,
  FiTrendingDown,
  FiLayers,
  FiActivity,
  FiTarget,
  FiInfo,
  FiCheck,
} from 'react-icons/fi';
import { useToast } from '../context/ToastContext';
import { api, type ValgrindConfig } from '../api/client';
import { useTabMode } from '../hooks/useTabMode';
import ModHeader from '../components/ui/ModHeader';
import SettingsCard from '../components/ui/SettingsCard';
import SettingRow from '../components/ui/SettingRow';
import SliderField from '../components/ui/SliderField';
import PresetGrid from '../components/ui/PresetGrid';

interface ValgrindTabProps {
  onSaved?: () => void;
}

export default function ValgrindTab({ onSaved }: ValgrindTabProps = {}) {
  const { showToast } = useToast();
  const [mode, setMode] = useTabMode('valgrind');

  const [calculationMode, setCalculationMode] = useState<
    'TieredBrackets' | 'ContinuousCurve' | 'PerSkill'
  >('TieredBrackets');
  const [useTopNSkillsOnly, setUseTopNSkillsOnly] = useState(false);
  const [topNSkillsCount, setTopNSkillsCount] = useState(5);
  const [resetAccumulatorOnDeath, setResetAccumulatorOnDeath] = useState(true);
  const [enableDebugLogging, setEnableDebugLogging] = useState(false);

  // Tiered Brackets
  const [earlyGameLossPercent, setEarlyGameLossPercent] = useState(8.0);
  const [midGameLossPercent, setMidGameLossPercent] = useState(5.0);
  const [lateGameLossPercent, setLateGameLossPercent] = useState(2.5);
  const [endgameLossPercent, setEndgameLossPercent] = useState(1.0);

  // Continuous Curve
  const [curveMaxLossPercent, setCurveMaxLossPercent] = useState(8.0);
  const [curveMinLossPercent, setCurveMinLossPercent] = useState(1.0);

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const cfg = await api.getValgrindConfig();
      if (
        cfg.calculationMode === 'ContinuousCurve' ||
        cfg.calculationMode === 'PerSkill' ||
        cfg.calculationMode === 'TieredBrackets'
      ) {
        setCalculationMode(cfg.calculationMode);
      } else {
        setCalculationMode('TieredBrackets');
      }
      setUseTopNSkillsOnly(cfg.useTopNSkillsOnly ?? false);
      setTopNSkillsCount(cfg.topNSkillsCount ?? 5);
      setResetAccumulatorOnDeath(cfg.resetAccumulatorOnDeath ?? true);
      setEnableDebugLogging(cfg.enableDebugLogging ?? false);

      setEarlyGameLossPercent(cfg.earlyGameLossPercent ?? 8.0);
      setMidGameLossPercent(cfg.midGameLossPercent ?? 5.0);
      setLateGameLossPercent(cfg.lateGameLossPercent ?? 2.5);
      setEndgameLossPercent(cfg.endgameLossPercent ?? 1.0);

      setCurveMaxLossPercent(cfg.curveMaxLossPercent ?? 8.0);
      setCurveMinLossPercent(cfg.curveMinLossPercent ?? 1.0);
    } catch {
      showToast('Failed to fetch Valgrind config from server', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: ValgrindConfig = {
        calculationMode,
        useTopNSkillsOnly,
        topNSkillsCount,
        resetAccumulatorOnDeath,
        enableDebugLogging,
        earlyGameLossPercent,
        midGameLossPercent,
        lateGameLossPercent,
        endgameLossPercent,
        curveMaxLossPercent,
        curveMinLossPercent,
      };

      await api.saveValgrindConfig(payload);
      showToast(
        `Valgrind updated: Mode '${calculationMode}' configured (Restart pending).`,
        'success'
      );
      onSaved?.();
    } catch {
      showToast('Failed to save Valgrind configuration', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate simulated loss percentage for a given skill level
  const getSimulatedLossPercent = (level: number): number => {
    if (calculationMode === 'ContinuousCurve') {
      const t = Math.max(0, Math.min(1, level / 100));
      return curveMaxLossPercent + t * (curveMinLossPercent - curveMaxLossPercent);
    }
    // TieredBrackets or PerSkill
    if (level < 25) return earlyGameLossPercent;
    if (level < 50) return midGameLossPercent;
    if (level <= 75) return lateGameLossPercent;
    return endgameLossPercent;
  };

  const applyPreset = (preset: {
    mode: 'TieredBrackets' | 'ContinuousCurve' | 'PerSkill';
    early?: number;
    mid?: number;
    late?: number;
    end?: number;
    cMax?: number;
    cMin?: number;
    name: string;
  }) => {
    setCalculationMode(preset.mode);
    if (preset.early !== undefined) setEarlyGameLossPercent(preset.early);
    if (preset.mid !== undefined) setMidGameLossPercent(preset.mid);
    if (preset.late !== undefined) setLateGameLossPercent(preset.late);
    if (preset.end !== undefined) setEndgameLossPercent(preset.end);
    if (preset.cMax !== undefined) setCurveMaxLossPercent(preset.cMax);
    if (preset.cMin !== undefined) setCurveMinLossPercent(preset.cMin);
    showToast(`Loaded preset: ${preset.name}`, 'info');
  };

  const presets = [
    {
      name: 'Valgrind Default',
      desc: '8% -> 1% (Dynamic)',
      isActive:
        calculationMode === 'TieredBrackets' &&
        earlyGameLossPercent === 8.0 &&
        midGameLossPercent === 5.0 &&
        lateGameLossPercent === 2.5 &&
        endgameLossPercent === 1.0,
      onClick: () =>
        applyPreset({
          name: 'Valgrind Default',
          mode: 'TieredBrackets',
          early: 8.0,
          mid: 5.0,
          late: 2.5,
          end: 1.0,
        }),
    },
    {
      name: 'Vanilla Valheim',
      desc: 'Flat 5.0% (Unforgiving)',
      isActive:
        calculationMode === 'TieredBrackets' &&
        earlyGameLossPercent === 5.0 &&
        midGameLossPercent === 5.0 &&
        lateGameLossPercent === 5.0 &&
        endgameLossPercent === 5.0,
      onClick: () =>
        applyPreset({
          name: 'Vanilla Valheim',
          mode: 'TieredBrackets',
          early: 5.0,
          mid: 5.0,
          late: 5.0,
          end: 5.0,
        }),
    },
    {
      name: 'Continuous Curve',
      desc: 'Max 8% -> Min 1%',
      isActive:
        calculationMode === 'ContinuousCurve' &&
        curveMaxLossPercent === 8.0 &&
        curveMinLossPercent === 1.0,
      onClick: () =>
        applyPreset({
          name: 'Continuous Curve',
          mode: 'ContinuousCurve',
          cMax: 8.0,
          cMin: 1.0,
        }),
    },
    {
      name: 'Per-Skill Tiered',
      desc: 'Evaluates each skill',
      isActive: calculationMode === 'PerSkill',
      onClick: () =>
        applyPreset({
          name: 'Per-Skill Tiered',
          mode: 'PerSkill',
          early: 8.0,
          mid: 5.0,
          late: 2.5,
          end: 1.0,
        }),
    },
    {
      name: 'Hardcore Penalty',
      desc: '15% -> 4% (Brutal)',
      isActive:
        calculationMode === 'TieredBrackets' &&
        earlyGameLossPercent === 15.0 &&
        midGameLossPercent === 10.0,
      onClick: () =>
        applyPreset({
          name: 'Hardcore Penalty',
          mode: 'TieredBrackets',
          early: 15.0,
          mid: 10.0,
          late: 7.0,
          end: 4.0,
        }),
    },
    {
      name: 'Zero Penalty',
      desc: '0.0% loss (Safe)',
      isActive:
        earlyGameLossPercent === 0 &&
        midGameLossPercent === 0 &&
        lateGameLossPercent === 0 &&
        endgameLossPercent === 0,
      onClick: () =>
        applyPreset({
          name: 'Zero Penalty',
          mode: 'TieredBrackets',
          early: 0.0,
          mid: 0.0,
          late: 0.0,
          end: 0.0,
        }),
    },
  ];

  return (
    <div className="space-y-6 w-full">
      {/* Unified Mod Header */}
      <ModHeader
        icon={FiSliders}
        title="Valgrind Dynamic Death Penalty"
        description="Control dynamic skill loss formulas, bracket tiers, and master-level protection upon death."
        mode={mode}
        onModeChange={setMode}
        tabId="valgrind"
        accentColor="orange"
        onRefresh={fetchConfig}
        isRefreshing={isLoading}
        onSave={handleSave}
        isSaving={isSaving}
      />

      {/* Mode Presets Card */}
      <SettingsCard
        title="Configuration Presets"
        subtitle="Quickly load tested skill loss penalty presets"
        icon={FiShield}
        accentColor="orange"
      >
        <PresetGrid presets={presets} accentColor="orange" />
      </SettingsCard>

      {/* Main Calculation Mode Selection */}
      <SettingsCard
        title="Calculation Mode"
        subtitle="Choose the mathematical model applied when calculating skill deductions on death"
        icon={FiLayers}
        accentColor="orange"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              id: 'TieredBrackets' as const,
              title: 'Tiered Brackets',
              badge: 'Character Average',
              icon: FiLayers,
              desc: 'Discrete loss % determined by overall average skill level. Applied uniformly to all active skills.',
            },
            {
              id: 'ContinuousCurve' as const,
              title: 'Continuous Curve',
              badge: 'Smooth Scaling',
              icon: FiTrendingDown,
              desc: 'Smooth linear interpolation between Max Loss % (at Level 0) down to Min Loss % (at Level 100).',
            },
            {
              id: 'PerSkill' as const,
              title: 'Per-Skill Brackets',
              badge: 'Individual Skill',
              icon: FiTarget,
              desc: 'Evaluates each skill independently against the brackets based on its own individual level.',
            },
          ].map((m) => {
            const isSelected = calculationMode === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setCalculationMode(m.id)}
                className={`p-5 rounded-xl text-left border transition-all flex flex-col justify-between group ${
                  isSelected
                    ? 'bg-orange-500/10 border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.15)] ring-1 ring-orange-500/30'
                    : 'bg-gray-950/60 border-gray-800 hover:border-gray-700 hover:bg-gray-900/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2.5">
                      <div
                        className={`p-2 rounded-lg ${
                          isSelected
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'bg-gray-900 text-gray-400 group-hover:text-gray-300'
                        }`}
                      >
                        <Icon size={18} />
                      </div>
                      <span
                        className={`text-sm font-bold ${
                          isSelected ? 'text-orange-300' : 'text-gray-200'
                        }`}
                      >
                        {m.title}
                      </span>
                    </div>
                    {isSelected && (
                      <FiCheck className="text-orange-400 text-base flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{m.desc}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-800/80">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-900 text-gray-400 border border-gray-800">
                    {m.badge}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Live Simulation Matrix */}
        <div className="p-4 sm:p-5 bg-gray-950/90 border border-gray-800 rounded-xl space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-orange-300 font-mono uppercase tracking-wider flex items-center space-x-1.5">
              <FiInfo className="text-orange-400" />
              <span>Real-Time Loss Simulation ({calculationMode})</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {[
              { level: 10, label: 'Novice Tier' },
              { level: 35, label: 'Adept Tier' },
              { level: 65, label: 'Expert Tier' },
              { level: 95, label: 'Master Tier' },
            ].map((sample) => {
              const lossPct = getSimulatedLossPercent(sample.level);
              const lostLevels = (sample.level * (lossPct / 100)).toFixed(1);
              const newLevel = (sample.level - parseFloat(lostLevels)).toFixed(1);
              return (
                <div
                  key={sample.level}
                  className="p-3 bg-gray-900/90 border border-gray-800/90 rounded-lg text-center font-mono"
                >
                  <div className="text-[11px] text-gray-400">
                    {sample.label} (Lvl {sample.level})
                  </div>
                  <div className="text-lg font-bold text-orange-400 my-0.5">
                    {lossPct.toFixed(1)}% Loss
                  </div>
                  <div className="text-[10px] text-gray-500">
                    -{lostLevels} lvl &rarr; {newLevel}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SettingsCard>

      {/* Advanced Mode Granular Controls */}
      <AnimatePresence>
        {mode === 'advanced' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-6 overflow-hidden"
          >
            {/* Mode-Specific Parameters */}
            {(calculationMode === 'TieredBrackets' ||
              calculationMode === 'PerSkill') && (
              <SettingsCard
                title="Tiered Brackets Fine-Tuning"
                subtitle="Configure skill loss percentage applied at each progression bracket"
                icon={FiLayers}
                accentColor="orange"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SliderField
                    label="Early Game Bracket"
                    sublabel="Skill level < 25"
                    value={earlyGameLossPercent}
                    min={0}
                    max={25}
                    step={0.5}
                    disabled={isLoading}
                    onChange={setEarlyGameLossPercent}
                    formatValue={(v) => `${v.toFixed(1)}%`}
                    accentColor="orange"
                    ticks={[
                      { label: '0% (Safe)' },
                      { label: '5% (Vanilla)' },
                      { label: '8% (Default)' },
                      { label: '25% (Brutal)' },
                    ]}
                  />

                  <SliderField
                    label="Mid Game Bracket"
                    sublabel="Skill level 25 – 50"
                    value={midGameLossPercent}
                    min={0}
                    max={25}
                    step={0.5}
                    disabled={isLoading}
                    onChange={setMidGameLossPercent}
                    formatValue={(v) => `${v.toFixed(1)}%`}
                    accentColor="orange"
                    ticks={[
                      { label: '0% (Safe)' },
                      { label: '5% (Default)' },
                      { label: '25% (Brutal)' },
                    ]}
                  />

                  <SliderField
                    label="Late Game Bracket"
                    sublabel="Skill level 50 – 75"
                    value={lateGameLossPercent}
                    min={0}
                    max={25}
                    step={0.5}
                    disabled={isLoading}
                    onChange={setLateGameLossPercent}
                    formatValue={(v) => `${v.toFixed(1)}%`}
                    accentColor="orange"
                    ticks={[
                      { label: '0% (Safe)' },
                      { label: '2.5% (Default)' },
                      { label: '5% (Vanilla)' },
                      { label: '25% (Brutal)' },
                    ]}
                  />

                  <SliderField
                    label="Endgame Master Bracket"
                    sublabel="Skill level > 75 (Master Protection)"
                    value={endgameLossPercent}
                    min={0}
                    max={25}
                    step={0.5}
                    disabled={isLoading}
                    onChange={setEndgameLossPercent}
                    formatValue={(v) => `${v.toFixed(1)}%`}
                    accentColor="orange"
                    ticks={[
                      { label: '0% (Safe)' },
                      { label: '1.0% (Default)' },
                      { label: '5% (Vanilla)' },
                      { label: '25% (Brutal)' },
                    ]}
                  />
                </div>
              </SettingsCard>
            )}

            {calculationMode === 'ContinuousCurve' && (
              <SettingsCard
                title="Continuous Curve Fine-Tuning"
                subtitle="Linear/curve interpolation between minimum and maximum penalties from level 0 to 100"
                icon={FiTrendingDown}
                accentColor="orange"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SliderField
                    label="Curve Maximum Loss %"
                    sublabel="Applied at Skill Level 0"
                    value={curveMaxLossPercent}
                    min={0}
                    max={25}
                    step={0.5}
                    disabled={isLoading}
                    onChange={setCurveMaxLossPercent}
                    formatValue={(v) => `${v.toFixed(1)}%`}
                    accentColor="orange"
                    ticks={[
                      { label: '0.0%' },
                      { label: '5.0% (Vanilla)' },
                      { label: '8.0% (Default)' },
                      { label: '25.0%' },
                    ]}
                  />

                  <SliderField
                    label="Curve Minimum Loss %"
                    sublabel="Applied at Skill Level 100"
                    value={curveMinLossPercent}
                    min={0}
                    max={25}
                    step={0.5}
                    disabled={isLoading}
                    onChange={setCurveMinLossPercent}
                    formatValue={(v) => `${v.toFixed(1)}%`}
                    accentColor="orange"
                    ticks={[
                      { label: '0.0%' },
                      { label: '1.0% (Default)' },
                      { label: '5.0% (Vanilla)' },
                      { label: '25.0%' },
                    ]}
                  />
                </div>
              </SettingsCard>
            )}

            {/* General Mechanics & Accumulator */}
            <SettingsCard
              title="General Valgrind Rules & Logging"
              subtitle="Fine-tune skill averaging formulas, death accumulator resets, and server logging"
              icon={FiActivity}
              accentColor="orange"
            >
              <div className="space-y-4">
                <div className="p-4 bg-gray-950/70 border border-gray-800 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-gray-200">
                        Use Top N Skills Only for Average
                      </span>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                        Averages only the player&apos;s top highest skills (reflecting
                        their active build) rather than all discovered skills.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
                      <input
                        type="checkbox"
                        checked={useTopNSkillsOnly}
                        disabled={isLoading}
                        onChange={(e) => setUseTopNSkillsOnly(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>

                  {useTopNSkillsOnly && (
                    <div className="pt-2 border-t border-gray-800/80">
                      <SliderField
                        label="Top Skills Count"
                        sublabel="Number of highest skills included in the average"
                        value={topNSkillsCount}
                        min={1}
                        max={20}
                        step={1}
                        disabled={isLoading}
                        onChange={setTopNSkillsCount}
                        formatValue={(v) => `${v} Skills`}
                        accentColor="orange"
                      />
                    </div>
                  )}
                </div>

                <SettingRow
                  label="Reset Accumulator Progress on Death"
                  description="If enabled, partial XP progress toward next level is wiped to 0 upon death (vanilla). If disabled, partial progress is preserved."
                  checked={resetAccumulatorOnDeath}
                  disabled={isLoading}
                  onChange={setResetAccumulatorOnDeath}
                  accentColor="orange"
                />

                <SettingRow
                  label="Enable Verbose Debug Logging"
                  description="Log detailed skill loss calculations and level deductions to the BepInEx server console on every death."
                  checked={enableDebugLogging}
                  disabled={isLoading}
                  onChange={setEnableDebugLogging}
                  accentColor="orange"
                />
              </div>
            </SettingsCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

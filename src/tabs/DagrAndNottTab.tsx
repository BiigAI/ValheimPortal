import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiClock,
  FiSun,
  FiMoon,
  FiSunset,
  FiSunrise,
  FiActivity,
  FiSliders,
} from 'react-icons/fi';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';
import { useTabMode } from '../hooks/useTabMode';
import ModHeader from '../components/ui/ModHeader';
import KpiGaugeCard from '../components/ui/KpiGaugeCard';
import SettingsCard from '../components/ui/SettingsCard';
import SettingRow from '../components/ui/SettingRow';
import SliderField from '../components/ui/SliderField';
import PresetGrid from '../components/ui/PresetGrid';

interface DagrAndNottTabProps {
  onSaved?: () => void;
}

export default function DagrAndNottTab({ onSaved }: DagrAndNottTabProps = {}) {
  const { showToast } = useToast();
  const [mode, setMode] = useTabMode('dagrnott');

  // Phase multipliers (defaults match DagrAndNott v1.0.0)
  const [dawnMultiplier, setDawnMultiplier] = useState(0.9);
  const [dayMultiplier, setDayMultiplier] = useState(0.5);
  const [duskMultiplier, setDuskMultiplier] = useState(0.9);
  const [nightMultiplier, setNightMultiplier] = useState(0.3);
  const [logPhaseTransitions, setLogPhaseTransitions] = useState(true);

  const [isApplying, setIsApplying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const cfg = await api.getDagrNottConfig();
      setDawnMultiplier(cfg.dawnMultiplier ?? 0.9);
      setDayMultiplier(cfg.dayMultiplier ?? 0.5);
      setDuskMultiplier(cfg.duskMultiplier ?? 0.9);
      setNightMultiplier(cfg.nightMultiplier ?? 0.3);
      setLogPhaseTransitions(cfg.logPhaseTransitions ?? true);
    } catch {
      showToast('Failed to fetch Dagr & Nott cycle from server', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Calculated minute estimates based on Valheim base seconds:
  // Vanilla: Dawn = 4.5m (270s), Day = 15.0m (900s), Dusk = 4.5m (270s), Night = 6.0m (360s) -> 30m total
  const dawnMinutes = +(4.5 / Math.max(0.01, dawnMultiplier)).toFixed(1);
  const dayMinutes = +(15.0 / Math.max(0.01, dayMultiplier)).toFixed(1);
  const duskMinutes = +(4.5 / Math.max(0.01, duskMultiplier)).toFixed(1);
  const nightMinutes = +(6.0 / Math.max(0.01, nightMultiplier)).toFixed(1);
  const totalMinutes = +(
    dawnMinutes +
    dayMinutes +
    duskMinutes +
    nightMinutes
  ).toFixed(1);

  // Proportional percentages
  const dawnPercent = ((dawnMinutes / (totalMinutes || 1)) * 100).toFixed(1);
  const dayPercent = ((dayMinutes / (totalMinutes || 1)) * 100).toFixed(1);
  const duskPercent = ((duskMinutes / (totalMinutes || 1)) * 100).toFixed(1);
  const nightPercent = ((nightMinutes / (totalMinutes || 1)) * 100).toFixed(1);

  const inGameHourMinutes = ((totalMinutes || 30) / 24).toFixed(2);

  const applyPreset = (
    dawn: number,
    day: number,
    dusk: number,
    night: number,
    name: string
  ) => {
    setDawnMultiplier(dawn);
    setDayMultiplier(day);
    setDuskMultiplier(dusk);
    setNightMultiplier(night);
    showToast(`Loaded preset: ${name}`, 'info');
  };

  const handleApplyConfig = async () => {
    setIsApplying(true);
    try {
      await api.saveDagrNottConfig({
        dawnMultiplier,
        dayMultiplier,
        duskMultiplier,
        nightMultiplier,
        logPhaseTransitions,
      });
      showToast(
        `Dagr & Nott cycle saved: ~${totalMinutes}m total (Dawn: ${dawnMultiplier}x, Day: ${dayMultiplier}x, Dusk: ${duskMultiplier}x, Night: ${nightMultiplier}x) (Restart pending).`,
        'success'
      );
      onSaved?.();
    } catch {
      showToast('Failed to sync Dagr & Nott cycle', 'error');
    } finally {
      setIsApplying(false);
    }
  };

  const presets = [
    {
      name: 'Dagr & Nott Balanced (1h)',
      desc: '~60m total (Extended Days, Fast Nights)',
      dawn: 0.9,
      day: 0.5,
      dusk: 0.9,
      night: 0.3,
    },
    {
      name: 'Vanilla Valheim (30m)',
      desc: '30m total (Official game baseline)',
      dawn: 1.0,
      day: 1.0,
      dusk: 1.0,
      night: 1.0,
    },
    {
      name: 'Epic Journey (2h)',
      desc: '~120m total (Maximal immersion)',
      dawn: 0.45,
      day: 0.25,
      dusk: 0.45,
      night: 0.15,
    },
    {
      name: 'Fast Rotation (15m)',
      desc: '~15m total (Rapid season rotation)',
      dawn: 2.0,
      day: 2.0,
      dusk: 2.0,
      night: 2.0,
    },
    {
      name: 'Long Day / Short Night',
      desc: '~59m total (Builders paradise)',
      dawn: 1.0,
      day: 0.33,
      dusk: 1.0,
      night: 1.2,
    },
    {
      name: 'Endless Dark Night',
      desc: '~61m total (Hardcore survival trial)',
      dawn: 1.5,
      day: 1.5,
      dusk: 1.5,
      night: 0.13,
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* ── 1. Top Hero Header ── */}
      <ModHeader
        icon={FiClock}
        title="Dagr & Nott Diurnal Engine"
        mode={mode}
        onModeChange={setMode}
        tabId="dagrnott"
        accentColor="amber"
        onRefresh={fetchConfig}
        isRefreshing={isLoading}
        onSave={handleApplyConfig}
        isSaving={isApplying}
      />

      {/* ── 2. Top Visual Telemetry Gauges (4 Cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiGaugeCard
          icon={FiClock}
          label="Total Day Cycle"
          value={`~${totalMinutes}m`}
          unit="(Vanilla: 30m)"
          progressPercent={Math.min(100, (totalMinutes / 120) * 100)}
          progressGradient="from-amber-500 to-yellow-400"
          accentColor="amber"
        />

        <KpiGaugeCard
          icon={FiSun}
          label="Daylight Window"
          value={`~${dayMinutes}m`}
          unit={`${dayPercent}% Cycle`}
          progressPercent={parseFloat(dayPercent)}
          progressGradient="from-yellow-400 to-amber-300"
          accentColor="amber"
        />

        <KpiGaugeCard
          icon={FiMoon}
          label="Nightfall Window"
          value={`~${nightMinutes}m`}
          unit={`${nightPercent}% Cycle`}
          progressPercent={parseFloat(nightPercent)}
          progressGradient="from-indigo-600 to-purple-700"
          accentColor="indigo"
        />

        <KpiGaugeCard
          icon={FiActivity}
          label="Valheim Clock Hour"
          value={`${inGameHourMinutes}m`}
          unit="Real Minutes"
          progressPercent={Math.min(100, (parseFloat(inGameHourMinutes) / 5) * 100)}
          progressGradient="from-amber-500 to-orange-500"
          accentColor="amber"
        />
      </div>

      {/* ── 3. Cycle Presets ── */}
      <SettingsCard
        title="Diurnal Cycle Presets"
        subtitle="Quickly adjust overall day and night cycle length with balanced presets"
        icon={FiClock}
        accentColor="amber"
      >
        <PresetGrid
          presets={presets.map((p) => {
            const isMatch =
              Math.abs(dawnMultiplier - p.dawn) < 0.02 &&
              Math.abs(dayMultiplier - p.day) < 0.02 &&
              Math.abs(duskMultiplier - p.dusk) < 0.02 &&
              Math.abs(nightMultiplier - p.night) < 0.02;
            return {
              name: p.name,
              desc: p.desc,
              isActive: isMatch,
              onClick: () => applyPreset(p.dawn, p.day, p.dusk, p.night, p.name),
            };
          })}
          accentColor="amber"
        />
      </SettingsCard>

      {/* ── 4. Cycle Duration & Visual Timeline Ratio Bar ── */}
      <SettingsCard
        title="Phase Timeline & Dilation Proportions"
        subtitle="Real-time breakdown of phase duration and in-game time dilation"
        icon={FiSun}
        accentColor="amber"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800/80 pb-5">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-mono">
              Estimated Total Cycle Duration
            </div>
            <div className="flex items-baseline space-x-3 mt-1">
              <span className="text-3xl sm:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-orange-300 to-indigo-300 font-mono">
                ~{totalMinutes}m
              </span>
              <span className="text-xs text-gray-400 font-mono">
                ({inGameHourMinutes}m per in-game hour &bull; Vanilla: 30.0m)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              <FiSunrise className="mr-1.5 text-amber-400" /> Dawn ~{dawnMinutes}m ({dawnPercent}%)
            </span>
            <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-yellow-500/10 text-yellow-300 border border-yellow-500/20">
              <FiSun className="mr-1.5 text-yellow-400" /> Day ~{dayMinutes}m ({dayPercent}%)
            </span>
            <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
              <FiSunset className="mr-1.5 text-rose-400" /> Dusk ~{duskMinutes}m ({duskPercent}%)
            </span>
            <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              <FiMoon className="mr-1.5 text-indigo-400" /> Night ~{nightMinutes}m ({nightPercent}%)
            </span>
          </div>
        </div>

        {/* 4-Phase Progress Bar */}
        <div className="space-y-2 pt-2">
          <div className="flex justify-between items-center text-xs font-mono text-gray-400">
            <span className="text-amber-400 flex items-center space-x-1">
              <FiSunrise size={12} />
              <span>0.00 Dawn</span>
            </span>
            <span className="text-yellow-400 flex items-center space-x-1">
              <FiSun size={12} />
              <span>0.15 Day</span>
            </span>
            <span className="text-rose-400 flex items-center space-x-1">
              <FiSunset size={12} />
              <span>0.65 Dusk</span>
            </span>
            <span className="text-indigo-400 flex items-center space-x-1">
              <FiMoon size={12} />
              <span>0.80 Night</span>
            </span>
            <span className="text-indigo-300">1.00</span>
          </div>

          <div className="h-4 w-full rounded-full flex overflow-hidden shadow-inner bg-gray-950 border border-gray-800">
            <div
              className="bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-300"
              style={{ width: `${dawnPercent}%` }}
              title={`Dawn: ~${dawnMinutes}m (${dawnPercent}%)`}
            />
            <div
              className="bg-gradient-to-r from-yellow-400 to-amber-300 transition-all duration-300"
              style={{ width: `${dayPercent}%` }}
              title={`Day: ~${dayMinutes}m (${dayPercent}%)`}
            />
            <div
              className="bg-gradient-to-r from-orange-400 to-rose-400 transition-all duration-300"
              style={{ width: `${duskPercent}%` }}
              title={`Dusk: ~${duskMinutes}m (${duskPercent}%)`}
            />
            <div
              className="bg-gradient-to-r from-indigo-600 to-purple-700 transition-all duration-300"
              style={{ width: `${nightPercent}%` }}
              title={`Night: ~${nightMinutes}m (${nightPercent}%)`}
            />
          </div>
        </div>
      </SettingsCard>

      {/* ── 5. Advanced Granular Phase Tuning ── */}
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
              title="Granular Phase Speed Multipliers"
              subtitle="Fine-tune time progression velocity (<1.0x extends time, >1.0x accelerates time)"
              icon={FiSliders}
              accentColor="amber"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SliderField
                  label="Dawn Phase Speed"
                  sublabel={`0.00 – 0.15 (15% of cycle) • ~${dawnMinutes} mins`}
                  icon={FiSunrise}
                  value={dawnMultiplier}
                  min={0.05}
                  max={3.0}
                  step={0.05}
                  vanillaDefault={1.0}
                  disabled={isLoading}
                  onChange={setDawnMultiplier}
                  formatValue={(v) => `${v.toFixed(2)}x`}
                  accentColor="amber"
                  ticks={[
                    { label: '0.10x', value: 0.1 },
                    { label: '0.50x', value: 0.5 },
                    { label: '1.00x (Vanilla)', value: 1.0 },
                    { label: '2.00x', value: 2.0 },
                    { label: '3.00x', value: 3.0 },
                  ]}
                />

                <SliderField
                  label="Daytime Phase Speed"
                  sublabel={`0.15 – 0.65 (50% of cycle) • ~${dayMinutes} mins`}
                  icon={FiSun}
                  value={dayMultiplier}
                  min={0.05}
                  max={3.0}
                  step={0.05}
                  vanillaDefault={1.0}
                  disabled={isLoading}
                  onChange={setDayMultiplier}
                  formatValue={(v) => `${v.toFixed(2)}x`}
                  accentColor="amber"
                  ticks={[
                    { label: '0.10x', value: 0.1 },
                    { label: '0.50x', value: 0.5 },
                    { label: '1.00x (Vanilla)', value: 1.0 },
                    { label: '2.00x', value: 2.0 },
                    { label: '3.00x', value: 3.0 },
                  ]}
                />

                <SliderField
                  label="Dusk Phase Speed"
                  sublabel={`0.65 – 0.80 (15% of cycle) • ~${duskMinutes} mins`}
                  icon={FiSunset}
                  value={duskMultiplier}
                  min={0.05}
                  max={3.0}
                  step={0.05}
                  vanillaDefault={1.0}
                  disabled={isLoading}
                  onChange={setDuskMultiplier}
                  formatValue={(v) => `${v.toFixed(2)}x`}
                  accentColor="amber"
                  ticks={[
                    { label: '0.10x', value: 0.1 },
                    { label: '0.50x', value: 0.5 },
                    { label: '1.00x (Vanilla)', value: 1.0 },
                    { label: '2.00x', value: 2.0 },
                    { label: '3.00x', value: 3.0 },
                  ]}
                />

                <SliderField
                  label="Nighttime Phase Speed"
                  sublabel={`0.80 – 1.00 (20% of cycle) • ~${nightMinutes} mins`}
                  icon={FiMoon}
                  value={nightMultiplier}
                  min={0.05}
                  max={3.0}
                  step={0.05}
                  vanillaDefault={1.0}
                  disabled={isLoading}
                  onChange={setNightMultiplier}
                  formatValue={(v) => `${v.toFixed(2)}x`}
                  accentColor="indigo"
                  ticks={[
                    { label: '0.10x', value: 0.1 },
                    { label: '0.50x', value: 0.5 },
                    { label: '1.00x (Vanilla)', value: 1.0 },
                    { label: '2.00x', value: 2.0 },
                    { label: '3.00x', value: 3.0 },
                  ]}
                />
              </div>
            </SettingsCard>

            <SettingsCard
              title="Server Logging"
              subtitle="Configure console logging for day and night phase shifts"
              icon={FiActivity}
              accentColor="amber"
            >
              <SettingRow
                label="Log Phase Transitions"
                description="Print server console notifications whenever day/night transitions occur (e.g. [Phase Transition] Day -> Dusk (0.90x speed))."
                checked={logPhaseTransitions}
                disabled={isLoading}
                onChange={setLogPhaseTransitions}
                accentColor="amber"
              />
            </SettingsCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiCompass,
  FiWind,
  FiCloudRain,
  FiSun,
  FiMoon,
  FiAlertTriangle,
  FiNavigation,
} from 'react-icons/fi';
import { useToast } from '../context/ToastContext';
import { api, type NjororConfig } from '../api/client';
import { useTabMode } from '../hooks/useTabMode';
import ModHeader from '../components/ui/ModHeader';
import SettingsCard from '../components/ui/SettingsCard';
import SettingRow from '../components/ui/SettingRow';
import SliderField from '../components/ui/SliderField';

interface NjororTabProps {
  onSaved?: () => void;
}

export default function NjororTab({ onSaved }: NjororTabProps = {}) {
  const { showToast } = useToast();
  const [mode, setMode] = useTabMode('njoror');

  const [config, setConfig] = useState<NjororConfig>({
    enableFairWinds: true,
    headwindMitigationPercent: 60.0,
    minWindSpeedMultiplier: 1.0,
    alwaysTailwindInOcean: false,
    checkDeflectOnWindChange: true,
    checkDeflectTimeSeconds: 0,
    enableWeatherTuning: true,
    stormFrequencyMultiplier: 1.0,
    rainFrequencyMultiplier: 1.0,
    clearFrequencyMultiplier: 1.0,
    enableSerpentTuning: true,
    daytimeSerpentSpawnChance: 0.0,
    nighttimeSerpentSpawnChance: 5.0,
    serpentSpawnIntervalSeconds: 1000.0,
    allowCalmWeatherDaySerpents: false,
    enableDebugLogging: false,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeCompassAngle, setActiveCompassAngle] = useState(45);

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const cfg = await api.getNjororConfig();
      setConfig(cfg);
    } catch {
      showToast('Failed to fetch Njörðr configuration from server', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    const interval = setInterval(() => {
      setActiveCompassAngle((prev) => (prev + 15) % 360);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const res = await api.saveNjororConfig(config);
      setConfig(res.config);
      showToast(
        'Njörðr ocean atmospheric parameters saved (Restart pending).',
        'success'
      );
      onSaved?.();
    } catch {
      showToast('Failed to save Njörðr configuration', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Mod Header */}
      <ModHeader
        icon={FiCompass}
        title="Njörðr Fair Winds & Ocean Weather"
        description="Server-side wind deflection, storm frequency modulation, and Sea Serpent spawner tables."
        mode={mode}
        onModeChange={setMode}
        tabId="njoror"
        accentColor="cyan"
        onRefresh={fetchConfig}
        isRefreshing={isLoading}
        onSave={handleSaveConfig}
        isSaving={isSaving}
      />

      {/* 2-Column Grid: Core Rules & Wind Vector Compass */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Core Rules Toggles */}
        <SettingsCard
          title="Ocean Atmosphere Modules"
          subtitle="Toggle sailing assistance, dynamic weather modulation, and serpents"
          icon={FiWind}
          accentColor="cyan"
        >
          <div className="space-y-3">
            <SettingRow
              label="Fair Winds & Sailing Assistance"
              description="Mitigates dead headwinds by deflecting wind into favorable crosswinds"
              checked={config.enableFairWinds}
              disabled={isLoading}
              onChange={(c) => setConfig({ ...config, enableFairWinds: c })}
              accentColor="cyan"
            />

            <SettingRow
              label="Ocean Tailwind Sanctuary"
              description="Guarantees full tailwind for ships navigating deep ocean zones"
              checked={config.alwaysTailwindInOcean}
              disabled={!config.enableFairWinds || isLoading}
              onChange={(c) =>
                setConfig({ ...config, alwaysTailwindInOcean: c })
              }
              accentColor="cyan"
            />

            <SettingRow
              label="Check Deflect on Wind Change"
              description="Evaluate fair-wind deflection only when Valheim selects a new wind target (recommended, takes priority over timed)"
              checked={config.checkDeflectOnWindChange}
              disabled={!config.enableFairWinds || isLoading}
              onChange={(c) =>
                setConfig({ ...config, checkDeflectOnWindChange: c })
              }
              accentColor="cyan"
            />

            <div className={`p-3.5 bg-gray-950/80 rounded-xl border border-gray-800 ${config.checkDeflectOnWindChange ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1 mr-4">
                  <span className="block text-sm font-semibold text-gray-200">Timed Deflect Check (seconds)</span>
                  <span className="block text-[11px] text-gray-400 mt-0.5">When wind-change check is off, re-evaluate fair winds at this interval. 0 = disabled.</span>
                </div>
                <input
                  type="number"
                  min={0}
                  max={3600}
                  step={10}
                  value={config.checkDeflectTimeSeconds}
                  disabled={config.checkDeflectOnWindChange || !config.enableFairWinds || isLoading}
                  onChange={(e) =>
                    setConfig({ ...config, checkDeflectTimeSeconds: Math.max(0, Math.min(3600, parseInt(e.target.value) || 0)) })
                  }
                  className="w-24 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 text-center font-mono focus:outline-none focus:border-cyan-500/80 transition-all"
                />
              </div>
            </div>

            <SettingRow
              label="Atmospheric Weather Modulation"
              description="Enables server-side weather tuning for thunderstorms, rain, and clear skies"
              checked={config.enableWeatherTuning}
              disabled={isLoading}
              onChange={(c) => setConfig({ ...config, enableWeatherTuning: c })}
              accentColor="cyan"
            />

            <SettingRow
              label="Sea Serpent Encounter Controls"
              description="Enables custom spawn rates and timing rules for ocean sea serpents"
              checked={config.enableSerpentTuning}
              disabled={isLoading}
              onChange={(c) =>
                setConfig({ ...config, enableSerpentTuning: c })
              }
              accentColor="cyan"
            />

            <SettingRow
              label="Enable Verbose Debug Logging"
              description="Log detailed Njoror diagnostics. Errors and successful headwind deflections are always logged."
              checked={config.enableDebugLogging}
              disabled={isLoading}
              onChange={(c) => setConfig({ ...config, enableDebugLogging: c })}
              accentColor="cyan"
            />
          </div>
        </SettingsCard>

        {/* Live Wind Vector Visualizer */}
        <SettingsCard
          title="Authoritative Wind Vector Simulator"
          subtitle="Real-time preview of server-side deflection angles and velocity"
          icon={FiNavigation}
          accentColor="cyan"
        >
          <div className="p-4 bg-gray-950/80 border border-gray-800 rounded-xl flex flex-col items-center justify-center space-y-3">
            <div className="relative w-32 h-32 rounded-full border-2 border-dashed border-cyan-500/30 flex items-center justify-center bg-gray-900/50 shadow-inner">
              {/* Compass points */}
              <span className="absolute top-1.5 text-[10px] font-bold text-gray-500 font-mono">
                N
              </span>
              <span className="absolute bottom-1.5 text-[10px] font-bold text-gray-500 font-mono">
                S
              </span>
              <span className="absolute left-2 text-[10px] font-bold text-gray-500 font-mono">
                W
              </span>
              <span className="absolute right-2 text-[10px] font-bold text-gray-500 font-mono">
                E
              </span>

              {/* Ship marker */}
              <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs shadow-md">
                ⛵
              </div>

              {/* Wind arrow */}
              <div
                className="absolute inset-0 flex items-center justify-center transition-transform duration-700 pointer-events-none"
                style={{ transform: `rotate(${activeCompassAngle}deg)` }}
              >
                <div className="w-1 h-12 bg-gradient-to-t from-transparent via-cyan-400 to-cyan-200 rounded-full -translate-y-4 shadow-lg shadow-cyan-400/50"></div>
              </div>
            </div>
            <span className="text-[11px] font-mono text-cyan-300">
              Wind Angle: {activeCompassAngle}° (
              {activeCompassAngle < 90
                ? 'NE'
                : activeCompassAngle < 180
                ? 'SE'
                : activeCompassAngle < 270
                ? 'SW'
                : 'NW'}
              ) • Deflection: {config.headwindMitigationPercent.toFixed(0)}%
            </span>
          </div>
        </SettingsCard>
      </div>

      {/* Advanced Fine-Tuning */}
      <AnimatePresence>
        {mode === 'advanced' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-6 overflow-hidden"
          >
            {/* Fair Winds Granular Sliders */}
            <SettingsCard
              title="Fair Winds Deflection Fine-Tuning"
              subtitle="Control headwind mitigation probabilities and minimum boat velocity"
              icon={FiWind}
              accentColor="cyan"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SliderField
                  label="Headwind Deflection Chance"
                  sublabel="Probability of converting headwind into favorable crosswind"
                  value={config.headwindMitigationPercent}
                  min={0}
                  max={100}
                  step={5}
                  disabled={!config.enableFairWinds || isLoading}
                  onChange={(v) =>
                    setConfig({ ...config, headwindMitigationPercent: v })
                  }
                  formatValue={(v) => `${v.toFixed(0)}%`}
                  accentColor="cyan"
                  ticks={[
                    { label: '0% (Vanilla)' },
                    { label: '60% (Recommended)' },
                    { label: '100% (No Headwinds)' },
                  ]}
                />

                <SliderField
                  label="Minimum Wind Speed Multiplier"
                  sublabel="Floor multiplier for wind force across all biomes"
                  value={config.minWindSpeedMultiplier}
                  min={0.5}
                  max={2.5}
                  step={0.1}
                  disabled={!config.enableFairWinds || isLoading}
                  onChange={(v) =>
                    setConfig({ ...config, minWindSpeedMultiplier: v })
                  }
                  formatValue={(v) => `${v.toFixed(1)}x`}
                  accentColor="cyan"
                  ticks={[
                    { label: '0.5x (Light)' },
                    { label: '1.0x (Vanilla)' },
                    { label: '2.5x (Gale)' },
                  ]}
                />
              </div>
            </SettingsCard>

            {/* Ocean Weather Modulation */}
            <SettingsCard
              title="Atmospheric Weather Modulation"
              subtitle="Scale relative frequencies of storms, rainfall, and sunny weather"
              icon={FiCloudRain}
              accentColor="cyan"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SliderField
                  label="ThunderStorms"
                  sublabel="Heavy rain, lightning & violent waves"
                  icon={FiAlertTriangle}
                  value={config.stormFrequencyMultiplier}
                  min={0.1}
                  max={3.0}
                  step={0.1}
                  disabled={!config.enableWeatherTuning || isLoading}
                  onChange={(v) =>
                    setConfig({ ...config, stormFrequencyMultiplier: v })
                  }
                  formatValue={(v) => `${v.toFixed(2)}x`}
                  accentColor="indigo"
                  ticks={[
                    { label: '0.1x (Calm)' },
                    { label: '1.0x' },
                    { label: '3.0x (Tempest)' },
                  ]}
                />

                <SliderField
                  label="Rain & Fog"
                  sublabel="Standard precipitation and overcast"
                  icon={FiCloudRain}
                  value={config.rainFrequencyMultiplier}
                  min={0.1}
                  max={3.0}
                  step={0.1}
                  disabled={!config.enableWeatherTuning || isLoading}
                  onChange={(v) =>
                    setConfig({ ...config, rainFrequencyMultiplier: v })
                  }
                  formatValue={(v) => `${v.toFixed(2)}x`}
                  accentColor="cyan"
                  ticks={[
                    { label: '0.1x (Dry)' },
                    { label: '1.0x' },
                    { label: '3.0x (Soggy)' },
                  ]}
                />

                <SliderField
                  label="Clear Skies"
                  sublabel="Calm sunny conditions with high visibility"
                  icon={FiSun}
                  value={config.clearFrequencyMultiplier}
                  min={0.5}
                  max={3.0}
                  step={0.1}
                  disabled={!config.enableWeatherTuning || isLoading}
                  onChange={(v) =>
                    setConfig({ ...config, clearFrequencyMultiplier: v })
                  }
                  formatValue={(v) => `${v.toFixed(2)}x`}
                  accentColor="amber"
                  ticks={[
                    { label: '0.5x' },
                    { label: '1.0x' },
                    { label: '3.0x (Sunny)' },
                  ]}
                />
              </div>
            </SettingsCard>

            {/* Sea Serpent Encounters */}
            <SettingsCard
              title="Sea Serpent Encounter Controls"
              subtitle="Configure daytime and nighttime encounter frequencies in ocean biomes"
              icon={FiCompass}
              accentColor="cyan"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SliderField
                    label="Daytime Serpent Spawn Probability"
                    sublabel="Probability of encounter during day hours"
                    icon={FiSun}
                    value={config.daytimeSerpentSpawnChance}
                    min={0}
                    max={30}
                    step={1}
                    disabled={!config.enableSerpentTuning || isLoading}
                    onChange={(v) =>
                      setConfig({ ...config, daytimeSerpentSpawnChance: v })
                    }
                    formatValue={(v) => `${v.toFixed(0)}%`}
                    accentColor="cyan"
                    ticks={[
                      { label: '0% (Vanilla)' },
                      { label: '15%' },
                      { label: '30% (High)' },
                    ]}
                  />

                  <SliderField
                    label="Nighttime Serpent Spawn Probability"
                    sublabel="Probability of encounter during night hours"
                    icon={FiMoon}
                    value={config.nighttimeSerpentSpawnChance}
                    min={1}
                    max={50}
                    step={1}
                    disabled={!config.enableSerpentTuning || isLoading}
                    onChange={(v) =>
                      setConfig({ ...config, nighttimeSerpentSpawnChance: v })
                    }
                    formatValue={(v) => `${v.toFixed(0)}%`}
                    accentColor="indigo"
                    ticks={[
                      { label: '1%' },
                      { label: '5% (Vanilla)' },
                      { label: '50% (Infested)' },
                    ]}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="flex items-center justify-between p-3.5 bg-gray-950/80 rounded-xl border border-gray-800">
                    <div>
                      <span className="text-xs font-semibold text-gray-200 block">
                        Ocean Check Interval
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">
                        Vanilla: 1000 seconds
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="number"
                        min="100"
                        max="2000"
                        step="50"
                        value={config.serpentSpawnIntervalSeconds}
                        disabled={!config.enableSerpentTuning || isLoading}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            serpentSpawnIntervalSeconds:
                              parseFloat(e.target.value) || 1000,
                          })
                        }
                        className="w-20 bg-gray-900 border border-gray-700/80 rounded-lg px-2 py-1 text-xs font-mono text-cyan-300 text-right focus:outline-none focus:border-cyan-500"
                      />
                      <span className="text-xs text-gray-400">sec</span>
                    </div>
                  </div>

                  <SettingRow
                    label="Allow Day Spawns in Calm Weather"
                    description="Vanilla requires storm/rain for daytime serpent spawns"
                    checked={config.allowCalmWeatherDaySerpents}
                    disabled={!config.enableSerpentTuning || isLoading}
                    onChange={(c) =>
                      setConfig({ ...config, allowCalmWeatherDaySerpents: c })
                    }
                    accentColor="cyan"
                  />
                </div>
              </div>
            </SettingsCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

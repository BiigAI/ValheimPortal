import { useState, useEffect } from 'react';
import { 
  FiCompass, FiWind, FiCloudRain, FiCheck, FiRefreshCw, 
  FiSun, FiMoon, FiAlertTriangle, FiNavigation 
} from 'react-icons/fi';
import { useToast } from '../context/ToastContext';
import { api, type NjororConfig } from '../api/client';

export default function NjororTab() {
  const { showToast } = useToast();
  const [config, setConfig] = useState<NjororConfig>({
    enableFairWinds: true,
    headwindMitigationPercent: 60.0,
    minWindSpeedMultiplier: 1.0,
    alwaysTailwindInOcean: false,
    enableWeatherTuning: true,
    stormFrequencyMultiplier: 1.0,
    rainFrequencyMultiplier: 1.0,
    clearFrequencyMultiplier: 1.0,
    enableSerpentTuning: true,
    daytimeSerpentSpawnChance: 0.0,
    nighttimeSerpentSpawnChance: 5.0,
    serpentSpawnIntervalSeconds: 1000.0,
    allowCalmWeatherDaySerpents: false,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeCompassAngle, setActiveCompassAngle] = useState(45);

  const fetchConfig = async () => {
    try {
      const cfg = await api.getNjororConfig();
      setConfig(cfg);
    } catch (err) {
      showToast('Failed to fetch Njörðr configuration from server', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    const interval = setInterval(() => {
      setActiveCompassAngle(prev => (prev + 15) % 360);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const res = await api.saveNjororConfig(config);
      setConfig(res.config);
      showToast('Njörðr ocean atmospheric parameters saved.', 'success');
    } catch (err) {
      showToast('Failed to save Njörðr configuration', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 w-full">
      {/* Header Banner */}
      <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-xl">
            <FiCompass size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-100">Njörðr Fair Winds & Ocean Weather</h2>
            <p className="text-xs text-gray-400 mt-0.5">Server-side wind deflection, storm frequency modulation, and Sea Serpent spawner tables.</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchConfig}
            className="p-2.5 bg-gray-800/80 hover:bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700/80 rounded-xl transition-all"
            title="Reload config"
          >
            <FiRefreshCw size={16} />
          </button>
          <button
            onClick={handleSaveConfig}
            disabled={isSaving || isLoading}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-6 py-2.5 rounded-xl font-medium text-xs transition-all shadow-lg shadow-cyan-600/25 flex items-center space-x-2"
          >
            <FiCheck />
            <span>{isSaving ? 'Saving...' : 'Save & Apply Config'}</span>
          </button>
        </div>
      </div>

      {/* 2-Column Responsive Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        
        {/* Left Column: Fair Winds & Sailing Assistance */}
        <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-gray-800/80 pb-4">
            <div className="flex items-center space-x-2.5">
              <FiWind className="text-cyan-400 text-lg" />
              <h3 className="font-semibold text-gray-100 text-base">Fair Winds & Sailing Mechanics</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={config.enableFairWinds}
                onChange={(e) => setConfig({ ...config, enableFairWinds: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
            </label>
          </div>

          <div className="space-y-6">
            {/* Headwind Mitigation Slider */}
            <div className="space-y-3 p-4 bg-gray-950/70 rounded-xl border border-gray-800">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-gray-300">Headwind Deflection Chance</label>
                <span className="text-sm font-bold font-mono text-cyan-400">{config.headwindMitigationPercent.toFixed(0)}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="100" step="5"
                value={config.headwindMitigationPercent}
                disabled={!config.enableFairWinds}
                onChange={(e) => setConfig({ ...config, headwindMitigationPercent: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-900 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-40"
              />
              <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                <span>0% (Pure Vanilla RNG)</span>
                <span>60% (Recommended)</span>
                <span>100% (No Headwinds)</span>
              </div>
              <p className="text-[11px] text-gray-400">
                When a boat encounters a dead headwind, deflects wind angle into a favorable crosswind so sails always catch speed.
              </p>
            </div>

            {/* Ocean Forced Tailwind Toggle */}
            <label className="flex items-center justify-between p-3.5 bg-gray-950/70 rounded-xl border border-gray-800 cursor-pointer">
              <div>
                <span className="text-xs font-semibold text-gray-200 block">Ocean Tailwind Sanctuary</span>
                <span className="text-[11px] text-gray-400">Forces full tailwind for ships traveling across deep ocean biomes</span>
              </div>
              <input
                type="checkbox"
                checked={config.alwaysTailwindInOcean}
                disabled={!config.enableFairWinds}
                onChange={(e) => setConfig({ ...config, alwaysTailwindInOcean: e.target.checked })}
                className="accent-cyan-500 w-4 h-4 cursor-pointer disabled:opacity-40"
              />
            </label>

            {/* Live Wind Compass Visualizer Card */}
            <div className="p-5 bg-gray-950/90 border border-gray-800 rounded-2xl flex flex-col items-center justify-center space-y-3">
              <span className="text-xs font-semibold text-gray-300 font-mono flex items-center space-x-1.5">
                <FiNavigation className="text-cyan-400" />
                <span>Authoritative Wind Vector Simulator</span>
              </span>
              <div className="relative w-32 h-32 rounded-full border-2 border-dashed border-cyan-500/30 flex items-center justify-center bg-gray-900/50 shadow-inner">
                {/* Compass points */}
                <span className="absolute top-1 text-[10px] font-bold text-gray-500 font-mono">N</span>
                <span className="absolute bottom-1 text-[10px] font-bold text-gray-500 font-mono">S</span>
                <span className="absolute left-1.5 text-[10px] font-bold text-gray-500 font-mono">W</span>
                <span className="absolute right-1.5 text-[10px] font-bold text-gray-500 font-mono">E</span>
                
                {/* Ship marker */}
                <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs">
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
                Wind: {activeCompassAngle}° ({activeCompassAngle < 90 ? 'NE' : activeCompassAngle < 180 ? 'SE' : activeCompassAngle < 270 ? 'SW' : 'NW'}) • Velocity: {config.minWindSpeedMultiplier.toFixed(1)}x
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Ocean Weather & Sea Serpents */}
        <div className="space-y-8">

      {/* Section 2: Ocean Weather & Storm Frequencies */}
      <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-gray-800/80 pb-4">
          <div className="flex items-center space-x-2.5">
            <FiCloudRain className="text-blue-400 text-lg" />
            <h3 className="font-semibold text-gray-100 text-base">Weather & Atmosphere Cycle Modulation</h3>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={config.enableWeatherTuning}
              onChange={(e) => setConfig({ ...config, enableWeatherTuning: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-8 h-4 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Storm Frequency */}
          <div className="space-y-3 p-4 bg-gray-950/70 rounded-xl border border-gray-800">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-gray-300 flex items-center space-x-1.5">
                <FiAlertTriangle className="text-purple-400" />
                <span>ThunderStorms</span>
              </label>
              <span className="text-xs font-bold font-mono text-purple-400">{config.stormFrequencyMultiplier.toFixed(2)}x</span>
            </div>
            <input 
              type="range" 
              min="0.1" max="3.0" step="0.1"
              value={config.stormFrequencyMultiplier}
              disabled={!config.enableWeatherTuning}
              onChange={(e) => setConfig({ ...config, stormFrequencyMultiplier: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-900 rounded-lg appearance-none cursor-pointer accent-purple-500 disabled:opacity-40"
            />
            <div className="flex justify-between text-[10px] text-gray-500 font-mono">
              <span>0.1x (Calm)</span>
              <span>1.0x</span>
              <span>3.0x (Tempest)</span>
            </div>
          </div>

          {/* Rain / Overcast Frequency */}
          <div className="space-y-3 p-4 bg-gray-950/70 rounded-xl border border-gray-800">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-gray-300 flex items-center space-x-1.5">
                <FiCloudRain className="text-blue-400" />
                <span>Rain & Fog</span>
              </label>
              <span className="text-xs font-bold font-mono text-blue-400">{config.rainFrequencyMultiplier.toFixed(2)}x</span>
            </div>
            <input 
              type="range" 
              min="0.1" max="3.0" step="0.1"
              value={config.rainFrequencyMultiplier}
              disabled={!config.enableWeatherTuning}
              onChange={(e) => setConfig({ ...config, rainFrequencyMultiplier: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-900 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-40"
            />
            <div className="flex justify-between text-[10px] text-gray-500 font-mono">
              <span>0.1x (Dry)</span>
              <span>1.0x</span>
              <span>3.0x (Soggy)</span>
            </div>
          </div>

          {/* Clear Sky Frequency */}
          <div className="space-y-3 p-4 bg-gray-950/70 rounded-xl border border-gray-800">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-gray-300 flex items-center space-x-1.5">
                <FiSun className="text-yellow-400" />
                <span>Clear Skies</span>
              </label>
              <span className="text-xs font-bold font-mono text-yellow-400">{config.clearFrequencyMultiplier.toFixed(2)}x</span>
            </div>
            <input 
              type="range" 
              min="0.5" max="3.0" step="0.1"
              value={config.clearFrequencyMultiplier}
              disabled={!config.enableWeatherTuning}
              onChange={(e) => setConfig({ ...config, clearFrequencyMultiplier: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-900 rounded-lg appearance-none cursor-pointer accent-yellow-500 disabled:opacity-40"
            />
            <div className="flex justify-between text-[10px] text-gray-500 font-mono">
              <span>0.5x</span>
              <span>1.0x</span>
              <span>3.0x (Sunny)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Ocean Sea Serpent Spawners */}
      <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-gray-800/80 pb-4">
          <div className="flex items-center space-x-2.5">
            <span className="text-emerald-400 text-lg">🐍</span>
            <h3 className="font-semibold text-gray-100 text-base">Ocean Sea Serpent Encounter Controls</h3>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={config.enableSerpentTuning}
              onChange={(e) => setConfig({ ...config, enableSerpentTuning: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-8 h-4 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Daytime Chance Slider */}
          <div className="space-y-3 p-4 bg-gray-950/70 rounded-xl border border-gray-800">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-gray-300 flex items-center space-x-1.5">
                <FiSun className="text-yellow-400" />
                <span>Daytime Serpent Spawn Probability</span>
              </label>
              <span className="text-sm font-bold font-mono text-emerald-400">{config.daytimeSerpentSpawnChance.toFixed(0)}%</span>
            </div>
            <input 
              type="range" 
              min="0" max="30" step="1"
              value={config.daytimeSerpentSpawnChance}
              disabled={!config.enableSerpentTuning}
              onChange={(e) => setConfig({ ...config, daytimeSerpentSpawnChance: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-900 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-40"
            />
            <div className="flex justify-between text-[10px] text-gray-500 font-mono">
              <span>0% (Vanilla storm-only)</span>
              <span>15%</span>
              <span>30% (High Danger)</span>
            </div>
          </div>

          {/* Nighttime Chance Slider */}
          <div className="space-y-3 p-4 bg-gray-950/70 rounded-xl border border-gray-800">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-gray-300 flex items-center space-x-1.5">
                <FiMoon className="text-indigo-400" />
                <span>Nighttime Serpent Spawn Probability</span>
              </label>
              <span className="text-sm font-bold font-mono text-indigo-400">{config.nighttimeSerpentSpawnChance.toFixed(0)}%</span>
            </div>
            <input 
              type="range" 
              min="1" max="50" step="1"
              value={config.nighttimeSerpentSpawnChance}
              disabled={!config.enableSerpentTuning}
              onChange={(e) => setConfig({ ...config, nighttimeSerpentSpawnChance: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-900 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-40"
            />
            <div className="flex justify-between text-[10px] text-gray-500 font-mono">
              <span>1%</span>
              <span>5% (Vanilla Default)</span>
              <span>50% (Serpent Infested)</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3.5 bg-gray-950 rounded-xl border border-gray-800">
            <div>
              <span className="text-xs font-semibold text-gray-200 block">Ocean Check Interval</span>
              <span className="text-[10px] text-gray-500">Vanilla: 1000 seconds</span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="100" max="2000" step="50"
                value={config.serpentSpawnIntervalSeconds}
                disabled={!config.enableSerpentTuning}
                onChange={(e) => setConfig({ ...config, serpentSpawnIntervalSeconds: parseFloat(e.target.value) || 1000 })}
                className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-emerald-300 text-right focus:outline-none focus:border-emerald-500"
              />
              <span className="text-xs text-gray-400">sec</span>
            </div>
          </div>

          <label className="flex items-center justify-between p-3.5 bg-gray-950 rounded-xl border border-gray-800 cursor-pointer">
            <div>
              <span className="text-xs font-semibold text-gray-200 block">Allow Day Spawns in Calm Weather</span>
              <span className="text-[10px] text-gray-500">Vanilla requires rain/storms for day encounters</span>
            </div>
            <input
              type="checkbox"
              checked={config.allowCalmWeatherDaySerpents}
              disabled={!config.enableSerpentTuning}
              onChange={(e) => setConfig({ ...config, allowCalmWeatherDaySerpents: e.target.checked })}
              className="accent-emerald-500 w-4 h-4 cursor-pointer disabled:opacity-40"
            />
          </label>
        </div>
      </div>
    </div>
  </div>
</div>
  );
}

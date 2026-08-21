import { useState, useEffect } from 'react';
import { 
  FiShield, FiUsers, FiMoon, FiNavigation, 
  FiCheck, FiRefreshCw, FiZap, FiTarget, FiInfo 
} from 'react-icons/fi';
import { useToast } from '../context/ToastContext';
import { api, type HeimdallrConfig } from '../api/client';

export default function HeimdallrTab() {
  const { showToast } = useToast();
  const [config, setConfig] = useState<HeimdallrConfig>({
    enableCustomScaling: true,
    playerHealthScalePercent: 30.0,
    playerDamageScalePercent: 4.0,
    playerRangeRadius: 100.0,
    bossHealthMultiplier: 1.25,
    bossDamageMultiplier: 1.10,
    enableStarTweaks: true,
    nightStarBonusChance: 15.0,
    distanceCenterMultiplier: 1.5,
    globalOneStarChance: 10.0,
    globalTwoStarChance: 10.0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [simPlayerCount, setSimPlayerCount] = useState(3);

  const fetchConfig = async () => {
    try {
      const cfg = await api.getHeimdallrConfig();
      setConfig(cfg);
    } catch (err) {
      showToast('Failed to fetch Heimdallr configuration from server', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const res = await api.saveHeimdallrConfig(config);
      setConfig(res.config);
      showToast('Heimdallr difficulty scaling & star distribution saved.', 'success');
    } catch (err) {
      showToast('Failed to save Heimdallr configuration', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Math simulation for preview card
  const simulatedMobHpMultiplier = 1 + (simPlayerCount - 1) * (config.playerHealthScalePercent / 100);
  const simulatedMobDmgMultiplier = 1 + (simPlayerCount - 1) * (config.playerDamageScalePercent / 100);
  const simulatedBossHpMultiplier = simulatedMobHpMultiplier * config.bossHealthMultiplier;

  return (
    <div className="space-y-8 w-full">
      {/* Header Banner */}
      <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
            <FiShield size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-100">Heimdallr Dynamic Scaling Engine</h2>
            <p className="text-xs text-gray-400 mt-0.5">Server-side multiplayer health/damage curves, boss tuning, and star creature distribution.</p>
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
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-6 py-2.5 rounded-xl font-medium text-xs transition-all shadow-lg shadow-amber-500/25 flex items-center space-x-2"
          >
            <FiCheck />
            <span>{isSaving ? 'Saving...' : 'Save & Apply Config'}</span>
          </button>
        </div>
      </div>

      {/* 2-Column Responsive Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        
        {/* Left Column: Multiplayer Player Scaling */}
        <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-gray-800/80 pb-4">
            <div className="flex items-center space-x-2.5">
              <FiUsers className="text-amber-400 text-lg" />
              <h3 className="font-semibold text-gray-100 text-base">Multiplayer Difficulty Scaling</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={config.enableCustomScaling}
                onChange={(e) => setConfig({ ...config, enableCustomScaling: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Health Scale Slider */}
            <div className="space-y-3 p-4 bg-gray-950/70 rounded-xl border border-gray-800">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-gray-300">Creature Health Scale / Extra Player</label>
                <span className="text-sm font-bold font-mono text-amber-400">+{config.playerHealthScalePercent.toFixed(0)}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="100" step="5"
                value={config.playerHealthScalePercent}
                disabled={!config.enableCustomScaling}
                onChange={(e) => setConfig({ ...config, playerHealthScalePercent: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-900 rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:opacity-40"
              />
              <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                <span>0% (No HP scaling)</span>
                <span>30% (Vanilla default)</span>
                <span>100% (Double HP/player)</span>
              </div>
            </div>

            {/* Damage Scale Slider */}
            <div className="space-y-3 p-4 bg-gray-950/70 rounded-xl border border-gray-800">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-gray-300">Creature Damage Scale / Extra Player</label>
                <span className="text-sm font-bold font-mono text-orange-400">+{config.playerDamageScalePercent.toFixed(1)}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="25" step="1"
                value={config.playerDamageScalePercent}
                disabled={!config.enableCustomScaling}
                onChange={(e) => setConfig({ ...config, playerDamageScalePercent: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-900 rounded-lg appearance-none cursor-pointer accent-orange-500 disabled:opacity-40"
              />
              <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                <span>0% (No extra damage)</span>
                <span>4% (Vanilla default)</span>
                <span>25% (Brutal damage)</span>
              </div>
            </div>
          </div>

          {/* Player Range Radius Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-gray-300">Player Detection Range Radius</label>
              <span className="text-xs font-bold font-mono text-gray-200">{config.playerRangeRadius} meters</span>
            </div>
            <input 
              type="range" 
              min="20" max="300" step="10"
              value={config.playerRangeRadius}
              disabled={!config.enableCustomScaling}
              onChange={(e) => setConfig({ ...config, playerRangeRadius: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-950 rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:opacity-40"
            />
          </div>

          {/* Live Multiplayer Scaling Simulator Box */}
          <div className="p-4 bg-gray-950/90 border border-gray-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-300 flex items-center space-x-1.5">
                <FiInfo />
                <span>Real-Time Group Scaling Simulator</span>
              </span>
              <div className="flex items-center space-x-2 text-xs font-mono text-gray-400">
                <span>Nearby Players:</span>
                <div className="flex space-x-1">
                  {[1, 2, 3, 5, 8].map(p => (
                    <button
                      key={p}
                      onClick={() => setSimPlayerCount(p)}
                      className={`px-2 py-0.5 rounded text-xs ${
                        simPlayerCount === p ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold' : 'bg-gray-900 text-gray-400'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              With <strong className="text-gray-200">{simPlayerCount} players</strong> in combat range: Standard creatures have <strong className="text-amber-400">{simPlayerCount === 1 ? '1.00x' : `${simulatedMobHpMultiplier.toFixed(2)}x`} HP</strong> and deal <strong className="text-orange-400">{simPlayerCount === 1 ? '1.00x' : `${simulatedMobDmgMultiplier.toFixed(2)}x`} Damage</strong>. Bosses have <strong className="text-red-400">{simulatedBossHpMultiplier.toFixed(2)}x Total HP</strong>.
            </p>
          </div>
        </div>

        {/* Right Column: Boss Tuning & Star Spawning */}
        <div className="space-y-8">

      {/* Section 2: Boss Tuning */}
      <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center space-x-2.5 border-b border-gray-800/80 pb-4">
          <FiZap className="text-red-400 text-lg" />
          <h3 className="font-semibold text-gray-100 text-base">Legendary Boss Tuning</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Boss HP Multiplier */}
          <div className="space-y-3 p-4 bg-gray-950/70 rounded-xl border border-gray-800">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-gray-300">Boss Base Health Multiplier</label>
              <span className="text-sm font-bold font-mono text-red-400">{config.bossHealthMultiplier.toFixed(2)}x</span>
            </div>
            <input 
              type="range" 
              min="0.5" max="5.0" step="0.05"
              value={config.bossHealthMultiplier}
              onChange={(e) => setConfig({ ...config, bossHealthMultiplier: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-900 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
            <div className="flex justify-between text-[10px] text-gray-500 font-mono">
              <span>0.5x (Weaker)</span>
              <span>1.0x (Vanilla)</span>
              <span>2.5x (Raid Boss)</span>
              <span>5.0x (Mythic)</span>
            </div>
          </div>

          {/* Boss Damage Multiplier */}
          <div className="space-y-3 p-4 bg-gray-950/70 rounded-xl border border-gray-800">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-gray-300">Boss Base Damage Multiplier</label>
              <span className="text-sm font-bold font-mono text-orange-400">{config.bossDamageMultiplier.toFixed(2)}x</span>
            </div>
            <input 
              type="range" 
              min="0.5" max="3.0" step="0.05"
              value={config.bossDamageMultiplier}
              onChange={(e) => setConfig({ ...config, bossDamageMultiplier: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-900 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
            <div className="flex justify-between text-[10px] text-gray-500 font-mono">
              <span>0.5x (Forgiving)</span>
              <span>1.0x (Vanilla)</span>
              <span>3.0x (Punishing)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Star Creature Distribution (1-Star & 2-Star) */}
      <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-gray-800/80 pb-4">
          <div className="flex items-center space-x-2.5">
            <FiTarget className="text-yellow-400 text-lg" />
            <h3 className="font-semibold text-gray-100 text-base">Star Creature Spawning & Distribution</h3>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={config.enableStarTweaks}
              onChange={(e) => setConfig({ ...config, enableStarTweaks: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-8 h-4 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-yellow-500"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Night Bonus Chance */}
          <div className="space-y-3 p-4 bg-gray-950/70 rounded-xl border border-gray-800">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-gray-300 flex items-center space-x-1.5">
                <FiMoon className="text-indigo-400" />
                <span>Nighttime Star Spawn Boost</span>
              </label>
              <span className="text-sm font-bold font-mono text-yellow-400">+{config.nightStarBonusChance.toFixed(0)}%</span>
            </div>
            <input 
              type="range" 
              min="0" max="50" step="5"
              value={config.nightStarBonusChance}
              disabled={!config.enableStarTweaks}
              onChange={(e) => setConfig({ ...config, nightStarBonusChance: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-900 rounded-lg appearance-none cursor-pointer accent-yellow-500 disabled:opacity-40"
            />
            <p className="text-[11px] text-gray-500">Makes night wilderness exploration significantly more dangerous.</p>
          </div>

          {/* Distance from Center Multiplier */}
          <div className="space-y-3 p-4 bg-gray-950/70 rounded-xl border border-gray-800">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-gray-300 flex items-center space-x-1.5">
                <FiNavigation className="text-blue-400" />
                <span>Perimeter Distance Multiplier</span>
              </label>
              <span className="text-sm font-bold font-mono text-blue-400">{config.distanceCenterMultiplier.toFixed(2)}x</span>
            </div>
            <input 
              type="range" 
              min="0.5" max="3.0" step="0.1"
              value={config.distanceCenterMultiplier}
              disabled={!config.enableStarTweaks}
              onChange={(e) => setConfig({ ...config, distanceCenterMultiplier: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-900 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-40"
            />
            <p className="text-[11px] text-gray-500">Increases star spawn rates as players venture further toward the world rim (&gt;2000m).</p>
          </div>
        </div>

        {/* Global Base Chances */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="flex items-center justify-between p-3.5 bg-gray-950 rounded-xl border border-gray-800">
            <div>
              <span className="text-xs font-semibold text-gray-200 block">Base 1-Star Spawn Chance</span>
              <span className="text-[10px] text-gray-500">Vanilla: 10.0%</span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0" max="50" step="1"
                value={config.globalOneStarChance}
                disabled={!config.enableStarTweaks}
                onChange={(e) => setConfig({ ...config, globalOneStarChance: parseFloat(e.target.value) || 0 })}
                className="w-16 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-yellow-300 text-right focus:outline-none focus:border-yellow-500"
              />
              <span className="text-xs text-gray-400">%</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-gray-950 rounded-xl border border-gray-800">
            <div>
              <span className="text-xs font-semibold text-gray-200 block">Base 2-Star Promotion Chance</span>
              <span className="text-[10px] text-gray-500">Vanilla: 10.0% of 1-Stars</span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0" max="50" step="1"
                value={config.globalTwoStarChance}
                disabled={!config.enableStarTweaks}
                onChange={(e) => setConfig({ ...config, globalTwoStarChance: parseFloat(e.target.value) || 0 })}
                className="w-16 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-orange-300 text-right focus:outline-none focus:border-orange-500"
              />
              <span className="text-xs text-gray-400">%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
  );
}

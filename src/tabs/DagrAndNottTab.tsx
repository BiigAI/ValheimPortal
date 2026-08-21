import { useState, useEffect } from 'react';
import { FiSun, FiMoon, FiClock, FiZap, FiCheck, FiRefreshCw } from 'react-icons/fi';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';

export default function DagrAndNottTab() {
  const { showToast } = useToast();
  const [totalLength, setTotalLength] = useState(30); // in minutes
  const [dayLength, setDayLength] = useState(21);
  const [nightLength, setNightLength] = useState(9);
  const [isApplying, setIsApplying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfig = async () => {
    try {
      const cfg = await api.getDagrNottConfig();
      setTotalLength(cfg.totalLength);
      setDayLength(cfg.dayLength);
      setNightLength(cfg.nightLength);
    } catch (err) {
      showToast('Failed to fetch Dagr & Nott cycle from server', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Synchronize sub-sliders when total changes, preserving proportions
  const handleTotalChange = (newTotal: number) => {
    setTotalLength(newTotal);
    const dayRatio = dayLength / (dayLength + nightLength || 1);
    const newDay = Math.max(1, Math.round(newTotal * dayRatio));
    const newNight = Math.max(1, newTotal - newDay);
    setDayLength(newDay);
    setNightLength(newNight);
  };

  // Adjust night strictly when day changes
  const handleDayChange = (newDay: number) => {
    const clampedDay = Math.min(Math.max(1, newDay), totalLength - 1);
    setDayLength(clampedDay);
    setNightLength(totalLength - clampedDay);
  };

  // Adjust day strictly when night changes
  const handleNightChange = (newNight: number) => {
    const clampedNight = Math.min(Math.max(1, newNight), totalLength - 1);
    setNightLength(clampedNight);
    setDayLength(totalLength - clampedNight);
  };

  const applyPreset = (total: number, day: number, night: number, name: string) => {
    setTotalLength(total);
    setDayLength(day);
    setNightLength(night);
    showToast(`Loaded preset: ${name}`, 'info');
  };

  const handleApplyConfig = async () => {
    setIsApplying(true);
    try {
      await api.saveDagrNottConfig({ totalLength, dayLength, nightLength });
      showToast(`Dagr & Nott cycle applied: ${totalLength}m total (${dayLength}m Day / ${nightLength}m Night)`, 'success');
    } catch (err) {
      showToast('Failed to sync Dagr & Nott cycle', 'error');
    } finally {
      setIsApplying(false);
    }
  };

  const inGameHourMinutes = (totalLength / 24).toFixed(2);

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 p-6 rounded-2xl shadow-xl flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl">
            <FiClock size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-100">Dagr & Nott Diurnal Engine</h2>
            <p className="text-xs text-gray-400 mt-0.5">Real-time reactive day/night cycle scaling and 24h Valheim time dilation.</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchConfig}
            className="p-2.5 bg-gray-800/80 hover:bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700/80 rounded-xl transition-all"
            title="Reload config from server"
          >
            <FiRefreshCw size={16} />
          </button>
          <button
            onClick={handleApplyConfig}
            disabled={isApplying || isLoading}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium text-xs transition-all shadow-lg shadow-blue-500/25 flex items-center space-x-2"
          >
            <FiCheck />
            <span>{isApplying ? 'Saving...' : 'Save & Apply Config'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Master Duration & Presets */}
        <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl p-8 space-y-6 shadow-xl flex flex-col justify-between">
          <div className="space-y-6">
            {/* Quick Presets */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-3 font-mono">
                Cycle Presets
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { label: 'Vanilla Valheim', total: 30, day: 21, night: 9 },
                  { label: 'Fast Cycles', total: 15, day: 10, night: 5 },
                  { label: 'Long Journey', total: 60, day: 45, night: 15 },
                  { label: 'Midnight Sun', total: 45, day: 38, night: 7 },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p.total, p.day, p.night, p.label)}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-medium transition-all text-center ${
                      totalLength === p.total && dayLength === p.day
                        ? 'bg-blue-500/15 border-blue-500/40 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.15)]'
                        : 'bg-gray-950/60 border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700'
                    }`}
                  >
                    <div>{p.label}</div>
                    <div className="text-[10px] font-mono text-gray-500 mt-0.5">{p.total}m total</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Master Slider */}
            <div className="space-y-4 pt-2">
              <div className="flex justify-between items-end">
                <div>
                  <label className="flex items-center space-x-2 text-sm font-semibold text-gray-200 mb-1">
                    <FiZap className="text-blue-400" />
                    <span>Total IRL Cycle Length</span>
                  </label>
                  <p className="text-xs text-gray-400">
                    Real-world minutes for a full 24-hour in-game rotation.
                  </p>
                </div>
                <div className="text-right font-mono">
                  <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-amber-200">
                    {totalLength}m
                  </span>
                  <span className="text-xs text-gray-500 block">({inGameHourMinutes}m / in-game hour)</span>
                </div>
              </div>
              
              <div className="relative pt-2">
                <input 
                  type="range" 
                  min="10" max="120" step="1" 
                  value={totalLength}
                  disabled={isLoading}
                  onChange={(e) => handleTotalChange(parseInt(e.target.value))}
                  className="w-full h-3 bg-gray-950 border border-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all shadow-inner"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-2 font-mono">
                  <span>10m (Turbo)</span>
                  <span>30m (Default)</span>
                  <span>60m (Double)</span>
                  <span>120m (Epic)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Reactive Balance Allocation & Visualization */}
        <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl p-8 space-y-6 shadow-xl flex flex-col justify-between">
          <div className="space-y-6">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-mono flex items-center justify-between border-b border-gray-800 pb-3">
              <span>Reactive Balance Allocation</span>
              <span className="text-blue-400 font-bold">Day + Night = {totalLength}m</span>
            </div>

            {/* Day Sub-slider */}
            <div className="space-y-3 p-4 bg-gray-950/70 rounded-xl border border-gray-800">
              <div className="flex justify-between items-center">
                <label className="flex items-center space-x-2 text-sm font-medium text-amber-300">
                  <FiSun className="text-amber-400 text-base" />
                  <span>Daytime Duration</span>
                </label>
                <span className="text-base font-bold font-mono text-amber-400">{dayLength} min</span>
              </div>
              <input 
                type="range" 
                min="1" max={totalLength - 1} step="1" 
                value={dayLength}
                disabled={isLoading}
                onChange={(e) => handleDayChange(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-900 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400 transition-all"
              />
              <div className="text-[11px] text-gray-500 font-mono">
                Represents {((dayLength / totalLength) * 100).toFixed(1)}% of the total day cycle
              </div>
            </div>

            {/* Night Sub-slider */}
            <div className="space-y-3 p-4 bg-gray-950/70 rounded-xl border border-gray-800">
              <div className="flex justify-between items-center">
                <label className="flex items-center space-x-2 text-sm font-medium text-indigo-300">
                  <FiMoon className="text-indigo-400 text-base" />
                  <span>Nighttime Duration</span>
                </label>
                <span className="text-base font-bold font-mono text-indigo-400">{nightLength} min</span>
              </div>
              <input 
                type="range" 
                min="1" max={totalLength - 1} step="1" 
                value={nightLength}
                disabled={isLoading}
                onChange={(e) => handleNightChange(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-900 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
              />
              <div className="text-[11px] text-gray-500 font-mono">
                Represents {((nightLength / totalLength) * 100).toFixed(1)}% of the total day cycle
              </div>
            </div>

            {/* Visual Ratio Bar */}
            <div className="pt-2">
              <div className="flex justify-between items-center text-xs font-mono text-gray-400 mb-2">
                <span className="flex items-center space-x-1 text-amber-400">
                  <FiSun />
                  <span>Day {((dayLength / totalLength) * 100).toFixed(0)}%</span>
                </span>
                <span className="flex items-center space-x-1 text-indigo-400">
                  <FiMoon />
                  <span>Night {((nightLength / totalLength) * 100).toFixed(0)}%</span>
                </span>
              </div>
              <div className="h-3 w-full rounded-full flex overflow-hidden shadow-inner bg-gray-900 border border-gray-800">
                <div 
                  className="bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-200" 
                  style={{ width: `${(dayLength / totalLength) * 100}%` }}
                ></div>
                <div 
                  className="bg-gradient-to-r from-indigo-600 to-purple-700 transition-all duration-200" 
                  style={{ width: `${(nightLength / totalLength) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

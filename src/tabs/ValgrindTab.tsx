import { useState, useEffect } from 'react';
import { FiSliders, FiCheck, FiInfo, FiTrendingDown, FiShield, FiRefreshCw } from 'react-icons/fi';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';

export default function ValgrindTab() {
  const { showToast } = useToast();
  const [xpLoss, setXpLoss] = useState(5.0);
  const [calcMode, setCalcMode] = useState('Standard');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfig = async () => {
    try {
      const cfg = await api.getValgrindConfig();
      setXpLoss(cfg.xpLoss);
      setCalcMode(cfg.calcMode);
    } catch (err) {
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
      await api.saveValgrindConfig({ xpLoss, calcMode });
      showToast(`Valgrind updated: ${xpLoss.toFixed(1)}% XP loss with ${calcMode} scaling.`, 'success');
    } catch (err) {
      showToast('Failed to save Valgrind configuration', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 p-6 rounded-2xl shadow-xl flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
            <FiSliders size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-100">Valgrind XP Penalty Configuration</h2>
            <p className="text-xs text-gray-400 mt-0.5">Control skill loss behavior and formulas upon character death.</p>
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
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-6 py-2.5 rounded-xl font-medium text-xs transition-all shadow-lg shadow-orange-500/25 flex items-center space-x-2"
          >
            <FiCheck />
            <span>{isSaving ? 'Saving...' : 'Save & Apply Config'}</span>
          </button>
        </div>
      </div>

      <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl p-8 space-y-8 shadow-xl">
        
        {/* Dynamic XP Loss Slider */}
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <label className="flex items-center space-x-2 text-sm font-semibold text-gray-200 mb-1">
                <FiTrendingDown className="text-orange-400" />
                <span>Dynamic XP Loss Percentage</span>
              </label>
              <p className="text-xs text-gray-400">
                Percentage of skill progression forfeited upon dying in-game.
              </p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold font-mono text-orange-400">{xpLoss.toFixed(1)}%</span>
            </div>
          </div>
          
          <div className="relative pt-2">
            <input 
              type="range" 
              min="0" max="25" step="0.1" 
              value={xpLoss}
              disabled={isLoading}
              onChange={(e) => setXpLoss(parseFloat(e.target.value))}
              className="w-full h-2.5 bg-gray-950 border border-gray-800 rounded-lg appearance-none cursor-pointer accent-orange-500 hover:accent-orange-400 transition-all"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-2.5 font-mono">
              <span>0.0% (Zero Penalty)</span>
              <span>5.0% (Vanilla Standard)</span>
              <span>25.0% (Hardcore Brutal)</span>
            </div>
          </div>
        </div>

        <hr className="border-gray-800/80" />

        {/* Calculation Mode Dropdown */}
        <div className="space-y-4">
          <div>
            <label className="flex items-center space-x-2 text-sm font-semibold text-gray-200 mb-1">
              <FiShield className="text-amber-400" />
              <span>Calculation Mode (`CalculationMode`)</span>
            </label>
            <p className="text-xs text-gray-400">
              Mathematical curve used to compute skill level deductions.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { id: 'Standard', name: 'Standard Linear', desc: 'Equal percentage across all skill tiers.' },
              { id: 'Logarithmic', name: 'Logarithmic Dampened', desc: 'Protects hard-earned master levels (80-100).' },
              { id: 'Exponential', name: 'Exponential Punishing', desc: 'Low levels lose little; high levels lose heavily.' },
              { id: 'Flat', name: 'Flat Value Deduction', desc: 'Exact static point subtraction regardless of level.' },
            ].map((mode) => {
              const isSelected = calcMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setCalcMode(mode.id)}
                  className={`p-4 rounded-xl text-left border transition-all ${
                    isSelected
                      ? 'bg-orange-500/10 border-orange-500/40 shadow-[0_0_15px_rgba(249,115,22,0.1)]'
                      : 'bg-gray-950/60 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-semibold ${isSelected ? 'text-orange-300' : 'text-gray-200'}`}>
                      {mode.name}
                    </span>
                    {isSelected && <FiCheck className="text-orange-400 text-sm" />}
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{mode.desc}</p>
                </button>
              );
            })}
          </div>
          
          {/* Dynamic Interactive Preview Card */}
          <div className="p-4 bg-gray-950/80 border border-gray-800 rounded-xl flex items-start space-x-3">
            <FiInfo className="text-orange-400 text-lg flex-shrink-0 mt-0.5" />
            <div className="text-xs text-gray-300 space-y-1">
              <span className="font-semibold text-orange-300">Active Formula Simulation:</span>
              <p className="text-gray-400">
                {calcMode === 'Standard' && `A level 50 Sword skill loses ${(50 * (xpLoss / 100)).toFixed(1)} levels. Level 100 loses ${(100 * (xpLoss / 100)).toFixed(1)} levels.`}
                {calcMode === 'Logarithmic' && `A level 50 skill loses ${(50 * (xpLoss / 100) * 0.9).toFixed(1)} levels. High tiers (100) are protected, losing only ${(100 * (xpLoss / 100) * 0.65).toFixed(1)} levels.`}
                {calcMode === 'Exponential' && `A level 20 skill loses ${(20 * (xpLoss / 100) * 0.4).toFixed(1)} levels. Master tiers (100) are severely punished, losing ${(100 * (xpLoss / 100) * 1.5).toFixed(1)} levels.`}
                {calcMode === 'Flat' && `Every death deducts exactly ${(xpLoss).toFixed(1)} static skill points regardless of progression.`}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

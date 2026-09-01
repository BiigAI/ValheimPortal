import { motion } from 'framer-motion';
import { FiZap, FiSliders } from 'react-icons/fi';

export type ModeType = 'simple' | 'advanced';

interface SimpleAdvancedToggleProps {
  mode: ModeType;
  onChange: (newMode: ModeType) => void;
  accentColor?: 'orange' | 'amber' | 'cyan' | 'red' | 'indigo' | 'emerald';
  idPrefix?: string;
}

const colorMap = {
  orange: {
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/40',
    text: 'text-orange-300',
    glow: 'shadow-[0_0_12px_rgba(249,115,22,0.25)]',
    pill: 'bg-orange-500/20 border-orange-500/40 text-orange-200',
    activeIcon: 'text-orange-400',
  },
  amber: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/40',
    text: 'text-amber-300',
    glow: 'shadow-[0_0_12px_rgba(245,158,11,0.25)]',
    pill: 'bg-amber-500/20 border-amber-500/40 text-amber-200',
    activeIcon: 'text-amber-400',
  },
  cyan: {
    bg: 'bg-cyan-500/20',
    border: 'border-cyan-500/40',
    text: 'text-cyan-300',
    glow: 'shadow-[0_0_12px_rgba(6,182,212,0.25)]',
    pill: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-200',
    activeIcon: 'text-cyan-400',
  },
  red: {
    bg: 'bg-red-500/20',
    border: 'border-red-500/40',
    text: 'text-red-300',
    glow: 'shadow-[0_0_12px_rgba(239,68,68,0.25)]',
    pill: 'bg-red-500/20 border-red-500/40 text-red-200',
    activeIcon: 'text-red-400',
  },
  indigo: {
    bg: 'bg-indigo-500/20',
    border: 'border-indigo-500/40',
    text: 'text-indigo-300',
    glow: 'shadow-[0_0_12px_rgba(99,102,241,0.25)]',
    pill: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200',
    activeIcon: 'text-indigo-400',
  },
  emerald: {
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/40',
    text: 'text-emerald-300',
    glow: 'shadow-[0_0_12px_rgba(16,185,129,0.25)]',
    pill: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200',
    activeIcon: 'text-emerald-400',
  },
};

export default function SimpleAdvancedToggle({
  mode,
  onChange,
  accentColor = 'orange',
  idPrefix = 'toggle',
}: SimpleAdvancedToggleProps) {
  const styles = colorMap[accentColor] || colorMap.orange;

  return (
    <div className="relative inline-flex items-center p-1 bg-gray-950/80 border border-gray-800/90 rounded-xl select-none backdrop-blur-sm">
      <button
        type="button"
        onClick={() => onChange('simple')}
        className={`relative z-10 flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-200 ${
          mode === 'simple' ? styles.text : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        <FiZap
          size={13}
          className={`transition-colors ${
            mode === 'simple' ? styles.activeIcon : 'text-gray-500'
          }`}
        />
        <span>Simple</span>
        {mode === 'simple' && (
          <motion.div
            layoutId={`${idPrefix}-pill`}
            className={`absolute inset-0 rounded-lg border ${styles.pill} ${styles.glow} z-[-1]`}
            transition={{ type: 'spring', stiffness: 450, damping: 32 }}
          />
        )}
      </button>

      <button
        type="button"
        onClick={() => onChange('advanced')}
        className={`relative z-10 flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-200 ${
          mode === 'advanced' ? styles.text : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        <FiSliders
          size={13}
          className={`transition-colors ${
            mode === 'advanced' ? styles.activeIcon : 'text-gray-500'
          }`}
        />
        <span>Advanced</span>
        {mode === 'advanced' && (
          <motion.div
            layoutId={`${idPrefix}-pill`}
            className={`absolute inset-0 rounded-lg border ${styles.pill} ${styles.glow} z-[-1]`}
            transition={{ type: 'spring', stiffness: 450, damping: 32 }}
          />
        )}
      </button>
    </div>
  );
}

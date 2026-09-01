export interface PresetItem {
  id?: string;
  name: string;
  desc?: string;
  isActive?: boolean;
  onClick: () => void;
}

interface PresetGridProps {
  label?: string;
  presets: PresetItem[];
  accentColor?: 'orange' | 'amber' | 'cyan' | 'red' | 'indigo' | 'emerald';
  columns?: string;
  className?: string;
}

const presetColors = {
  orange: {
    active:
      'bg-orange-500/15 border-orange-500/40 text-orange-300 shadow-[0_0_12px_rgba(249,115,22,0.15)] ring-1 ring-orange-500/30',
    title: 'text-orange-200',
  },
  amber: {
    active:
      'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/30',
    title: 'text-amber-200',
  },
  cyan: {
    active:
      'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30',
    title: 'text-cyan-200',
  },
  red: {
    active:
      'bg-red-500/15 border-red-500/40 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.15)] ring-1 ring-red-500/30',
    title: 'text-red-200',
  },
  indigo: {
    active:
      'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/30',
    title: 'text-indigo-200',
  },
  emerald: {
    active:
      'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30',
    title: 'text-emerald-200',
  },
};

export default function PresetGrid({
  label = 'Configuration Presets',
  presets,
  accentColor = 'orange',
  columns = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  className = '',
}: PresetGridProps) {
  const styles = presetColors[accentColor] || presetColors.orange;

  return (
    <div className={`space-y-3 ${className}`}>
      {label && (
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block font-mono">
          {label}
        </label>
      )}
      <div className={`grid ${columns} gap-2.5 sm:gap-3`}>
        {presets.map((p, idx) => (
          <button
            key={p.id || p.name || idx}
            type="button"
            onClick={p.onClick}
            className={`p-3 rounded-xl border text-xs font-medium transition-all text-left flex flex-col justify-between group ${
              p.isActive
                ? styles.active
                : 'bg-gray-950/60 border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700 hover:bg-gray-900/60'
            }`}
          >
            <div
              className={`font-semibold transition-colors ${
                p.isActive ? styles.title : 'text-gray-300 group-hover:text-gray-100'
              }`}
            >
              {p.name}
            </div>
            {p.desc && (
              <div className="text-[10px] font-mono text-gray-500 mt-1.5 line-clamp-1">
                {p.desc}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

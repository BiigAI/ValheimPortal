import { type IconType } from 'react-icons';

export interface KpiGaugeCardProps {
  icon: IconType;
  label: string;
  value: string | number;
  unit?: string;
  progressPercent?: number;
  progressGradient?: string;
  accentColor?: 'orange' | 'amber' | 'cyan' | 'red' | 'indigo' | 'emerald';
  className?: string;
}

const accentConfig = {
  orange: {
    icon: 'text-orange-400',
    bar: 'from-orange-500 to-amber-400',
  },
  amber: {
    icon: 'text-amber-400',
    bar: 'from-amber-500 to-yellow-400',
  },
  cyan: {
    icon: 'text-cyan-400',
    bar: 'from-cyan-500 to-blue-400',
  },
  red: {
    icon: 'text-red-400',
    bar: 'from-red-500 to-rose-400',
  },
  indigo: {
    icon: 'text-indigo-400',
    bar: 'from-indigo-500 to-purple-400',
  },
  emerald: {
    icon: 'text-emerald-400',
    bar: 'from-emerald-500 to-teal-400',
  },
};

export default function KpiGaugeCard({
  icon: Icon,
  label,
  value,
  unit,
  progressPercent,
  progressGradient,
  accentColor = 'orange',
  className = '',
}: KpiGaugeCardProps) {
  const cfg = accentConfig[accentColor] || accentConfig.orange;
  const barGradient = progressGradient || cfg.bar;

  const validProgress =
    typeof progressPercent === 'number'
      ? Math.max(0, Math.min(100, progressPercent))
      : null;

  return (
    <div
      className={`bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-3 transition-all hover:border-gray-700/80 ${className}`}
    >
      <div className="flex items-center space-x-2 text-xs font-semibold text-gray-400 truncate">
        <Icon className={`${cfg.icon} text-sm shrink-0`} />
        <span className="truncate">{label}</span>
      </div>

      <div>
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-extrabold text-gray-100 font-mono tracking-tight">
            {value}
          </span>
          {unit && (
            <span className="text-xs text-gray-500 font-mono font-medium truncate">
              {unit}
            </span>
          )}
        </div>

        {validProgress !== null && (
          <div className="w-full h-2 bg-gray-950 rounded-full mt-2.5 overflow-hidden border border-gray-800">
            <div
              className={`h-full bg-gradient-to-r ${barGradient} rounded-full transition-all duration-500`}
              style={{ width: `${validProgress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

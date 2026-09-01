import { type IconType } from 'react-icons';

interface SliderFieldProps {
  label: string;
  sublabel?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  icon?: IconType;
  ticks?: Array<{ label: string; value?: number }>;
  disabled?: boolean;
  accentColor?: 'orange' | 'amber' | 'cyan' | 'red' | 'indigo' | 'emerald';
  className?: string;
}

const sliderColors = {
  orange: {
    accent: 'accent-orange-500 hover:accent-orange-400',
    valueText: 'text-orange-400',
  },
  amber: {
    accent: 'accent-amber-500 hover:accent-amber-400',
    valueText: 'text-amber-400',
  },
  cyan: {
    accent: 'accent-cyan-500 hover:accent-cyan-400',
    valueText: 'text-cyan-400',
  },
  red: {
    accent: 'accent-red-500 hover:accent-red-400',
    valueText: 'text-red-400',
  },
  indigo: {
    accent: 'accent-indigo-500 hover:accent-indigo-400',
    valueText: 'text-indigo-400',
  },
  emerald: {
    accent: 'accent-emerald-500 hover:accent-emerald-400',
    valueText: 'text-emerald-400',
  },
};

export default function SliderField({
  label,
  sublabel,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
  icon: Icon,
  ticks,
  disabled = false,
  accentColor = 'orange',
  className = '',
}: SliderFieldProps) {
  const styles = sliderColors[accentColor] || sliderColors.orange;
  const displayValue = formatValue ? formatValue(value) : value.toString();

  return (
    <div
      className={`p-4 sm:p-5 bg-gray-950/70 border border-gray-800 rounded-xl space-y-3 transition-colors ${
        disabled ? 'opacity-50' : 'hover:border-gray-700/80'
      } ${className}`}
    >
      <div className="flex justify-between items-start">
        <div className="min-w-0 pr-2">
          <div className="flex items-center space-x-1.5">
            {Icon && <Icon className="text-gray-400 text-sm flex-shrink-0" />}
            <span className="text-xs font-semibold text-gray-200 block truncate">
              {label}
            </span>
          </div>
          {sublabel && (
            <span className="text-[11px] text-gray-500 block font-mono mt-0.5">
              {sublabel}
            </span>
          )}
        </div>
        <span
          className={`text-sm sm:text-base font-bold font-mono flex-shrink-0 ${styles.valueText}`}
        >
          {displayValue}
        </span>
      </div>

      <div className="space-y-1.5">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={`w-full h-2 bg-gray-900 rounded-lg appearance-none cursor-pointer border border-gray-800/80 transition-all ${
            styles.accent
          } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        />

        {ticks && ticks.length > 0 && (
          <div className="flex justify-between text-[10px] text-gray-500 font-mono select-none px-0.5">
            {ticks.map((t, idx) => (
              <span key={idx}>{t.label}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

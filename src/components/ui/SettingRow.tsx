import React from 'react';
import { type IconType } from 'react-icons';

interface SettingRowProps {
  label: string;
  description?: React.ReactNode;
  icon?: IconType;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  accentColor?: 'orange' | 'amber' | 'cyan' | 'red' | 'indigo' | 'emerald';
  children?: React.ReactNode;
  className?: string;
}

const toggleColors = {
  orange: 'peer-checked:bg-orange-500',
  amber: 'peer-checked:bg-amber-500',
  cyan: 'peer-checked:bg-cyan-500',
  red: 'peer-checked:bg-red-500',
  indigo: 'peer-checked:bg-indigo-500',
  emerald: 'peer-checked:bg-emerald-500',
};

export default function SettingRow({
  label,
  description,
  icon: Icon,
  checked,
  onChange,
  disabled = false,
  accentColor = 'orange',
  children,
  className = '',
}: SettingRowProps) {
  const activeToggleClass = toggleColors[accentColor] || toggleColors.orange;

  // If checkbox mode
  if (onChange !== undefined && checked !== undefined) {
    return (
      <label
        className={`flex items-center justify-between p-4 bg-gray-950/70 border border-gray-800 rounded-xl transition-colors cursor-pointer hover:border-gray-700/80 ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${className}`}
      >
        <div className="flex items-start space-x-3 min-w-0 pr-4">
          {Icon && (
            <Icon className="text-gray-400 mt-0.5 flex-shrink-0 text-base" />
          )}
          <div className="min-w-0">
            <span className="text-xs font-semibold text-gray-200 block">
              {label}
            </span>
            {description && (
              <span className="text-[11px] text-gray-400 mt-0.5 block leading-relaxed">
                {description}
              </span>
            )}
          </div>
        </div>

        <div className="relative inline-flex items-center flex-shrink-0">
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
          />
          <div
            className={`w-11 h-6 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${activeToggleClass}`}
          ></div>
        </div>
      </label>
    );
  }

  // Custom children/control mode
  return (
    <div
      className={`flex items-center justify-between p-4 bg-gray-950/70 border border-gray-800 rounded-xl transition-colors ${
        disabled ? 'opacity-50' : ''
      } ${className}`}
    >
      <div className="flex items-start space-x-3 min-w-0 pr-4">
        {Icon && (
          <Icon className="text-gray-400 mt-0.5 flex-shrink-0 text-base" />
        )}
        <div className="min-w-0">
          <span className="text-xs font-semibold text-gray-200 block">
            {label}
          </span>
          {description && (
            <span className="text-[11px] text-gray-400 mt-0.5 block leading-relaxed">
              {description}
            </span>
          )}
        </div>
      </div>

      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

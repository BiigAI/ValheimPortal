import React from 'react';
import { type IconType } from 'react-icons';

interface SettingsCardProps {
  title?: string;
  subtitle?: string;
  icon?: IconType;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  accentColor?: 'orange' | 'amber' | 'cyan' | 'red' | 'indigo' | 'emerald' | 'gray';
  className?: string;
  children: React.ReactNode;
}

const iconColors = {
  orange: 'text-orange-400',
  amber: 'text-amber-400',
  cyan: 'text-cyan-400',
  red: 'text-red-400',
  indigo: 'text-indigo-400',
  emerald: 'text-emerald-400',
  gray: 'text-gray-400',
};

export default function SettingsCard({
  title,
  icon: Icon,
  badge,
  action,
  accentColor = 'gray',
  className = '',
  children,
}: SettingsCardProps) {
  const iconColorClass = iconColors[accentColor] || iconColors.gray;

  return (
    <div
      className={`bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5 transition-all ${className}`}
    >
      {(title || Icon || action || badge) && (
        <div className="flex items-center justify-between gap-2 border-b border-gray-800/80 pb-4">
          <div className="flex items-center space-x-2.5">
            {Icon && <Icon className={`text-base ${iconColorClass}`} />}
            {title && (
              <h3 className="font-bold text-gray-100 text-sm sm:text-base tracking-tight">
                {title}
              </h3>
            )}
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {badge}
            {action}
          </div>
        </div>
      )}

      {children}
    </div>
  );
}

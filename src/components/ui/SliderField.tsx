import React, { useRef, useCallback, useState, useEffect } from 'react';
import { type IconType } from 'react-icons';

export interface SliderTick {
  label: string;
  value?: number;
}

interface SliderFieldProps {
  label: string;
  sublabel?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  vanillaDefault?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  icon?: IconType;
  ticks?: Array<SliderTick>;
  disabled?: boolean;
  accentColor?: 'orange' | 'amber' | 'cyan' | 'red' | 'indigo' | 'emerald';
  className?: string;
}

const sliderColors = {
  orange: {
    fill: 'bg-orange-500',
    valueText: 'text-orange-400',
    ring: 'focus:ring-orange-500/30',
    activeTick: 'bg-orange-400',
  },
  amber: {
    fill: 'bg-amber-500',
    valueText: 'text-amber-400',
    ring: 'focus:ring-amber-500/30',
    activeTick: 'bg-amber-400',
  },
  cyan: {
    fill: 'bg-cyan-500',
    valueText: 'text-cyan-400',
    ring: 'focus:ring-cyan-500/30',
    activeTick: 'bg-cyan-400',
  },
  red: {
    fill: 'bg-red-500',
    valueText: 'text-red-400',
    ring: 'focus:ring-red-500/30',
    activeTick: 'bg-red-400',
  },
  indigo: {
    fill: 'bg-indigo-500',
    valueText: 'text-indigo-400',
    ring: 'focus:ring-indigo-500/30',
    activeTick: 'bg-indigo-400',
  },
  emerald: {
    fill: 'bg-emerald-500',
    valueText: 'text-emerald-400',
    ring: 'focus:ring-emerald-500/30',
    activeTick: 'bg-emerald-400',
  },
};

function parseTickNumeric(tick: SliderTick): number | null {
  if (typeof tick.value === 'number') return tick.value;
  const match = tick.label.match(/-?\d+(\.\d+)?/);
  if (match) return parseFloat(match[0]);
  return null;
}

export default function SliderField({
  label,
  sublabel,
  value,
  min,
  max,
  step = 1,
  vanillaDefault,
  onChange,
  formatValue,
  icon: Icon,
  ticks,
  disabled = false,
  accentColor = 'orange',
  className = '',
}: SliderFieldProps) {
  const styles = sliderColors[accentColor] || sliderColors.orange;
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Parse and sort all tick values and their exact percentages
  const parsedTicks = React.useMemo(() => {
    if (!ticks || ticks.length === 0) return [];

    const list = ticks
      .map((t) => {
        const numVal = parseTickNumeric(t);
        if (numVal === null) return null;
        const clampedVal = Math.max(min, Math.min(max, numVal));
        const percent = ((clampedVal - min) / (max - min)) * 100;
        const isVanilla =
          t.label.toLowerCase().includes('vanilla') ||
          (vanillaDefault !== undefined && Math.abs(clampedVal - vanillaDefault) < 0.001);

        // Separate short value (e.g. "5%") from annotation (e.g. "(Vanilla)")
        const match = t.label.match(/^([^\s(]+)(?:\s*\((.*?)\))?$/);
        const shortLabel = match ? match[1] : t.label;
        const annotation = match && match[2] ? match[2] : '';

        return {
          fullLabel: t.label,
          shortLabel,
          annotation,
          value: clampedVal,
          percent,
          isVanilla,
          tier: 0, // 0 for standard row, 1 for staggered row if colliding
          useShort: false,
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .sort((a, b) => a.percent - b.percent);

    // Collision detection: Check spacing between adjacent ticks
    for (let i = 0; i < list.length; i++) {
      const prev = list[i - 1];
      const next = list[i + 1];
      const prevGap = prev ? list[i].percent - prev.percent : 100;
      const nextGap = next ? next.percent - list[i].percent : 100;
      const minAdjacentGap = Math.min(prevGap, nextGap);

      // If gap is tighter than 22%, shorten label to eliminate wide annotations
      if (minAdjacentGap < 22) {
        list[i].useShort = true;
      }

      // If gap is critically tight (< 12%), stagger alternating tick to tier 1
      if (prev && list[i].percent - prev.percent < 12 && prev.tier === 0) {
        list[i].tier = 1;
      }
    }

    return list;
  }, [ticks, min, max, vanillaDefault]);

  const hasTier1 = parsedTicks.some((t) => t.tier === 1);

  // Current percentage for fill and thumb
  const currentPercent = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const displayValue = formatValue ? formatValue(value) : value.toString();

  // Compute stepped or snapped value from clientX
  const computeValueFromX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return value;
      const rect = trackRef.current.getBoundingClientRect();
      const rawFrac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const rawVal = min + rawFrac * (max - min);

      // Magnetic snap to tick if within 3.5% threshold
      const snapThresholdVal = (max - min) * 0.035;
      let closestTick: (typeof parsedTicks)[0] | null = null;
      let minTickDist = Infinity;
      for (const t of parsedTicks) {
        const dist = Math.abs(rawVal - t.value);
        if (dist < minTickDist) {
          minTickDist = dist;
          closestTick = t;
        }
      }

      if (closestTick && minTickDist <= snapThresholdVal) {
        return closestTick.value;
      }

      // Otherwise snap to nearest step
      const stepped = Math.round((rawVal - min) / step) * step + min;
      const precision = (step.toString().split('.')[1] || '').length;
      return parseFloat(Math.max(min, Math.min(max, stepped)).toFixed(precision));
    },
    [min, max, step, parsedTicks, value]
  );

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const newVal = computeValueFromX(clientX);
    onChange(newVal);
  };

  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const newVal = computeValueFromX(clientX);
      onChange(newVal);
    };

    const onPointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove);
    window.addEventListener('touchend', onPointerUp);

    return () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
    };
  }, [isDragging, computeValueFromX, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    let next = value;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      next = Math.max(min, value - step);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      next = Math.min(max, value + step);
    } else if (e.key === 'Home') {
      e.preventDefault();
      next = min;
    } else if (e.key === 'End') {
      e.preventDefault();
      next = max;
    }
    const precision = (step.toString().split('.')[1] || '').length;
    onChange(parseFloat(next.toFixed(precision)));
  };

  return (
    <div
      className={`p-3.5 sm:p-4 bg-gray-950/60 border border-gray-800/80 rounded-xl space-y-2.5 transition-colors ${
        disabled ? 'opacity-50' : 'hover:border-gray-700/80'
      } ${className}`}
    >
      {/* Header Row: Label, Sublabel, Vanilla Tag, Value Readout */}
      <div className="flex justify-between items-start">
        <div className="min-w-0 pr-2">
          <div className="flex items-center space-x-1.5">
            {Icon && <Icon className="text-gray-400 text-sm flex-shrink-0" />}
            <span className="text-xs font-semibold text-gray-200 block truncate">
              {label}
            </span>
          </div>
          {sublabel && (
            <span className="text-[11px] text-gray-500 block font-mono mt-0.5 truncate">
              {sublabel}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0">
          {vanillaDefault !== undefined && (
            <span
              className="text-[10px] font-mono text-amber-400/90 bg-amber-950/40 border border-amber-900/50 px-1.5 py-0.5 rounded hidden sm:inline"
              title="Vanilla Game Default"
            >
              Vanilla: {formatValue ? formatValue(vanillaDefault) : vanillaDefault}
            </span>
          )}
          <span
            className={`text-sm sm:text-base font-bold font-mono ${styles.valueText}`}
          >
            {displayValue}
          </span>
        </div>
      </div>

      {/* Interactive Slider Area */}
      <div className="pt-1.5 pb-0.5">
        {/* Track Container: Horizontal margin so thumb and 0%/100% labels never clip card */}
        <div className="relative mx-2 sm:mx-2.5">
          {/* Draggable Track Hitbox */}
          <div
            ref={trackRef}
            onMouseDown={handlePointerDown}
            onTouchStart={handlePointerDown}
            className={`relative h-6 flex items-center cursor-pointer select-none ${
              disabled ? 'cursor-not-allowed opacity-50' : ''
            }`}
          >
            {/* Clean Slim Rail */}
            <div className="absolute left-0 right-0 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              {/* Solid Accent Fill */}
              <div
                className={`h-full ${styles.fill} transition-all duration-75`}
                style={{ width: `${currentPercent}%` }}
              />
            </div>

            {/* Precision Tick Pips on Rail */}
            {parsedTicks.map((t, idx) => {
              const isPassed = t.value <= value;
              return (
                <div
                  key={idx}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) onChange(t.value);
                  }}
                  title={`Click to set ${t.fullLabel}`}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center p-1.5 z-10 cursor-pointer group/pip"
                  style={{ left: `${t.percent}%` }}
                >
                  <div
                    className={`transition-all rounded-full ${
                      t.isVanilla
                        ? 'h-3 w-1 bg-amber-400 shadow-sm shadow-amber-500/40'
                        : isPassed
                        ? 'h-2 w-0.5 bg-gray-400'
                        : 'h-2 w-0.5 bg-gray-600 group-hover/pip:bg-gray-400'
                    }`}
                  />
                </div>
              );
            })}

            {/* Standalone Vanilla Pip if not in parsedTicks */}
            {vanillaDefault !== undefined &&
              !parsedTicks.some((t) => Math.abs(t.value - vanillaDefault) < 0.001) &&
              vanillaDefault >= min &&
              vanillaDefault <= max && (
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) onChange(vanillaDefault);
                  }}
                  title={`Click to set Vanilla Default (${formatValue ? formatValue(vanillaDefault) : vanillaDefault})`}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center p-1.5 z-10 cursor-pointer"
                  style={{ left: `${((vanillaDefault - min) / (max - min)) * 100}%` }}
                >
                  <div className="h-3 w-1 bg-amber-400 rounded-full shadow-sm shadow-amber-500/40" />
                </div>
              )}

            {/* Minimalist Solid White Knob (Thumb) */}
            <div
              tabIndex={disabled ? -1 : 0}
              role="slider"
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={value}
              aria-label={label}
              onKeyDown={handleKeyDown}
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-md shadow-black/80 border border-white/90 transition-transform z-20 outline-none ${
                disabled
                  ? 'cursor-not-allowed'
                  : 'cursor-grab active:cursor-grabbing hover:scale-125 focus:ring-2 focus:ring-white/40'
              } ${isDragging ? 'scale-125 ring-2 ring-white/40' : ''}`}
              style={{ left: `${currentPercent}%` }}
            />
          </div>

          {/* Clean, Non-Overlapping Tick Labels */}
          {parsedTicks.length > 0 && (
            <div
              className={`relative select-none pointer-events-auto transition-all ${
                hasTier1 ? 'h-8' : 'h-4'
              }`}
            >
              {parsedTicks.map((t, idx) => {
                const isSelected = Math.abs(t.value - value) <= step / 2;
                const displayText = t.useShort ? t.shortLabel : t.fullLabel;

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={disabled}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!disabled) onChange(t.value);
                    }}
                    className={`absolute text-[10px] font-mono cursor-pointer transition-all hover:text-white whitespace-nowrap focus:outline-none -translate-x-1/2 ${
                      t.tier === 1 ? 'top-3.5' : 'top-0'
                    } ${
                      isSelected
                        ? `${styles.valueText} font-bold scale-105`
                        : t.isVanilla
                        ? 'text-amber-400/90 font-semibold'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                    style={{ left: `${t.percent}%` }}
                    title={`Click to set ${t.fullLabel}`}
                  >
                    {displayText}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

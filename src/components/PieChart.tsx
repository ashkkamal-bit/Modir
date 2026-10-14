import React, { useState } from 'react';
import { toPersianDigits } from '../utils/jalali';

interface PieSlice {
  label: string;
  count: number;
  color: string;
  hoverColor: string;
  textClass: string;
  bgBadge: string;
}

interface PieChartProps {
  done: number;
  late: number;
  notDone: number;
  size?: number;
  title?: string;
  showLegend?: boolean;
  centerSubtitle?: string;
}

export const PieChart: React.FC<PieChartProps> = ({
  done,
  late,
  notDone,
  size = 200,
  title,
  showLegend = true,
  centerSubtitle = 'کل برنامه‌ها',
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const total = done + late + notDone;

  const slices: PieSlice[] = [
    {
      label: 'انجام شده (به‌موقع)',
      count: done,
      color: '#10b981', // emerald-500
      hoverColor: '#059669',
      textClass: 'text-emerald-700',
      bgBadge: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    },
    {
      label: 'دیر انجام شده',
      count: late,
      color: '#f59e0b', // amber-500
      hoverColor: '#d97706',
      textClass: 'text-amber-700',
      bgBadge: 'bg-amber-50 border-amber-200 text-amber-700',
    },
    {
      label: 'انجام نشده',
      count: notDone,
      color: '#ef4444', // red-500
      hoverColor: '#dc2626',
      textClass: 'text-rose-700',
      bgBadge: 'bg-rose-50 border-rose-200 text-rose-700',
    },
  ];

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-4 text-center">
        <div
          className="rounded-full border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 p-3"
          style={{ width: size, height: size }}
        >
          <span className="text-xs font-bold text-slate-500">۰ مورد</span>
          <span className="text-[10px] text-slate-400 mt-1">تکلیفی ثبت نشده</span>
        </div>
      </div>
    );
  }

  // Calculate SVG paths for doughnut / pie
  const radius = size / 2;
  const strokeWidth = size * 0.22;
  const adjustedRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * adjustedRadius;

  let accumulatedAngle = 0;

  const paths = slices.map((slice, idx) => {
    const percentage = slice.count / total;
    const strokeDasharray = `${circumference * percentage} ${circumference * (1 - percentage)}`;
    const strokeDashoffset = -circumference * accumulatedAngle;
    accumulatedAngle += percentage;

    const isHovered = hoveredIndex === idx;

    return (
      <circle
        key={slice.label}
        cx={radius}
        cy={radius}
        r={adjustedRadius}
        fill="transparent"
        stroke={isHovered ? slice.hoverColor : slice.color}
        strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="butt"
        className="transition-all duration-200 cursor-pointer"
        onMouseEnter={() => setHoveredIndex(idx)}
        onMouseLeave={() => setHoveredIndex(null)}
      />
    );
  });

  const activeSlice = hoveredIndex !== null ? slices[hoveredIndex] : null;
  const activePercent = activeSlice ? Math.round((activeSlice.count / total) * 100) : null;

  return (
    <div className="flex flex-col items-center select-none w-full">
      {title && <h4 className="text-xs font-bold text-slate-700 mb-2">{title}</h4>}

      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {paths}
        </svg>

        {/* Center label in Donut chart */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {activeSlice ? (
            <div className="text-center animate-fade-in">
              <span className="text-xl font-black text-slate-800">
                %{toPersianDigits(activePercent)}
              </span>
              <p className="text-[11px] font-semibold text-slate-600 truncate max-w-[90px]">
                {toPersianDigits(activeSlice.count)} مورد
              </p>
            </div>
          ) : (
            <div className="text-center">
              <span className="text-xl font-black text-slate-800">{toPersianDigits(total)}</span>
              <p className="text-[10px] font-medium text-slate-500">{centerSubtitle}</p>
            </div>
          )}
        </div>
      </div>

      {showLegend && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 w-full mt-3 pt-2 border-t border-slate-100">
          {slices.map((slice, idx) => {
            const pct = Math.round((slice.count / total) * 100);
            return (
              <div
                key={slice.label}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`flex items-center justify-between p-1.5 rounded-lg border text-[11px] transition-all cursor-pointer ${
                  hoveredIndex === idx ? 'ring-2 ring-slate-400 bg-white shadow-xs' : slice.bgBadge
                }`}
              >
                <div className="flex items-center gap-1 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="font-semibold truncate">{slice.label}</span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0 mr-1 font-mono">
                  <span className="font-bold">{toPersianDigits(slice.count)}</span>
                  <span className="text-[10px] opacity-80">(%{toPersianDigits(pct)})</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

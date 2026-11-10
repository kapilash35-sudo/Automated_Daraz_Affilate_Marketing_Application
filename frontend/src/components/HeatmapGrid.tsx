'use client';

import React, { useState } from 'react';
import { Clock, Zap } from 'lucide-react';

interface HeatmapGridProps {
  grid: number[][]; // 7 days (0: Sun to 6: Sat) x 24 hours (0 to 23)
  maxValue: number;
  type: 'REACTION' | 'CLICK';
  topPeakSlots?: Array<{ day: number; hour: number; count: number }>;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function HeatmapGrid({ grid, maxValue, type, topPeakSlots = [] }: HeatmapGridProps) {
  const [hoveredCell, setHoveredCell] = useState<{
    day: number;
    hour: number;
    count: number;
  } | null>(null);

  const isClick = type === 'CLICK';

  // Compute color based on intensity percentage (0 to 1)
  const getCellColor = (count: number) => {
    if (count === 0) return 'bg-slate-50 border border-slate-200/60 text-transparent';
    const ratio = maxValue > 0 ? count / maxValue : 0;

    if (isClick) {
      // Warm Amber / Orange gradient for Clicks (Daraz)
      if (ratio > 0.8) return 'bg-amber-500 text-white font-bold border-amber-600 shadow-sm';
      if (ratio > 0.6) return 'bg-amber-400 text-slate-900 font-bold border-amber-500';
      if (ratio > 0.4) return 'bg-amber-300 text-slate-900 font-semibold border-amber-400';
      if (ratio > 0.2) return 'bg-amber-200 text-amber-900 font-medium border-amber-300';
      return 'bg-amber-100 text-amber-900 border-amber-200';
    } else {
      // Clean WhatsApp Green gradient for Reactions (News)
      if (ratio > 0.8) return 'bg-emerald-600 text-white font-bold border-emerald-700 shadow-sm';
      if (ratio > 0.6) return 'bg-emerald-500 text-white font-bold border-emerald-600';
      if (ratio > 0.4) return 'bg-emerald-400 text-slate-900 font-semibold border-emerald-500';
      if (ratio > 0.2) return 'bg-emerald-200 text-emerald-950 font-medium border-emerald-300';
      return 'bg-emerald-100 text-emerald-900 border-emerald-200';
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
            <Clock className={`w-4 h-4 ${isClick ? 'text-amber-600' : 'text-emerald-600'}`} />
            <span>
              {isClick
                ? 'Buyer Click-Through Heatmap (24h x 7d)'
                : 'Audience Engagement Heatmap (Reaction Peak Times)'}
            </span>
            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              Asia/Colombo (SLST)
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isClick
              ? 'Identifies high-converting purchase hours when WhatsApp community members click affiliate links.'
              : 'Visualizes peak viral hours when readers react to news — prime slots for sponsor ad inserts.'}
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <span>Low</span>
          <div className="flex gap-1">
            <div className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-200" />
            <div
              className={`w-3.5 h-3.5 rounded ${isClick ? 'bg-amber-100' : 'bg-emerald-100'}`}
            />
            <div
              className={`w-3.5 h-3.5 rounded ${isClick ? 'bg-amber-300' : 'bg-emerald-300'}`}
            />
            <div
              className={`w-3.5 h-3.5 rounded ${isClick ? 'bg-amber-500' : 'bg-emerald-600'}`}
            />
          </div>
          <span>Peak</span>
        </div>
      </div>

      {/* 24-Hour Grid */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[700px]">
          {/* Header Hours */}
          <div className="grid grid-cols-[50px_repeat(24,1fr)] gap-1 text-[10px] text-slate-400 font-mono text-center mb-1.5 font-bold">
            <div className="text-left font-bold text-slate-500">Day</div>
            {HOURS.map((hour) => (
              <div key={hour} className="py-1">
                {hour % 3 === 0 ? `${hour.toString().padStart(2, '0')}:00` : ''}
              </div>
            ))}
          </div>

          {/* Grid Rows (Days) */}
          <div className="space-y-1.5">
            {DAYS.map((dayName, dayIndex) => (
              <div
                key={dayName}
                className="grid grid-cols-[50px_repeat(24,1fr)] gap-1 items-center"
              >
                <div className="text-xs font-bold text-slate-700 tracking-wide">
                  {dayName}
                </div>
                {HOURS.map((hour) => {
                  const count = grid[dayIndex]?.[hour] || 0;
                  const colorClass = getCellColor(count);

                  return (
                    <div
                      key={hour}
                      onMouseEnter={() => setHoveredCell({ day: dayIndex, hour, count })}
                      onMouseLeave={() => setHoveredCell(null)}
                      className={`h-7 rounded-md border transition-all cursor-pointer flex items-center justify-center text-[10px] select-none hover:scale-110 hover:z-10 ${colorClass}`}
                      title={`${dayName} ${hour}:00 - ${count} ${isClick ? 'clicks' : 'reactions'}`}
                    >
                      {count > 0 && count > maxValue * 0.4 ? count : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hover Info & Peak Strategic Callouts */}
      <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="text-xs text-slate-600 flex items-center gap-2">
          {hoveredCell ? (
            <span className="font-mono bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
              📍 <strong className="text-slate-900">{DAYS[hoveredCell.day]}</strong> at{' '}
              <strong className="text-slate-900">{hoveredCell.hour}:00 - {hoveredCell.hour + 1}:00</strong> :{' '}
              <span className={isClick ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>
                {hoveredCell.count} {isClick ? 'link clicks' : 'user reactions'}
              </span>
            </span>
          ) : (
            <span className="text-slate-400 italic">
              Hover over any hour cell to inspect engagement frequency.
            </span>
          )}
        </div>

        {/* Peak Recommendation */}
        {topPeakSlots.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 font-bold text-slate-700">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Recommended Prime Window:</span>
            </span>
            <span
              className={`px-2.5 py-1 rounded-lg font-mono font-bold ${
                isClick
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              {DAYS[topPeakSlots[0].day]} {topPeakSlots[0].hour.toString().padStart(2, '0')}:00 (
              {topPeakSlots[0].count} {isClick ? 'clicks' : 'reactions'})
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

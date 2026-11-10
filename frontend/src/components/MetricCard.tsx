'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  color?: 'emerald' | 'amber' | 'blue' | 'purple' | 'red';
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendUp = true,
  color = 'emerald',
}: MetricCardProps) {
  const colorMap = {
    emerald: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      icon: 'text-emerald-600',
    },
    amber: {
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      icon: 'text-amber-600',
    },
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-100',
      icon: 'text-blue-600',
    },
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-100',
      icon: 'text-purple-600',
    },
    red: {
      bg: 'bg-rose-50',
      border: 'border-rose-100',
      icon: 'text-rose-600',
    },
  };

  const c = colorMap[color] || colorMap.emerald;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
        <div className={`p-2 rounded-xl ${c.bg} ${c.border} border`}>
          <Icon className={`w-4 h-4 ${c.icon}`} />
        </div>
      </div>

      <div className="mt-4">
        <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{value}</div>
        {(subtitle || trend) && (
          <div className="mt-1 flex items-center justify-between text-xs">
            {subtitle && <span className="text-slate-500 font-medium">{subtitle}</span>}
            {trend && (
              <span
                className={`font-mono font-bold ${
                  trendUp ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                {trend}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

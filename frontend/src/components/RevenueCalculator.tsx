'use client';

import React, { useState } from 'react';
import { DollarSign, Sliders, TrendingUp, Sparkles, CheckCircle2 } from 'lucide-react';

interface RevenueCalculatorProps {
  totalClicks: number;
  expectedCommission: number;
  initialConversionRate?: number; // e.g. 0.025 (2.5%)
  onConversionRateChange?: (conversionRate: number) => void;
}

export function RevenueCalculator({
  totalClicks,
  expectedCommission,
  initialConversionRate = 0.025,
  onConversionRateChange,
}: RevenueCalculatorProps) {
  const [conversionRatePercent, setConversionRatePercent] = useState<number>(
    initialConversionRate * 100
  );

  const conversionRate = conversionRatePercent / 100;
  const estimatedOrders = Math.round(totalClicks * conversionRate);

  const handleRateChange = (newPercent: number) => {
    setConversionRatePercent(newPercent);
    if (onConversionRateChange) {
      onConversionRateChange(newPercent / 100);
    }
  };

  const presets = [
    { label: '1.0% (Conservative)', val: 1.0 },
    { label: '2.5% (Standard)', val: 2.5 },
    { label: '5.0% (High Converting)', val: 5.0 },
    { label: '8.0% (Flash Sales)', val: 8.0 },
  ];

  return (
    <div className="bg-white border border-emerald-200/80 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-5 border-b border-slate-100 gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span>Real-Time Commission & Conversion Rate Estimator</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Expected income is calculated directly from each ad's actual registered commission entered via the WhatsApp Bot / Dashboard.
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-bold shrink-0 self-start sm:self-center">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>Real Deal Attribution Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Conversion Rate Slider & Preset Chips */}
        <div className="space-y-4 md:col-span-2">
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-700 font-bold flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                Target Conversion Rate:
              </span>
              <span className="font-mono font-extrabold text-emerald-700 text-base bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                {conversionRatePercent.toFixed(1)}%
              </span>
            </div>

            <input
              type="range"
              min="0.5"
              max="10.0"
              step="0.1"
              value={conversionRatePercent}
              onChange={(e) => handleRateChange(parseFloat(e.target.value))}
              className="w-full h-2.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />

            <div className="flex justify-between text-[11px] text-slate-400 font-mono mt-1.5">
              <span>0.5% (Min)</span>
              <span>2.5% (Benchmark)</span>
              <span>5.0% (Strong)</span>
              <span>10.0% (Peak Promo)</span>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            {presets.map((p) => {
              const isActive = Math.abs(conversionRatePercent - p.val) < 0.05;
              return (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => handleRateChange(p.val)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm font-bold'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-xl p-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Per-Ad Commission Multiplier:</strong> Each link click uses the exact commission rate registered for that specific deal.
            </span>
          </div>
        </div>

        {/* Real Projected Commission Result Box */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-6 text-center flex flex-col justify-center items-center shadow-sm">
          <span className="text-xs text-emerald-900 uppercase tracking-wider font-extrabold flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
            Real Expected Income
          </span>
          <div className="text-3xl sm:text-4xl font-extrabold text-emerald-700 tracking-tight mt-2 font-mono">
            Rs. {expectedCommission.toLocaleString()}
          </div>
          <div className="text-xs text-slate-600 mt-2.5 font-medium leading-relaxed">
            ≈ <strong className="text-slate-900">{estimatedOrders}</strong> projected orders from{' '}
            <strong className="text-slate-900">{totalClicks}</strong> total clicks
          </div>
          <span className="text-[10px] text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full font-mono mt-3 font-semibold">
            Based on {conversionRatePercent.toFixed(1)}% Conversion
          </span>
        </div>
      </div>
    </div>
  );
}

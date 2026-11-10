'use client';

import React, { useState } from 'react';
import { DollarSign, Sliders, TrendingUp, ShoppingCart } from 'lucide-react';

interface RevenueCalculatorProps {
  totalClicks: number;
  initialConversionRate?: number; // e.g. 0.025 (2.5%)
  initialAvgCommission?: number; // e.g. Rs 380
  onParametersChange?: (conversionRate: number, avgCommission: number) => void;
}

export function RevenueCalculator({
  totalClicks,
  initialConversionRate = 0.025,
  initialAvgCommission = 380,
  onParametersChange,
}: RevenueCalculatorProps) {
  const [conversionRatePercent, setConversionRatePercent] = useState<number>(
    initialConversionRate * 100
  );
  const [avgCommission, setAvgCommission] = useState<number>(initialAvgCommission);

  const conversionRate = conversionRatePercent / 100;
  const estimatedOrders = Math.round(totalClicks * conversionRate);
  const estimatedCommission = Math.round(estimatedOrders * avgCommission);

  const handleRateChange = (newPercent: number) => {
    setConversionRatePercent(newPercent);
    if (onParametersChange) {
      onParametersChange(newPercent / 100, avgCommission);
    }
  };

  const handleCommChange = (newComm: number) => {
    setAvgCommission(newComm);
    if (onParametersChange) {
      onParametersChange(conversionRatePercent / 100, newComm);
    }
  };

  return (
    <div className="bg-white border border-amber-200/80 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-600" />
            <span>Expected Affiliate Revenue Estimator</span>
          </h2>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-mono font-bold">
          <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
          <span>Daraz Partner Model</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Sliders */}
        <div className="space-y-5 md:col-span-2">
          {/* Conversion Rate Slider */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-700 font-bold flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-600" />
                Est. E-commerce Conversion Rate:
              </span>
              <span className="font-mono font-bold text-amber-700 text-sm">
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
              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[11px] text-slate-400 font-mono mt-1">
              <span>0.5% (Conservative)</span>
              <span>2.5% (Benchmark)</span>
              <span>10.0% (Flash Sales)</span>
            </div>
          </div>

          {/* Average Commission Slider */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-700 font-bold flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />
                Avg Commission per Order:
              </span>
              <span className="font-mono font-bold text-amber-700 text-sm">
                Rs. {avgCommission}
              </span>
            </div>
            <input
              type="range"
              min="100"
              max="1500"
              step="25"
              value={avgCommission}
              onChange={(e) => handleCommChange(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[11px] text-slate-400 font-mono mt-1">
              <span>Rs. 100</span>
              <span>Rs. 380 (~$1.20)</span>
              <span>Rs. 1,500</span>
            </div>
          </div>
        </div>

        {/* Projected Revenue Result Box */}
        <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-5 text-center flex flex-col justify-center items-center">
          <span className="text-xs text-amber-800 uppercase tracking-wider font-bold">
            Expected Commission
          </span>
          <div className="text-3xl font-extrabold text-amber-600 tracking-tight mt-1 font-mono">
            Rs. {estimatedCommission.toLocaleString()}
          </div>
          <div className="text-xs text-slate-600 mt-2 font-medium">
            ≈ <strong className="text-slate-900">{estimatedOrders}</strong> expected orders from{' '}
            <strong className="text-slate-900">{totalClicks}</strong> clicks
          </div>
        </div>
      </div>
    </div>
  );
}

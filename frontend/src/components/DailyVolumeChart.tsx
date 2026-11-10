'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { BarChart3 } from 'lucide-react';

interface DailyVolumeProps {
  data: Array<{
    date: string;
    sent: number;
    duplicate: number;
    failed: number;
  }>;
}

export function DailyVolumeChart({ data }: DailyVolumeProps) {
  const formattedData = data.map((item) => {
    const d = new Date(item.date);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return {
      ...item,
      label,
    };
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            <span>Daily Pipeline Volume: Sent vs AI-Blocked Duplicates</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Visualizes Gemini 3.0 deduplication efficiency — saving WhatsApp subscribers from message fatigue.
          </p>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                borderColor: '#e2e8f0',
                borderRadius: '12px',
                fontSize: '12px',
                color: '#0f172a',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
              iconType="circle"
            />
            <Bar
              dataKey="sent"
              name="Posts Dispatched"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
              stackId="a"
            />
            <Bar
              dataKey="duplicate"
              name="AI Blocked Duplicates"
              fill="#f43f5e"
              radius={[4, 4, 0, 0]}
              stackId="a"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

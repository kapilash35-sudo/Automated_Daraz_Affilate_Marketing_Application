'use client';

import React from 'react';
import { Flame, ImageIcon } from 'lucide-react';

interface TopNewsItem {
  id: string;
  title: string;
  reactionsCount: number;
  sentAt: string | null;
  mediaUrl: string | null;
  processedPreview: string | null;
}

interface TopNewsTableProps {
  items: TopNewsItem[];
}

export function TopNewsTable({ items }: TopNewsTableProps) {
  if (items.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-sm">
        No news posts dispatched yet.
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Flame className="w-4 h-4 text-emerald-600" />
            <span>Top Performing News (Ranked by Audience Reactions)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Highest engagement posts indicating viral topics and prime real estate for sponsor mentions.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase tracking-wider font-mono">
              <th className="pb-3 font-semibold">Rank</th>
              <th className="pb-3 font-semibold">Headline / Story</th>
              <th className="pb-3 font-semibold text-center">Media</th>
              <th className="pb-3 font-semibold text-right">Reactions</th>
              <th className="pb-3 font-semibold text-right">Sent Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, idx) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                <td className="py-3.5 font-mono text-xs text-slate-500">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      idx === 0
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : idx === 1
                        ? 'bg-slate-100 text-slate-700 border border-slate-300'
                        : idx === 2
                        ? 'bg-amber-50 text-amber-900 border border-amber-200'
                        : 'text-slate-400'
                    }`}
                  >
                    #{idx + 1}
                  </span>
                </td>
                <td className="py-3.5 pr-4 max-w-md">
                  <div className="font-semibold text-slate-900 line-clamp-1 group-hover:text-emerald-700 transition-colors">
                    {item.title}
                  </div>
                  {item.processedPreview && (
                    <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                      {item.processedPreview}
                    </div>
                  )}
                </td>
                <td className="py-3.5 text-center">
                  {item.mediaUrl ? (
                    <a
                      href={item.mediaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>View</span>
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="py-3.5 text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold font-mono">
                    👍 {item.reactionsCount}
                  </span>
                </td>
                <td className="py-3.5 text-right text-xs text-slate-500 font-mono">
                  {item.sentAt
                    ? new Date(item.sentAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

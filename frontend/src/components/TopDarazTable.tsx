'use client';

import React from 'react';
import { ShoppingBag, ArrowUpRight, Percent } from 'lucide-react';

interface TopProductItem {
  id: string;
  title: string;
  originalPrice?: number | string;
  discountPrice: number | string;
  discountPercentage?: number | string;
  commissionAmount?: number;
  clicksCount: number;
  estimatedRevenue: number;
  mediaUrl: string | null;
  sentAt: string | null;
}

interface TopDarazTableProps {
  items: TopProductItem[];
  apiBaseUrl?: string;
}

export function TopDarazTable({ items, apiBaseUrl = 'http://localhost:4000' }: TopDarazTableProps) {
  if (items.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-sm">
        No Daraz flash deals dispatched yet.
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-amber-600" />
            <span>Top Performing Flash Deals (Ranked by Click Volume)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time link click metrics logged via the redirect engine (/r/:postId).
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase tracking-wider font-mono">
              <th className="pb-3 font-semibold">Rank</th>
              <th className="pb-3 font-semibold">Product Deal</th>
              <th className="pb-3 font-semibold text-right">Offer Price</th>
              <th className="pb-3 font-semibold text-center">Discount</th>
              <th className="pb-3 font-semibold text-right">Bot Comm.</th>
              <th className="pb-3 font-semibold text-right">Clicks</th>
              <th className="pb-3 font-semibold text-right">Est. Comm.</th>
              <th className="pb-3 font-semibold text-center">Tracking URL</th>
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
                <td className="py-3.5 pr-4 max-w-sm">
                  <div className="font-semibold text-slate-900 line-clamp-1 group-hover:text-amber-700 transition-colors">
                    {item.title}
                  </div>
                  {item.sentAt && (
                    <div className="text-xs text-slate-500 mt-0.5 font-mono">
                      Dispatched:{' '}
                      {new Date(item.sentAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                </td>
                <td className="py-3.5 text-right font-mono font-bold text-slate-900">
                  Rs. {item.discountPrice}
                </td>
                <td className="py-3.5 text-center">
                  {item.discountPercentage ? (
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
                      <Percent className="w-3 h-3" />
                      {item.discountPercentage}%
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="py-3.5 text-right font-mono text-xs font-bold text-slate-800">
                  {item.commissionAmount ? `Rs. ${item.commissionAmount}` : '—'}
                </td>
                <td className="py-3.5 text-right">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold font-mono">
                    ⚡ {item.clicksCount}
                  </span>
                </td>
                <td className="py-3.5 text-right font-mono font-bold text-emerald-700">
                  Rs. {item.estimatedRevenue.toLocaleString()}
                </td>
                <td className="py-3.5 text-center">
                  <a
                    href={`${apiBaseUrl}/r/${item.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 hover:text-amber-800 text-xs transition-colors font-mono font-semibold"
                    title="Test tracking redirect (/r/:postId)"
                  >
                    <span>/r/{item.id.slice(0, 6)}</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

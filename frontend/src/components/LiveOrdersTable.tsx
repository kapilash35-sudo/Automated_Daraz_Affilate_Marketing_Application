'use client';

import React, { useState } from 'react';
import { ShoppingCart, CheckCircle2, Clock, Copy, Check, ExternalLink, ShieldCheck } from 'lucide-react';
import { DarazOrderRecord } from '../lib/types';

interface LiveOrdersTableProps {
  orders?: DarazOrderRecord[];
}

export function LiveOrdersTable({ orders = [] }: LiveOrdersTableProps) {
  const [copied, setCopied] = useState(false);
  const webhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin.replace(':3001', ':4000')}/api/webhooks/daraz/postback`
    : 'https://darazdeals.duckdns.org/api/webhooks/daraz/postback';

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText('https://darazdeals.duckdns.org/api/webhooks/daraz/postback');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
      {/* Header & Postback Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-600" />
            <span>Daraz Real-Time Confirmed Orders (Webhook S2S)</span>
            <span className="ml-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Postback
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            100% verified orders received directly from Daraz Affiliate Program via server-to-server webhook.
          </p>
        </div>

        {/* Copy Webhook URL Widget */}
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
          <div className="text-xs font-mono text-slate-600 px-2 truncate max-w-[240px] md:max-w-[320px]">
            https://darazdeals.duckdns.org/api/webhooks/daraz/postback
          </div>
          <button
            onClick={copyWebhookUrl}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors shadow-xs"
            title="Copy Postback URL"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Orders Table */}
      {orders.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-2">
          <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">No Orders Logged Yet</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Once you paste your Postback URL in Daraz Affiliate Program (Type: Order), all customer purchases will appear here live with order value and your commission!
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Product / Item</th>
                <th className="py-3 px-4 text-right">Order Amount</th>
                <th className="py-3 px-4 text-right">Your Commission</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {orders.map((o) => {
                const isPaid = ['Order', 'Delivered', 'Paid', 'Approved'].includes(o.status);
                return (
                  <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-800">
                      {o.orderId}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800 line-clamp-1 max-w-[260px]">
                        {o.itemName || 'Daraz Qualifying Purchase'}
                      </div>
                      {o.subId && (
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          SubID: {o.subId}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-700">
                      {o.orderAmount > 0 ? `Rs. ${o.orderAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                      {o.commissionAmount > 0 ? `Rs. ${o.commissionAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          isPaid
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {isPaid ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Clock className="w-3 h-3 text-amber-500" />}
                        {o.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-xs text-slate-500">
                      {new Date(o.createdAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

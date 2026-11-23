'use client';

import React, { useState } from 'react';
import {
  ShoppingCart,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Smartphone,
  Sparkles,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import { DarazOrderRecord } from '../lib/types';

interface LiveOrdersTableProps {
  orders?: DarazOrderRecord[];
}

export const DARAZ_MACRO_POSTBACK_URL =
  'https://darazdeals.duckdns.org/api/webhooks/daraz/postback?order_id={_p_transaction}&sub_order_id={_p_sub_transaction}&amount={_p_pay_amount}&payout={_p_payout}&commission_rate={_p_com_rate}&currency={_p_currency}&status={_p_status}&item_id={_p_purchased_item_id}&sku={_p_sku_daraz}&category1={_p_cate_name_lv1}&category2={_p_cate_name_lv2}&device_os={_device_os}&platform={_p_platform}&is_new_user={_p_new_user}&conversion_time={_p_conversion_time}&sub_aff_id={sub_aff_id}&post_id={sub_id1}&language={sub_id2}';

export function LiveOrdersTable({ orders = [] }: LiveOrdersTableProps) {
  const [copied, setCopied] = useState(false);

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(DARAZ_MACRO_POSTBACK_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
      {/* Header & Postback Info */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-600" />
            <span>Daraz Real-Time Confirmed Orders (S2S Postback)</span>
            <span className="ml-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live S2S Macros
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            100% verified customer orders attributed to WhatsApp posts via Daraz Adsense Server-to-Server webhook.
          </p>
        </div>

        {/* Copy Webhook URL Widget */}
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
          <div className="text-xs font-mono text-slate-600 px-2 truncate max-w-[200px] sm:max-w-[320px]">
            {DARAZ_MACRO_POSTBACK_URL}
          </div>
          <button
            onClick={copyWebhookUrl}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors shadow-xs shrink-0"
            title="Copy Full Macro Postback URL for Daraz"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copied ? 'Copied Full URL!' : 'Copy Postback URL'}</span>
          </button>
        </div>
      </div>

      {/* Orders Table */}
      {orders.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-2">
          <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">No Orders Logged Yet</p>
          <p className="text-xs text-slate-500 max-w-lg mx-auto">
            Paste the <strong>Full Macro Postback URL</strong> above into your Daraz Affiliate Program (Type: Order). When customers purchase from your WhatsApp links, their orders, commissions, and category will appear here instantly!
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Order ID & Item</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Source / Device</th>
                <th className="py-3 px-4 text-right">Order Amount</th>
                <th className="py-3 px-4 text-right">Commission</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {orders.map((o) => {
                const isPaid = ['Order', 'Delivered', 'Paid', 'Approved', 'Fulfilled'].includes(o.status);
                const isSinhala = o.language === 'SINHALA';
                return (
                  <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-xs font-bold text-slate-800">
                        {o.orderId}
                      </div>
                      <div className="font-medium text-slate-700 text-xs line-clamp-1 max-w-[240px] mt-0.5">
                        {o.itemName || o.post?.rawPayload?.title || 'Daraz Qualifying Purchase'}
                      </div>
                      {o.isNewUser && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.2 mt-1">
                          <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                          New Buyer
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {o.category1 ? (
                        <div>
                          <span className="font-semibold text-slate-800">{o.category1}</span>
                          {o.category2 && <div className="text-[11px] text-slate-400">{o.category2}</div>}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                            isSinhala ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {isSinhala ? 'SINHALA' : 'TAMIL'}
                        </span>
                        {o.deviceOs && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            <Smartphone className="w-3 h-3 text-slate-400" />
                            {o.deviceOs}
                          </span>
                        )}
                      </div>
                      {o.postId && (
                        <div className="text-[10px] text-slate-400 font-mono mt-1">
                          Post: {o.postId.slice(-8)}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-semibold text-slate-700">
                      {o.orderAmount > 0 ? `Rs. ${o.orderAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="font-bold text-emerald-600">
                        {o.commissionAmount > 0 ? `Rs. ${o.commissionAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                      </div>
                      {o.commissionRate ? (
                        <div className="text-[10px] text-emerald-500 font-medium">
                          {(o.commissionRate * 100).toFixed(1)}% rate
                        </div>
                      ) : null}
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

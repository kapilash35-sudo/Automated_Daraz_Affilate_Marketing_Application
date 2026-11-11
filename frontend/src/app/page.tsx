'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '../components/Header';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  PlusCircle,
  ShoppingBag,
  ExternalLink,
  Percent,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { fetchPendingDeals, approveDeal, rejectDeal, fetchAllDeals, fetchWhatsAppStatus } from '../lib/api';
import { DealPost } from '../lib/types';

export default function DealsPage() {
  const [pendingDeals, setPendingDeals] = useState<DealPost[]>([]);
  const [dispatchedDeals, setDispatchedDeals] = useState<DealPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(false);
  const [selectedLangMap, setSelectedLangMap] = useState<Record<string, 'TAMIL' | 'SINHALA'>>({});
  const [toast, setToast] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [pending, all, waStatus] = await Promise.all([
        fetchPendingDeals().catch(() => []),
        fetchAllDeals('SENT').catch(() => []),
        fetchWhatsAppStatus().catch(() => null),
      ]);
      setPendingDeals(pending);
      setDispatchedDeals(all);
      if (waStatus) setIsWhatsAppConnected(waStatus.connected);
    } catch (err: any) {
      console.error('Failed to load deals:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await approveDeal(id);
      showToast(res.message || 'Deal approved and enqueued for broadcast!');
      await loadData();
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('Are you sure you want to discard this deal draft?')) return;
    setActionLoadingId(id);
    try {
      await rejectDeal(id);
      showToast('Deal draft rejected.');
      await loadData();
    } catch (err: any) {
      alert(`Rejection error: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="space-y-8">
      <Header
        title="Daraz Deals & Approval Command Center"
        subtitle="Review, approve, and broadcast AI-generated Tamil WhatsApp deals to your buyer groups."
        onRefresh={loadData}
        isLoading={isLoading}
        isWhatsAppConnected={isWhatsAppConnected}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2 text-sm animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* SECTION 1: PENDING APPROVAL QUEUE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
            <h2 className="text-lg font-bold text-slate-900">
              Awaiting Approval ({pendingDeals.length})
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              (Sent via WhatsApp Bot or Quick Creator)
            </span>
          </div>

          <Link
            href="/create"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Create New Deal</span>
          </Link>
        </div>

        {pendingDeals.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <div className="font-bold text-slate-800 text-sm">All caught up! No deals waiting for approval.</div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Send a Daraz deal link from your phone on WhatsApp (or tap <strong>Create New Deal</strong>) to generate a new AI draft.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {pendingDeals.map((deal) => {
              const payload = deal.rawPayload || {};
              return (
                <div
                  key={deal.id}
                  className="bg-white border-2 border-amber-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Header Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold font-mono">
                        <Clock className="w-3 h-3" />
                        Pending Approval
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {new Date(deal.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Image & Title Preview */}
                    <div className="flex gap-4 items-start">
                      {deal.mediaUrl ? (
                        <img
                          src={deal.mediaUrl}
                          alt="Product"
                          className="w-20 h-20 rounded-xl object-cover border border-slate-200 shadow-sm shrink-0 bg-slate-50"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-xs text-center p-1 shrink-0 font-medium">
                          No Photo
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm line-clamp-2">
                          {payload.title || 'Daraz Deal Item'}
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5">
                          {payload.discountPrice && (
                            <span className="text-sm font-extrabold text-emerald-700 font-mono">
                              Rs. {payload.discountPrice}
                            </span>
                          )}
                          {payload.originalPrice && (
                            <span className="text-xs text-slate-400 line-through font-mono">
                              Rs. {payload.originalPrice}
                            </span>
                          )}
                          {payload.discountPercentage && (
                            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                              {payload.discountPercentage}% OFF
                            </span>
                          )}
                          {payload.commissionAmount && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono">
                              Comm: Rs. {payload.commissionAmount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bilingual Language Switcher */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
                        <button
                          type="button"
                          onClick={() => setSelectedLangMap((prev) => ({ ...prev, [deal.id]: 'TAMIL' }))}
                          className={`px-2.5 py-1 rounded font-bold text-[11px] transition-all ${
                            (selectedLangMap[deal.id] || 'TAMIL') === 'TAMIL'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          🇱🇰 தமிழ்
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedLangMap((prev) => ({ ...prev, [deal.id]: 'SINHALA' }))}
                          className={`px-2.5 py-1 rounded font-bold text-[11px] transition-all ${
                            selectedLangMap[deal.id] === 'SINHALA'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          🇱🇰 සිංහල
                        </button>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {(selectedLangMap[deal.id] || 'TAMIL') === 'TAMIL' ? 'Tamil Copy Preview' : 'Sinhala Copy Preview'}
                      </span>
                    </div>

                    {/* AI Generated WhatsApp Copy Box */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-800 font-mono whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto">
                      {selectedLangMap[deal.id] === 'SINHALA'
                        ? deal.processedTextSinhala || 'සිංහල දැන්වීමක් නොමැත (Only Tamil available)'
                        : deal.processedText}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <button
                      onClick={() => handleReject(deal.id)}
                      disabled={actionLoadingId === deal.id}
                      className="px-4 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-all disabled:opacity-50"
                    >
                      Reject
                    </button>

                    <button
                      onClick={() => handleApprove(deal.id)}
                      disabled={actionLoadingId === deal.id}
                      className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        {actionLoadingId === deal.id ? 'Broadcasting...' : 'Approve & Broadcast Now'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: DISPATCHED DEALS & CLICK HISTORY */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
              <span>Broadcasted Deals & Click Volume</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Real-time records of deals dispatched to your WhatsApp groups.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase tracking-wider font-mono">
                <th className="pb-3 font-semibold">Deal Title</th>
                <th className="pb-3 font-semibold text-center">Status</th>
                <th className="pb-3 font-semibold text-right">Offer Price</th>
                <th className="pb-3 font-semibold text-right">Clicks</th>
                <th className="pb-3 font-semibold text-right">Dispatched At</th>
                <th className="pb-3 font-semibold text-center">Tracking URL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dispatchedDeals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                    No deals broadcasted yet.
                  </td>
                </tr>
              ) : (
                dispatchedDeals.map((deal) => {
                  const payload = deal.rawPayload || {};
                  return (
                    <tr key={deal.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 pr-4 max-w-sm">
                        <div className="font-bold text-slate-900 line-clamp-1">
                          {payload.title || 'Daraz Deal'}
                        </div>
                      </td>
                      <td className="py-3.5 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {deal.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-right font-mono font-bold text-slate-900">
                        Rs. {payload.discountPrice || payload.price || '—'}
                      </td>
                      <td className="py-3.5 text-right font-mono font-extrabold text-amber-600">
                        ⚡ {deal.clicksCount}
                      </td>
                      <td className="py-3.5 text-right text-xs text-slate-500 font-mono">
                        {deal.sentAt
                          ? new Date(deal.sentAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Queued'}
                      </td>
                      <td className="py-3.5 text-center">
                        <a
                          href={`http://localhost:4000/r/${deal.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-mono font-semibold"
                        >
                          <span>/r/{deal.id.slice(0, 6)}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

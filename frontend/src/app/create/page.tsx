'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '../../components/Header';
import { Sparkles, Check } from 'lucide-react';
import { createQuickDeal } from '../../lib/api';

export default function CreateDealPage() {
  const router = useRouter();
  const [dealText, setDealText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [commissionAmount, setCommissionAmount] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealText.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await createQuickDeal({
        text: dealText.trim(),
        imageUrl: imageUrl.trim() || undefined,
        commissionAmount: commissionAmount ? parseFloat(commissionAmount) : undefined,
        autoApprove,
      });

      setSuccessMessage(res.message);
      setDealText('');
      setImageUrl('');
      setCommissionAmount('');
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err: any) {
      alert(`Error creating deal: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <Header
        title="Quick Deal Creator"
        subtitle="Generate WhatsApp promotional ads with Gemini 3.0"
      />

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-2">
          <Check className="w-5 h-5 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
            Daraz Share Text & Link
          </label>
          <textarea
            required
            rows={5}
            value={dealText}
            onChange={(e) => setDealText(e.target.value)}
            placeholder="Paste Daraz product details with link (e.g. https://s.daraz.lk/s.xxx)..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
            Product Commission (Rs.)
          </label>
          <input
            type="number"
            value={commissionAmount}
            onChange={(e) => setCommissionAmount(e.target.value)}
            placeholder="e.g. 250"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
            Optional Custom Product Image URL
          </label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://... (Leave empty to automatically extract from Daraz)"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all font-mono"
          />
        </div>

        {/* Auto Approve Toggle */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-900">Auto-Approve & Broadcast Immediately?</div>
            <div className="text-[11px] text-slate-500">
              When checked, skips approval queue and broadcasts immediately.
            </div>
          </div>
          <input
            type="checkbox"
            checked={autoApprove}
            onChange={(e) => setAutoApprove(e.target.checked)}
            className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
          />
        </div>

        <div className="pt-2 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-all"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Processing with Gemini 3.0...'
                : autoApprove
                ? 'Generate & Broadcast'
                : 'Generate AI Ad Draft'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}


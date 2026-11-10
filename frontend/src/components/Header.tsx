'use client';

import React from 'react';
import { RefreshCw, QrCode } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  isLoading?: boolean;
  onOpenQR?: () => void;
  isWhatsAppConnected?: boolean;
}

export function Header({
  title,
  subtitle,
  onRefresh,
  isLoading,
  onOpenQR,
  isWhatsAppConnected,
}: HeaderProps) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-slate-200">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* WhatsApp QR Quick Link Button */}
        {onOpenQR && (
          <button
            onClick={onOpenQR}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
              isWhatsAppConnected
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>{isWhatsAppConnected ? 'WhatsApp Linked' : 'Scan QR Code'}</span>
          </button>
        )}

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        )}
      </div>
    </header>
  );
}

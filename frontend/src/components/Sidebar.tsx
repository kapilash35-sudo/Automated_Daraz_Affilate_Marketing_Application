'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CheckSquare,
  PlusCircle,
  TrendingUp,
  Settings,
  ShoppingBag,
} from 'lucide-react';
import { fetchWhatsAppStatus, fetchPendingDeals } from '../lib/api';

export function Sidebar() {
  const pathname = usePathname();
  const [isConnected, setIsConnected] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const checkState = async () => {
      try {
        const [status, pending] = await Promise.all([
          fetchWhatsAppStatus().catch(() => null),
          fetchPendingDeals().catch(() => []),
        ]);
        if (status) setIsConnected(status.connected);
        setPendingCount(pending.length);
      } catch {}
    };

    checkState();
    const interval = setInterval(checkState, 6000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    {
      name: 'Deals & Approvals',
      href: '/',
      icon: CheckSquare,
      badge: pendingCount > 0 ? `${pendingCount} Pending` : undefined,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    },
    {
      name: 'Quick Deal Creator',
      href: '/create',
      icon: PlusCircle,
    },
    {
      name: 'Revenue & Analytics',
      href: '/analytics',
      icon: TrendingUp,
    },
    {
      name: 'Settings & QR Connect',
      href: '/settings',
      icon: Settings,
    },
  ];

  return (
    <aside className="w-72 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 h-screen sticky top-0 shadow-sm">
      <div>
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-slate-900 text-sm tracking-wide">
              DARAZ AFFILIATE HUB
            </h1>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Marketing & Deals Engine
            </p>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="px-4 py-6">
          <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase px-3">
            Affiliate Management
          </span>
          <nav className="mt-3 space-y-1.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}

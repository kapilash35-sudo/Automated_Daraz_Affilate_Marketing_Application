'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '../../components/Header';
import { MetricCard } from '../../components/MetricCard';
import { HeatmapGrid } from '../../components/HeatmapGrid';
import { TopDarazTable } from '../../components/TopDarazTable';
import { LiveOrdersTable } from '../../components/LiveOrdersTable';
import {
  ShoppingBag,
  ShoppingCart,
  DollarSign,
  Tag,
  TrendingUp,
} from 'lucide-react';
import { fetchDarazAnalytics } from '../../lib/api';
import { DarazAnalyticsResponse } from '../../lib/types';

export default function AnalyticsPage() {
  const [data, setData] = useState<DarazAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await fetchDarazAnalytics();
      setData(res);
    } catch (err: any) {
      console.error('Failed to load Daraz analytics:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-8">
      <Header
        title="Revenue & Performance Analytics"
        subtitle="100% real-time verified Daraz purchases, webhook postback orders, and actual earned commissions."
        onRefresh={loadData}
        isLoading={isLoading}
      />

      {/* Primary KPI Grid (100% Real-Time Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Total Deals Broadcasted"
          value={data?.summary.totalSent ?? '—'}
          subtitle={`${data?.summary.totalDeals ?? 0} Ingested Total`}
          icon={Tag}
          color="amber"
        />

        <MetricCard
          title="Confirmed Orders"
          value={data?.summary.realOrdersCount ?? 0}
          subtitle="Real Webhook Purchases"
          icon={ShoppingCart}
          color="purple"
          trend="100% Verified"
        />

        <MetricCard
          title="Total Sales Volume (GMV)"
          value={
            data
              ? `Rs. ${(data.summary.realSalesVolume ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '—'
          }
          subtitle="Total Goods Sold on Daraz"
          icon={TrendingUp}
          color="blue"
        />

        <MetricCard
          title="Actual Commission Earned"
          value={
            data
              ? `Rs. ${(data.summary.realCommissionEarned ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '—'
          }
          subtitle="Verified Net Earnings"
          icon={DollarSign}
          color="emerald"
          trend="Real Cash Payout"
        />
      </div>

      {/* Live Verified Daraz Orders Table (from S2S Webhook) */}
      <LiveOrdersTable orders={data?.recentOrders || []} />

      {/* Buyer Click-Through Heatmap (7x24 Day-vs-Hour Grid) */}
      {data && (
        <HeatmapGrid
          grid={data.heatmap.grid}
          maxValue={data.heatmap.maxValue}
          type="CLICK"
          topPeakSlots={data.heatmap.topPeakSlots}
        />
      )}

      {/* Top Performing Daraz Deals Table */}
      {data && <TopDarazTable items={data.topProducts} />}
    </div>
  );
}

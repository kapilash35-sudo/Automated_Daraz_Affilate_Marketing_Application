'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '../../components/Header';
import { MetricCard } from '../../components/MetricCard';
import { HeatmapGrid } from '../../components/HeatmapGrid';
import { TopDarazTable } from '../../components/TopDarazTable';
import { RevenueCalculator } from '../../components/RevenueCalculator';
import {
  ShoppingBag,
  MousePointerClick,
  DollarSign,
  Tag,
} from 'lucide-react';
import { fetchDarazAnalytics, fetchSettings } from '../../lib/api';
import { DarazAnalyticsResponse } from '../../lib/types';

export default function AnalyticsPage() {
  const [data, setData] = useState<DarazAnalyticsResponse | null>(null);
  const [conversionRate, setConversionRate] = useState(0.025);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async (convRate = conversionRate) => {
    setIsLoading(true);
    try {
      const res = await fetchDarazAnalytics(convRate.toString());
      setData(res);
    } catch (err: any) {
      console.error('Failed to load Daraz analytics:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const settings = await fetchSettings().catch(() => null);
        if (settings && settings.conversionRate) {
          setConversionRate(parseFloat(settings.conversionRate));
        }
      } catch {}
      await loadData();
    };
    init();
  }, []);

  const handleConversionRateChange = (rate: number) => {
    setConversionRate(rate);
    loadData(rate);
  };

  return (
    <div className="space-y-8">
      <Header
        title="Revenue & Performance Analytics"
        subtitle="Track affiliate link click volume, buyer peak engagement hours, and actual projected commission earnings."
        onRefresh={() => loadData(conversionRate)}
        isLoading={isLoading}
      />

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Total Deals Broadcasted"
          value={data?.summary.totalSent ?? '—'}
          subtitle={`${data?.summary.totalDeals ?? 0} Ingested Total`}
          icon={Tag}
          color="amber"
        />

        <MetricCard
          title="Affiliate Link Clicks"
          value={data?.summary.totalClicks ?? '—'}
          subtitle="Real-time Redirect Logs"
          icon={MousePointerClick}
          color="blue"
          trend="Tracked via /r/:postId"
        />

        <MetricCard
          title="Estimated Orders"
          value={data ? Math.round(data.summary.totalClicks * conversionRate) : '—'}
          subtitle={`At ${(conversionRate * 100).toFixed(1)}% Conv. Rate`}
          icon={ShoppingBag}
          color="purple"
        />

        <MetricCard
          title="Expected Commission"
          value={
            data
              ? `Rs. ${data.summary.expectedCommission.toLocaleString()}`
              : '—'
          }
          subtitle="Real-time Bot Commissions"
          icon={DollarSign}
          color="emerald"
          trend="Projected Payout"
        />
      </div>

      {/* Interactive Revenue Estimator Slider Widget (Conversion Rate Only) */}
      {data && (
        <RevenueCalculator
          totalClicks={data.summary.totalClicks}
          expectedCommission={data.summary.expectedCommission}
          initialConversionRate={conversionRate}
          onConversionRateChange={handleConversionRateChange}
        />
      )}

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

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
  TrendingUp,
  Tag,
} from 'lucide-react';
import { fetchDarazAnalytics, fetchSettings } from '../../lib/api';
import { DarazAnalyticsResponse } from '../../lib/types';

export default function AnalyticsPage() {
  const [data, setData] = useState<DarazAnalyticsResponse | null>(null);
  const [conversionRate, setConversionRate] = useState(0.025);
  const [avgCommission, setAvgCommission] = useState(380);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async (convRate = conversionRate, comm = avgCommission) => {
    setIsLoading(true);
    try {
      const res = await fetchDarazAnalytics(convRate.toString(), comm.toString());
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
        if (settings) {
          if (settings.conversionRate) setConversionRate(parseFloat(settings.conversionRate));
          if (settings.avgCommission) setAvgCommission(parseFloat(settings.avgCommission));
        }
      } catch {}
      await loadData();
    };
    init();
  }, []);

  const handleParametersChange = (rate: number, comm: number) => {
    setConversionRate(rate);
    setAvgCommission(comm);
  };

  return (
    <div className="space-y-8">
      <Header
        title="Revenue & Performance Analytics"
        subtitle="Track affiliate link click volume, buyer peak engagement hours, and projected commission earnings."
        onRefresh={() => loadData(conversionRate, avgCommission)}
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
              ? `Rs. ${Math.round(
                  data.summary.totalClicks * conversionRate * avgCommission
                ).toLocaleString()}`
              : '—'
          }
          subtitle={`Rs. ${avgCommission} avg / order`}
          icon={DollarSign}
          color="emerald"
          trend="Projected Payout"
        />
      </div>

      {/* Interactive Revenue Estimator Slider Widget */}
      {data && (
        <RevenueCalculator
          totalClicks={data.summary.totalClicks}
          initialConversionRate={conversionRate}
          initialAvgCommission={avgCommission}
          onParametersChange={handleParametersChange}
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


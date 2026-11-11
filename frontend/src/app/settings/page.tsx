'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '../../components/Header';
import { WhatsAppQRConnect } from '../../components/WhatsAppQRConnect';
import {
  Settings,
  Phone,
  Link as LinkIcon,
  Users,
  Check,
  RefreshCw,
  Power,
  ShieldCheck,
  Globe,
  Radio,
} from 'lucide-react';
import {
  fetchSettings,
  updateSettings,
  fetchGroups,
  updateGroup,
  syncWahaGroups,
} from '../../lib/api';
import { SystemSettings, WhatsAppGroup, GroupLanguage } from '../../lib/types';

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    adminPhone: '',
    communityInviteUrl: '',
    communityInviteUrlSinhala: '',
    autoApprove: 'false',
    conversionRate: '0.025',
    avgCommission: '380',
  });
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingGroups, setIsSyncingGroups] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<'ALL' | 'ACTIVE' | 'TAMIL' | 'SINHALA'>('ALL');

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [s, g] = await Promise.all([
        fetchSettings().catch(() => null),
        fetchGroups().catch(() => []),
      ]);
      if (s) setSettings(s);
      setGroups(g);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateSettings(settings);
      showToast('Settings saved successfully!');
    } catch (err: any) {
      alert(`Error saving settings: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleGroup = async (group: WhatsAppGroup) => {
    const newRole = group.role === 'DESTINATION' ? 'NONE' : 'DESTINATION';
    // Optimistic UI update
    setGroups((prev) =>
      prev.map((g) => (g.id === group.id ? { ...g, role: newRole, type: 'DARAZ', isActive: true } : g))
    );
    try {
      const updated = await updateGroup(group.id, {
        role: newRole,
        type: 'DARAZ',
        isActive: true,
      });
      setGroups((prev) => prev.map((g) => (g.id === group.id ? updated : g)));
      showToast(
        updated.role === 'DESTINATION'
          ? `Added "${group.name}" to broadcast list (${group.language || 'TAMIL'})`
          : `Removed "${group.name}" from broadcast list`
      );
    } catch (err: any) {
      showToast(`Error updating group: ${err.message}`);
      setGroups((prev) => prev.map((g) => (g.id === group.id ? group : g)));
    }
  };

  const handleLanguageChange = async (group: WhatsAppGroup, newLang: GroupLanguage) => {
    // Optimistic UI update
    setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, language: newLang } : g)));
    try {
      const updated = await updateGroup(group.id, { language: newLang });
      setGroups((prev) => prev.map((g) => (g.id === group.id ? updated : g)));
      showToast(`"${group.name}" language set to ${newLang}`);
    } catch (err: any) {
      showToast(`Failed to update group language: ${err.message}`);
      setGroups((prev) => prev.map((g) => (g.id === group.id ? group : g)));
    }
  };

  const handleSyncWaha = async () => {
    setIsSyncingGroups(true);
    try {
      const res = await syncWahaGroups();
      setGroups(res.data);
      if (res.importedCount > 0) {
        showToast(`Synced! Discovered ${res.importedCount} new groups.`);
      } else {
        showToast(`Synced! All ${res.data.length} groups are up to date.`);
      }
    } catch (err: any) {
      showToast('WhatsApp syncing. Please ensure QR is scanned or try in a moment.');
    } finally {
      setIsSyncingGroups(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const activeDestinations = groups.filter((g) => g.role === 'DESTINATION');
  const tamilActive = activeDestinations.filter((g) => (g.language || 'TAMIL') === 'TAMIL' || g.language === 'ALL').length;
  const sinhalaActive = activeDestinations.filter((g) => g.language === 'SINHALA' || g.language === 'ALL').length;

  const filteredGroups = groups.filter((g) => {
    if (groupFilter === 'ACTIVE') return g.role === 'DESTINATION';
    if (groupFilter === 'TAMIL') return (g.language || 'TAMIL') === 'TAMIL';
    if (groupFilter === 'SINHALA') return g.language === 'SINHALA';
    return true;
  });

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <Header
        title="Settings & System Configuration"
        subtitle="Manage your WhatsApp connection, admin security phone number, community group invite links (Tamil & Sinhala), and target broadcast groups."
        onRefresh={loadAll}
        isLoading={isLoading}
      />

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2 text-sm font-semibold animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. WHATSAPP QR CODE SCANNER & SESSION MANAGER */}
      <WhatsAppQRConnect />

      {/* 2. ADMIN & COMMUNITY SETTINGS FORM */}
      <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Admin & Community Link Configuration
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure separate Tamil and Sinhala community group invite links for automated ad footers.
              </p>
            </div>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer shrink-0"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Admin Phone Whitelist */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              <span>Admin WhatsApp Number</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 94771234567"
              value={settings.adminPhone}
              onChange={(e) => setSettings({ ...settings, adminPhone: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono font-semibold focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Only this number can submit deals and vote on WhatsApp Polls.
            </p>
          </div>

          {/* Active Tamil Community Group Link */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tamil Community Link</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold font-mono">
                🇱🇰 தமிழ்
              </span>
            </label>
            <input
              type="url"
              placeholder="https://chat.whatsapp.com/..."
              value={settings.communityInviteUrl}
              onChange={(e) => setSettings({ ...settings, communityInviteUrl: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono font-semibold focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Appended to footer of all Tamil deal broadcast ads.
            </p>
          </div>

          {/* Active Sinhala Community Group Link */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-amber-600" />
                <span>Sinhala Community Link</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-bold font-mono">
                🇱🇰 සිංහල
              </span>
            </label>
            <input
              type="url"
              placeholder="https://chat.whatsapp.com/..."
              value={settings.communityInviteUrlSinhala || ''}
              onChange={(e) => setSettings({ ...settings, communityInviteUrlSinhala: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono font-semibold focus:outline-none focus:border-amber-500 focus:bg-white transition-all"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Appended to footer of all Sinhala deal broadcast ads.
            </p>
          </div>
        </div>
      </form>

      {/* 3. BROADCAST TARGET GROUPS & LANGUAGE SELECTOR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-base">
                Target Broadcast Groups ({activeDestinations.length} Active)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select groups to receive broadcasts and choose each group's ad language (Tamil, Sinhala, or All).
            </p>
          </div>

          <button
            onClick={handleSyncWaha}
            disabled={isSyncingGroups}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGroups ? 'animate-spin' : ''}`} />
            <span>Sync Chats from WhatsApp</span>
          </button>
        </div>

        {/* Stats & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Broadcast Breakdown:</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
              🇱🇰 Tamil: {tamilActive}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200">
              🇱🇰 Sinhala: {sinhalaActive}
            </span>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setGroupFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                groupFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({groups.length})
            </button>
            <button
              type="button"
              onClick={() => setGroupFilter('ACTIVE')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                groupFilter === 'ACTIVE' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active ({activeDestinations.length})
            </button>
            <button
              type="button"
              onClick={() => setGroupFilter('TAMIL')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                groupFilter === 'TAMIL' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tamil
            </button>
            <button
              type="button"
              onClick={() => setGroupFilter('SINHALA')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                groupFilter === 'SINHALA' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sinhala
            </button>
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs italic">
            No WhatsApp groups discovered yet. Tap "Sync Chats from WhatsApp" or scan your QR code above.
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs italic">
            No groups match the selected filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[500px] overflow-y-auto pr-1 pt-1">
            {filteredGroups.map((group) => {
              const isSelected = group.role === 'DESTINATION';
              const currentLang = group.language || 'TAMIL';

              return (
                <div
                  key={group.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-emerald-50/50 border-emerald-300 shadow-xs'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70'
                  }`}
                >
                  {/* Top: Name, ID, Toggle Button */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 text-xs truncate" title={group.name}>
                        {group.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                        {group.wahaChatId}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleGroup(group)}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold font-mono transition-all shrink-0 cursor-pointer shadow-xs ${
                        isSelected
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-slate-200 hover:bg-slate-300 text-slate-600'
                      }`}
                    >
                      {isSelected ? '✓ BROADCAST ON' : 'OFF'}
                    </button>
                  </div>

                  {/* Bottom: Language Selection Controls */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-200/70 gap-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Ad Language:
                    </span>

                    <div className="inline-flex rounded-lg p-0.5 bg-slate-200/70 gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleLanguageChange(group, 'TAMIL')}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                          currentLang === 'TAMIL'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Receive Tamil deal copies"
                      >
                        🇱🇰 Tamil
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLanguageChange(group, 'SINHALA')}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                          currentLang === 'SINHALA'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Receive Sinhala deal copies"
                      >
                        🇱🇰 Sinhala
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLanguageChange(group, 'ALL')}
                        className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                          currentLang === 'ALL'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Receive Bilingual (Tamil + Sinhala)"
                      >
                        🌐 All
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


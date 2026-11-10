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
} from 'lucide-react';
import {
  fetchSettings,
  updateSettings,
  fetchGroups,
  updateGroup,
  syncWahaGroups,
} from '../../lib/api';
import { SystemSettings, WhatsAppGroup } from '../../lib/types';

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    adminPhone: '',
    communityInviteUrl: '',
    autoApprove: 'false',
    conversionRate: '0.025',
    avgCommission: '380',
  });
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingGroups, setIsSyncingGroups] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
    try {
      const updated = await updateGroup(group.id, {
        role: group.role === 'DESTINATION' ? 'NONE' : 'DESTINATION',
        isActive: true,
      });
      setGroups((prev) => prev.map((g) => (g.id === group.id ? updated : g)));
      showToast(
        updated.role === 'DESTINATION'
          ? `Added "${group.name}" to broadcast list`
          : `Removed "${group.name}" from broadcast list`
      );
    } catch (err: any) {
      alert(`Error updating group: ${err.message}`);
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
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <Header
        title="Settings & System Configuration"
        subtitle="Manage your WhatsApp connection, admin security phone number, community group invite link, and target broadcast groups."
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
            <h3 className="font-bold text-slate-900 text-base">
              Admin & Community Link Configuration
            </h3>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Admin Phone Whitelist */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              <span>Authorized Admin WhatsApp Number</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 94771234567"
              value={settings.adminPhone}
              onChange={(e) => setSettings({ ...settings, adminPhone: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono font-semibold focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Only this phone number can send deals and vote on WhatsApp Polls.
            </p>
          </div>

          {/* Active Community Group Link */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>Active WhatsApp Community Group Link</span>
            </label>
            <input
              type="url"
              placeholder="https://chat.whatsapp.com/..."
              value={settings.communityInviteUrl}
              onChange={(e) => setSettings({ ...settings, communityInviteUrl: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono font-semibold focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              When a WhatsApp group gets full (1024 limit), update this URL here to change the footer link for all future ads!
            </p>
          </div>
        </div>
      </form>

      {/* 3. BROADCAST TARGET GROUPS CHECKLIST */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-base">
                Target Broadcast Groups ({groups.filter((g) => g.role === 'DESTINATION').length} Active)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select which WhatsApp groups should receive approved Daraz deal broadcasts.
            </p>
          </div>

          <button
            onClick={handleSyncWaha}
            disabled={isSyncingGroups}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGroups ? 'animate-spin' : ''}`} />
            <span>Sync Chats from WhatsApp</span>
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs italic">
            No WhatsApp groups discovered yet. Tap "Sync Chats from WhatsApp" or scan your QR code above.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
            {groups.map((group) => {
              const isSelected = group.role === 'DESTINATION';
              return (
                <div
                  key={group.id}
                  onClick={() => handleToggleGroup(group)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-emerald-50/60 border-emerald-300 shadow-sm'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-xs truncate">
                      {group.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                      {group.wahaChatId}
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`px-3 py-1 rounded-full text-xs font-bold font-mono transition-all shrink-0 ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isSelected ? 'BROADCAST ON' : 'OFF'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


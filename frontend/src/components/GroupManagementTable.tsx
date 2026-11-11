'use client';

import React, { useState } from 'react';
import { WhatsAppGroup, GroupRole, ChannelType, GroupLanguage } from '../lib/types';
import { updateGroup, syncWahaGroups } from '../lib/api';
import { Users, RefreshCw, Check, Power, Globe } from 'lucide-react';

interface GroupManagementTableProps {
  initialGroups: WhatsAppGroup[];
}

export function GroupManagementTable({ initialGroups }: GroupManagementTableProps) {
  const [groups, setGroups] = useState<WhatsAppGroup[]>(initialGroups);
  const [isSyncing, setIsSyncing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const handleRoleChange = async (group: WhatsAppGroup, newRole: GroupRole) => {
    setUpdatingId(group.id);
    try {
      const updated = await updateGroup(group.id, { role: newRole });
      setGroups((prev) => prev.map((g) => (g.id === group.id ? updated : g)));
      showToast(`Group role set to ${newRole}`);
    } catch (err: any) {
      alert(`Failed to update group role: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleTypeChange = async (group: WhatsAppGroup, newType: ChannelType) => {
    setUpdatingId(group.id);
    try {
      const updated = await updateGroup(group.id, { type: newType });
      setGroups((prev) => prev.map((g) => (g.id === group.id ? updated : g)));
      showToast(`Channel type set to ${newType}`);
    } catch (err: any) {
      alert(`Failed to update channel type: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleLanguageChange = async (group: WhatsAppGroup, newLang: GroupLanguage) => {
    setUpdatingId(group.id);
    try {
      const updated = await updateGroup(group.id, { language: newLang });
      setGroups((prev) => prev.map((g) => (g.id === group.id ? updated : g)));
      showToast(`Group language set to ${newLang}`);
    } catch (err: any) {
      alert(`Failed to update group language: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleActive = async (group: WhatsAppGroup) => {
    setUpdatingId(group.id);
    try {
      const updated = await updateGroup(group.id, { isActive: !group.isActive });
      setGroups((prev) => prev.map((g) => (g.id === group.id ? updated : g)));
      showToast(`Group ${!group.isActive ? 'activated' : 'deactivated'}`);
    } catch (err: any) {
      alert(`Failed to toggle status: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSyncWaha = async () => {
    setIsSyncing(true);
    try {
      const res = await syncWahaGroups();
      setGroups(res.data);
      showToast(`Synced with WAHA. Imported ${res.importedCount} new groups.`);
    } catch (err: any) {
      showToast(`WhatsApp syncing. Please verify QR connect status or try again in a moment.`);
    } finally {
      setIsSyncing(false);
    }
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" />
            <span>WhatsApp Group Routing & Topology</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Assign monitored inbound channels (SOURCE) and outbound broadcast subscriber groups (DESTINATION).
          </p>
        </div>

        <div className="flex items-center gap-3">
          {notification && (
            <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1.5 animate-fadeIn font-semibold">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              {notification}
            </span>
          )}

          <button
            onClick={handleSyncWaha}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Sync WAHA Chats</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase tracking-wider font-mono">
              <th className="pb-3 font-semibold">Group Name & Chat ID</th>
              <th className="pb-3 font-semibold text-center">Assigned Role</th>
              <th className="pb-3 font-semibold text-center">Pipeline Domain</th>
              <th className="pb-3 font-semibold text-center">Language</th>
              <th className="pb-3 font-semibold text-center">Active Status</th>
              <th className="pb-3 font-semibold text-right">Routing Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groups.map((group) => (
              <tr key={group.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-3.5 pr-4">
                  <div className="font-bold text-slate-900">{group.name}</div>
                  <div className="text-xs font-mono text-slate-400 mt-0.5">{group.wahaChatId}</div>
                </td>

                {/* Role Selector */}
                <td className="py-3.5 text-center">
                  <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
                    {(['SOURCE', 'DESTINATION', 'NONE'] as GroupRole[]).map((r) => {
                      const isSelected = group.role === r;
                      return (
                        <button
                          key={r}
                          disabled={updatingId === group.id}
                          onClick={() => handleRoleChange(group, r)}
                          className={`px-3 py-1 rounded-lg font-mono text-[11px] font-bold transition-all ${
                            isSelected
                              ? r === 'SOURCE'
                                ? 'bg-cyan-600 text-white shadow-sm'
                                : r === 'DESTINATION'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-slate-400 text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                </td>

                {/* Pipeline Type */}
                <td className="py-3.5 text-center">
                  <select
                    value={group.type}
                    disabled={updatingId === group.id}
                    onChange={(e) => handleTypeChange(group, e.target.value as ChannelType)}
                    className="bg-white border border-slate-200 text-xs rounded-xl px-3 py-1.5 text-slate-800 font-mono font-semibold focus:outline-none focus:border-emerald-500 shadow-sm"
                  >
                    <option value="NEWS">NEWS (Media)</option>
                    <option value="DARAZ">DARAZ (Affiliate)</option>
                  </select>
                </td>

                {/* Target Language */}
                <td className="py-3.5 text-center">
                  <select
                    value={group.language || 'TAMIL'}
                    disabled={updatingId === group.id}
                    onChange={(e) => handleLanguageChange(group, e.target.value as GroupLanguage)}
                    className="bg-white border border-slate-200 text-xs rounded-xl px-2.5 py-1.5 text-slate-800 font-semibold focus:outline-none focus:border-emerald-500 shadow-sm"
                  >
                    <option value="TAMIL">🇱🇰 தமிழ் (Tamil)</option>
                    <option value="SINHALA">🇱🇰 සිංහල (Sinhala)</option>
                    <option value="ALL">🌐 All (இருமொழியும்)</option>
                  </select>
                </td>

                {/* Active Toggle */}
                <td className="py-3.5 text-center">
                  <button
                    onClick={() => handleToggleActive(group)}
                    disabled={updatingId === group.id}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono transition-all ${
                      group.isActive
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    <Power className="w-3 h-3" />
                    <span>{group.isActive ? 'ACTIVE' : 'PAUSED'}</span>
                  </button>
                </td>

                {/* Info / Tag */}
                <td className="py-3.5 text-right font-mono text-xs font-semibold">
                  {group.role === 'SOURCE' && (
                    <span className="text-cyan-700">📥 Ingesting Messages</span>
                  )}
                  {group.role === 'DESTINATION' && (
                    <span className="text-emerald-700">📤 Broadcasting Posts</span>
                  )}
                  {group.role === 'NONE' && <span className="text-slate-400">Unrouted</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

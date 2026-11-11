import {
  WhatsAppGroup,
  WhatsAppSessionStatus,
  WhatsAppQRResponse,
  SystemSettings,
  DealPost,
  DarazAnalyticsResponse,
} from './types';

const API_BASE = typeof window !== 'undefined'
  ? ''
  : (process.env.NEXT_PUBLIC_API_URL || 'http://backend:4000');

// 1. Settings API
export async function fetchSettings(): Promise<SystemSettings> {
  const res = await fetch(`${API_BASE}/api/settings`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch settings');
  const json = await res.json();
  return json.data;
}

export async function updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
  const res = await fetch(`${API_BASE}/api/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  const json = await res.json();
  return json.data;
}

// 2. Deals & Approvals API
export async function fetchPendingDeals(): Promise<DealPost[]> {
  const res = await fetch(`${API_BASE}/api/deals/pending`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch pending deals');
  const json = await res.json();
  return json.data || [];
}

export async function approveDeal(id: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/deals/${id}/approve`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Approval failed' }));
    throw new Error(err.error || 'Approval failed');
  }
  return res.json();
}

export async function rejectDeal(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/deals/${id}/reject`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Rejection failed');
  return res.json();
}

export async function createQuickDeal(payload: {
  text: string;
  imageUrl?: string;
  commissionAmount?: number | string;
  autoApprove?: boolean;
}): Promise<{ success: boolean; message: string; postId: string }> {
  const res = await fetch(`${API_BASE}/api/deals/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Deal creation failed' }));
    throw new Error(err.error || 'Deal creation failed');
  }
  return res.json();
}

export async function fetchAllDeals(status?: string): Promise<DealPost[]> {
  const url = status ? `${API_BASE}/api/deals?status=${status}` : `${API_BASE}/api/deals`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch deals');
  const json = await res.json();
  return json.data || [];
}

// 3. Analytics API
export async function fetchDarazAnalytics(
  conversionRate = '0.025',
  avgCommission = '380'
): Promise<DarazAnalyticsResponse> {
  const res = await fetch(
    `${API_BASE}/api/analytics/daraz?conversionRate=${conversionRate}&avgCommission=${avgCommission}`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json();
}

// 4. WhatsApp Groups API
export async function fetchGroups(): Promise<WhatsAppGroup[]> {
  const res = await fetch(`${API_BASE}/api/groups`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch groups');
  const json = await res.json();
  return json.data || [];
}

export async function updateGroup(
  id: string,
  data: Partial<Pick<WhatsAppGroup, 'name' | 'role' | 'type' | 'language' | 'isActive'>>
): Promise<WhatsAppGroup> {
  const res = await fetch(`${API_BASE}/api/groups/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update group');
  const json = await res.json();
  return json.data;
}

export async function syncWahaGroups(): Promise<{ importedCount: number; data: WhatsAppGroup[] }> {
  const res = await fetch(`${API_BASE}/api/groups/sync`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to sync groups');
  return res.json();
}

// 5. WhatsApp QR & Session API
export async function fetchWhatsAppStatus(session?: string): Promise<WhatsAppSessionStatus> {
  const url = session
    ? `${API_BASE}/api/whatsapp/status?session=${encodeURIComponent(session)}`
    : `${API_BASE}/api/whatsapp/status`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch status');
  return res.json();
}

export async function fetchWhatsAppQR(session?: string): Promise<WhatsAppQRResponse> {
  const url = session
    ? `${API_BASE}/api/whatsapp/qr?session=${encodeURIComponent(session)}`
    : `${API_BASE}/api/whatsapp/qr`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch QR code');
  return res.json();
}

export async function startWhatsAppSession(session?: string): Promise<{ success: boolean; session: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/whatsapp/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session }),
  });
  if (!res.ok) throw new Error('Failed to create/start session');
  return res.json();
}

export async function fetchWhatsAppSessions(): Promise<{ activeSession: string; sessions: any[] }> {
  const res = await fetch(`${API_BASE}/api/whatsapp/sessions`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch sessions');
  return res.json();
}

export async function restartWhatsAppSession(session?: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/whatsapp/restart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session }),
  });
  return res.json();
}

export async function logoutWhatsAppSession(session?: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/whatsapp/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session }),
  });
  return res.json();
}

export async function deleteWhatsAppSession(session: string): Promise<{ success: boolean; session: string }> {
  const res = await fetch(`${API_BASE}/api/whatsapp/sessions/${encodeURIComponent(session)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete session');
  return res.json();
}

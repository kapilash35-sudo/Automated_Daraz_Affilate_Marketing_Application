'use client';

import React, { useEffect, useState } from 'react';
import {
  QrCode,
  CheckCircle2,
  RefreshCw,
  Smartphone,
  LogOut,
  PlayCircle,
  Check,
  AlertCircle,
  Trash2,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  fetchWhatsAppStatus,
  fetchWhatsAppQR,
  startWhatsAppSession,
  logoutWhatsAppSession,
  fetchSettings,
  fetchWhatsAppSessions,
  deleteWhatsAppSession,
} from '../lib/api';
import { WhatsAppSessionStatus } from '../lib/types';

interface WhatsAppQRConnectProps {
  onStatusChange?: (connected: boolean) => void;
  compact?: boolean;
}

export function WhatsAppQRConnect({ onStatusChange }: WhatsAppQRConnectProps) {
  const [sessionName, setSessionName] = useState('default');
  const [session, setSession] = useState<WhatsAppSessionStatus | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Sessions management state
  const [sessionsList, setSessionsList] = useState<any[]>([]);
  const [showSessionsList, setShowSessionsList] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [deletingSessionName, setDeletingSessionName] = useState<string | null>(null);

  // Check status for current session
  const checkStatus = async (targetSession = sessionName) => {
    try {
      const statusRes = await fetchWhatsAppStatus(targetSession);
      setSession(statusRes);
      if (onStatusChange) onStatusChange(statusRes.connected);

      // If connected, clear QR code
      if (statusRes.connected) {
        setQrCode(null);
      } else if (statusRes.status === 'SCAN_QR_CODE') {
        const qrRes = await fetchWhatsAppQR(targetSession);
        if (qrRes?.qr) {
          setQrCode(qrRes.qr);
        }
      }
      return statusRes;
    } catch (err: any) {
      console.warn('Status check failed:', err.message);
      return null;
    }
  };

  useEffect(() => {
    // Initial status check with configured session name
    const init = async () => {
      try {
        const settings = await fetchSettings().catch(() => null);
        const activeName = (settings?.wahaSessionName || 'default').trim();
        setSessionName(activeName);
        await checkStatus(activeName);
      } catch {
        checkStatus('default');
      }
    };
    init();
  }, []);

  // Poll status while QR code is visible until phone scans and connects
  useEffect(() => {
    if (!qrCode || session?.connected) return;

    const interval = setInterval(async () => {
      const res = await checkStatus(sessionName);
      if (res?.connected) {
        setMessage({ type: 'success', text: 'WhatsApp connected successfully!' });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [qrCode, session?.connected, sessionName]);

  // Session management handlers
  const handleLoadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const res = await fetchWhatsAppSessions();
      setSessionsList(res.sessions || []);
      setShowSessionsList(true);
      setMessage({
        type: 'info',
        text: `Loaded ${res.sessions?.length || 0} session(s) from WAHA.`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: `Failed to load sessions: ${err.message}` });
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleDeleteSession = async (targetSession: string) => {
    if (!window.confirm(`Are you sure you want to delete session "${targetSession}"? This will clear its data.`)) {
      return;
    }

    setDeletingSessionName(targetSession);
    try {
      await deleteWhatsAppSession(targetSession);
      setMessage({
        type: 'success',
        text: `Session "${targetSession}" deleted successfully!`,
      });
      // Refresh list
      const res = await fetchWhatsAppSessions();
      setSessionsList(res.sessions || []);
      // If deleted active session, reset QR & status
      if (sessionName === targetSession) {
        setQrCode(null);
        setSession(null);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: `Failed to delete session: ${err.message}` });
    } finally {
      setDeletingSessionName(null);
    }
  };

  const handleSelectSession = async (targetSession: string) => {
    setSessionName(targetSession);
    setMessage({ type: 'info', text: `Switched active session to "${targetSession}". Checking status...` });
    await checkStatus(targetSession);
  };

  // Step 1: Create Session
  const handleCreateSession = async () => {
    const trimmed = sessionName.trim();
    if (!trimmed) {
      setMessage({ type: 'error', text: 'Please enter a valid session name' });
      return;
    }

    setIsCreatingSession(true);
    setMessage({
      type: 'info',
      text: `Initializing session "${trimmed}" in WAHA...`,
    });
    try {
      const res = await startWhatsAppSession(trimmed);
      if (res.success) {
        setMessage({
          type: 'success',
          text: `Session "${trimmed}" is active! Fetching QR Code...`,
        });
        await checkStatus(trimmed);
        // Automatically fetch QR code after creating session
        await fetchQRWithRetry(trimmed);
      } else {
        setMessage({ type: 'error', text: res.message || 'Failed to start session' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create session' });
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Helper: Fetch QR code with smart retry for when WAHA Chromium is booting
  const fetchQRWithRetry = async (targetSession: string) => {
    setIsGeneratingQR(true);
    try {
      let attempts = 0;
      let qrFound = false;

      while (attempts < 8 && !qrFound) {
        attempts++;
        const qrRes = await fetchWhatsAppQR(targetSession);
        if (qrRes.qr) {
          setQrCode(qrRes.qr);
          setMessage({
            type: 'info',
            text: 'QR Code ready! Point your WhatsApp camera to scan.',
          });
          qrFound = true;
          break;
        } else if (qrRes.connected) {
          setQrCode(null);
          setMessage({ type: 'success', text: 'WhatsApp is already connected!' });
          await checkStatus(targetSession);
          qrFound = true;
          break;
        }

        setMessage({
          type: 'info',
          text: `Starting WhatsApp engine... Waiting for QR (${attempts}/8)...`,
        });
        // Wait 1.5 seconds before polling again
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      if (!qrFound) {
        setMessage({
          type: 'info',
          text: 'Session initialization took a moment. Click "Generate QR" to load the code.',
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Could not fetch QR code: ' + err.message });
    } finally {
      setIsGeneratingQR(false);
    }
  };

  // Step 2: Generate QR
  const handleGenerateQR = async () => {
    const trimmed = sessionName.trim();
    if (!trimmed) return;
    await fetchQRWithRetry(trimmed);
  };

  // Logout / Disconnect
  const handleLogout = async () => {
    if (!confirm(`Are you sure you want to disconnect session "${sessionName}"?`)) return;
    setIsLoading(true);
    try {
      await logoutWhatsAppSession(sessionName);
      setQrCode(null);
      setMessage({ type: 'info', text: 'Session unlinked/disconnected.' });
      await checkStatus(sessionName);
    } catch (err: any) {
      alert(`Logout error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const isConnected = session?.connected === true;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">
              WhatsApp Session & QR Connect
            </h2>
            <p className="text-xs text-slate-500">
              Enter session name, click Create Session, then Generate QR to connect your WhatsApp account.
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {isConnected ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Not Connected
            </span>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {message && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : message.type === 'error'
              ? 'bg-rose-50 border border-rose-200 text-rose-800'
              : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}
        >
          {message.type === 'success' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
          {message.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          {message.type === 'info' && <RefreshCw className="w-4 h-4 text-blue-600 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Manual Session Control Box */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
              WhatsApp Session Name
            </label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g. default"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 font-semibold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreateSession}
              disabled={isCreatingSession || isLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
            >
              <PlayCircle className={`w-3.5 h-3.5 ${isCreatingSession ? 'animate-spin' : ''}`} />
              <span>{isCreatingSession ? 'Creating...' : 'Create Session'}</span>
            </button>

            <button
              type="button"
              onClick={handleGenerateQR}
              disabled={isGeneratingQR || isLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
            >
              <QrCode className={`w-3.5 h-3.5 ${isGeneratingQR ? 'animate-spin' : ''}`} />
              <span>{isGeneratingQR ? 'Generating...' : 'Generate QR'}</span>
            </button>

            <button
              type="button"
              onClick={handleLoadSessions}
              disabled={isLoadingSessions}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
              title="Load all existing WhatsApp sessions"
            >
              <Layers className={`w-3.5 h-3.5 ${isLoadingSessions ? 'animate-spin' : ''}`} />
              <span>{isLoadingSessions ? 'Loading...' : 'Load Sessions'}</span>
            </button>
          </div>
        </div>

        {/* Sessions List Panel */}
        {showSessionsList && (
          <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>Existing WAHA Sessions ({sessionsList.length})</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowSessionsList(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-2 py-0.5 rounded bg-slate-100"
              >
                Hide
              </button>
            </div>

            {sessionsList.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">
                No active sessions found in WAHA.
              </p>
            ) : (
              <div className="space-y-2">
                {sessionsList.map((s) => {
                  const isCurrent = s.name === sessionName;
                  const isDeleting = deletingSessionName === s.name;
                  return (
                    <div
                      key={s.name}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border text-xs gap-3 transition-all ${
                        isCurrent
                          ? 'bg-emerald-50/70 border-emerald-300'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            s.status === 'WORKING'
                              ? 'bg-emerald-500 ring-2 ring-emerald-200'
                              : s.status === 'SCAN_QR_CODE'
                              ? 'bg-amber-500 ring-2 ring-amber-200 animate-pulse'
                              : s.status === 'STARTING'
                              ? 'bg-blue-500 animate-pulse'
                              : 'bg-rose-500'
                          }`}
                        />
                        <div>
                          <div className="font-mono font-bold text-slate-900 flex items-center gap-2">
                            <span>{s.name}</span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                                Active / Current
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Status: <span className="font-semibold text-slate-700">{s.status || 'UNKNOWN'}</span>
                            {s.me?.id && ` • Phone: ${s.me.id}`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => handleSelectSession(s.name)}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all"
                          >
                            Switch to This
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteSession(s.name)}
                          disabled={isDeleting}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-semibold text-xs transition-all disabled:opacity-50"
                          title="Delete Session and wipe its data"
                        >
                          <Trash2 className={`w-3.5 h-3.5 ${isDeleting ? 'animate-spin' : ''}`} />
                          <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active Connected State */}
      {isConnected ? (
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs uppercase font-mono font-bold text-emerald-700">
                Active Session: {session?.session}
              </div>
              <div className="text-base font-bold text-slate-900">
                {session?.me?.pushName || 'WhatsApp Connected'}
              </div>
              <div className="text-xs font-mono text-slate-500">
                {session?.me?.id || 'Ready for message routing'}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold shadow-sm transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Disconnect</span>
          </button>
        </div>
      ) : (
        /* QR Code & Scan Instructions */
        qrCode && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center pt-2">
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-md">
                <img
                  src={qrCode}
                  alt="WhatsApp QR Code"
                  className="w-56 h-56 object-contain"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-3 font-mono">
                Point WhatsApp camera to scan
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <span>How to link WhatsApp / எப்படி இணைப்பது:</span>
              </h4>

              <ol className="space-y-2.5 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <div>Open WhatsApp on your phone.</div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    Tap <strong>Settings ⚙</strong> (or <strong>⋮</strong>) &rarr; Select <strong>Linked Devices</strong>.
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    Tap <strong>Link a Device</strong> and scan this QR code.
                  </div>
                </li>
              </ol>

              <button
                type="button"
                onClick={handleGenerateQR}
                disabled={isGeneratingQR}
                className="w-full mt-2 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingQR ? 'animate-spin' : ''}`} />
                <span>Refresh QR Code</span>
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

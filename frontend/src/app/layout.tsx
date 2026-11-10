import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '../components/Sidebar';

export const metadata: Metadata = {
  title: 'WhatsApp Media & Affiliate Marketing Engine',
  description: 'Dual-Source Ingestion, AI Deduplication & Deep Analytics Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-emerald-500/20 selection:text-emerald-900">
        <Sidebar />
        <main className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {children}
        </main>
      </body>
    </html>
  );
}

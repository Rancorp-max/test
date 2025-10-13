'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ReaderInner() {
  const params = useSearchParams();
  const pdf = params.get('pdf') || '';
  const images = (params.get('images') || '').split(',').filter(Boolean);
  const [zoom, setZoom] = React.useState(1);

  return (
    <div className="min-h-screen bg-white">
      <header className="print:hidden sticky top-0 z-40 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/demo" className="text-slate-600 hover:text-slate-900 text-sm">← Back to editor</a>
            <div className="text-slate-400 text-xs">Reader</div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button onClick={() => window.print()} className="px-3 py-2 rounded-lg border hover:bg-slate-50">Print</button>
            {pdf && <a href={pdf} target="_blank" className="px-3 py-2 rounded-lg border hover:bg-slate-50">Download PDF</a>}
            <div className="hidden md:flex items-center gap-2 ml-2">
              <button onClick={() => setZoom(z => Math.max(0.6, z - 0.1))} className="px-2 py-1 border rounded">-</button>
              <span className="text-xs text-slate-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="px-2 py-1 border rounded">+</button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {pdf ? (
          <div className="border rounded-xl overflow-hidden shadow-sm">
            <iframe
              src={pdf + '#toolbar=0&navpanes=0'}
              style={{ width: '100%', height: '80vh', transform: `scale(${zoom})`, transformOrigin: 'top left' }}
            />
          </div>
        ) : images.length ? (
          <div className="space-y-6">
            {images.map((src, i) => (
              <img key={i} src={src} alt={`page ${i + 1}`} className="w-full border rounded-xl shadow-sm" />
            ))}
          </div>
        ) : (
          <div className="text-center text-slate-500">
            No content. Open this page with <code>?pdf=</code> or <code>?images=</code>.
          </div>
        )}
      </main>

      <style jsx global>{`
        @media print {
          @page { size: auto; margin: 12mm; }
          header, .print\\:hidden { display: none !important; }
          body { background: white !important; }
          iframe { height: 100vh !important; }
        }
      `}</style>
    </div>
  );
}

export default function ReaderPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500">Loading reader…</div>}>
      <ReaderInner />
    </Suspense>
  );
}

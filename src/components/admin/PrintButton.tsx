'use client';

export default function PrintButton({ label = 'Çap et' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 print:hidden"
    >
      {label}
    </button>
  );
}

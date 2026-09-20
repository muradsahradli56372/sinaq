'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  function clearSavedExam() {
    try {
      localStorage.removeItem('elmira-exam-v1');
      localStorage.removeItem('elmira-exam-questions-v1');
    } catch {
      /* ignore */
    }
    window.location.href = '/exam';
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-blue-50 via-white to-emerald-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-blue-100 bg-white p-6 text-center shadow-xl shadow-blue-900/5 sm:p-8">
        <h1 className="text-2xl font-extrabold text-slate-900">Xəta baş verdi</h1>
        <p className="mt-3 text-base text-slate-600">
          Səhifə düzgün yüklənmədi. Yenidən cəhd edin.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="min-h-14 rounded-2xl bg-blue-600 px-6 text-lg font-bold text-white hover:bg-blue-700"
          >
            Yenidən cəhd et
          </button>
          <Link
            href="/"
            className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-slate-200 px-6 text-lg font-bold text-slate-800 hover:bg-slate-50"
          >
            Ana səhifə
          </Link>
          <button
            type="button"
            onClick={clearSavedExam}
            className="mx-auto mt-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 underline underline-offset-2 hover:text-slate-800"
          >
            Saxlanmış sınaq məlumatını sil və yenidən başla
          </button>
        </div>
      </div>
    </main>
  );
}

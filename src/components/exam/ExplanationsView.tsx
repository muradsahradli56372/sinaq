'use client';

import { useEffect, useState } from 'react';
import type { createClient } from '@/lib/supabase/client';
import { OPTION_KEYS } from '@/lib/types';

interface Row {
  question_id: number;
  position: number;
  text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  selected_option: string | null;
  correct_option: string;
  explanation: string | null;
}

/** Shown to a student only when the teacher enabled explanations (checked again in the database). */
export default function ExplanationsView({
  supabase,
  studentId,
}: {
  supabase: ReturnType<typeof createClient>;
  studentId: string;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('get_explanations', { p_student_id: studentId });
      if (cancelled) return;
      if (error) setError(true);
      else setRows((data ?? []) as Row[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, studentId]);

  if (error) {
    return <p role="alert" className="mt-6 text-center font-semibold text-red-700">İzahlar yüklənmədi.</p>;
  }
  if (!rows) return <p role="status" className="mt-6 text-center text-slate-600">Yüklənir…</p>;
  if (rows.length === 0) {
    return <p className="mt-6 text-center text-slate-600">İzahlar hazırda əlçatan deyil.</p>;
  }

  return (
    <section aria-label="Sualların izahları" className="mt-6 space-y-4">
      {rows.map((r) => {
        const ok = r.selected_option === r.correct_option;
        const opt = (k: string) => r[`option_${k.toLowerCase()}` as keyof Row] as string;
        return (
          <article
            key={r.question_id}
            className={`rounded-3xl border-2 bg-white p-5 shadow-sm ${
              ok ? 'border-emerald-200' : 'border-red-200'
            }`}
          >
            <h3 className="text-sm font-bold text-blue-700">
              Sual {r.position} · {ok ? 'Düzgün' : r.selected_option ? 'Səhv' : 'Cavabsız'}
            </h3>
            <p className="mt-1 whitespace-pre-line text-lg font-semibold text-slate-900">{r.text}</p>
            <ul className="mt-3 space-y-1.5">
              {OPTION_KEYS.map((k) => (
                <li
                  key={k}
                  className={`rounded-xl px-3 py-2 text-base ${
                    k === r.correct_option
                      ? 'bg-emerald-50 font-semibold text-emerald-900'
                      : k === r.selected_option
                        ? 'bg-red-50 text-red-900'
                        : 'text-slate-700'
                  }`}
                >
                  <span className="mr-2 font-bold">{k}.</span>
                  {opt(k)}
                  {k === r.correct_option && <span className="sr-only"> (düzgün cavab)</span>}
                  {k === r.selected_option && k !== r.correct_option && (
                    <span className="sr-only"> (sizin cavabınız)</span>
                  )}
                </li>
              ))}
            </ul>
            {r.explanation && (
              <p className="mt-3 rounded-xl bg-blue-50 px-4 py-3 text-base leading-relaxed text-slate-800">
                <strong>İzah: </strong>
                {r.explanation}
              </p>
            )}
          </article>
        );
      })}
    </section>
  );
}

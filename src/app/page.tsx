import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { EXAM_MINUTES } from '@/lib/types';

// Always read the current number of questions (no caching), so it changes as soon as the questions do.
export const dynamic = 'force-dynamic';

interface ExamSummary {
  question_count: number;
  duration_minutes: number;
}

async function getExamSummaries(): Promise<ExamSummary[] | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const result = await Promise.race([
      supabase.rpc('get_exams'),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
    if (!result || result.error || !result.data) return null;
    return result.data as ExamSummary[];
  } catch {
    return null; // never break the home page because of this
  }
}

const conversions = [
  { base: 'Onluq', value: '25', sub: '10' },
  { base: 'İkilik', value: '11001', sub: '2' },
  { base: 'Səkkizlik', value: '31', sub: '8' },
  { base: 'Onaltılıq', value: '19', sub: '16' },
];

export default async function HomePage() {
  const exams = await getExamSummaries();
  // One exam: show its size. Several exams: students pick one on the next screen.
  const facts: { value: string; label: string }[] = [];
  if (exams && exams.length === 1) {
    facts.push({ value: String(exams[0].question_count), label: 'sual' });
    facts.push({ value: String(exams[0].duration_minutes), label: 'dəqiqə vaxt limiti' });
  } else if (exams && exams.length > 1) {
    facts.push({ value: String(exams.length), label: 'sınaq mövcuddur' });
  } else {
    facts.push({ value: `${EXAM_MINUTES}`, label: 'dəqiqə vaxt limiti' });
  }
  facts.push({ value: 'A–E', label: 'çoxseçimli test' });

  return (
    <main className="min-h-dvh bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Elmira Fətəliyeva</span>
          <Link
            href="/admin/login"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-blue-700"
          >
            Müəllim girişi
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div>
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Rəqəm Sistemləri üzrə Onlayn Sınaq
            </h1>
            <p className="mt-5 text-xl font-semibold text-blue-700 sm:text-2xl">
              Müəllimə Elmira Fətəliyeva
            </p>

            <blockquote className="mt-8 max-w-xl border-l-4 border-emerald-500 pl-5 text-lg leading-relaxed text-slate-700">
              Sən bacarırsan! Hər sual biliyini bir addım irəli aparır. Uğurlar!
            </blockquote>

            <div className="mt-9">
              <Link
                href="/exam"
                className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-blue-600 px-9 py-4 text-lg font-bold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-700 focus-visible:outline-offset-4"
              >
                Sınağa Başla
              </Link>
            </div>

            <dl className="mt-10 flex flex-wrap gap-3">
              {facts.map((f) => (
                <div
                  key={f.label}
                  className="flex items-baseline gap-2 rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-sm"
                >
                  <dt className="sr-only">{f.label}</dt>
                  <dd className="text-xl font-extrabold text-blue-700">{f.value}</dd>
                  <dd className="text-sm font-medium text-slate-600" aria-hidden="true">
                    {f.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <aside
            aria-label="Eyni ədədin müxtəlif say sistemlərində yazılışı"
            className="rounded-3xl border border-blue-100 bg-white p-6 shadow-xl shadow-blue-900/10 sm:p-8"
          >
            <p className="text-sm font-medium text-slate-600">Eyni ədəd, dörd yazılış</p>
            <ul className="mt-4 divide-y divide-slate-100">
              {conversions.map((c, i) => (
                <li key={c.base} className="flex items-baseline justify-between gap-4 py-4">
                  <span className="text-base font-medium text-slate-600">{c.base}</span>
                  <span
                    className={`tabular-nums tracking-tight ${
                      i === 0
                        ? 'text-5xl font-extrabold text-slate-900'
                        : 'text-3xl font-bold text-blue-700'
                    }`}
                  >
                    {c.value}
                    <sub className="ml-0.5 text-base font-semibold text-emerald-600">{c.sub}</sub>
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        </section>

        <footer className="pb-2 text-center text-sm text-slate-500">
          Nəticələr birbaşa müəllimə göndərilir.
        </footer>
      </div>
    </main>
  );
}

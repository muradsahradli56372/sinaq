'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';
import {
  formatClock,
  formatDate,
  formatDuration,
  scoreOf,
  type QuestionStat,
  type StudentResult,
} from '@/lib/types';

type SortKey = 'date_desc' | 'date_asc' | 'score_desc' | 'score_asc' | 'name';

const PAGE_SIZE = 50;
const BLUE = '#2563EB';
const EMERALD = '#10B981';
const RED = '#E11D48';

function pct(correct: number, attempts: number) {
  return attempts ? Math.round((correct * 100) / attempts) : 0;
}

function scoreBadge(score: number | null) {
  if (score === null) return 'bg-slate-100 text-slate-600';
  if (score >= 80) return 'bg-emerald-100 text-emerald-800';
  if (score >= 50) return 'bg-blue-100 text-blue-800';
  return 'bg-red-100 text-red-800';
}

export default function Dashboard({
  results,
  stats,
  showExplanations,
}: {
  results: StudentResult[];
  stats: QuestionStat[];
  showExplanations: boolean;
}) {
  const [query, setQuery] = useState('');
  const [cls, setCls] = useState('');
  const [sort, setSort] = useState<SortKey>('date_desc');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [explOn, setExplOn] = useState(showExplanations);
  const [explBusy, setExplBusy] = useState(false);
  const [explError, setExplError] = useState<string | null>(null);
  const [pdfHint, setPdfHint] = useState(false);

  /* ---------- summary numbers ---------- */
  const summary = useMemo(() => {
    const finished = results.filter((r) => r.submitted_at);
    const scores = finished.map((r) => scoreOf(r) ?? 0);
    const durations = finished
      .map((r) => r.duration_seconds)
      .filter((d): d is number => d !== null);
    const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    return {
      total: results.length,
      finished: finished.length,
      avgScore: mean(scores),
      avgTime: mean(durations),
      scores,
    };
  }, [results]);

  const distribution = useMemo(() => {
    const bins = Array.from({ length: 10 }, (_, i) => ({
      name: `${i * 10}–${i * 10 + 10}`,
      count: 0,
    }));
    summary.scores.forEach((s) => {
      bins[Math.min(9, Math.floor(s / 10))].count += 1;
    });
    return bins;
  }, [summary.scores]);

  const perQuestion = useMemo(
    () =>
      stats.map((s) => ({
        name: String(s.position),
        pct: pct(s.correct, s.attempts),
        text: s.text,
        attempts: s.attempts,
      })),
    [stats],
  );

  const hardest = useMemo(
    () =>
      [...perQuestion]
        .filter((q) => q.attempts > 0)
        .sort((a, b) => a.pct - b.pct)
        .slice(0, 5)
        .map((q) => ({ ...q, label: `S${q.name}` })),
    [perQuestion],
  );

  /* ---------- table ---------- */
  const classes = useMemo(
    () => Array.from(new Set(results.map((r) => r.class))).sort((a, b) => a.localeCompare(b, 'az', { numeric: true })),
    [results],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('az');
    const rows = results.filter(
      (r) => (!cls || r.class === cls) && (!q || r.full_name.toLocaleLowerCase('az').includes(q)),
    );
    const byScore = (dir: 1 | -1) => (a: StudentResult, b: StudentResult) => {
      const sa = scoreOf(a);
      const sb = scoreOf(b);
      if (sa === null && sb === null) return 0;
      if (sa === null) return 1; // unfinished always last
      if (sb === null) return -1;
      return (sa - sb) * dir;
    };
    const time = (r: StudentResult) => new Date(r.started_at).getTime();
    switch (sort) {
      case 'score_desc':
        return rows.sort(byScore(-1));
      case 'score_asc':
        return rows.sort(byScore(1));
      case 'date_asc':
        return rows.sort((a, b) => time(a) - time(b));
      case 'name':
        return rows.sort((a, b) => a.full_name.localeCompare(b.full_name, 'az'));
      default:
        return rows.sort((a, b) => time(b) - time(a));
    }
  }, [results, query, cls, sort]);

  /* ---------- actions ---------- */
  async function exportExcel() {
    const XLSX = await import('xlsx');
    const rows = filtered.map((r) => ({
      'Ad Soyad': r.full_name,
      Sinif: r.class,
      Məktəb: r.school ?? '',
      Bal: scoreOf(r) ?? '',
      Düzgün: r.submitted_at ? r.correct_count : '',
      Səhv: r.submitted_at ? r.wrong_count : '',
      Boş: r.submitted_at ? r.blank_count : '',
      Vaxt: r.submitted_at ? formatClock(r.duration_seconds ?? 0) : '',
      Tarix: formatDate(r.started_at),
      Status: r.submitted_at ? 'Bitirib' : 'Bitirməyib',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [30, 8, 24, 8, 8, 8, 8, 8, 18, 12].map((wch) => ({ wch }));

    const qs = stats.map((s) => ({
      'Sual №': s.position,
      Sual: s.text,
      'Cavab verənlər': s.attempts,
      Düzgün: s.correct,
      'Düzgün %': pct(s.correct, s.attempts),
    }));
    const ws2 = XLSX.utils.json_to_sheet(qs);
    ws2['!cols'] = [8, 60, 14, 10, 10].map((wch) => ({ wch }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nəticələr');
    XLSX.utils.book_append_sheet(wb, ws2, 'Suallar');
    XLSX.writeFile(wb, `sinaq-neticeleri-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportPdf() {
    // The browser's print dialog can "Save as PDF" – this keeps Azerbaijani letters (ə, ı, ş…) intact.
    setPdfHint(true);
    const previous = document.title;
    document.title = `Sinaq-neticeleri-${new Date().toISOString().slice(0, 10)}`;
    const restore = () => {
      document.title = previous;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
  }

  async function toggleExplanations() {
    setExplBusy(true);
    setExplError(null);
    const next = !explOn;
    const { error } = await createClient()
      .from('settings')
      .upsert({ key: 'show_explanations', value: next });
    if (error) setExplError('Dəyişiklik yadda saxlanmadı. Yenidən cəhd edin.');
    else setExplOn(next);
    setExplBusy(false);
  }

  const btn =
    'min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50';
  const control =
    'min-h-11 rounded-xl border-2 border-slate-200 bg-white px-3 text-base text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/20';

  return (
    <div className="space-y-6">
      {/* Print-only heading */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-extrabold">Rəqəm Sistemləri Onlayn Sınaq — Nəticələr</h1>
        <p className="text-sm text-slate-600">Müəllimə Elmira Fətəliyeva · {formatDate(new Date().toISOString())}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Nəticələr</h1>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={exportExcel} className={btn}>
            Excel (.xlsx)
          </button>
          <button type="button" onClick={exportPdf} className={btn}>
            PDF
          </button>
          <button type="button" onClick={() => window.print()} className={btn}>
            Çap et
          </button>
        </div>
      </div>

      {pdfHint && (
        <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900 print:hidden">
          PDF üçün açılan pəncərədə çap cihazı kimi <strong>“PDF kimi saxla”</strong> seçin.
        </p>
      )}

      {/* Stat cards */}
      <section aria-label="Ümumi statistika" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Ümumi iştirakçı sayı" value={String(summary.total)} />
        <StatCard label="Bitirənlər" value={String(summary.finished)} accent="emerald" />
        <StatCard
          label="Orta bal"
          value={summary.avgScore === null ? '—' : summary.avgScore.toFixed(1)}
          hint="100 üzərindən"
        />
        <StatCard
          label="Orta vaxt"
          value={summary.avgTime === null ? '—' : formatClock(summary.avgTime)}
          hint="dəqiqə : saniyə"
        />
      </section>

      {/* Explanations switch */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white p-4 print:hidden">
        <div>
          <h2 className="text-base font-bold text-slate-900">Şagirdlərə izahları göstər</h2>
          <p className="text-sm text-slate-600">
            Açıq olarsa, şagird sınağı göndərdikdən sonra düzgün cavabları və izahları görə bilər.
          </p>
          {explError && (
            <p role="alert" className="mt-1 text-sm font-semibold text-red-700">
              {explError}
            </p>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={explOn}
          aria-label="Şagirdlərə izahları göstər"
          disabled={explBusy}
          onClick={toggleExplanations}
          className={`relative h-9 w-16 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
            explOn ? 'bg-emerald-500' : 'bg-slate-300'
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-all ${
              explOn ? 'left-8' : 'left-1'
            }`}
          />
        </button>
      </section>

      {/* Charts */}
      {summary.finished > 0 && (
        <section aria-label="Diaqramlar" className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Balların paylanması" subtitle="Bal aralığına görə şagird sayı">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [`${v}`, 'Şagird sayı']} labelFormatter={(l) => `${l} bal`} />
                <Bar dataKey="count" fill={BLUE} radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Ən çətin suallar" subtitle="Düzgün cavab faizi ən aşağı olan 5 sual">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hardest} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="label" width={40} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [`${v}%`, 'Düzgün cavab']} />
                <Bar dataKey="pct" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                  {hardest.map((h) => (
                    <Cell key={h.name} fill={RED} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="lg:col-span-2">
            <ChartCard title="Hər sual üzrə düzgün cavab faizi" subtitle="Sual nömrəsinə görə">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perQuestion} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(v) => [`${v}%`, 'Düzgün cavab']}
                    labelFormatter={(l) => `Sual ${l}`}
                  />
                  <Bar dataKey="pct" fill={EMERALD} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {hardest.length > 0 && (
            <div className="rounded-3xl border border-slate-200 bg-white p-5 lg:col-span-2">
              <h2 className="text-base font-bold text-slate-900">Ən çətin sualların mətni</h2>
              <ol className="mt-3 space-y-2 text-sm text-slate-700">
                {hardest.map((h) => (
                  <li key={h.name} className="flex gap-3">
                    <span className="w-10 shrink-0 font-bold text-red-700">{h.pct}%</span>
                    <span>
                      <strong>Sual {h.name}.</strong> {h.text}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}

      {/* Results table */}
      <section aria-label="Şagird nəticələri" className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-3 print:hidden">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="search" className="text-sm font-bold text-slate-700">Ada görə axtar</label>
            <input
              id="search"
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE_SIZE);
              }}
              placeholder="Ad və ya soyad"
              className={`${control} mt-1 w-full`}
            />
          </div>
          <div>
            <label htmlFor="cls" className="text-sm font-bold text-slate-700">Sinif</label>
            <select
              id="cls"
              value={cls}
              onChange={(e) => {
                setCls(e.target.value);
                setLimit(PAGE_SIZE);
              }}
              className={`${control} mt-1 block`}
            >
              <option value="">Hamısı</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sort" className="text-sm font-bold text-slate-700">Sırala</label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className={`${control} mt-1 block`}
            >
              <option value="date_desc">Tarix: ən yeni</option>
              <option value="date_asc">Tarix: ən köhnə</option>
              <option value="score_desc">Bal: yüksəkdən aşağıya</option>
              <option value="score_asc">Bal: aşağıdan yuxarıya</option>
              <option value="name">Ad (əlifba ilə)</option>
            </select>
          </div>
        </div>

        <p className="mt-3 text-sm text-slate-600" role="status">
          {filtered.length} nəticə
        </p>

        <div className="mt-2 overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm print:min-w-0">
            <caption className="sr-only">Şagirdlərin sınaq nəticələri</caption>
            <thead>
              <tr className="border-b-2 border-slate-200 text-slate-600">
                {['Ad Soyad', 'Sinif', 'Məktəb', 'Bal', 'Düzgün', 'Səhv', 'Boş', 'Vaxt', 'Tarix'].map((h) => (
                  <th key={h} scope="col" className="px-3 py-3 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const score = scoreOf(r);
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-slate-100 hover:bg-blue-50/40 ${
                      i >= limit ? 'hidden print:table-row' : ''
                    }`}
                  >
                    <td className="px-3 py-3 font-semibold text-slate-900">
                      <Link
                        href={`/admin/students/${r.id}`}
                        className="rounded text-blue-700 underline-offset-2 hover:underline print:text-slate-900 print:no-underline"
                      >
                        {r.full_name}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{r.class}</td>
                    <td className="px-3 py-3 text-slate-600">{r.school ?? '—'}</td>
                    <td className="px-3 py-3">
                      {score === null ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                          Bitirməyib
                        </span>
                      ) : (
                        <span className={`rounded-full px-2.5 py-1 text-sm font-extrabold ${scoreBadge(score)}`}>
                          {score}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 tabular-nums">{r.submitted_at ? r.correct_count : '—'}</td>
                    <td className="px-3 py-3 tabular-nums">{r.submitted_at ? r.wrong_count : '—'}</td>
                    <td className="px-3 py-3 tabular-nums">{r.submitted_at ? r.blank_count : '—'}</td>
                    <td className="px-3 py-3 tabular-nums">{formatDuration(r.duration_seconds)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDate(r.started_at)}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-slate-600">
                    {results.length === 0
                      ? 'Hələ heç kim sınağa başlamayıb. Şagirdlər sınağı bitirdikcə nəticələr burada görünəcək.'
                      : 'Axtarışa uyğun nəticə tapılmadı.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > limit && (
          <div className="mt-4 text-center print:hidden">
            <button type="button" onClick={() => setLimit((l) => l + PAGE_SIZE)} className={btn}>
              Daha çox göstər ({filtered.length - limit})
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: 'emerald';
}) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p
        className={`mt-1 text-4xl font-extrabold tabular-nums ${
          accent === 'emerald' ? 'text-emerald-600' : 'text-blue-700'
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 break-inside-avoid">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-600">{subtitle}</p>
      <div className="mt-4 h-64 w-full">{children}</div>
    </div>
  );
}

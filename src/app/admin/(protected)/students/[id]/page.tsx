import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  OPTION_KEYS,
  formatDate,
  formatDuration,
  scoreOf,
  type OptionKey,
  type StudentResult,
} from '@/lib/types';
import PrintButton from '@/components/admin/PrintButton';

export const metadata: Metadata = { title: 'Şagird hesabatı' };
export const dynamic = 'force-dynamic';

interface QuestionRow {
  position: number;
  text: string;
  image_url: string | null;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  correct_option: OptionKey;
  explanation: string | null;
}

interface AnswerRow {
  question_id: number;
  selected_option: OptionKey | null;
  is_correct: boolean;
  questions: QuestionRow | QuestionRow[] | null;
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: studentData, error } = await supabase
    .from('student_results')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !studentData) notFound();
  const student = studentData as StudentResult;

  const { data: answerData } = await supabase
    .from('answers')
    .select(
      'question_id, selected_option, is_correct, questions(position, text, image_url, option_a, option_b, option_c, option_d, option_e, correct_option, explanation)',
    )
    .eq('student_id', id);

  const rows = ((answerData ?? []) as unknown as AnswerRow[])
    .map((a) => ({ ...a, q: Array.isArray(a.questions) ? a.questions[0] : a.questions }))
    .filter((a): a is typeof a & { q: QuestionRow } => !!a.q)
    .sort((a, b) => a.q.position - b.q.position);

  const score = scoreOf(student);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/admin"
          className="rounded-lg px-2 py-1 text-sm font-bold text-blue-700 hover:bg-blue-50"
        >
          ← Bütün nəticələr
        </Link>
        <PrintButton label="Çap et / PDF" />
      </div>

      <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm sm:p-7">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{student.full_name}</h1>
        <p className="mt-1 text-base text-slate-600">
          {student.class} sinif{student.school ? ` · ${student.school}` : ''}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Bal" value={score === null ? '—' : String(score)} strong />
          <Metric label="Düzgün" value={student.submitted_at ? String(student.correct_count) : '—'} />
          <Metric label="Səhv" value={student.submitted_at ? String(student.wrong_count) : '—'} />
          <Metric label="Boş" value={student.submitted_at ? String(student.blank_count) : '—'} />
          <Metric label="Vaxt" value={formatDuration(student.duration_seconds)} />
          <Metric label="Tarix" value={formatDate(student.started_at)} small />
        </dl>
      </section>

      {!student.submitted_at && (
        <p className="rounded-2xl bg-amber-50 px-5 py-4 font-semibold text-amber-900">
          Bu şagird sınağı hələ göndərməyib. Cavablar göndərildikdən sonra burada görünəcək.
        </p>
      )}

      <div className="space-y-4">
        {rows.map(({ question_id, selected_option, is_correct, q }) => {
          const status = is_correct ? 'Düzgün' : selected_option ? 'Səhv' : 'Cavabsız';
          const opt = (k: OptionKey) => q[`option_${k.toLowerCase()}` as keyof QuestionRow] as string;
          return (
            <article
              key={question_id}
              className={`break-inside-avoid rounded-3xl border-2 bg-white p-5 ${
                is_correct ? 'border-emerald-200' : 'border-red-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-blue-700">Sual {q.position}</h2>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-extrabold ${
                    is_correct
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {is_correct ? '✓' : '✗'} {status}
                </span>
              </div>

              <p className="mt-2 whitespace-pre-line text-lg font-semibold text-slate-900">{q.text}</p>

              {q.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={q.image_url}
                  alt={`Sual ${q.position} üçün şəkil`}
                  className="mt-3 max-h-64 rounded-xl border border-slate-200 object-contain"
                />
              )}

              <ul className="mt-3 space-y-1.5">
                {OPTION_KEYS.map((k) => {
                  const isCorrect = k === q.correct_option;
                  const isChosen = k === selected_option;
                  return (
                    <li
                      key={k}
                      className={`rounded-xl px-3 py-2 text-base ${
                        isCorrect
                          ? 'bg-emerald-50 font-semibold text-emerald-900'
                          : isChosen
                            ? 'bg-red-50 text-red-900'
                            : 'text-slate-700'
                      }`}
                    >
                      <span className="mr-2 font-bold">{k}.</span>
                      {opt(k)}
                      {isCorrect && <span className="ml-2 text-sm font-bold">← Düzgün cavab</span>}
                      {isChosen && !isCorrect && (
                        <span className="ml-2 text-sm font-bold">← Şagirdin cavabı</span>
                      )}
                    </li>
                  );
                })}
              </ul>

              <p className="mt-3 text-sm text-slate-600">
                Şagirdin cavabı: <strong>{selected_option ?? 'cavab verilməyib'}</strong> · Düzgün cavab:{' '}
                <strong>{q.correct_option}</strong>
              </p>

              {q.explanation && (
                <p className="mt-3 rounded-xl bg-blue-50 px-4 py-3 text-base leading-relaxed text-slate-800">
                  <strong>İzah: </strong>
                  {q.explanation}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  strong,
  small,
}: {
  label: string;
  value: string;
  strong?: boolean;
  small?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <dt className="text-xs font-semibold text-slate-600">{label}</dt>
      <dd
        className={`mt-0.5 font-extrabold tabular-nums ${
          strong ? 'text-3xl text-blue-700' : small ? 'text-sm text-slate-900' : 'text-2xl text-slate-900'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

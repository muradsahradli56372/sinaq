import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import type { QuestionStat, StudentResult } from '@/lib/types';
import Dashboard, { type ExamOption } from '@/components/admin/Dashboard';

type ResultRow = StudentResult & { exam_id: number };
type StatRow = QuestionStat & { exam_id: number };

export const metadata: Metadata = { title: 'Nəticələr – Müəllim paneli' };
export const dynamic = 'force-dynamic';

const PAGE = 1000; // Supabase returns at most 1000 rows per request

export default async function AdminPage() {
  const supabase = await createClient();

  const results: ResultRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('student_results')
      .select('*')
      .order('started_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    results.push(...((data ?? []) as ResultRow[]));
    if (!data || data.length < PAGE) break;
  }

  const { data: stats, error: statsError } = await supabase
    .from('question_stats')
    .select('*')
    .order('position');
  if (statsError) throw new Error(statsError.message);

  const { data: examRows, error: examError } = await supabase
    .from('exams')
    .select('id, slug, title')
    .order('sort_order')
    .order('id');
  if (examError) throw new Error(examError.message);
  const exams = (examRows ?? []) as ExamOption[];

  // Open on the exam that had the latest activity (results are newest first).
  const defaultExamId = results[0]?.exam_id ?? exams[0]?.id ?? null;

  const { data: setting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'show_explanations')
    .maybeSingle();

  return (
    <Dashboard
      results={results}
      stats={(stats ?? []) as StatRow[]}
      exams={exams}
      defaultExamId={defaultExamId}
      showExplanations={setting?.value === true}
    />
  );
}

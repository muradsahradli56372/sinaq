import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import type { QuestionStat, StudentResult } from '@/lib/types';
import Dashboard from '@/components/admin/Dashboard';

export const metadata: Metadata = { title: 'Nəticələr – Müəllim paneli' };
export const dynamic = 'force-dynamic';

const PAGE = 1000; // Supabase returns at most 1000 rows per request

export default async function AdminPage() {
  const supabase = await createClient();

  const results: StudentResult[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('student_results')
      .select('*')
      .order('started_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    results.push(...((data ?? []) as StudentResult[]));
    if (!data || data.length < PAGE) break;
  }

  const { data: stats, error: statsError } = await supabase
    .from('question_stats')
    .select('*')
    .order('position');
  if (statsError) throw new Error(statsError.message);

  const { data: setting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'show_explanations')
    .maybeSingle();

  return (
    <Dashboard
      results={results}
      stats={(stats ?? []) as QuestionStat[]}
      showExplanations={setting?.value === true}
    />
  );
}

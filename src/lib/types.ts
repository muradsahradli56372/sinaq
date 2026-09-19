export type OptionKey = 'A' | 'B' | 'C' | 'D' | 'E';
export const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D', 'E'];

/** Exam length. Keep in sync with submit_exam() in supabase/schema.sql (1800 s). */
export const EXAM_MINUTES = 30;
export const EXAM_SECONDS = EXAM_MINUTES * 60;

export interface PublicQuestion {
  id: number;
  position: number;
  text: string;
  image_url: string | null;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
}

export interface StudentResult {
  id: string;
  full_name: string;
  class: string;
  school: string | null;
  started_at: string;
  submitted_at: string | null;
  duration_seconds: number | null;
  correct_count: number;
  wrong_count: number;
  blank_count: number;
  total_questions: number;
}

export interface QuestionStat {
  id: number;
  position: number;
  text: string;
  attempts: number;
  correct: number;
}

export function optionText(q: PublicQuestion, key: OptionKey): string {
  return q[`option_${key.toLowerCase()}` as keyof PublicQuestion] as string;
}

/** Score on a 0–100 scale. Null while the student has not submitted. */
export function scoreOf(r: StudentResult): number | null {
  if (!r.submitted_at || !r.total_questions) return null;
  return Math.round((r.correct_count * 100) / r.total_questions);
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds === null || totalSeconds === undefined) return '—';
  return `${formatClock(totalSeconds)} dəq`;
}

/** Fixed time zone so server and browser render the same text. */
export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('az', {
    timeZone: 'Asia/Baku',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

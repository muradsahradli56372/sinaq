'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  EXAM_SECONDS,
  OPTION_KEYS,
  formatClock,
  optionText,
  type OptionKey,
  type PublicQuestion,
} from '@/lib/types';
import ExplanationsView from './ExplanationsView';

const STORAGE_KEY = 'elmira-exam-v1';
const EXAMS_KEY = 'elmira-exams-v2';
const questionsKey = (examId: number) => `elmira-exam-questions-v2-${examId}`;

type Phase = 'loading' | 'choose' | 'intro' | 'exam' | 'done' | 'error';

interface ExamInfo {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  question_count: number;
}

type Client = ReturnType<typeof createClient>;

interface Session {
  /** Which exam this attempt belongs to (missing in attempts saved by the older version). */
  examId?: number;
  studentId: string;
  fullName: string;
  className: string;
  /** Local timestamp (ms) of the moment the exam started. Survives refresh. */
  startedAt: number;
  answers: Record<string, OptionKey>;
  current: number;
  submitted: boolean;
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/** A saved session is only reused if it still matches the current questions. */
function isSessionValid(s: Session, qs: PublicQuestion[]): boolean {
  if (!s || typeof s.studentId !== 'string' || typeof s.startedAt !== 'number') return false;
  if (typeof s.current !== 'number' || s.current < 0 || s.current >= qs.length) return false;
  if (!s.answers || typeof s.answers !== 'object') return false;
  const ids = new Set(qs.map((q) => String(q.id)));
  return Object.keys(s.answers).every((k) => ids.has(k));
}

function writeSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage full or blocked – the exam still works in memory */
  }
}

/** Active exams. Falls back to the copy saved on this device when offline. */
async function fetchExams(supabase: Client): Promise<ExamInfo[] | null> {
  try {
    const { data, error } = await supabase.rpc('get_exams');
    if (!error && data) {
      const list = data as ExamInfo[];
      try {
        localStorage.setItem(EXAMS_KEY, JSON.stringify(list));
      } catch {
        /* ignore */
      }
      return list;
    }
  } catch {
    /* offline – use the saved copy below */
  }
  try {
    const raw = localStorage.getItem(EXAMS_KEY);
    if (raw) return JSON.parse(raw) as ExamInfo[];
  } catch {
    /* ignore */
  }
  return null;
}

/** Questions of one exam. Falls back to the copy saved on this device when offline. */
async function fetchQuestions(supabase: Client, examId: number): Promise<PublicQuestion[] | null> {
  try {
    const { data, error } = await supabase.rpc('get_exam_questions', { p_exam_id: examId });
    if (!error && data) {
      const list = data as PublicQuestion[];
      if (list.length) {
        try {
          localStorage.setItem(questionsKey(examId), JSON.stringify(list));
        } catch {
          /* ignore */
        }
      }
      return list;
    }
  } catch {
    /* offline – use the saved copy below */
  }
  try {
    const raw = localStorage.getItem(questionsKey(examId));
    if (raw) return JSON.parse(raw) as PublicQuestion[];
  } catch {
    /* ignore */
  }
  return null;
}

export default function ExamApp() {
  const supabase = useMemo(() => createClient(), []);

  const [phase, setPhase] = useState<Phase>('loading');
  const [exams, setExams] = useState<ExamInfo[]>([]);
  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [remaining, setRemaining] = useState(EXAM_SECONDS);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const examSeconds = (exam?.duration_minutes ?? EXAM_SECONDS / 60) * 60;

  const submittingRef = useRef(false);
  const autoSubmitRef = useRef(false);
  const pendingRef = useRef(false);

  /* ---------- open an exam: load its questions and show the name form ---------- */
  const openExam = useCallback(
    async (ex: ExamInfo) => {
      setLoadError(null);
      setOpeningId(ex.id);
      const qs = await fetchQuestions(supabase, ex.id);
      setOpeningId(null);
      if (!qs || qs.length === 0) {
        setLoadError('Suallar yüklənmədi. İnternet bağlantısını yoxlayıb səhifəni yeniləyin.');
        setPhase('error');
        return;
      }
      setExam(ex);
      setQuestions(qs);
      setPhase('intro');
    },
    [supabase],
  );

  /* ---------- initial load: exams + saved attempt ---------- */
  useEffect(() => {
    let cancelled = false;
    const saved = readSession();

    if (saved?.submitted) {
      setSession(saved);
      setPhase('done');
      return;
    }

    (async () => {
      const list = await fetchExams(supabase);
      if (cancelled) return;

      if (!list) {
        setLoadError('Sınaqlar yüklənmədi. İnternet bağlantısını yoxlayıb səhifəni yeniləyin.');
        setPhase('error');
        return;
      }
      if (list.length === 0) {
        setLoadError('Hazırda aktiv sınaq yoxdur.');
        setPhase('error');
        return;
      }
      setExams(list);

      // continue an unfinished attempt (also after a refresh)
      if (saved) {
        const ex = list.find((e) => e.id === (saved.examId ?? list[0].id));
        if (ex) {
          const qs = await fetchQuestions(supabase, ex.id);
          if (cancelled) return;
          if (!qs) {
            setLoadError('Suallar yüklənmədi. İnternet bağlantısını yoxlayıb səhifəni yeniləyin.');
            setPhase('error');
            return;
          }
          if (qs.length && isSessionValid(saved, qs)) {
            setExam(ex);
            setQuestions(qs);
            setSession({ ...saved, examId: ex.id });
            setPhase('exam');
            return;
          }
        }
        // Old data from a different question set / removed exam: start fresh instead of crashing.
        writeSession(null);
      }

      if (list.length === 1) await openExam(list[0]);
      else setPhase('choose');
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, openExam]);

  /* ---------- autosave answers + position ---------- */
  useEffect(() => {
    if (session && phase === 'exam') writeSession(session);
  }, [session, phase]);

  /* ---------- submit ---------- */
  const submit = useCallback(async () => {
    if (!session || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setShowConfirm(false);

    try {
      const { error } = await supabase.rpc('submit_exam', {
        p_student_id: session.studentId,
        p_answers: session.answers,
      });
      if (error && !error.message.includes('already_submitted')) {
        throw new Error(error.message);
      }
      pendingRef.current = false;
      const done: Session = { ...session, answers: {}, submitted: true };
      writeSession(done);
      setSession(done);
      setPhase('done');
    } catch (e) {
      if (e instanceof Error && e.message.includes('student_not_found')) {
        // The saved attempt no longer exists in the database: go back to the start screen.
        pendingRef.current = false;
        writeSession(null);
        setSession(null);
        setNotice('Bu sınaq sessiyası artıq mövcud deyil. Zəhmət olmasa sınağa yenidən başlayın.');
        setPhase('intro');
        return;
      }
      pendingRef.current = true;
      setSubmitError(
        navigator.onLine
          ? 'Cavablar göndərilə bilmədi. Yenidən cəhd edin — cavablarınız cihazda qorunur.'
          : 'İnternet bağlantısı yoxdur. Bağlantı bərpa olunanda cavablar avtomatik göndəriləcək.',
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [session, supabase]);

  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  /* ---------- online / offline ---------- */
  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => {
      setOnline(true);
      if (pendingRef.current) void submitRef.current();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  /* ---------- countdown (derived from the saved start time) ---------- */
  const startedAt = session?.startedAt;
  useEffect(() => {
    if (phase !== 'exam' || startedAt === undefined) return;
    const tick = () =>
      setRemaining(Math.max(0, examSeconds - Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, startedAt, examSeconds]);

  /* ---------- auto-submit when time is up ---------- */
  useEffect(() => {
    if (phase === 'exam' && remaining === 0 && !autoSubmitRef.current) {
      autoSubmitRef.current = true;
      void submit();
    }
  }, [phase, remaining, submit]);

  /* ---------- answer / navigation helpers ---------- */
  const select = useCallback((qid: number, key: OptionKey) => {
    setSession((s) => (s ? { ...s, answers: { ...s.answers, [qid]: key } } : s));
  }, []);

  const clearAnswer = useCallback((qid: number) => {
    setSession((s) => {
      if (!s) return s;
      const next = { ...s.answers };
      delete next[qid];
      return { ...s, answers: next };
    });
  }, []);

  const go = useCallback(
    (index: number) => {
      setSession((s) =>
        s ? { ...s, current: Math.min(Math.max(index, 0), questions.length - 1) } : s,
      );
      setShowNav(false);
      window.scrollTo({ top: 0 });
    },
    [questions.length],
  );

  /* ---------- keyboard: ← → and A–E / 1–5 ---------- */
  useEffect(() => {
    if (phase !== 'exam' || showConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const cur = session?.current ?? 0;
      const q = questions[cur];
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(cur + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(cur - 1);
      } else if (q) {
        const k = e.key.toUpperCase();
        const idx = '12345'.includes(k) && k.length === 1 ? Number(k) - 1 : OPTION_KEYS.indexOf(k as OptionKey);
        if (idx >= 0 && idx < 5) select(q.id, OPTION_KEYS[idx]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, showConfirm, session?.current, questions, go, select]);

  /* ---------- start ---------- */
  async function handleStart(v: {
    fullName: string;
    className: string;
    school: string;
  }): Promise<string | null> {
    if (!exam) return 'Sınaq seçilməyib. Səhifəni yeniləyin.';
    try {
      const { data, error } = await supabase.rpc('start_exam', {
        p_full_name: v.fullName,
        p_class: v.className,
        p_school: v.school || null,
        p_exam_id: exam.id,
      });
      if (error || !data || data.length === 0) {
        return 'Sınaq başlaya bilmədi. İnternet bağlantısını yoxlayıb yenidən cəhd edin.';
      }
      const row = data[0] as { student_id: string };
      const s: Session = {
        examId: exam.id,
        studentId: row.student_id,
        fullName: v.fullName,
        className: v.className,
        startedAt: Date.now(),
        answers: {},
        current: 0,
        submitted: false,
      };
      writeSession(s);
      autoSubmitRef.current = false;
      pendingRef.current = false;
      setRemaining(examSeconds);
      setSession(s);
      setPhase('exam');
      window.scrollTo({ top: 0 });
      return null;
    } catch {
      return 'Sınaq başlaya bilmədi. İnternet bağlantısını yoxlayıb yenidən cəhd edin.';
    }
  }

  function resetForNewStudent() {
    writeSession(null);
    window.location.reload();
  }

  /* =============================== render =============================== */

  if (phase === 'loading') {
    return (
      <Shell>
        <div className="flex min-h-[60vh] items-center justify-center" role="status">
          <span className="text-lg font-medium text-slate-600">Yüklənir…</span>
        </div>
      </Shell>
    );
  }

  if (phase === 'error') {
    return (
      <Shell>
        <Card className="mx-auto mt-16 max-w-lg text-center">
          <p className="text-lg font-semibold text-slate-900">{loadError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 min-h-12 rounded-xl bg-blue-600 px-6 font-bold text-white hover:bg-blue-700"
          >
            Səhifəni yenilə
          </button>
        </Card>
      </Shell>
    );
  }

  if (phase === 'choose') {
    return (
      <Shell>
        <ChooseExam exams={exams} openingId={openingId} onChoose={(ex) => void openExam(ex)} />
      </Shell>
    );
  }

  if (phase === 'intro') {
    return (
      <Shell>
        <IntroForm
          examTitle={exam?.title}
          total={questions.length}
          minutes={exam?.duration_minutes ?? EXAM_SECONDS / 60}
          notice={notice}
          onBack={
            exams.length > 1
              ? () => {
                  setExam(null);
                  setQuestions([]);
                  setNotice(null);
                  setPhase('choose');
                }
              : undefined
          }
          onStart={handleStart}
        />
      </Shell>
    );
  }

  if (phase === 'done' && session) {
    return (
      <Shell>
        <DoneScreen
          supabase={supabase}
          studentId={session.studentId}
          onNewStudent={resetForNewStudent}
        />
      </Shell>
    );
  }

  if (phase !== 'exam' || !session) return null;

  /* ---------- exam screen ---------- */
  const total = questions.length;
  const q = questions[session.current];
  if (!q) return null;
  const selected = session.answers[q.id];
  const answeredCount = questions.filter((x) => session.answers[x.id]).length;
  const isLast = session.current === total - 1;
  const lowTime = remaining <= 300;
  const announce =
    remaining === 300 ? '5 dəqiqə qalıb' : remaining === 60 ? '1 dəqiqə qalıb' : '';

  return (
    <div className="min-h-dvh bg-gradient-to-br from-blue-50 via-white to-emerald-50 pb-10">
      <header className="sticky top-0 z-20 border-b border-blue-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-3">
              <span className="whitespace-nowrap text-base font-extrabold text-slate-900">
                Sual {session.current + 1}/{total}
              </span>
              <span className="truncate text-sm font-medium text-slate-600">{session.fullName}</span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100"
              role="progressbar"
              aria-label="Cavablandırılmış suallar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={answeredCount}
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width]"
                style={{ width: `${(answeredCount / total) * 100}%` }}
              />
            </div>
          </div>

          <div
            role="timer"
            aria-label="Qalan vaxt"
            className={`rounded-2xl px-4 py-2 text-xl font-extrabold tabular-nums shadow-sm sm:text-2xl ${
              lowTime ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
            }`}
          >
            {formatClock(remaining)}
          </div>
        </div>
        <p className="sr-only" role="status">
          {announce}
        </p>
      </header>

      {!online && (
        <div role="alert" className="bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-900">
          İnternet bağlantısı yoxdur. Cavablarınız cihazda saxlanılır, taymer davam edir.
        </div>
      )}

      <main className="mx-auto mt-5 grid max-w-6xl gap-5 px-4 sm:px-6 lg:grid-cols-[1fr_300px]">
        <section aria-labelledby="question-heading" className="min-w-0">
          <Card>
            <h1 id="question-heading" className="text-sm font-bold text-blue-700">
              Sual {q.position}
            </h1>
            <p className="mt-2 whitespace-pre-line text-xl font-semibold leading-snug text-slate-900 sm:text-2xl">
              {q.text}
            </p>

            {q.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={q.image_url}
                alt={`Sual ${q.position} üçün şəkil`}
                className="mt-5 max-h-96 w-full rounded-2xl border border-slate-200 bg-white object-contain"
              />
            )}

            <div role="radiogroup" aria-labelledby="question-heading" className="mt-6 grid gap-3">
              {OPTION_KEYS.map((key) => {
                const active = selected === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => select(q.id, key)}
                    className={`flex min-h-14 w-full items-start gap-4 rounded-2xl border-2 p-4 text-left transition-colors ${
                      active
                        ? 'border-blue-600 bg-blue-50 shadow-md shadow-blue-600/10'
                        : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-extrabold ${
                        active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {key}
                    </span>
                    <span className="pt-1 text-lg leading-snug text-slate-900">
                      <span className="sr-only">Variant {key}: </span>
                      {optionText(q, key)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 h-8">
              {selected && (
                <button
                  type="button"
                  onClick={() => clearAnswer(q.id)}
                  className="rounded-lg px-2 py-1 text-sm font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
                >
                  Cavabı təmizlə
                </button>
              )}
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => go(session.current - 1)}
                disabled={session.current === 0}
                className="min-h-14 flex-1 rounded-2xl border-2 border-slate-200 bg-white px-5 text-lg font-bold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Əvvəlki
              </button>
              {isLast ? (
                <button
                  type="button"
                  onClick={() => setShowConfirm(true)}
                  className="min-h-14 flex-1 rounded-2xl bg-emerald-600 px-5 text-lg font-bold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700"
                >
                  Bitir və Cavabları Göndər
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => go(session.current + 1)}
                  className="min-h-14 flex-1 rounded-2xl bg-blue-600 px-5 text-lg font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700"
                >
                  Növbəti
                </button>
              )}
            </div>
          </Card>
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="!p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-slate-900">Suallar</h2>
              <span className="text-sm font-medium text-slate-600">
                {answeredCount}/{total} cavablandırılıb
              </span>
              <button
                type="button"
                onClick={() => setShowNav((v) => !v)}
                aria-expanded={showNav}
                aria-controls="question-grid"
                className="rounded-lg px-3 py-1.5 text-sm font-bold text-blue-700 hover:bg-blue-50 lg:hidden"
              >
                {showNav ? 'Bağla' : 'Aç'}
              </button>
            </div>

            <ol
              id="question-grid"
              className={`mt-3 grid-cols-5 gap-2 ${showNav ? 'grid' : 'hidden lg:grid'}`}
            >
              {questions.map((x, i) => {
                const isCurrent = i === session.current;
                const isAnswered = !!session.answers[x.id];
                return (
                  <li key={x.id}>
                    <button
                      type="button"
                      onClick={() => go(i)}
                      aria-current={isCurrent ? 'step' : undefined}
                      aria-label={`Sual ${i + 1}${isAnswered ? ', cavablandırılıb' : ', cavabsız'}`}
                      className={`flex h-12 w-full items-center justify-center rounded-xl text-base font-bold transition-colors ${
                        isCurrent
                          ? 'bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-2'
                          : isAnswered
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                            : 'border border-slate-200 bg-white text-slate-700 hover:border-blue-300'
                      }`}
                    >
                      {i + 1}
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="mt-4 hidden flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate-600 lg:flex">
              <Legend color="bg-blue-600" label="Cari sual" />
              <Legend color="bg-emerald-500" label="Cavablandırılıb" />
            </div>

            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="mt-4 min-h-12 w-full rounded-xl bg-emerald-600 px-4 font-bold text-white hover:bg-emerald-700"
            >
              Bitir və Cavabları Göndər
            </button>
          </Card>
        </aside>
      </main>

      {(submitError || submitting) && (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-4 z-30 mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
        >
          {submitting ? (
            <p className="font-semibold text-slate-800">Cavablar göndərilir…</p>
          ) : (
            <>
              <p className="font-semibold text-red-700">{submitError}</p>
              <button
                type="button"
                onClick={() => void submit()}
                className="mt-3 min-h-11 rounded-xl bg-blue-600 px-5 font-bold text-white hover:bg-blue-700"
              >
                Yenidən göndər
              </button>
            </>
          )}
        </div>
      )}

      {showConfirm && (
        <ConfirmModal
          unanswered={total - answeredCount}
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => void submit()}
        />
      )}
    </div>
  );
}

/* ====================== small presentational pieces ====================== */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gradient-to-br from-blue-50 via-white to-emerald-50 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl">{children}</div>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-3xl border border-blue-100 bg-white p-5 shadow-xl shadow-blue-900/5 sm:p-8 ${className}`}
    >
      {children}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded ${color}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function ChooseExam({
  exams,
  openingId,
  onChoose,
}: {
  exams: ExamInfo[];
  openingId: number | null;
  onChoose: (ex: ExamInfo) => void;
}) {
  return (
    <div className="mx-auto max-w-2xl pt-4">
      <Link href="/" className="inline-block rounded-lg px-2 py-1 text-sm font-medium text-slate-600 hover:text-blue-700">
        ← Ana səhifə
      </Link>

      <Card className="mt-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Sınağı seçin</h1>
        <p className="mt-2 text-base text-slate-600">Həll etmək istədiyiniz sual toplusunu seçin.</p>

        <ul className="mt-6 space-y-3">
          {exams.map((ex) => (
            <li key={ex.id}>
              <button
                type="button"
                onClick={() => onChoose(ex)}
                disabled={openingId !== null}
                className="flex min-h-20 w-full items-center justify-between gap-4 rounded-2xl border-2 border-slate-200 bg-white p-4 text-left transition-colors hover:border-blue-400 hover:bg-blue-50/50 disabled:opacity-60"
              >
                <span className="min-w-0">
                  <span className="block text-lg font-extrabold leading-snug text-slate-900">{ex.title}</span>
                  {ex.description && (
                    <span className="mt-0.5 block text-sm text-slate-600">{ex.description}</span>
                  )}
                  <span className="mt-1 block text-sm font-semibold text-blue-700">
                    {ex.question_count} sual · {ex.duration_minutes} dəqiqə
                  </span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-2xl font-bold text-blue-600">
                  {openingId === ex.id ? '…' : '→'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function IntroForm({
  examTitle,
  total,
  minutes,
  notice,
  onBack,
  onStart,
}: {
  examTitle?: string;
  total: number;
  minutes: number;
  notice?: string | null;
  onBack?: () => void;
  onStart: (v: { fullName: string; className: string; school: string }) => Promise<string | null>;
}) {
  const [fullName, setFullName] = useState('');
  const [className, setClassName] = useState('');
  const [school, setSchool] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = fullName.trim().replace(/\s+/g, ' ');
    const cls = className.trim();
    if (name.length < 2) return setError('Ad və soyadınızı yazın.');
    if (!cls) return setError('Sinifinizi yazın.');
    setError(null);
    setBusy(true);
    const err = await onStart({ fullName: name, className: cls, school: school.trim() });
    if (err) {
      setError(err);
      setBusy(false);
    }
  }

  const input =
    'mt-2 block min-h-14 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-lg text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/20';

  return (
    <div className="mx-auto max-w-xl pt-4">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-block rounded-lg px-2 py-1 text-sm font-medium text-slate-600 hover:text-blue-700"
        >
          ← Sınaq seçiminə qayıt
        </button>
      ) : (
        <Link href="/" className="inline-block rounded-lg px-2 py-1 text-sm font-medium text-slate-600 hover:text-blue-700">
          ← Ana səhifə
        </Link>
      )}

      <Card className="mt-3">
        {examTitle && <p className="text-sm font-bold text-blue-700">{examTitle}</p>}
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">Sınağa başlamazdan əvvəl</h1>
        <p className="mt-2 text-base text-slate-600">
          {total} sual, {minutes} dəqiqə. Başladıqdan sonra taymer dayanmır — səhifəni yeniləsəniz də davam edir.
        </p>

        {notice && (
          <p role="status" className="mt-4 rounded-xl bg-amber-100 px-4 py-3 text-base font-semibold text-amber-900">
            {notice}
          </p>
        )}

        <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
          <div>
            <label htmlFor="fullName" className="text-base font-bold text-slate-800">
              Ad və Soyad <span className="text-red-600" aria-hidden="true">*</span>
              <span className="sr-only"> (vacib)</span>
            </label>
            <input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              maxLength={120}
              required
              className={input}
              placeholder="Məsələn: Aysel Məmmədova"
            />
          </div>

          <div>
            <label htmlFor="className" className="text-base font-bold text-slate-800">
              Sinif <span className="text-red-600" aria-hidden="true">*</span>
              <span className="sr-only"> (vacib)</span>
            </label>
            <input
              id="className"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              maxLength={20}
              required
              className={input}
              placeholder="Məsələn: 9B"
            />
          </div>

          <div>
            <label htmlFor="school" className="text-base font-bold text-slate-800">
              Məktəb <span className="font-medium text-slate-500">(könüllü)</span>
            </label>
            <input
              id="school"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              maxLength={160}
              className={input}
              placeholder="Məsələn: 132 nömrəli məktəb"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-base font-semibold text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="min-h-14 w-full rounded-2xl bg-blue-600 px-6 text-lg font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? 'Başlayır…' : 'Sınağa Başla'}
          </button>
        </form>
      </Card>
    </div>
  );
}

function ConfirmModal({
  unanswered,
  onCancel,
  onConfirm,
}: {
  unanswered: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  // Runs once: the parent re-renders every second (timer), which must not steal focus again.
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/60 p-4 sm:items-center"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
      >
        <h2 id="confirm-title" className="text-2xl font-extrabold text-slate-900">
          Sınağı bitirmək istəyirsiniz?
        </h2>
        <p className="mt-3 text-base leading-relaxed text-slate-700">
          {unanswered > 0 ? (
            <>
              <strong className="text-red-700">{unanswered} sual</strong> cavabsız qalıb.{' '}
            </>
          ) : (
            'Bütün suallar cavablandırılıb. '
          )}
          Göndərdikdən sonra cavabları dəyişmək olmaz.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-14 flex-1 rounded-2xl border-2 border-slate-200 px-4 text-lg font-bold text-slate-800 hover:bg-slate-50"
          >
            Geri qayıt
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-14 flex-1 rounded-2xl bg-emerald-600 px-4 text-lg font-bold text-white hover:bg-emerald-700"
          >
            Bəli, göndər
          </button>
        </div>
      </div>
    </div>
  );
}

function DoneScreen({
  supabase,
  studentId,
  onNewStudent,
}: {
  supabase: ReturnType<typeof createClient>;
  studentId: string;
  onNewStudent: () => void;
}) {
  const [canSeeExplanations, setCanSeeExplanations] = useState(false);
  const [showExplanations, setShowExplanations] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.rpc('get_public_settings');
        if (!cancelled && data?.[0]?.show_explanations) setCanSeeExplanations(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return (
    <div className="mx-auto max-w-xl pt-10">
      <Card className="text-center">
        <div
          aria-hidden="true"
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-600"
        >
          ✓
        </div>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-900">
          Təbriklər! Cavablarınız uğurla göndərildi.
        </h1>
        <p className="mt-3 text-lg text-slate-600">Cavablar müəllimə göndərildi.</p>

        <div className="mt-8 flex flex-col gap-3">
          {canSeeExplanations && !showExplanations && (
            <button
              type="button"
              onClick={() => setShowExplanations(true)}
              className="min-h-14 rounded-2xl bg-blue-600 px-6 text-lg font-bold text-white hover:bg-blue-700"
            >
              İzahlara bax
            </button>
          )}
          <Link
            href="/"
            className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-slate-200 px-6 text-lg font-bold text-slate-800 hover:bg-slate-50"
          >
            Ana səhifə
          </Link>
          <button
            type="button"
            onClick={onNewStudent}
            className="mx-auto mt-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 underline underline-offset-2 hover:text-slate-800"
          >
            Başqa şagird üçün yeni sınaq
          </button>
        </div>
      </Card>

      {showExplanations && <ExplanationsView supabase={supabase} studentId={studentId} />}
    </div>
  );
}

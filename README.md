# Elmira Fətəliyeva – Rəqəm Sistemləri Onlayn Sınaq

Online multiple-choice exam (25 questions, 30 minutes) in Azerbaijani.
Students need no account. The teacher signs in at `/admin` to see results.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase (Auth + Postgres) · Recharts · SheetJS.
Runs entirely on **Vercel Free + Supabase Free**.

---

## 1. Run locally

```bash
npm install
cp .env.example .env.local      # then fill in the values (step 2)
npm run dev                     # http://localhost:3000
```

Needs Node.js 20 or newer.

## 2. Supabase setup (about 10 minutes)

1. Go to <https://supabase.com> → **New project** (free plan). Save the database password.
2. **SQL Editor → New query** → paste the whole file `supabase/schema.sql` → **Run**.
   (Safe to run again later.)
3. **Project Settings → API**. Copy into `.env.local`:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**local only, used by `npm run seed`; never put it on Vercel**)
4. **Create the teacher account.** Authentication → Users → **Add user → Create new user**.
   Enter the teacher's email and a strong password, tick *Auto Confirm User*.
5. **Allow only the teacher.** In the SQL Editor run (use the same email):
   ```sql
   insert into public.admins (email) values ('teacher@example.com');
   ```
   Also put the same email in `.env.local` as `ADMIN_EMAIL`.
6. **Turn off public sign-ups:** Authentication → Sign In / Providers → switch off
   **Allow new users to sign up**. (Even if left on, only emails in the `admins` table can see any data.)
7. **Load the questions:**
   ```bash
   npm run seed
   ```

Open `/admin/login` and sign in with the teacher account.

## 3. Add the real questions

Edit **`src/data/questions.ts`**. It currently holds 25 *sample* number-system questions.
Every question looks like this:

```ts
{
  position: 7,                       // order in the exam
  text: 'Sual mətni…',
  image: '/questions/sual-7.png',    // optional (see below)
  options: ['A variantı', 'B variantı', 'C variantı', 'D variantı', 'E variantı'],
  correct: 'C',
  explanation: 'Niyə C düzgündür…',
},
```

Then run `npm run seed` again. Existing questions are updated by `position`.

**Questions from screenshots:** put each image into `public/questions/` (e.g. `sual-7.png`) and set
`image: '/questions/sual-7.png'`. Redeploy so the file goes online.

> Change questions **before** students start. Editing a question later does not re-grade old submissions.

If you change the number of questions, nothing else needs editing: the interface, scoring
(score = correct × 100 ÷ number of questions) and charts adapt automatically.

## 4. Deploy to Vercel (free)

1. Push this folder to a GitHub repository.
2. <https://vercel.com> → **Add New → Project** → import the repository (framework is detected as Next.js).
3. Add **Environment Variables**:
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key |
   | `ADMIN_EMAIL` | the teacher's email |
4. **Deploy.** Open the URL, take a test exam, then check `/admin`.

## 5. How it works

- **Students** are stored through a database function, `start_exam`. There is no student login.
- **Answer key stays private.** Students receive questions *without* `correct_option` or `explanation`
  (`get_exam_questions`). Grading is done on the server by `submit_exam`, which can be called once per student, so submitted answers cannot be changed.
- **Timer** counts from the saved start time, so refreshing the page or closing the tab does not reset it.
  At 00:00 answers are submitted automatically.
- **Autosave:** answers and the current question are saved in the browser (`localStorage`) after every click.
  The questions are cached too, so a refresh works even while offline. If the internet drops during submission, the page keeps
  the answers and sends them automatically when the connection returns.
- **Security:** Row Level Security is on for every table; anonymous visitors cannot read or write tables directly.
  `/admin` is protected by middleware, by the `admins` table, and by RLS.
- **Explanations for students** are off by default. The teacher can switch them on in the dashboard;
  the database enforces it and only releases them after the student has submitted.

## 6. Good to know

- **PDF export** uses the browser's print dialog (*Save as PDF*). This keeps Azerbaijani letters (ə, ı, ö, ü, ş, ç, ğ) perfect.
  Excel export (`.xlsx`) downloads directly, with a second sheet of per-question statistics.
- **One attempt per student is not enforced.** Students have no accounts, so someone who clears their browser data
  could start again. Each attempt appears as a separate row.
- **Supabase Free pauses a project after 7 days without activity.** Open the Supabase dashboard and click *Restore*
  before an exam day if it has been idle. Data is kept.
- The timer uses the student's own device clock. The server records the real elapsed time (capped at 30 minutes) in `duration_seconds`.
- To change the exam length, edit `EXAM_MINUTES` in `src/lib/types.ts` **and** the `1800` in `submit_exam` in `supabase/schema.sql`.

## Project structure

```
middleware.ts                       protects /admin
supabase/schema.sql                 tables, RLS, grading functions, views
scripts/seed.ts                     uploads src/data/questions.ts to Supabase
src/data/questions.ts               ← edit questions here
src/lib/                            types, helpers, Supabase clients
src/app/page.tsx                    landing page
src/app/exam/                       student exam
src/app/admin/login/                teacher sign-in
src/app/admin/(protected)/          dashboard + student detail (needs login)
src/components/exam/                exam UI, confirm dialog, explanations
src/components/admin/               dashboard, charts, table, export
```

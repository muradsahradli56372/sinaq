/**
 * Uploads src/data/questions.ts to Supabase.
 * Run:  npm run seed      (needs .env.local with the SERVICE ROLE key)
 */
import { createClient } from '@supabase/supabase-js';
import { questions } from '../src/data/questions';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// --- validate before touching the database ---
const seen = new Set<number>();
for (const q of questions) {
  if (seen.has(q.position)) throw new Error(`Duplicate position: ${q.position}`);
  seen.add(q.position);
  if (q.options.length !== 5) throw new Error(`Question ${q.position}: exactly 5 options required`);
  if (!'ABCDE'.includes(q.correct)) throw new Error(`Question ${q.position}: invalid "correct"`);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const rows = questions.map((q) => ({
  position: q.position,
  text: q.text,
  image_url: q.image ?? null,
  option_a: q.options[0],
  option_b: q.options[1],
  option_c: q.options[2],
  option_d: q.options[3],
  option_e: q.options[4],
  correct_option: q.correct,
  explanation: q.explanation,
}));

const { error } = await supabase.from('questions').upsert(rows, { onConflict: 'position' });
if (error) {
  console.error('Seed failed:', error.message);
  process.exit(1);
}

const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true });
console.log(`✔ ${rows.length} questions uploaded. Total in database: ${count}`);
if (count !== null && count > rows.length) {
  console.log('ℹ The database has more questions than this file. Delete the extra ones in Supabase → Table Editor → questions.');
}

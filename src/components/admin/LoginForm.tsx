'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError('E-poçt və ya şifrə yanlışdır.');
      setBusy(false);
      return;
    }
    router.replace('/admin');
    router.refresh();
  }

  const input =
    'mt-2 block min-h-14 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-lg text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/20';

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5">
      <div>
        <label htmlFor="email" className="text-base font-bold text-slate-800">E-poçt</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={input}
        />
      </div>
      <div>
        <label htmlFor="password" className="text-base font-bold text-slate-800">Şifrə</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={input}
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
        {busy ? 'Daxil olur…' : 'Daxil ol'}
      </button>
    </form>
  );
}

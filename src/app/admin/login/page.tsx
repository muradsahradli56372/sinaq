import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LoginForm from '@/components/admin/LoginForm';

export const metadata: Metadata = { title: 'Müəllim girişi' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (isAdmin) redirect('/admin');
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-blue-50 via-white to-emerald-50 px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-block rounded-lg px-2 py-1 text-sm font-medium text-slate-600 hover:text-blue-700">
          ← Ana səhifə
        </Link>
        <div className="mt-3 rounded-3xl border border-blue-100 bg-white p-6 shadow-xl shadow-blue-900/5 sm:p-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Müəllim girişi</h1>
          <p className="mt-2 text-base text-slate-600">Nəticələri görmək üçün daxil olun.</p>
          {sp.error === 'forbidden' && (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-base font-semibold text-red-700">
              Bu hesabın müəllim icazəsi yoxdur.
            </p>
          )}
          <LoginForm />
        </div>
      </div>
    </main>
  );
}

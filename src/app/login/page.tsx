'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const DEMO_ACCOUNTS = [
  { email: 'director@rncare.demo', name: 'Lim Wei Ming', role: 'Director' },
  { email: 'sarah@rncare.demo', name: 'Sarah Tan', role: 'Key Account Manager' },
  { email: 'evon@rncare.demo', name: 'Evon Lew', role: 'Key Account Manager' },
  { email: 'marcus@rncare.demo', name: 'Marcus Lee', role: 'BD Consultant' },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('demo1234');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(targetEmail: string, targetPwd: string) {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password: targetPwd,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push('/desk');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-teal-50 via-white to-slate-100">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center">
        {/* Brand panel */}
        <div className="hidden md:block">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-10 rounded-xl bg-brand text-white grid place-items-center font-bold text-lg">RN</div>
            <div>
              <div className="font-semibold text-slate-900">RN Care Services</div>
              <div className="text-sm text-muted">Singapore medical recruitment</div>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 leading-tight tracking-tight">
            Live pipeline.<br />
            <span className="text-brand">Co-broke without the huddle.</span>
          </h1>
          <p className="mt-4 text-slate-600 leading-relaxed">
            One shared view of every open role, who owns it, and who&apos;s contributing.
            Stop waiting for the weekly meeting to share leads.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-slate-700">
            <li className="flex gap-2"><span className="text-brand">●</span> Pipeline visible to the whole team in real time</li>
            <li className="flex gap-2"><span className="text-brand">●</span> Open roles for co-broke with default split rules</li>
            <li className="flex gap-2"><span className="text-brand">●</span> Director dashboard replaces the master spreadsheet</li>
          </ul>
        </div>

        {/* Sign-in card */}
        <div className="bg-white border border-border rounded-2xl shadow-sm p-8">
          <h2 className="text-lg font-semibold text-slate-900">Sign in to the demo</h2>
          <p className="text-sm text-muted mt-1">Pick a role below — password is pre-filled.</p>

          <div className="mt-6 space-y-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                onClick={() => signIn(a.email, 'demo1234')}
                disabled={loading}
                className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-brand hover:bg-brand-soft/40 transition disabled:opacity-50 group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{a.name}</div>
                    <div className="text-xs text-muted">{a.role}</div>
                  </div>
                  <div className="text-xs text-brand opacity-0 group-hover:opacity-100 transition">Sign in →</div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-border">
            <details className="text-sm">
              <summary className="cursor-pointer text-muted hover:text-slate-900">Sign in manually</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  signIn(email, password);
                }}
                className="mt-3 space-y-3"
              >
                <input
                  type="email"
                  required
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-brand"
                />
                <input
                  type="password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-brand"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-3 py-2 rounded-lg bg-brand text-white font-medium hover:bg-brand-ink disabled:opacity-50"
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            </details>
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/Sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-700">
        Profile missing. Run <code className="mx-1 px-2 py-0.5 bg-slate-100 rounded">npm run seed</code> first.
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar profile={profile} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

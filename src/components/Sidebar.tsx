'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  KanbanSquare,
  Briefcase,
  Users,
  Building2,
  BarChart3,
  Radio,
  LogOut,
} from 'lucide-react';
import clsx from 'clsx';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/supabase/types';
import { ROLE_LABELS } from '@/lib/supabase/types';

const NAV = [
  { href: '/desk', label: 'My desk', icon: Home },
  { href: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { href: '/feed', label: 'Co-broke feed', icon: Radio },
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/candidates', label: 'Candidates', icon: Users },
  { href: '/clients', label: 'Clients', icon: Building2 },
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
];

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-border flex flex-col">
      <div className="px-5 py-5 border-b border-border">
        <Link href="/desk" className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-brand text-white grid place-items-center font-bold">RN</div>
          <div>
            <div className="font-semibold text-slate-900 text-sm">RN Care</div>
            <div className="text-[11px] text-muted -mt-0.5">Co-broking CRM</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition',
                active
                  ? 'bg-brand-soft text-brand-ink font-medium'
                  : 'text-slate-700 hover:bg-slate-100'
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border space-y-2">
        <div className="px-3 py-2 text-xs">
          <div className="font-medium text-slate-900">{profile.full_name}</div>
          <div className="text-muted">{ROLE_LABELS[profile.role]}</div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

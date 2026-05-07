'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCircle2, AlertCircle, Radio, Mail } from 'lucide-react';
import clsx from 'clsx';
import { createClient } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/format';
import type { Notification, NotificationKind } from '@/lib/supabase/types';

const KIND_ICON: Record<NotificationKind, React.ComponentType<{ className?: string }>> = {
  placed: CheckCircle2,
  placed_elsewhere: AlertCircle,
  split_pending: Mail,
  split_approved: CheckCircle2,
  split_rejected: AlertCircle,
  cobroke_opened: Radio,
};

const KIND_COLOR: Record<NotificationKind, string> = {
  placed: 'text-emerald-600',
  placed_elsewhere: 'text-amber-600',
  split_pending: 'text-blue-600',
  split_approved: 'text-emerald-600',
  split_rejected: 'text-red-600',
  cobroke_opened: 'text-brand',
};

export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      setItems((data ?? []) as Notification[]);
    })();
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
        (payload) => {
          setItems((rows) => [payload.new as Notification, ...rows].slice(0, 20));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const unread = items.filter((n) => !n.read_at);

  async function markRead(id: string) {
    setItems((rows) => rows.map((r) => (r.id === id ? { ...r, read_at: new Date().toISOString() } : r)));
    const supabase = createClient();
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  }

  async function markAllRead() {
    if (unread.length === 0) return;
    const ids = unread.map((n) => n.id);
    const now = new Date().toISOString();
    setItems((rows) => rows.map((r) => (ids.includes(r.id) ? { ...r, read_at: now } : r)));
    const supabase = createClient();
    await supabase.from('notifications').update({ read_at: now }).in('id', ids);
  }

  function handleClick(n: Notification) {
    markRead(n.id);
    setOpen(false);
    if (n.href) {
      router.push(n.href as never);
      router.refresh();
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
      >
        <Bell className="size-4" />
        Notifications
        {unread.length > 0 && (
          <span className="ml-auto inline-flex items-center justify-center text-[10px] font-bold size-5 rounded-full bg-brand text-white">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full ml-2 bottom-0 w-80 bg-white rounded-xl shadow-xl border border-border z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="font-medium text-slate-900 text-sm">Notifications</div>
            {unread.length > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-brand hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-auto divide-y divide-border">
            {items.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted">No notifications yet.</li>
            )}
            {items.map((n) => {
              const Icon = KIND_ICON[n.kind] ?? Bell;
              return (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n)}
                    className={clsx(
                      'w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-50',
                      !n.read_at && 'bg-brand-soft/20'
                    )}
                  >
                    <Icon className={clsx('size-4 shrink-0 mt-0.5', KIND_COLOR[n.kind])} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900">{n.title}</div>
                      {n.body && <div className="text-xs text-muted mt-0.5">{n.body}</div>}
                      <div className="text-[11px] text-muted mt-1">{timeAgo(n.created_at)}</div>
                    </div>
                    {!n.read_at && <span className="size-2 rounded-full bg-brand shrink-0 mt-1.5" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="px-4 py-2 border-t border-border bg-slate-50 text-xs text-muted text-center">
            Real-time · in-app only · email & Slack in production
          </div>
        </div>
      )}
    </div>
  );
}

export function StaticNotificationLink() {
  // For server-side render fallback / non-realtime contexts
  return (
    <Link
      href={'/feed' as never}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
    >
      <Bell className="size-4" />
      Notifications
    </Link>
  );
}

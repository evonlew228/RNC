import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { CoBrokeFeed } from '@/components/CoBrokeFeed';

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: activities } = await supabase
    .from('activities')
    .select(`
      *,
      actor:profiles!activities_actor_id_fkey(id, full_name, role),
      job:jobs(id, title, client:clients(name)),
      candidate:candidates(id, full_name, current_title)
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader
        title="Co-broke feed"
        subtitle="Live stream of pipeline activity. New co-broke opportunities appear here in real time."
      />
      <div className="flex-1 overflow-auto p-6">
        <CoBrokeFeed
          initial={(activities ?? []) as unknown as import('@/components/CoBrokeFeed').FeedRow[]}
          currentUserId={user!.id}
        />
      </div>
    </div>
  );
}

import { createClient } from '@/lib/supabase/server';
import { PipelineBoard } from '@/components/PipelineBoard';
import { PageHeader } from '@/components/PageHeader';

export default async function PipelinePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single();

  const { data: submissions } = await supabase
    .from('submissions')
    .select(`
      *,
      job:jobs(id, title, role_type, owner_id, co_broke_open, default_split, annual_package_sgd, fee_pct, client:clients(id, name)),
      candidate:candidates(id, full_name, current_title, current_employer),
      submitter:profiles!submissions_submitting_consultant_id_fkey(id, full_name, role)
    `)
    .order('updated_at', { ascending: false });

  return (
    <div className="flex flex-col h-screen">
      <PageHeader
        title="Pipeline"
        subtitle="Drag candidates across stages. Updates are visible to everyone in real time."
      />
      <PipelineBoard
        initialSubmissions={(submissions ?? []) as unknown as import('@/components/PipelineBoard').SubmissionRow[]}
        currentProfile={profile!}
      />
    </div>
  );
}

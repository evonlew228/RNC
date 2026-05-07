'use client';

import { useState } from 'react';
import { Upload, FileText, X, Link as LinkIcon, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Mode = 'upload' | 'url';

export function ResumeUploader({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [mode, setMode] = useState<Mode>(value && !value.includes('candidate-resumes') ? 'url' : 'upload');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    const supabase = createClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from('candidate-resumes')
      .upload(path, file, { upsert: false });
    if (upErr) {
      setError(`Upload failed: ${upErr.message}. Did you run migration 0004?`);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from('candidate-resumes').getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
  }

  function clear() {
    onChange('');
    setError(null);
  }

  // Already uploaded — show file preview
  if (value && mode === 'upload') {
    const filename = value.split('/').pop()?.split('?')[0] ?? 'Resume';
    return (
      <div className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg bg-slate-50">
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 min-w-0 flex-1 hover:text-brand"
        >
          <FileText className="size-5 text-brand shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-900 truncate">{filename}</div>
            <div className="text-xs text-muted">Click to preview</div>
          </div>
        </a>
        <button
          type="button"
          onClick={clear}
          className="p-1 text-muted hover:text-red-600"
          title="Remove"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-1 mb-2 text-xs">
        <ModeTab active={mode === 'upload'} onClick={() => setMode('upload')} icon={<Upload className="size-3" />}>
          Upload file
        </ModeTab>
        <ModeTab active={mode === 'url'} onClick={() => setMode('url')} icon={<LinkIcon className="size-3" />}>
          Link to Drive / URL
        </ModeTab>
      </div>

      {mode === 'upload' ? (
        <label
          className={`flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed rounded-lg transition ${
            uploading
              ? 'border-brand bg-brand-soft/30'
              : 'border-border hover:border-brand hover:bg-brand-soft/20 cursor-pointer'
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="size-5 animate-spin text-brand" />
              <div className="text-sm text-muted">Uploading…</div>
            </>
          ) : (
            <>
              <Upload className="size-5 text-muted" />
              <div className="text-sm text-muted">
                <span className="text-brand font-medium">Click to upload</span> a PDF
              </div>
              <div className="text-xs text-muted">PDF, DOC, DOCX up to 10MB</div>
            </>
          )}
          <input
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="hidden"
          />
        </label>
      ) : (
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://drive.google.com/file/d/..."
          className="w-full px-3 py-2 border border-border rounded-lg text-sm"
        />
      )}

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${
        active ? 'bg-brand-soft text-brand-ink font-medium' : 'text-muted hover:text-slate-900'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

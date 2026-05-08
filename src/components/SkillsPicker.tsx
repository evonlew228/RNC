'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export interface SkillTag {
  id?: string;        // existing skill id
  name: string;
  isNew?: boolean;    // not yet persisted
}

/**
 * Multi-select skills picker with create-new support.
 * Stores selected tags as a list. The parent persists them on submit
 * (creates new skills first, then writes the join rows).
 */
export function SkillsPicker({
  selected,
  onChange,
  placeholder = 'Type to search or add a new skill…',
}: {
  selected: SkillTag[];
  onChange: (next: SkillTag[]) => void;
  placeholder?: string;
}) {
  const [allSkills, setAllSkills] = useState<{ id: string; name: string }[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from('skills').select('id, name').order('name');
      setAllSkills((data ?? []) as { id: string; name: string }[]);
    })();
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allSkills.slice(0, 8);
    return allSkills
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) &&
          !selected.some((sel) => sel.id === s.id)
      )
      .slice(0, 8);
  }, [query, allSkills, selected]);

  const exactMatch = useMemo(
    () => allSkills.some((s) => s.name.toLowerCase() === query.trim().toLowerCase()),
    [query, allSkills]
  );

  const canCreate = query.trim().length > 0 && !exactMatch &&
    !selected.some((sel) => sel.name.toLowerCase() === query.trim().toLowerCase());

  function add(skill: SkillTag) {
    if (selected.some((s) => (s.id && s.id === skill.id) || s.name.toLowerCase() === skill.name.toLowerCase())) {
      return;
    }
    onChange([...selected, skill]);
    setQuery('');
  }

  function remove(skill: SkillTag) {
    onChange(selected.filter((s) => s !== skill));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (matches.length > 0) {
        add({ id: matches[0].id, name: matches[0].name });
      } else if (canCreate) {
        add({ name: query.trim(), isNew: true });
      }
    } else if (e.key === 'Backspace' && query === '' && selected.length > 0) {
      remove(selected[selected.length - 1]);
    }
  }

  return (
    <div className="relative">
      <div
        className="flex flex-wrap gap-1.5 px-2 py-1.5 border border-border rounded-lg min-h-[42px] focus-within:ring-2 focus-within:ring-brand bg-white"
        onClick={() => setOpen(true)}
      >
        {selected.map((s, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brand-soft text-brand-ink text-xs font-medium"
          >
            {s.name}
            {s.isNew && <span className="text-[9px] opacity-70">NEW</span>}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(s);
              }}
              className="hover:text-red-600"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          placeholder={selected.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[180px] outline-none text-sm bg-transparent"
        />
      </div>

      {open && (matches.length > 0 || canCreate) && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-border rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {matches.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                add({ id: s.id, name: s.name });
              }}
              className="w-full text-left px-3 py-2 text-sm text-slate-800 hover:bg-slate-100"
            >
              {s.name}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                add({ name: query.trim(), isNew: true });
              }}
              className="w-full text-left px-3 py-2 text-sm text-brand-ink hover:bg-brand-soft border-t border-border flex items-center gap-2"
            >
              <Plus className="size-3.5" />
              Create &quot;{query.trim()}&quot;
            </button>
          )}
        </div>
      )}

      <div className="text-[11px] text-muted mt-1">
        Press Enter to add. Type a new skill name and click Create to add it to the global skills library.
      </div>
    </div>
  );
}

/**
 * Helper used by callers after form submit:
 * - creates any "new" skills via the skills table
 * - returns the resolved list of skill IDs
 */
export async function resolveSkillIds(tags: SkillTag[]): Promise<string[]> {
  const supabase = createClient();
  const ids: string[] = [];
  for (const t of tags) {
    if (t.id) {
      ids.push(t.id);
      continue;
    }
    // Create new skill (or fetch if it exists already)
    const { data: existing } = await supabase
      .from('skills')
      .select('id')
      .eq('name', t.name)
      .maybeSingle();
    if (existing?.id) {
      ids.push(existing.id);
      continue;
    }
    const { data: created, error } = await supabase
      .from('skills')
      .insert({ name: t.name })
      .select('id')
      .single();
    if (error) throw error;
    ids.push(created.id);
  }
  return ids;
}

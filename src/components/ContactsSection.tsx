'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Mail, Phone, MapPin, Building, X, Pencil, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Contact } from '@/lib/supabase/types';

type ContactDraft = {
  id?: string;
  full_name: string;
  title: string;
  department: string;
  location: string;
  email: string;
  phone: string;
};

const EMPTY: ContactDraft = {
  full_name: '',
  title: '',
  department: '',
  location: '',
  email: '',
  phone: '',
};

export function ContactsSection({
  clientId,
  clientName,
  initialContacts,
}: {
  clientId: string;
  clientName: string;
  initialContacts: Contact[];
}) {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [editing, setEditing] = useState<ContactDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openNew() {
    setEditing({ ...EMPTY });
    setError(null);
  }

  function openEdit(c: Contact) {
    setEditing({
      id: c.id,
      full_name: c.full_name,
      title: c.title ?? '',
      department: c.department ?? '',
      location: c.location ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
    });
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();

    const payload = {
      client_id: clientId,
      full_name: editing.full_name,
      title: editing.title || null,
      department: editing.department || null,
      location: editing.location || null,
      email: editing.email || null,
      phone: editing.phone || null,
    };

    if (editing.id) {
      const { data, error } = await supabase
        .from('contacts')
        .update(payload)
        .eq('id', editing.id)
        .select()
        .single();
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
      setContacts((cs) => cs.map((c) => (c.id === editing.id ? (data as Contact) : c)));
    } else {
      const { data, error } = await supabase
        .from('contacts')
        .insert(payload)
        .select()
        .single();
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
      setContacts((cs) => [...cs, data as Contact]);
    }

    setEditing(null);
    setBusy(false);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm('Delete this contact?')) return;
    const supabase = createClient();
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) {
      alert(error.message);
      return;
    }
    setContacts((cs) => cs.filter((c) => c.id !== id));
    router.refresh();
  }

  return (
    <div className="bg-white border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium text-slate-900">Contacts ({contacts.length})</h2>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand text-white text-xs font-medium hover:bg-brand-ink"
        >
          <UserPlus className="size-3.5" />
          Add
        </button>
      </div>

      <ul className="divide-y divide-border">
        {contacts.map((c) => (
          <li key={c.id} className="py-3 group">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-900">{c.full_name}</div>
                {(c.title || c.department) && (
                  <div className="text-xs text-muted">
                    {[c.title, c.department].filter(Boolean).join(' · ')}
                  </div>
                )}
                <div className="mt-1.5 flex flex-col gap-0.5 text-xs text-slate-700">
                  {c.email && (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="size-3 text-muted" />
                      {c.email}
                    </span>
                  )}
                  {c.phone && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="size-3 text-muted" />
                      {c.phone}
                    </span>
                  )}
                  {c.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3 text-muted" />
                      {c.location}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openEdit(c)}
                  className="p-1.5 rounded text-muted hover:text-slate-900 hover:bg-slate-100"
                  title="Edit"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  onClick={() => remove(c.id)}
                  className="p-1.5 rounded text-muted hover:text-red-600 hover:bg-red-50"
                  title="Delete"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          </li>
        ))}
        {contacts.length === 0 && (
          <li className="py-6 text-sm text-muted text-center">No contacts yet.</li>
        )}
      </ul>

      {editing && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !busy && setEditing(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-border flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">
                  {editing.id ? 'Edit contact' : 'Add contact'}
                </h3>
                <p className="text-xs text-muted mt-0.5 inline-flex items-center gap-1">
                  <Building className="size-3" />
                  {clientName}
                </p>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="text-muted hover:text-slate-900"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={save} className="p-5 space-y-3">
              <Field label="Name" required>
                <input
                  required
                  value={editing.full_name}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                  placeholder="e.g. Dr. Tan Hui Yan"
                  className="w-full px-3 py-2 border border-border rounded-lg"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Designation">
                  <input
                    value={editing.title}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                    placeholder="e.g. Head of HR"
                    className="w-full px-3 py-2 border border-border rounded-lg"
                  />
                </Field>
                <Field label="Department">
                  <input
                    value={editing.department}
                    onChange={(e) => setEditing({ ...editing, department: e.target.value })}
                    placeholder="e.g. Talent Acquisition"
                    className="w-full px-3 py-2 border border-border rounded-lg"
                  />
                </Field>
              </div>

              <Field label="Location">
                <input
                  value={editing.location}
                  onChange={(e) => setEditing({ ...editing, location: e.target.value })}
                  placeholder="e.g. Mount Elizabeth Novena, Level 5"
                  className="w-full px-3 py-2 border border-border rounded-lg"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Email">
                  <input
                    type="email"
                    value={editing.email}
                    onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                    placeholder="name@company.sg"
                    className="w-full px-3 py-2 border border-border rounded-lg"
                  />
                </Field>
                <Field label="Phone">
                  <input
                    value={editing.phone}
                    onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                    placeholder="+65 9xxx xxxx"
                    className="w-full px-3 py-2 border border-border rounded-lg"
                  />
                </Field>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-lg border border-border text-slate-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-ink disabled:opacity-50"
                >
                  {busy ? 'Saving…' : editing.id ? 'Save' : 'Add contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </div>
      {children}
    </label>
  );
}

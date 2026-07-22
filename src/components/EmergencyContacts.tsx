import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, UserPlus } from "lucide-react";

type Contact = {
  id: string;
  contact_name: string;
  contact_number: string;
  contact_email: string | null;
  relationship: string;
};

export function EmergencyContacts({ onChange }: { onChange?: (c: Contact[]) => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ contact_name: "", contact_number: "", contact_email: "", relationship: "" });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("emergency_contacts")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    else {
      setContacts((data as Contact[]) ?? []);
      onChange?.((data as Contact[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contacts.length >= 5) { toast.error("Maximum 5 contacts allowed"); return; }
    setSubmitting(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setSubmitting(false); return; }
    const { error } = await supabase.from("emergency_contacts").insert({
      contact_name: form.contact_name,
      contact_number: form.contact_number,
      contact_email: form.contact_email || null,
      relationship: form.relationship,
      user_id: userData.user.id,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setForm({ contact_name: "", contact_number: "", contact_email: "", relationship: "" });
    toast.success("Contact added");
    void load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("emergency_contacts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Contact removed");
    void load();
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Trusted contacts</h2>
          <p className="text-sm text-muted-foreground">{contacts.length}/5 added · phone required, email optional</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contacts yet. Add up to 5 trusted people.</p>
        ) : (
          contacts.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-md border border-border bg-secondary/40 px-3 py-2">
              <div>
                <div className="font-medium">{c.contact_name} <span className="text-xs text-muted-foreground">· {c.relationship}</span></div>
                <div className="text-xs text-muted-foreground">
                  {c.contact_number}{c.contact_email ? ` · ${c.contact_email}` : ""}
                </div>
              </div>
              <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-primary" aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {contacts.length < 5 && (
        <form onSubmit={add} className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-5">
          <input required placeholder="Name" value={form.contact_name}
            onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
            className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
          <input required placeholder="Phone (WhatsApp)" type="tel" value={form.contact_number}
            onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
            className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
          <input placeholder="Email (optional)" type="email" value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
          <input required placeholder="Relationship" value={form.relationship}
            onChange={(e) => setForm({ ...form, relationship: e.target.value })}
            className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
          <button disabled={submitting} className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            <UserPlus className="h-4 w-4" /> Add
          </button>
        </form>
      )}
    </div>
  );
}

export type { Contact };

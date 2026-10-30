import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { LOGO_URL } from "@/lib/nav";
import RequestFormRenderer, { isComplete } from "@/features/requests/RequestFormRenderer";
import { KIND_LABELS } from "@/features/requests/formSchema";

// Public, no-login request form: /r/<RequestForm id>?k=<form_key>. Client sites link their "Submit a project" button here.
export default function PublicRequest() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const key = sp.get("k") || "";
  const [form, setForm] = useState(null);
  const [err, setErr] = useState("");
  const [vals, setVals] = useState({});
  const [contact, setContact] = useState({ name: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const base = `${window.location.origin}/functions/submit-request`;

  useEffect(() => {
    fetch(`${base}?form=${encodeURIComponent(id)}&key=${encodeURIComponent(key)}`).then((r) => r.json()).then((d) => (d.form ? setForm(d.form) : setErr(d.error || "Form not found"))).catch(() => setErr("Could not load the form"));
  }, [id, key]);  

  const submit = async (e) => {
    e.preventDefault();
    if (!form || !isComplete(form, vals)) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ form_id: id, key, values: vals, contact_name: contact.name, contact_email: contact.email, source: "public_form" }) });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || "Could not send");
      setDone(true);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <img src={LOGO_URL} alt="" className="h-8 w-11 object-contain" />
          <span className="text-[15px] font-semibold tracking-tight">Interstellar</span>
          {form && <span className="mono-label ml-auto text-[10px] text-ink/50">{form.client_name}</span>}
        </div>
        {err && !form && <p className="border border-hair bg-card p-5 text-[13px] text-red-700">{err}</p>}
        {form && done && (
          <div className="border border-hair bg-card p-8 text-center">
            <p className="mono-label text-[9.5px] text-[#ff3c00]">Received</p>
            <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.04em]">Thanks, we&apos;ve got it.</h1>
            <p className="mt-2 text-[13.5px] text-ink/60">We reply within 1 business day.</p>
            <button type="button" onClick={() => { setDone(false); setVals({}); }} className="mt-6 text-[13px] text-[#ff3c00] hover:underline">Send another</button>
          </div>
        )}
        {form && !done && (
          <form onSubmit={submit} className="border border-hair bg-card">
            <div className="border-b border-hair px-6 py-5">
              <p className="mono-label text-[9.5px] text-ink/50">{KIND_LABELS[form.kind] || form.kind}</p>
              <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.04em]">{form.title}</h1>
              {form.intro && <p className="mt-1 text-[13px] text-ink/60">{form.intro}</p>}
            </div>
            <div className="space-y-5 px-6 py-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div><label className="mono-label mb-1.5 block text-[9.5px] text-ink/55">Your name</label><input className="w-full border border-hair bg-paper px-3 py-2 text-[13.5px] outline-none focus:border-[#ff3c00]" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} /></div>
                <div><label className="mono-label mb-1.5 block text-[9.5px] text-ink/55">Email</label><input type="email" className="w-full border border-hair bg-paper px-3 py-2 text-[13.5px] outline-none focus:border-[#ff3c00]" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></div>
              </div>
              <RequestFormRenderer form={form} vals={vals} onChange={(k, v) => setVals((s) => ({ ...s, [k]: v }))} />
              {err && <p className="text-[12.5px] text-red-700">{err}</p>}
            </div>
            <div className="flex items-center justify-between border-t border-hair px-6 py-4">
              <p className="text-[11.5px] text-ink/45">Sent straight to Interstellar.</p>
              <button type="submit" disabled={busy || !isComplete(form, vals)} className="h-10 bg-[#ff3c00] px-6 text-[13px] font-medium text-white hover:bg-ink disabled:opacity-40">{busy ? "Sending…" : "Send"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Settings > Field inbox: WhatsApp secrets (names only, existence check), the webhook URL to paste into Meta,
// and the numbers allowed to file things. Secret values never reach the page.
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound, Loader2, Phone, X } from "lucide-react";
import { Panel } from "@/components/financial/finance/ui";
import { fieldStatus, saveNumbers } from "./fieldClient";

const SECRET_USES = {
  WHATSAPP_VERIFY_TOKEN: "Any long random string you also type into Meta's webhook form (verification handshake)",
  WHATSAPP_APP_SECRET: "Meta app > App settings > Basic > App secret (checks X-Hub-Signature-256 on every POST)",
  WHATSAPP_TOKEN: "Permanent System User access token with whatsapp_business_messaging (downloads media, sends replies)",
  WHATSAPP_PHONE_NUMBER_ID: "WhatsApp > API setup > Phone number ID of the Møthership number",
  JUSTIN_WHATSAPP_NUMBERS: "Your own WhatsApp number(s), comma separated, e.g. 15035550100 (or add them below)",
};

function Pill({ ok, yes = "Set", no = "Missing" }) {
  return ok
    ? <span className="mono-label inline-flex items-center gap-1 rounded bg-[#ff3c00]/10 px-1.5 py-0.5 text-[9px] text-[#c23000]"><Check className="h-2.5 w-2.5" />{yes}</span>
    : <span className="mono-label inline-flex items-center gap-1 rounded bg-ink/[0.07] px-1.5 py-0.5 text-[9px] text-ink/55"><X className="h-2.5 w-2.5" />{no}</span>;
}

export default function FieldInboxSettings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["field-inbox", "status"], queryFn: fieldStatus, staleTime: 60_000, retry: false });
  const st = q.data || {};
  const [numbers, setNumbers] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { if (st.allowed) setNumbers((st.allowed.from_settings || []).join(", ")); }, [st.allowed]);

  const copy = async () => { try { await navigator.clipboard.writeText(st.webhook_url || ""); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ } };
  const save = async () => {
    setSaving(true); setMsg("");
    try { const r = await saveNumbers(numbers); setMsg(`Saved ${r.allowed_numbers.length} number${r.allowed_numbers.length === 1 ? "" : "s"}.`); qc.invalidateQueries({ queryKey: ["field-inbox", "status"] }); }
    catch (e) { setMsg(e?.message || "Could not save."); } finally { setSaving(false); }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" data-testid="field-inbox-settings">
      <div className="space-y-5">
        <Panel title="Field inbox · WhatsApp" subtitle="Checks only whether each secret exists. Values are never read into the page, shown or logged." right={q.isLoading ? <Loader2 className="h-4 w-4 animate-spin text-ink/30" /> : <Pill ok={st.ready} yes="Ready" no="Not set up" />}>
          {q.isError && <p className="mb-3 rounded-md bg-red-600/[0.06] px-3 py-2 text-[12px] text-red-700">Couldn&apos;t check: {String(q.error?.message || q.error)}</p>}
          <ul className="divide-y divide-hair rounded-md border border-hair">
            {Object.keys(SECRET_USES).map((name) => (
              <li key={name} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <KeyRound className="h-3.5 w-3.5 shrink-0 text-ink/30" />
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[12px] font-medium">{name}</span>
                  <span className="block text-[11.5px] text-ink/50">{SECRET_USES[name]}</span>
                </span>
                {q.isLoading ? null : <Pill ok={st.secrets?.[name]} no={name === "JUSTIN_WHATSAPP_NUMBERS" ? "Not set" : "Missing"} />}
              </li>
            ))}
            <li className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <KeyRound className="h-3.5 w-3.5 shrink-0 text-ink/30" />
              <span className="min-w-0 flex-1"><span className="block font-mono text-[12px] font-medium">OPENAI_API_KEY <span className="font-sans text-[11px] font-normal text-ink/40">optional</span></span><span className="block text-[11.5px] text-ink/50">Transcribes WhatsApp voice notes on arrival. Without it, Claude transcribes them on the next queue run.</span></span>
              {q.isLoading ? null : <Pill ok={st.optional?.OPENAI_API_KEY} no="Not set" />}
            </li>
          </ul>
        </Panel>

        <Panel title="Webhook URL" subtitle="Paste into Meta: your app > WhatsApp > Configuration > Webhook > Callback URL, with the same verify token. Then subscribe to the messages field.">
          <div className="flex items-stretch gap-2">
            <code className="min-w-0 flex-1 break-all rounded-md border border-hair bg-paper px-3 py-2 font-mono text-[12px]">{st.webhook_url || "https://base44.app/api/apps/69d80bb06c5ad07a795df54e/functions/whatsapp-inbound"}</code>
            <button type="button" onClick={copy} className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-hair px-3 text-[12px] hover:border-ink" aria-label="Copy webhook URL">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy"}</button>
          </div>
        </Panel>
      </div>

      <div className="space-y-5">
        <Panel title="Allowed numbers" subtitle="Only these WhatsApp numbers can file things. Everyone else is ignored silently (no row, no reply).">
          {(st.allowed?.from_secret || []).length > 0 && (
            <p className="mb-3 text-[12px] text-ink/60">From the JUSTIN_WHATSAPP_NUMBERS secret: {(st.allowed.from_secret || []).map((n) => <span key={n} className="mr-2 font-mono">{n}</span>)}</p>
          )}
          <label className="block">
            <span className="mono-label text-[9.5px] text-ink/50">Numbers set here (full international, digits)</span>
            <div className="mt-1.5 flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-ink/35" />
              <input value={numbers} onChange={(e) => setNumbers(e.target.value)} placeholder="15035550100" inputMode="tel" className="h-10 w-full min-w-0 rounded-md border border-hair bg-paper px-3 font-mono text-[13px] outline-none focus:border-[#ff3c00]" />
            </div>
          </label>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" onClick={save} disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-ink px-3 text-[12.5px] text-white hover:bg-[#ff3c00] disabled:opacity-50">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Save numbers</button>
            {msg && <span className="text-[12px] text-ink/60">{msg}</span>}
          </div>
        </Panel>
        <Panel title="How it works">
          <ol className="list-decimal space-y-1.5 pl-4 text-[12.5px] leading-relaxed text-ink/70">
            <li>Save the Møthership WhatsApp number in your phone as a contact named “Møthership”.</li>
            <li>On the glasses: “Hey Meta, send a WhatsApp to Møthership: task: call Miguel tomorrow”.</li>
            <li>task: / idea: / note: are filed directly. build, fix, redo, make, research or write → Claude job. A video with words → site visit. Anything unclear → task Inbox.</li>
            <li>You get a one-line reply on WhatsApp. Nothing is ever published or sent to anyone else.</li>
          </ol>
        </Panel>
      </div>
    </div>
  );
}

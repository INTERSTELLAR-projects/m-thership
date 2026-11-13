import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { X, Check, SkipForward, RotateCcw, ArrowRight, Ban, Send, MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { clock12, toMin, zonedParts, TZ_DEFAULT, PILLAR_BY_ID } from "./engine";
import { getBrief, listActions, act, errMsg } from "./api";
import { chime, speak, stopSpeaking, useListener, useWakeLock, parseSpoken, canListen } from "./voice";
import { KIND_LABEL } from "./NeedsYou";
import { Mono } from "./ui";

// Walk Mode: the earpiece prototype. Chime → spoken brief → each Needs-you item, one at a time.
// Spoken yes/no/skip/next/repeat (or huge buttons). External sends always stop on a screen that shows the exact
// text and wait for a tap: a spoken "yes" can't send anything outside the business.

function briefScript(b) {
  if (!b) return "I couldn't load today's brief.";
  const lines = [b.greeting, b.focus].filter(Boolean);
  if (b.since_yesterday?.length) lines.push(`Since yesterday: ${b.since_yesterday.slice(0, 2).join(" ")}`);
  (b.outcomes || []).forEach((o, i) => lines.push(`${["First", "Second", "Third"][i] || "Next"}: ${o.title}.`));
  const p = zonedParts(new Date(), TZ_DEFAULT);
  const nowMin = p.hour * 60 + p.minute;
  const next = (b.plan_today || []).find((x) => toMin(x.end) > nowMin && !["buffer", "life"].includes(x.kind));
  if (next) lines.push(`Next on the plan, ${clock12(next.start)}: ${next.title}.`);
  return lines.join(" ");
}
function cardScript(c, i, n) {
  const kind = KIND_LABEL[c.kind] || "Item";
  let s = `${i + 1} of ${n}. ${kind}. ${c.title}. ${c.rationale || ""}`;
  if (c.kind === "send_email") s += ` To ${c.payload?.to || "no recipient yet"}. Say yes to review it on screen.`;
  else if (c.kind === "send_sms") s += " Say yes to get it ready for Messages.";
  else if (c.kind === "choice") s += " " + (c.payload?.options || []).map((o, k) => `Option ${k + 1}: ${o.label}.`).join(" ") + " Say one, two or three.";
  else if (c.kind === "question") s += " Say yes, then your answer.";
  else s += " Say yes, no, skip, or repeat.";
  return s;
}

export default function WalkMode() {
  const { user } = useAuth();
  const [phase, setPhase] = useState("idle"); // idle | brief | card | answer | confirm | done
  const [brief, setBrief] = useState(null);
  const [cards, setCards] = useState([]);
  const [i, setI] = useState(0);
  const [heard, setHeard] = useState("");
  const [answer, setAnswer] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const wake = useWakeLock(phase !== "idle" && phase !== "done");
  const card = cards[i];
  const handler = useRef(() => {});

  const listener = useListener({ continuous: true, onFinal: (t) => { setHeard(t); handler.current(t); } });

  const say = useCallback((text, then) => { setNote(""); speak(text, { onend: then }); }, []);
  const next = useCallback((list = cards, k = i + 1) => {
    if (k >= list.length) { setPhase("done"); say("That's everything that needs you. Have a good one."); return; }
    setI(k); setPhase("card"); setAnswer("");
    say(cardScript(list[k], k, list.length));
  }, [cards, i, say]);

  const start = async () => {
    chime();
    setPhase("brief");
    setNote("Loading your brief…");
    let b = null, list = [];
    try { b = (await getBrief(user)).brief; } catch (e) { setNote(errMsg(e)); }
    try { list = await listActions(); } catch { list = []; }
    setBrief(b); setCards(list); setI(0);
    if (canListen()) listener.start();
    say(briefScript(b) + (list.length ? ` ${list.length} ${list.length === 1 ? "thing needs" : "things need"} you.` : " Nothing needs you right now."), () => {
      if (list.length) { setPhase("card"); say(cardScript(list[0], 0, list.length)); } else setPhase("done");
    });
  };

  const run = useCallback(async (fn, label) => {
    setBusy(true);
    try { await fn(); setNote(label); next(); } catch (e) { setNote(errMsg(e)); say(`That didn't work. ${errMsg(e)}`); }
    setBusy(false);
  }, [next, say]);

  const yes = useCallback(() => {
    if (!card || busy) return;
    if (card.kind === "send_email" || card.kind === "send_sms") { setPhase("confirm"); say("Here it is on screen. Tap send if it's right. I won't send it by voice."); return; }
    if (card.kind === "question") { setPhase("answer"); say("Go ahead."); return; }
    if (card.kind === "choice") { say("Say one, two or three."); return; }
    run(() => act("approve", card.id), "Approved");
  }, [card, busy, run, say]);
  const choose = useCallback((k) => { if (card?.kind === "choice" && card.payload?.options?.[k]) run(() => act("approve", card.id, { option: k }), `Chose: ${card.payload.options[k].label}`); }, [card, run]);
  const skip = useCallback(() => { if (card && !busy) run(() => act("skip", card.id), "Skipped"); }, [card, busy, run]);
  const repeat = useCallback(() => { if (phase === "brief") say(briefScript(brief)); else if (card) say(cardScript(card, i, cards.length)); }, [phase, brief, card, i, cards.length, say]);
  const exit = () => { stopSpeaking(); listener.stop(); setPhase("done"); };

  const sendNow = async () => {
    setBusy(true);
    try {
      const res = await act("approve", card.id, { confirm: true });
      if (card.kind === "send_sms" && res?.result?.sms_url) { try { await navigator.clipboard?.writeText(card.payload?.body || ""); } catch { /* blocked */ } window.location.href = res.result.sms_url; }
      setNote(card.kind === "send_sms" ? "Opened in Messages" : `Sent to ${card.payload?.to}`);
      next();
    } catch (e) { setNote(errMsg(e)); }
    setBusy(false);
  };

  handler.current = (t) => {
    // Ignore what the microphone hears while the phone is talking (it would hear itself on a speaker).
    if (typeof window !== "undefined" && window.speechSynthesis?.speaking && parseSpoken(t) !== "stop") return;
    if (phase === "answer") {
      const cmd = parseSpoken(t);
      if (cmd === "stop" || cmd === "skip") { setPhase("card"); return; }
      if (cmd === "yes" && answer) { run(() => act("approve", card.id, { answer }), "Saved to the Brain"); return; }
      const full = (answer ? answer + " " : "") + t;
      setAnswer(full);
      say(`I heard: ${full}. Say yes to save, or keep talking.`);
      return;
    }
    const cmd = parseSpoken(t);
    if (!cmd) return;
    stopSpeaking();
    if (cmd === "stop") exit();
    else if (cmd === "repeat") repeat();
    else if (phase === "confirm") { if (cmd === "no" || cmd === "skip") { setPhase("card"); next(); } else say("Tap send on the screen to send it."); }
    else if (cmd === "yes") yes();
    else if (cmd === "no" || cmd === "skip") skip();
    else if (cmd === "next") next();
    else if (/^[123]$/.test(cmd)) choose(Number(cmd) - 1);
  };

  useEffect(() => () => { stopSpeaking(); }, []);

  const Big = ({ onClick, icon: Icon, children, tone = "light", disabled }) => (
    <button type="button" onClick={onClick} disabled={disabled} className={`flex min-h-[76px] flex-col items-center justify-center gap-1.5 text-[15px] font-medium transition-colors disabled:opacity-40 ${tone === "flame" ? "bg-[#ff3c00] text-white active:bg-[#e03500]" : "border border-white/20 text-white active:bg-white/10"}`}>
      <Icon className="h-5 w-5" />{children}
    </button>
  );

  return (
    // Outer wrapper is the fixed layer: .band-dark sets position: relative, which would override `fixed`.
    <div className="fixed inset-0 z-[150] overflow-y-auto bg-ink">
    <div className="band-dark grain flex min-h-full flex-col text-white" role="application" aria-label="Walk mode">
      <div className="relative z-10 flex items-center justify-between px-5 pt-5">
        <Mono className="text-white/50">Walk mode {wake ? "· screen kept awake" : ""} {listener.listening ? "· listening" : ""}</Mono>
        <Link to="/" onClick={exit} className="p-2 text-white/60 hover:text-white" aria-label="Leave walk mode"><X className="h-5 w-5" /></Link>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col px-5 pb-8 pt-6">
        {phase === "idle" && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <h1 className="text-[34px] font-semibold leading-[1.05] tracking-[-0.04em]">Put the phone in your pocket.<br /><span className="text-[#ff6a00]">I'll brief you.</span></h1>
            <p className="mt-4 max-w-[34ch] text-[14px] text-white/60">A chime, today's brief, then each thing that needs you. Answer yes, no, skip, next or repeat. Sends always wait for a tap.</p>
            <button type="button" onClick={start} className="mt-8 flex h-40 w-40 items-center justify-center rounded-full bg-[#ff3c00] text-[18px] font-semibold text-white shadow-[0_0_80px_-10px_rgba(255,60,0,0.7)] active:scale-95 motion-reduce:transition-none">Start</button>
            {!canListen() && <p className="mt-6 max-w-[36ch] text-[12.5px] text-[#ffaa00]">This browser can't listen, so use the big buttons. It will still read everything aloud.</p>}
          </div>
        )}

        {phase === "brief" && (
          <div className="flex-1">
            <Mono className="text-[#ff6a00]">Your brief</Mono>
            <p className="mt-3 text-[24px] font-semibold leading-snug tracking-[-0.02em]">{brief?.greeting || note}</p>
            <ol className="mt-5 space-y-3">{(brief?.outcomes || []).map((o, k) => <li key={k} className="text-[17px] leading-snug text-white/85"><span className="mr-2 font-mono text-white/40">{k + 1}</span>{o.title}</li>)}</ol>
            <div className="mt-8 grid grid-cols-2 gap-2"><Big icon={RotateCcw} onClick={repeat}>Repeat</Big><Big icon={ArrowRight} tone="flame" onClick={() => { stopSpeaking(); if (cards.length) { setPhase("card"); say(cardScript(cards[0], 0, cards.length)); } else setPhase("done"); }}>Next</Big></div>
          </div>
        )}

        {(phase === "card" || phase === "answer") && card && (
          <div className="flex flex-1 flex-col">
            <Mono className="text-white/50">{i + 1} of {cards.length} · {KIND_LABEL[card.kind]} · {PILLAR_BY_ID[card.pillar]?.name}</Mono>
            <h2 className="mt-3 text-[26px] font-semibold leading-snug tracking-[-0.025em]">{card.title}</h2>
            {card.rationale && <p className="mt-2 text-[15px] leading-snug text-white/65">{card.rationale}</p>}
            {card.kind === "record_change" && <ul className="mt-4 space-y-1 text-[14px] text-white/75">{(card.payload?.changes || []).slice(0, 6).map((c, k) => <li key={k}>· {c.label}</li>)}</ul>}
            {card.kind === "choice" && <div className="mt-4 grid gap-2">{(card.payload?.options || []).map((o, k) => <button key={k} type="button" onClick={() => choose(k)} className="min-h-[60px] border border-white/20 px-4 text-left text-[16px] active:bg-white/10"><span className="mr-3 font-mono text-[#ff6a00]">{k + 1}</span>{o.label}</button>)}</div>}
            {phase === "answer" && <div className="mt-5 border border-white/20 bg-white/[0.04] p-4"><Mono className="text-white/45">Your answer</Mono><p className="mt-1 min-h-[2em] text-[17px]">{answer || listener.interim || "Listening…"}</p>{answer && <button type="button" onClick={() => run(() => act("approve", card.id, { answer }), "Saved to the Brain")} className="mt-3 h-12 w-full bg-[#ff3c00] text-[15px] font-medium">Save answer</button>}</div>}
            <div className="mt-auto grid grid-cols-2 gap-2 pt-8">
              <Big icon={Check} tone="flame" onClick={yes} disabled={busy}>Yes</Big>
              <Big icon={Ban} onClick={skip} disabled={busy}>No</Big>
              <Big icon={SkipForward} onClick={skip} disabled={busy}>Skip</Big>
              <Big icon={RotateCcw} onClick={repeat}>Repeat</Big>
            </div>
          </div>
        )}

        {phase === "confirm" && card && (
          <div className="flex flex-1 flex-col">
            <Mono className="text-[#ff6a00]">Final check · tap to send</Mono>
            <div className="mt-3 border border-white/20 bg-white/[0.05] p-4 text-[15px]">
              <p><span className="text-white/50">{card.kind === "send_sms" ? "Phone" : "To"}: </span><strong>{card.kind === "send_sms" ? card.payload?.phone : card.payload?.to}</strong></p>
              {card.kind === "send_email" && <p className="mt-1"><span className="text-white/50">Subject: </span>{card.payload?.subject}</p>}
              <pre className="mt-3 max-h-[40vh] overflow-auto whitespace-pre-wrap border-t border-white/15 pt-3 font-sans leading-relaxed text-white/85">{card.payload?.body}</pre>
            </div>
            <div className="mt-auto grid grid-cols-2 gap-2 pt-6">
              <Big icon={card.kind === "send_sms" ? MessageSquare : Send} tone="flame" onClick={sendNow} disabled={busy || (card.kind === "send_email" && !card.payload?.to)}>{card.kind === "send_sms" ? "Open in Messages" : "Send"}</Big>
              <Big icon={X} onClick={() => { setPhase("card"); next(); }}>Not now</Big>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <h2 className="text-[30px] font-semibold tracking-[-0.03em]">All clear.</h2>
            <p className="mt-2 text-[14px] text-white/60">Everything that needed you has been handled or set aside.</p>
            <div className="mt-8 flex gap-2"><button type="button" onClick={start} className="h-12 border border-white/25 px-5 text-[14px]">Run it again</button><Link to="/" className="flex h-12 items-center bg-[#ff3c00] px-5 text-[14px] font-medium">Back to Today</Link></div>
          </div>
        )}

        {(heard || note || listener.error) && phase !== "idle" && (
          <div className="mt-6 border-t border-white/10 pt-3 text-[12.5px] text-white/50" aria-live="polite">
            {heard && <p>Heard: “{heard}”</p>}{note && <p>{note}</p>}{listener.error && <p className="text-[#ffaa00]">{listener.error}</p>}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

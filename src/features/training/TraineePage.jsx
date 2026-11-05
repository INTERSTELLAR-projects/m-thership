// Public trainee page: /t/<assignment id>?k=<token>. No login; the token only opens this one trainee's track.
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import BrandLockup from "@/components/brand/BrandLockup";
import TrainingPlayer from "./TrainingPlayer";
import { playerCall } from "./api";

export default function TraineePage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const k = sp.get("k") || "";
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    playerCall("load", { id, k }).then((d) => { if (alive) { setData(d); document.title = `${d.track?.title || "Training"} · ${d.business || ""}`; } }).catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [id, k]);

  if (err) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-canvas px-6 text-center text-ink">
        <div className="max-w-sm">
          <div className="flex justify-center"><BrandLockup word="TRAINING" sub="powered by Interstellar" size={16} /></div>
          <p className="mt-8 text-[20px] font-semibold tracking-[-0.03em]">We couldn&apos;t open your training.</p>
          <p className="mt-2 text-[14px] text-ink/60">{err}</p>
        </div>
      </div>
    );
  }
  if (!data) return <div className="grid min-h-[100dvh] place-items-center bg-canvas"><Loader2 className="h-6 w-6 animate-spin text-ink/40" /></div>;

  return (
    <TrainingPlayer
      key={data.assignment?.id}
      data={data}
      mode="trainee"
      onSave={async (args) => { const d = await playerCall("save", { id, k, ...args }); return d; }}
      onAsk={async (module_id, text) => playerCall("ask", { id, k, module_id, text })}
    />
  );
}

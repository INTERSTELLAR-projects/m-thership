import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import QrLibrary from "./QrLibrary";
import QrEditor from "./QrEditor";
import { portalStore } from "./lib/qrStore";

// Client portal: the client's own QR codes. Everything goes through the `portal` function (qr_* actions),
// which scopes every read and write to this client.
// openId: open this code's editor straight away (e.g. a review QR just made on the Google Business tab).
export default function PortalQr({ call, previewId, openId = null }) {
  const store = useMemo(() => portalStore(call), [call]);
  const qc = useQueryClient();
  const scopeKey = `portal:${previewId || "me"}`;
  const [editing, setEditing] = useState(() => (openId ? { id: openId } : null)); // { id, start }

  const close = () => {
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["qr-list", scopeKey] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-cross">(Bonus tool)</p>
          <h2 className="mt-2 text-[32px] font-semibold tracking-[-0.04em]">QR codes</h2>
          <p className="mt-1 max-w-2xl text-[14px] text-ink/60">
            On-brand QR codes for your storefront, flyers, menus and review cards. Make them dynamic to change where they point after printing and see every scan.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 flame-bg px-3 py-1.5 text-[12px] font-medium text-white">
          <Gift className="h-3.5 w-3.5" /> Free for life with Interstellar
        </span>
      </div>
      <QrLibrary
        store={store}
        scopeKey={scopeKey}
        onOpen={(c) => setEditing({ id: c.id })}
        onNew={({ folder }) => setEditing({ id: null, start: { folder } })}
      />
      {editing && (
        <div className="fixed inset-0 z-50 bg-canvas">
          <QrEditor
            store={store}
            id={editing.id}
            start={editing.start || {}}
            onExit={close}
            onCreated={(r) => setEditing({ id: r.id })}
            fullHeight
          />
        </div>
      )}
    </div>
  );
}

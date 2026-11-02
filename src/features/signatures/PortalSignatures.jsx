import React, { useMemo, useState } from "react";
import SignatureLibrary from "@/features/signatures/SignatureLibrary";
import SignatureEditor from "@/features/signatures/SignatureEditor";
import { portalStore } from "@/features/signatures/lib/signatureStore";

// Client portal: the team's own email signatures and templates, organized into projects.
// New signatures start from the client's default template (or Interstellar's default),
// pre-filled with the client's company, logo, website, slogan and brand colours.
export default function PortalSignatures({ call }) {
  const store = useMemo(() => portalStore(call), [call]);
  const [editing, setEditing] = useState(null); // { mode, id, start }
  const [libKey, setLibKey] = useState(0);
  const [tab, setTab] = useState("signatures");

  const close = () => {
    setEditing(null);
    setLibKey((k) => k + 1);
  };

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-[22px] font-semibold tracking-[-0.03em]">Email signatures</h2>
        <p className="text-[13px] text-ink/60 mt-1">
          Make animated email signatures for everyone on your team. Each one starts from your default design with your logo and brand already in place.
          Save designs as templates and organize them into projects.
        </p>
      </div>
      <SignatureLibrary
        key={libKey}
        store={store}
        initialTab={tab}
        onOpen={(s) => setEditing({ mode: "signature", id: s.id })}
        onNew={({ templateId, folder }) => {
          setTab("signatures");
          setEditing({ mode: "signature", id: null, start: { templateId, folder } });
        }}
        onOpenTemplate={(t) => {
          setTab("templates");
          setEditing({ mode: "template", id: t.id });
        }}
        onNewTemplate={({ folder }) => {
          setTab("templates");
          setEditing({ mode: "template", id: null, start: { folder } });
        }}
      />
      {editing && (
        <div className="fixed inset-0 z-50 bg-background">
          <SignatureEditor
            key={`${editing.mode}-${editing.id || "new"}`}
            store={store}
            mode={editing.mode}
            id={editing.id}
            start={editing.start || {}}
            onExit={close}
            height="100vh"
          />
        </div>
      )}
    </div>
  );
}

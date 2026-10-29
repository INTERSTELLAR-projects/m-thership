import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Mail, CheckCircle2 } from "lucide-react";

const steps = {
  gmail: [
    "Open Gmail and click the gear icon (Settings) in the top right.",
    "Click 'See all settings', then the 'General' tab.",
    "Scroll down to the Signature section and click 'Create new'.",
    "Name your signature, then paste (Cmd/Ctrl+V) into the box.",
    "Scroll to the bottom and click 'Save Changes'.",
  ],
  outlook_web: [
    "Open Outlook on the web and click the gear icon (Settings).",
    "Go to Mail > Compose and reply.",
    "Under Email signature, paste (Cmd/Ctrl+V) your signature.",
    "Click 'Save' at the bottom.",
  ],
  outlook_desktop: [
    "Open the Outlook desktop app.",
    "Go to File > Options > Mail > Signatures.",
    "Click 'New', name it, then paste (Cmd/Ctrl+V) into the edit box.",
    "Select it as your default signature and click OK.",
  ],
  apple: [
    "Open the Mail app and go to Mail > Settings (or Preferences).",
    "Click the 'Signatures' tab and click the '+' to add one.",
    "Paste (Cmd+V) your signature into the right-hand editor.",
    "Drag the signature onto the mailbox you want to use it for.",
  ],
};

function StepList({ title, items }) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
        <Mail className="w-4 h-4 text-[#ff3c00]" /> {title}
      </h4>
      <ol className="space-y-1.5 mb-5">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-[#ff3c00] shrink-0 mt-0.5" />
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function InstallInstructionsModal({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Signature copied — now install it</DialogTitle>
          <DialogDescription>
            Your formatted signature is on your clipboard. Paste it into your email client's signature settings.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2">
          <StepList title="Gmail" items={steps.gmail} />
          <StepList title="Outlook (web)" items={steps.outlook_web} />
          <StepList title="Outlook (desktop)" items={steps.outlook_desktop} />
          <StepList title="Apple Mail" items={steps.apple} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

import React from 'react';

// Shown when a signed-in email has no access. House look: canvas, hairline card, mono kicker, orange slash.
const UserNotRegisteredError = () => {
  return (
    <div className="grid-canvas flex min-h-screen flex-col items-center justify-center p-6 text-ink">
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-hair bg-card">
        <div className="h-[3px] flame-bg" />
        <div className="p-8 text-center">
          <p className="label-cross justify-center">(Access)</p>
          <h1 className="mt-4 text-[32px] font-semibold leading-[1.02] tracking-[-0.045em]">Access <span className="text-[#ff3c00]">/restricted</span></h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-ink/60">
            This email isn't set up for Møthership yet. Ask Interstellar Strategies for access.
          </p>
          <div className="mt-6 rounded-md border border-hair bg-paper p-4 text-left text-[13px] text-ink/65">
            <p className="mono-label text-[9.5px] text-ink/45">If this looks wrong</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Check you signed in with the right email</li>
              <li>Ask us to add your email</li>
              <li>Sign out and back in again</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;

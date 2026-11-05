// Portal > Studios > Training (HyperCare+, switched on). Locked plans and previews never reach this component:
// PortalApp shows the Studio preview page instead (PortalStudios.jsx, key "training").
import TrainingWorkspace from "./TrainingWorkspace";

export default function PortalTraining({ scopeId, business }) {
  return (
    <div className="space-y-6" data-portal-training>
      <div>
        <p className="label-cross">(People · Training)</p>
        <h1 className="mt-2 text-[32px] font-semibold leading-[1.02] tracking-[-0.04em] md:text-[44px]">Train new people <span className="text-[#ff3c00]">your way.</span></h1>
        <p className="mt-2 max-w-2xl text-[14.5px] text-ink/60">Turn {business ? `${business}'s` : "your"} processes into step-by-step training a new hire finishes on their phone: a short lesson, hands-on tasks, a quick check, then the next step. You see who&apos;s on track, who&apos;s stuck, and sign them off.</p>
      </div>
      <TrainingWorkspace scopeId={scopeId} portal />
    </div>
  );
}

// Small "% profile" badge for the clients list (Client Criteria completeness).
export default function CompletenessBadge({ pct }) {
  if (pct == null) return null;
  const tone = pct >= 80 ? "border-green-600/25 bg-green-600/[0.07] text-green-800" : pct >= 50 ? "border-[#ff6a00]/30 bg-[#ff6a00]/[0.08] text-[#c24100]" : "border-[#ff3c00]/30 bg-[#ff3c00]/[0.07] text-[#c23000]";
  return <span title="Client profile completeness (Client Criteria)" className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${tone}`}>{pct}% profile</span>;
}

// App-wide error boundary: one bad response or a broken card shows a small in-place notice with Try again,
// instead of blanking the whole page. Used around every admin route (Layout), the client portal and big cards.
import { Component } from "react";
import { base44 } from "@/api/base44Client";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Best effort, admin-only entity: a client session simply can't write it, which is fine.
    const now = new Date().toISOString();
    base44.entities.AutomationRun?.create({
      automation_name: "UI error", kind: "other", status: "failed", started_at: now, finished_at: now, processed: true,
      title: `${this.props.where || "page"}: ${String(error?.message || error).slice(0, 160)}`,
      message: `${typeof window !== "undefined" ? window.location.pathname : ""} · ${String(info?.componentStack || "").split("\n").slice(0, 4).join(" ").slice(0, 400)}`,
    }).catch(() => null);
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.reset();
  }

  reset() {
    this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.compact) {
      return (
        <div role="alert" className="border border-hair bg-card px-4 py-3 text-[12.5px] text-ink/60">
          This section couldn&apos;t load. <button type="button" onClick={this.reset} className="font-medium text-[#ff3c00] hover:underline">Try again</button>
        </div>
      );
    }
    return (
      <div role="alert" className="mx-auto my-12 max-w-md border border-hair bg-card px-6 py-6 text-center">
        <p className="mono-label text-[10px] text-[#ff3c00]">Something went wrong</p>
        <p className="mt-2 text-[15px] font-semibold tracking-[-0.02em]">This page hit a snag while loading.</p>
        <p className="mt-1 text-[12.5px] text-ink/55">The rest of the app is fine. Try again, or come back in a minute.</p>
        <div className="mt-4 flex justify-center gap-2">
          <button type="button" onClick={this.reset} className="h-9 bg-[#ff3c00] px-4 text-[13px] font-medium text-white hover:bg-ink">Try again</button>
          <button type="button" onClick={() => window.location.reload()} className="h-9 border border-hair px-4 text-[13px] hover:border-ink/30">Reload</button>
        </div>
      </div>
    );
  }
}

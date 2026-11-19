import { useLocation } from 'react-router-dom';

// 404 in the house look (canvas, grid, mono kicker, Geist headline with the orange slash, square CTA).
export default function PageNotFound() {
    const location = useLocation();
    const pageName = location.pathname.substring(1);

    return (
        <div className="grid-canvas flex min-h-screen items-center justify-center p-6 text-ink">
            <div className="w-full max-w-md text-center">
                <p className="label-cross justify-center">(404)</p>
                <h1 className="mt-4 text-[44px] font-semibold leading-[0.98] tracking-[-0.05em]">
                    Page not <span className="text-[#ff3c00]">/found</span>
                </h1>
                <p className="mt-4 text-[14.5px] leading-relaxed text-ink/60">
                    There is no page at <span className="font-mono text-[12.5px] text-ink/80">/{pageName}</span>. It may have moved, or the link is out of date.
                </p>
                <button
                    type="button"
                    onClick={() => { window.location.href = '/'; }}
                    className="mt-8 inline-flex h-10 items-center gap-2 px-4 text-[13px] font-semibold tracking-[-0.01em] text-white transition-transform duration-200 hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3c00] focus-visible:ring-offset-2"
                    style={{ background: 'linear-gradient(90deg,#ff3c00,#ff6a00 55%,#ffaa00)', boxShadow: '0 8px 20px -10px rgba(255,60,0,.9)' }}
                >
                    Go home &rarr;
                </button>
            </div>
        </div>
    );
}

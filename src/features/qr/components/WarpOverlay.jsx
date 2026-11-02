import { AnimatePresence, motion } from "framer-motion";

const STREAKS = Array.from({ length: 28 }, (_, i) => ({ deg: (i * 360) / 28 + ((i * 37) % 9), delay: ((i * 53) % 10) / 40, len: 34 + ((i * 29) % 18) }));
const RINGS = [0, 1, 2, 3];

// The "wormhole" warp: hyperspace streaks + expanding flame rings, played when a code is generated.
export default function WarpOverlay({ active, label = "Wormhole open" }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="absolute inset-0 bg-[#07070d]/90" />
          <div className="absolute left-1/2 top-1/2">
            {STREAKS.map((s, i) => (
              <div key={i} className="absolute left-0 top-0" style={{ transform: `rotate(${s.deg}deg)` }}>
                <motion.div
                  className="h-[2px] origin-left"
                  style={{ width: `${s.len}vmin`, background: "linear-gradient(90deg, rgba(255,170,0,0), #ffaa00 60%, #ffffff)" }}
                  initial={{ scaleX: 0, x: 8, opacity: 0 }}
                  animate={{ scaleX: [0, 1, 0.2], x: [8, 40, 160], opacity: [0, 1, 0] }}
                  transition={{ duration: 1.1, delay: s.delay, ease: "easeIn" }}
                />
              </div>
            ))}
          </div>
          {RINGS.map((i) => (
            <motion.div
              key={i}
              className="absolute left-1/2 top-1/2 h-40 w-40 rounded-full border-2"
              style={{ marginLeft: -80, marginTop: -80, borderColor: i % 2 ? "#ff6a00" : "#ff3c00", boxShadow: "0 0 24px rgba(255,106,0,0.55)" }}
              initial={{ scale: 0.05, opacity: 0 }}
              animate={{ scale: [0.05, 2.8], opacity: [0, 1, 0] }}
              transition={{ duration: 1.2, delay: 0.12 * i, ease: "easeOut" }}
            />
          ))}
          <motion.div
            className="absolute left-1/2 top-1/2 h-24 w-24 rounded-full"
            style={{ marginLeft: -48, marginTop: -48, background: "radial-gradient(circle, #ffffff 0%, #ffaa00 35%, #ff3c00 60%, rgba(255,60,0,0) 72%)" }}
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: [0.2, 1.4, 0.6], opacity: [0, 1, 0] }}
            transition={{ duration: 1.1 }}
          />
          <motion.p
            className="mono-label absolute inset-x-0 bottom-6 text-center text-[11px] text-white/85"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {label}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

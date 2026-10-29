import React, { useEffect, useRef } from "react";

export default function WebcamOrb({ stream, size = 124 }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    video.srcObject = stream;
    if (stream) video.play().catch(() => {});
    return () => {
      if (video) video.srcObject = null;
    };
  }, [stream]);

  if (!stream) return null;

  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="relative">
        <span className="tk-pulse absolute -inset-1 rounded-full border border-[#ffaa00]/60" />
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className="rounded-full object-cover"
          style={{ width: size * 0.56, height: size * 0.56, transform: "scaleX(-1)" }}
        />
      </div>
    </div>
  );
}

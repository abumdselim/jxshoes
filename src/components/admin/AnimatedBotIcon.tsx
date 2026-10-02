'use client';

/**
 * AnimatedBotIcon — জীবন্ত lucide "bot" আইকন
 * - চোখ দুটো এদিক-ওদিক তাকায় আর মাঝে মাঝে দ্বিগুণ পলক ফেলে
 * - requestAnimationFrame দিয়ে চলে, তাই সিস্টেমের reduced-motion সেটিং
 *   থাকলেও অ্যানিমেশন বন্ধ হয় না (CSS অ্যানিমেশন সেখানে বন্ধ হয়ে যায়)
 * - রঙ currentColor থেকে
 */

import React, { useEffect, useRef } from 'react';

export default function AnimatedBotIcon({ className = '' }: { className?: string }) {
  const lookRef = useRef<SVGGElement>(null);
  const eyeRefs = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = (now - start) / 1000;

      // চঞ্চল তাকানো — ৬ সেকেন্ড চক্রে কেন্দ্র → বাঁয়ে → ডানে → বাঁয়ে → কেন্দ্র
      const lookPhase = t % 6;
      let dx = 0;
      if (lookPhase >= 1.0 && lookPhase < 2.2) dx = -3;
      else if (lookPhase >= 2.6 && lookPhase < 3.6) dx = 3;
      else if (lookPhase >= 4.0 && lookPhase < 4.8) dx = -3;
      if (lookRef.current) lookRef.current.style.transform = `translateX(${dx}px)`;

      // পলক — ২.৮ সেকেন্ড চক্রে টানা দুবার চোখ বন্ধ
      const blinkPhase = t % 2.8;
      const closed =
        (blinkPhase >= 1.3 && blinkPhase < 1.42) || (blinkPhase >= 1.55 && blinkPhase < 1.67);
      const sy = closed ? 0.08 : 1;
      for (const eye of eyeRefs.current) {
        if (eye) eye.style.transform = `scaleY(${sy})`;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <g ref={lookRef} style={{ transformBox: 'fill-box' }}>
        <path
          ref={(el) => {
            eyeRefs.current[0] = el;
          }}
          d="M9 13v2"
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />
        <path
          ref={(el) => {
            eyeRefs.current[1] = el;
          }}
          d="M15 13v2"
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />
      </g>
    </svg>
  );
}

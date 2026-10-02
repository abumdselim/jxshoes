'use client';

/**
 * AnimatedBotIcon — জীবন্ত lucide "bot" আইকন
 * - চোখ বাঁয়ে-ডানে ছাড়াও উপরে-নিচে তাকায়; মাঝে মাঝে দ্বিগুণ পলক
 * - চোখ যেদিকে তাকায় বডিটাও সেদিকে হালকা ঝোঁকে (মসৃণ ফলো)
 * - requestAnimationFrame দিয়ে চলে, তাই সিস্টেমের reduced-motion সেটিং
 *   থাকলেও অ্যানিমেশন বন্ধ হয় না (CSS অ্যানিমেশন সেখানে বন্ধ হয়ে যায়)
 * - রঙ currentColor থেকে; strokeWidth প্রপে বোল্ডনেস নিয়ন্ত্রণ হয়
 */

import React, { useEffect, useRef } from 'react';

interface Props {
  className?: string;
  strokeWidth?: number;
}

export default function AnimatedBotIcon({ className = '', strokeWidth = 2 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const lookRef = useRef<SVGGElement>(null);
  const eyeRefs = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    let curAngle = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = (now - start) / 1000;

      // ৭ সেকেন্ড চক্র: কেন্দ্র → বাঁয়ে → কেন্দ্র → উপরে → কেন্দ্র → ডানে → কেন্দ্র → নিচে → কেন্দ্র
      const p = t % 7;
      let dx = 0;
      let dy = 0;
      if (p >= 0.8 && p < 1.8) { dx = -3; dy = 0; }
      else if (p >= 2.4 && p < 3.2) { dx = 0; dy = -2.2; }
      else if (p >= 3.8 && p < 4.8) { dx = 3; dy = 0; }
      else if (p >= 5.3 && p < 6.1) { dx = 0; dy = 2.2; }

      // বডি অনুসরণ — চোখের দিকে হালকা ঝোঁক (মসৃণ লার্প)
      const targetAngle = dx === -3 ? -6 : dx === 3 ? 6 : 0;
      curAngle += (targetAngle - curAngle) * 0.08;
      if (lookRef.current) lookRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
      if (svgRef.current) svgRef.current.style.transform = `rotate(${curAngle.toFixed(2)}deg)`;

      // পলক — ২.৮ সেকেন্ড চক্রে টানা দুবার চোখ বন্ধ
      const bp = t % 2.8;
      const closed =
        (bp >= 1.3 && bp < 1.42) || (bp >= 1.55 && bp < 1.67);
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
      ref={svgRef}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ transformOrigin: 'center' }}
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

'use client';

/**
 * AnimatedBotIcon — মোশন-সংস্করণ lucide "bot" আইকন
 * - চোখ দুটো এদিক-ওদিক তাকায়, মাঝে মাঝে পলক ফেলে (স্কেল-ব্লিংক)
 * - রঙ currentColor থেকে
 */

import React from 'react';

export default function AnimatedBotIcon({ className = '' }: { className?: string }) {
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
      <g className="bot-look">
        <path d="M9 13v2" className="bot-eye" />
        <path d="M15 13v2" className="bot-eye" />
      </g>
    </svg>
  );
}

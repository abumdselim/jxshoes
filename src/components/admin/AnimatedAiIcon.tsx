'use client';

/**
 * AnimatedAiIcon — মোশন-সংস্করণ AI স্পার্কল আইকন (lucide "sparkles"-এর কপি)
 * - বড় তারাটা ধীরে এদিক-ওদিক তাকায় (বাঁয়ে থেমে → ডানে থেমে → ফিরে আসে)
 * - ছোট তারা দুটো ঝিকমিক করে, পুরো আইকনটা হালকা ভাসে
 * রঙ currentColor থেকে — সাদা দিতে হলে text-white ক্লাস দিন।
 */

import React from 'react';

export default function AnimatedAiIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`ai-float ${className}`}
      aria-hidden="true"
    >
      <g className="ai-look">
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      </g>
      <g className="ai-twinkle-1">
        <path d="M20 3v4" />
        <path d="M22 5h-4" />
      </g>
      <g className="ai-twinkle-2">
        <path d="M4 17v2" />
        <path d="M5 18H3" />
      </g>
    </svg>
  );
}

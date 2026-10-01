import React from 'react';

interface CartIconProps {
  className?: string;
  size?: number;
}

/**
 * Solid, color-filled Shopping Cart (Trolley) icon.
 * Engineered for clean vector rendering and vibrant color filling (via text-* / fill="currentColor").
 * Solves the issue where stroke-based icons turn into featureless blobs when filled.
 */
export default function CartIcon({ className = 'w-5 h-5 text-orange-600', size }: CartIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      {/* Trolley basket and handle */}
      <path d="M2.25 2.25a.75.75 0 0 0 0 1.5h1.386c.17 0 .318.114.362.278l2.558 9.592a3.752 3.752 0 0 0-2.806 3.63c0 .414.336.75.75.75h15.75a.75.75 0 0 0 0-1.5H5.78a2.25 2.25 0 0 1 2.25-2.25h10.97a2.25 2.25 0 0 0 2.18-1.706l1.458-5.832A1.5 1.5 0 0 0 21.186 5.5H6.28l-.348-1.306A1.875 1.875 0 0 0 4.116 2.25H2.25Z" />
      {/* Front and rear wheels */}
      <circle cx="8.25" cy="20.25" r="1.75" />
      <circle cx="17.25" cy="20.25" r="1.75" />
    </svg>
  );
}

/**
 * Solid, color-filled Shopping Bag icon with hollow top handle arch and cutout front loop.
 */
export function BagIcon({ className = 'w-5 h-5 text-orange-600', size }: CartIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M7.5 6v.75H5.513c-.96 0-1.764.724-1.865 1.679l-1.263 12A1.875 1.875 0 0 0 4.25 22.5h15.5a1.875 1.875 0 0 0 1.865-2.071l-1.263-12a1.875 1.875 0 0 0-1.865-1.679H16.5V6a4.5 4.5 0 1 0-9 0ZM12 3a3 3 0 0 0-3 3v.75h6V6a3 3 0 0 0-3-3Zm-3 8.25a3 3 0 1 0 6 0v-.75a.75.75 0 0 1 1.5 0v.75a4.5 4.5 0 1 1-9 0v-.75a.75.75 0 0 1 1.5 0v.75Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

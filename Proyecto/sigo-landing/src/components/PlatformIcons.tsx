import React from 'react';

interface IconProps {
  className?: string;
}

export const WindowsIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Windows">
    <path d="M3 5.548L10.354 4.5v7.09H3V5.548zm0 12.904l7.354 1.048v-7.018H3v5.97zm8.246 1.174L21 21v-8.518h-9.754v7.144zm0-15.252v7.216H21V3l-9.754 1.374z" />
  </svg>
);

export const AppleMacIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="macOS">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.33c.67-.81 1.12-1.94 1-3.08-.96.04-2.13.64-2.82 1.45-.61.7-.15 1.85-1.01 2.97 1.08.08 2.16-.53 2.83-1.34z" />
  </svg>
);

export const AndroidIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Android">
    <path d="M17.523 15.341a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zm-11.046 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zm11.405-6.02 1.997-3.46a.416.416 0 0 0-.152-.567.416.416 0 0 0-.568.152l-2.022 3.503C15.616 8.25 13.86 7.86 12 7.86c-1.86 0-3.616.39-5.137 1.089L4.841 5.446a.416.416 0 0 0-.568-.152.416.416 0 0 0-.152.567l1.997 3.46C2.688 11.186.343 14.658 0 18.761h24c-.343-4.103-2.688-7.575-6.118-9.44z" />
  </svg>
);

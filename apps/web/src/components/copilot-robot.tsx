/** Mascot ILV Copilot — SVG alpha thật, không nền caro/ảnh lỗi. */
export function CopilotRobot({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 260"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Trợ lý AI ILV"
    >
      <defs>
        <linearGradient id="ilrBody" x1="50" y1="10" x2="170" y2="240" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#F4F7FC" />
          <stop offset="1" stopColor="#DCE5F5" />
        </linearGradient>
        <linearGradient id="ilrEye" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#A5F3FC" />
          <stop offset="1" stopColor="#06B6D4" />
        </linearGradient>
        <linearGradient id="ilrBadge" x1="90" y1="120" x2="130" y2="160" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60A5FA" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
        <filter id="ilrShadow" x="-30%" y="-10%" width="160%" height="140%">
          <feDropShadow dx="0" dy="14" stdDeviation="10" floodColor="#020617" floodOpacity="0.45" />
        </filter>
      </defs>

      {/* bóng dưới chân — không phải nền ảnh */}
      <ellipse cx="110" cy="248" rx="52" ry="9" fill="#020617" opacity="0.28" />

      <g filter="url(#ilrShadow)">
        {/* chân */}
        <rect x="76" y="178" width="28" height="48" rx="14" fill="url(#ilrBody)" />
        <rect x="116" y="178" width="28" height="48" rx="14" fill="url(#ilrBody)" />
        <path
          d="M72 216c0-6 5-10 12-10h16c7 0 12 4 12 10v10c0 6-5 10-12 10H84c-7 0-12-4-12-10v-10z"
          fill="#EEF2FF"
        />
        <path
          d="M112 216c0-6 5-10 12-10h16c7 0 12 4 12 10v10c0 6-5 10-12 10h-16c-7 0-12-4-12-10v-10z"
          fill="#EEF2FF"
        />
        <rect x="78" y="230" width="20" height="4" rx="2" fill="#22D3EE" opacity="0.9" />
        <rect x="122" y="230" width="20" height="4" rx="2" fill="#22D3EE" opacity="0.9" />

        {/* thân */}
        <rect x="64" y="104" width="92" height="86" rx="32" fill="url(#ilrBody)" />
        <circle cx="110" cy="140" r="20" fill="url(#ilrBadge)" />
        <circle cx="110" cy="140" r="20" stroke="#93C5FD" strokeWidth="2" opacity="0.7" />
        <text
          x="110"
          y="147"
          textAnchor="middle"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontSize="17"
          fontWeight="800"
          fill="#FFFFFF"
        >
          il
        </text>

        {/* tay trái */}
        <g transform="translate(0,4)">
          <rect
            x="34"
            y="112"
            width="24"
            height="56"
            rx="12"
            fill="url(#ilrBody)"
            transform="rotate(8 46 140)"
          />
          <circle cx="38" cy="172" r="11" fill="#F8FAFC" />
          <rect x="32" y="176" width="12" height="3" rx="1.5" fill="#22D3EE" />
        </g>

        {/* tay phải vẫy */}
        <g transform="rotate(-42 170 96)">
          <rect x="156" y="58" width="24" height="62" rx="12" fill="url(#ilrBody)" />
          <circle cx="168" cy="54" r="12" fill="#F8FAFC" />
          <rect x="162" y="48" width="12" height="3" rx="1.5" fill="#22D3EE" />
        </g>

        {/* đầu */}
        <rect x="68" y="28" width="84" height="80" rx="32" fill="url(#ilrBody)" />
        {/* tai / headset */}
        <ellipse cx="66" cy="68" rx="10" ry="14" fill="#E2E8F0" />
        <ellipse cx="154" cy="68" rx="10" ry="14" fill="#E2E8F0" />
        <path d="M66 78h-8c-4 0-7 3-7 7v18c0 3 2 5 5 5h4" stroke="#94A3B8" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* anten */}
        <line x1="110" y1="28" x2="110" y2="18" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
        <circle cx="110" cy="14" r="6" fill="#22D3EE" />
        <circle cx="110" cy="14" r="2.5" fill="#ECFEFF" />

        {/* mặt */}
        <rect x="82" y="50" width="56" height="40" rx="16" fill="#0B1220" />
        <circle cx="98" cy="68" r="8" fill="url(#ilrEye)" />
        <circle cx="122" cy="68" r="8" fill="url(#ilrEye)" />
        <circle cx="96" cy="66" r="2.5" fill="#F0FDFF" />
        <circle cx="120" cy="66" r="2.5" fill="#F0FDFF" />
        <path
          d="M100 80c4 4 12 4 16 0"
          stroke="#67E8F9"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  );
}

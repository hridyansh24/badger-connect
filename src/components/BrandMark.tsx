type BrandMarkProps = {
  className?: string
  title?: string
}

const BrandMark = ({ className, title }: BrandMarkProps) => (
  <svg
    viewBox="0 0 120 90"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    role={title ? 'img' : 'presentation'}
    aria-label={title}
    aria-hidden={title ? undefined : true}
  >
    <defs>
      <linearGradient id="bm-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ff3b4e" />
        <stop offset="55%" stopColor="#c5050c" />
        <stop offset="100%" stopColor="#ffcc33" />
      </linearGradient>
      <filter id="bm-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.4" result="b1" />
        <feMerge>
          <feMergeNode in="b1" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <path
      d="M 10 13 Q 11 11 13 13 L 33 68 Q 34 72 37 69 L 58 31 Q 60 28 62 31 L 83 69 Q 86 72 87 68 L 107 13 Q 109 11 110 13"
      fill="none"
      stroke="url(#bm-grad)"
      strokeWidth="11"
      strokeLinecap="round"
      strokeLinejoin="round"
      filter="url(#bm-glow)"
    />
    <path
      d="M 10 13 Q 11 11 13 13 L 33 68 Q 34 72 37 69 L 58 31 Q 60 28 62 31 L 83 69 Q 86 72 87 68 L 107 13 Q 109 11 110 13"
      fill="none"
      stroke="rgba(255,255,255,0.9)"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.7"
    />
    <circle cx="104" cy="82" r="2.4" fill="#ffcc33">
      <animate attributeName="opacity" values="0.3;1;0.3" dur="2.4s" repeatCount="indefinite" />
    </circle>
  </svg>
)

export default BrandMark

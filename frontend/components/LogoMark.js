export default function LogoMark({ size = 38 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="11" fill="#6B3FA0" />
      <rect x="9" y="12" width="22" height="18" rx="3" fill="white" />
      <rect x="9" y="12" width="22" height="5" rx="2" fill="#4FB3E8" />
      <rect x="13" y="21" width="4" height="4" rx="1" fill="#EDE4F5" />
      <rect x="19" y="21" width="4" height="4" rx="1" fill="#EDE4F5" />
      <rect x="25" y="21" width="4" height="4" rx="1" fill="#4FB3E8" />
      <circle cx="30" cy="30" r="7" fill="#D85A6A" stroke="white" strokeWidth="2" />
      <path d="M27 30l2 2 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

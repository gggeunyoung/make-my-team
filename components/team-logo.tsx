type TeamLogoProps = {
  src: string;
  alt: string;
  className?: string;
  rounded?: "full" | "xl" | "lg";
};

const roundedClass = {
  full: "rounded-full",
  xl: "rounded-xl",
  lg: "rounded-lg",
} as const;

/** 팀 로고 표시용 — PNG 투명 배경이 팀 색과 겹치지 않도록 흰색 컨테이너만 적용 */
export function TeamLogo({
  src,
  alt,
  className = "h-10 w-10",
  rounded = "full",
}: TeamLogoProps) {
  const radius = roundedClass[rounded];

  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden bg-white ${radius} ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    </span>
  );
}

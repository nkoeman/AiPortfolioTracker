"use client";

type AppIconName =
  | "performance"
  | "portfolio"
  | "transactions"
  | "insights"
  | "search"
  | "bell"
  | "moon"
  | "refresh"
  | "chevron-down";

type AppIconProps = {
  name: AppIconName;
  size?: number;
  stroke?: number;
  className?: string;
};

export function AppIcon({ name, size = 16, stroke = 1.6, className }: AppIconProps) {
  const shared = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className
  };

  switch (name) {
    case "performance":
      return (
        <svg {...shared}>
          <path d="M3 17l5-5 4 4 8-9" />
          <path d="M14 7h6v6" />
        </svg>
      );
    case "portfolio":
      return (
        <svg {...shared}>
          <path d="M3 9.5L12 4l9 5.5" />
          <path d="M5 10v9h14v-9" />
          <path d="M10 19v-5h4v5" />
        </svg>
      );
    case "transactions":
      return (
        <svg {...shared}>
          <path d="M4 7h12l-3-3" />
          <path d="M20 17H8l3 3" />
        </svg>
      );
    case "insights":
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
        </svg>
      );
    case "search":
      return (
        <svg {...shared}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      );
    case "bell":
      return (
        <svg {...shared}>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10 21a2 2 0 0 0 4 0" />
        </svg>
      );
    case "moon":
      return (
        <svg {...shared}>
          <path d="M21 12.8A8 8 0 1 1 11.2 3a6 6 0 0 0 9.8 9.8z" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...shared}>
          <path d="M3 12a9 9 0 0 1 15.3-6.4L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-15.3 6.4L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
      );
    case "chevron-down":
      return (
        <svg {...shared}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      );
    default:
      return null;
  }
}

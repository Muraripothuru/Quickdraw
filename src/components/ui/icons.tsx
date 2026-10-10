import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

function base(props: Props) {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export const IconPlus = (p: Props) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconGrid = (p: Props) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="7" rx="2" />
    <rect x="14" y="3" width="7" height="7" rx="2" />
    <rect x="3" y="14" width="7" height="7" rx="2" />
    <rect x="14" y="14" width="7" height="7" rx="2" />
  </svg>
);

export const IconSearch = (p: Props) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const IconUser = (p: Props) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
  </svg>
);

export const IconTrophy = (p: Props) => (
  <svg {...base(p)}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
    <path d="M8 5H5a3 3 0 0 0 3 3M16 5h3a3 3 0 0 1-3 3" />
    <path d="M12 13v4M9 20h6M10 17h4" />
  </svg>
);

export const IconCopy = (p: Props) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="11" height="11" rx="2.5" />
    <path d="M5 15V6a2 2 0 0 1 2-2h8" />
  </svg>
);

export const IconDownload = (p: Props) => (
  <svg {...base(p)}>
    <path d="M12 4v11M8 11l4 4 4-4M5 19h14" />
  </svg>
);

export const IconPrinter = (p: Props) => (
  <svg {...base(p)}>
    <path d="M7 8V4h10v4" />
    <rect x="4" y="8" width="16" height="8" rx="2" />
    <path d="M7 14h10v6H7z" />
  </svg>
);

export const IconTrash = (p: Props) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </svg>
);

export const IconEdit = (p: Props) => (
  <svg {...base(p)}>
    <path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4Z" />
    <path d="M13.5 6.5 17.5 10.5" />
  </svg>
);

export const IconDuplicate = (p: Props) => (
  <svg {...base(p)}>
    <rect x="8" y="8" width="12" height="12" rx="2.5" />
    <path d="M4 16V6a2 2 0 0 1 2-2h10" />
  </svg>
);

export const IconChevronRight = (p: Props) => (
  <svg {...base(p)}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);

export const IconChevronLeft = (p: Props) => (
  <svg {...base(p)}>
    <path d="m15 5-7 7 7 7" />
  </svg>
);

export const IconX = (p: Props) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconCheck = (p: Props) => (
  <svg {...base(p)}>
    <path d="m5 13 4 4L19 7" />
  </svg>
);

export const IconLink = (p: Props) => (
  <svg {...base(p)}>
    <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
  </svg>
);

export const IconSoundOn = (p: Props) => (
  <svg {...base(p)}>
    <path d="M5 9v6h3l4 4V5L8 9H5Z" />
    <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
  </svg>
);

export const IconSoundOff = (p: Props) => (
  <svg {...base(p)}>
    <path d="M5 9v6h3l4 4V5L8 9H5Z" />
    <path d="m16 10 4 4M20 10l-4 4" />
  </svg>
);

export const IconSpark = (p: Props) => (
  <svg {...base(p)}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M17.5 6.5 15 9M9 15l-2.5 2.5" />
  </svg>
);

export const IconUpload = (p: Props) => (
  <svg {...base(p)}>
    <path d="M12 16V5M8 9l4-4 4 4M5 19h14" />
  </svg>
);

export const IconList = (p: Props) => (
  <svg {...base(p)}>
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </svg>
);

export const IconLock = (p: Props) => (
  <svg {...base(p)}>
    <rect x="5" y="11" width="14" height="9" rx="2.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-indigo-800 text-white shadow-[0_8px_24px_-10px_rgba(99,102,241,0.9)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M12 3.5v5M12 3.5l3.2 2.4M20.5 12h-5M20.5 12l-2.4 3.2M12 20.5v-5M12 20.5l-3.2-2.4M3.5 12h5M3.5 12l2.4-3.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="2.4" fill="currentColor" />
        </svg>
      </span>
      <span className="text-lg font-bold tracking-tight text-white">
        Lucky<span className="text-accent2">Draw</span>
      </span>
    </span>
  );
}

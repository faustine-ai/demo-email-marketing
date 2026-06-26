// Minimal inline icon set — stroke-based, 24x24 viewBox, currentColor.
const S = ({ children, ...p }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    {children}
  </svg>
);

export const IconPulse = (p) => (
  <S {...p}>
    <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
  </S>
);
export const IconCampaign = (p) => (
  <S {...p}>
    <path d="M3 8.5 12 13l9-4.5L12 4 3 8.5Z" />
    <path d="M3 8.5v7L12 20l9-4.5v-7" />
  </S>
);
export const IconMailbox = (p) => (
  <S {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </S>
);
export const IconAudience = (p) => (
  <S {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M16 6a3 3 0 0 1 0 6M17 19a5 5 0 0 0-3-4.6" />
  </S>
);
export const IconTemplate = (p) => (
  <S {...p}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </S>
);
export const IconPlay = (p) => (
  <S {...p}>
    <path d="M7 5v14l11-7Z" fill="currentColor" stroke="none" />
  </S>
);
export const IconPause = (p) => (
  <S {...p}>
    <rect x="7" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none" />
    <rect x="13.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none" />
  </S>
);
export const IconPlus = (p) => (
  <S {...p}>
    <path d="M12 5v14M5 12h14" />
  </S>
);
export const IconClock = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </S>
);
export const IconBolt = (p) => (
  <S {...p}>
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
  </S>
);
export const IconClose = (p) => (
  <S {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </S>
);
export const IconArrowLeft = (p) => (
  <S {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </S>
);
export const IconTrash = (p) => (
  <S {...p}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </S>
);
export const IconMenu = (p) => (
  <S {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </S>
);
export const IconCheck = (p) => (
  <S {...p}>
    <path d="M5 12.5 10 17l9-10" />
  </S>
);
export const IconChevronUp = (p) => (
  <S {...p}>
    <path d="m6 14 6-6 6 6" />
  </S>
);
export const IconChevronDown = (p) => (
  <S {...p}>
    <path d="m6 10 6 6 6-6" />
  </S>
);

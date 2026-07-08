const eventImages: Record<string, string> = {
  'live-2026-01-25': '/images/events/live-2026-01-25.webp',
  'live-2026-01-31': '/images/events/live-2026-01-31.webp',
  'live-2026-02-15': '/images/events/live-2026-02-15.webp',
  'live-2026-02-23': '/images/events/live-2026-02-23.webp',
  'live-2026-03-14': '/images/events/live-2026-03-14.webp',
  'live-2026-03-28': '/images/events/live-2026-03-28.webp',
  'live-2026-04-26': '/images/events/live-2026-04-26.webp',
  'live-2026-05-16': '/images/events/live-2026-05-16.webp',
  'live-2026-07-04': '/images/events/live-2026-07-04.webp',
};

export function getEventImage(eventId: string, fallback = '/images/events/live-2026-07-04.webp') {
  return eventImages[eventId] || fallback;
}

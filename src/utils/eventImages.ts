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

export function getEventImage(eventId: string, fallback = '/images/events/fallback.webp') {
  return eventImages[eventId] || fallback;
}

/**
 * 生成事件图的响应式 srcset（仅对本地 /images/events/*.webp 生效）。
 * 配合构建期预生成的 -640 变体：卡片在小屏/中屏用 640w，大屏用 1280w，
 * 避免用 1280px 大图喂 400px 卡片造成的带宽浪费。
 * 非本地事件图（如 R2 上传图）返回 undefined，组件不输出 srcset。
 */
export function getEventSrcSet(url?: string): string | undefined {
  if (!url || !url.startsWith('/images/events/') || !url.endsWith('.webp')) return undefined;
  const base = url.slice(0, -5); // 去掉 .webp
  return `${base}-640.webp 640w, ${url} 1280w`;
}

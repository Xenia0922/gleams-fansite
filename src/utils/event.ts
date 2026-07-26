/**
 * 活动地点拼接：城市 + "•" + 具体地点。
 * 任一为空则退化为另一项（兼容旧数据仅存 venue 的情况）。
 * 例：formatVenue('南宁', '候朋现场') → "南宁•候朋现场"
 */
export function formatVenue(city?: string, venue?: string): string {
  const c = (city || '').trim();
  const v = (venue || '').trim();
  if (c && v) return `${c}•${v}`;
  return c || v || '';
}

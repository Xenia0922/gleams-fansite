/**
 * 共有成员元数据 — 消除 FanGallery 和 MessageBoard 中的重复定义。
 * 后续新增成员只需在此文件添加一条即可。
 */

export interface MemberMeta {
  emoji: string;
  name: string;
  color: string;
}

export const MEMBER_META: Record<string, MemberMeta> = {
  hakusai:  { emoji: '💛', name: '白菜', color: '#C99A00' },
  kumo:     { emoji: '💙', name: '云团', color: '#2F6FED' },
  yuzi:     { emoji: '💚', name: '柚子', color: '#1E9E6A' },
  other:    { emoji: '⭐', name: '多人·其他', color: '#C2417A' },
};

/**
 * 表演者映射（日程/返图里展示出演成员用），含毕业成员 huangyuyu。
 * 与 MEMBER_META 同源，消除 ScheduleList 内重复硬编码的 MEMBER_MAP。
 * 新增/调整成员时只改此处即可。
 */
export const PERFORMER_META: Record<string, { name: string; emoji: string; color: string }> = {
  hakusai:  { name: '白菜', emoji: '💛', color: '#C99A00' },
  kumo:     { name: '云团', emoji: '💙', color: '#2F6FED' },
  yuzi:     { name: '柚子', emoji: '💚', color: '#1E9E6A' },
  huangyuyu: { name: '黄鱼鱼', emoji: '🩷', color: '#E879B9' },
};

/**
 * 默认成员选项（带"全员"收尾项）：自动从 MEMBER_META 派生，保证单一来源。
 * 给 MessageBoard 等需要兜底列表的场景使用 —— 新增成员时只需在 MEMBER_META 加一条。
 */
export const FALLBACK_MEMBERS: { id: string | null; emoji: string; name: string; color: string }[] = [
  ...Object.entries(MEMBER_META).map(([id, m]) => ({ id, ...m })),
  { id: null, emoji: '⭐', name: '全员', color: '#e83e8c' },
];

/**
 * #RRGGBB 十六进制颜色 → rgba(r, g, b, a)
 */
export function tint(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

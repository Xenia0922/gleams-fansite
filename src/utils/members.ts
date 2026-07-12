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
 * #RRGGBB 十六进制颜色 → rgba(r, g, b, a)
 */
export function tint(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

import { useState, useEffect, useCallback, useRef } from 'react';

interface EmojiPickerPopoverProps {
  emojis: string[];
  /** 触发按钮的 data-emoji-trigger 值，用于定位弹出位置 */
  triggerId: string;
  onPick: (emoji: string) => void;
  onClose: () => void;
}

/**
 * 表情选择弹窗 — Portal 到 body，避开父容器的 overflow:hidden 裁剪。
 * 桌面端吸附触发按钮上方；移动端自适应居中、防溢出。
 *
 * 由 FanGallery 和 MessageBoard 共享（原两份 71 行重复代码已消除）。
 */
export default function EmojiPickerPopover({ emojis, triggerId, onPick, onClose }: EmojiPickerPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose; // 用 ref 避免 effect 依赖漂移

  const calculatePosition = useCallback(() => {
    const btn = document.querySelector(`[data-emoji-trigger="${triggerId}"]`);
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const popoverWidth = 6 * 36 + 5 * 4 + 32; // ~248px
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - popoverWidth / 2, viewportWidth - popoverWidth - 8));

    const spaceAbove = rect.top;
    const popoverHeight = 44;
    const top = spaceAbove >= popoverHeight + 16
      ? rect.top - popoverHeight - 8
      : rect.bottom + 8;

    setPosition({ top, left });
  }, [triggerId]);

  useEffect(() => {
    calculatePosition();
    window.addEventListener('scroll', calculatePosition, { passive: true });
    window.addEventListener('resize', calculatePosition);
    return () => {
      window.removeEventListener('scroll', calculatePosition);
      window.removeEventListener('resize', calculatePosition);
    };
  }, [calculatePosition]);

  // 点击外部关闭（backdrop 已处理，此处兜底）
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []); // 空依赖 — onCloseRef 稳定

  return (
    <div
      ref={ref}
      className="fixed z-[61] flex gap-1 p-2 rounded-2xl frost-card shadow-lg emoji-picker-enter pointer-events-auto"
      style={{ top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
      role="menu"
      aria-label="选择表情"
    >
      {emojis.map(emoji => (
        <button
          key={emoji}
          onClick={() => onPick(emoji)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-base hover:bg-[var(--accent-soft)] hover:scale-125 active:scale-90 transition-all duration-150"
          role="menuitem"
          aria-label={`贴 ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

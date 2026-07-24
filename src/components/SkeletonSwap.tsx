import { useState, useEffect } from 'react';

/**
 * 骨架屏 → 真实内容的「溶解浮现」过渡组件。
 *
 * 设计理念（与 globals.css 的 --ease 统一）：
 *  骨架不是"消失"——它轻微缩放 + 模糊 + 淡出（溶解），
 *  内容同时以极轻微的缩放浮现，形成物理上的"蜕变"感，
 *  而非生硬的 A 消失 → B 出现。
 *
 * 行为：
 *  - loading=true：只渲染骨架（由骨架决定容器高度）。
 *  - 数据到达（loading=false）：
 *    1. 骨架先保持一帧（确保 CSS 过渡起点确立），
 *    2. 下一帧触发 .skeleton-exit.fading（溶解：scale 0.975 + blur 3px + opacity 0，~450ms），
 *    3. 内容同时挂载，以 .content-enter 浮现（scale 0.975→1 + blur 2px→0 + opacity 0→1，520ms），
 *    4. 两条动画重叠 ~450ms，形成无缝 morph；500ms 后卸载骨架 DOM。
 *  - reduced-motion：所有动画降级为即时切换，无闪烁。
 */
export default function SkeletonSwap({
  loading,
  skeleton,
  children,
  className = '',
}: {
  loading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [showSk, setShowSk] = useState(loading);
  const [skFading, setSkFading] = useState(false);

  useEffect(() => {
    if (loading) {
      setShowSk(true);
      setSkFading(false);
      return;
    }
    // 数据到达：保持骨架可见 → 下一帧触发溶解 → 500ms 后卸载
    setSkFading(false);
    const raf = requestAnimationFrame(() => setSkFading(true));
    const t = setTimeout(() => {
      setShowSk(false);
      setSkFading(false);
    }, 500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [loading]);

  if (loading) {
    return <div className={className}>{skeleton}</div>;
  }

  return (
    <div className={`relative ${className}`}>
      <div className="content-enter">{children}</div>
      {showSk && (
        <div
          aria-hidden="true"
          className={`skeleton-exit pointer-events-none absolute inset-0 z-10 ${skFading ? 'fading' : ''}`}
        >
          {skeleton}
        </div>
      )}
    </div>
  );
}

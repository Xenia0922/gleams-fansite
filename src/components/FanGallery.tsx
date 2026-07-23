import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import ImageLightboxOverlay from './ImageLightboxOverlay';
import { useEvents } from './useEvents';
import { MEMBER_META } from '../utils/members';
import Skeleton from './Skeleton';
import SkeletonSwap from './SkeletonSwap';

interface Photo {
  key: string;
  url: string;
  uploaded: string;
  member?: string;
  event?: string | null;
  thumbUrl?: string | null;
}

export default function FanGallery() {
  const { map } = useEvents();
  const ssr = typeof window !== 'undefined' ? (window as any).__SSR_DATA__ : null;
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const hasCached = useRef(false);

  // Emoji 反应
  const [reactionsMap, setReactionsMap] = useState<Record<string, { reactions: { emoji: string; count: number }[]; mine: string[] }>>({});
  const REACTION_EMOJIS = ['👍', '❤️', '😂', '🥰', '😢', '👏'];

  // 动态成员 meta：优先 SSR 注入，fallback 硬编码 MEMBER_META（向后兼容）
  const metaMap = useMemo(() => {
    const m = new Map<string, { emoji: string; name: string; color: string }>();
    if (ssr?.membersMeta && ssr.membersMeta.length) {
      for (const mm of ssr.membersMeta) {
        m.set(mm.id, { emoji: mm.emoji || '⭐', name: mm.name, color: mm.color || '#C2417A' });
      }
    } else {
      for (const [id, meta] of Object.entries(MEMBER_META)) {
        if (id !== 'other') m.set(id, meta);
      }
    }
    m.set('other', { emoji: '⭐', name: '多人·其他', color: '#C2417A' });
    return m;
  }, [ssr]);

  const namedIds = useMemo(() => Array.from(metaMap.keys()).filter(k => k !== 'other'), [metaMap]);

  const visiblePhotos = photos.filter(p =>
    (!filter || (filter === 'other' ? !namedIds.includes(p.member ?? '') : p.member === filter)) &&
    (!eventFilter || p.event === eventFilter)
  );
  const lightboxImages = useMemo(() => visiblePhotos.map(p => ({ src: p.url })), [visiblePhotos]);

  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch('/api/photos');
      if (!res.ok) throw new Error('加载失败');
      const data = await res.json();
      if (Array.isArray(data)) {
        setPhotos(data);
        setError('');
        hasCached.current = true;
        // 批量获取反应统计
        if (data.length) {
          const ids = data.map((p: Photo) => p.key).join(',');
          fetch(`/api/reactions?type=photo&ids=${encodeURIComponent(ids)}`)
            .then(r => r.json())
            .then(map => { if (map && typeof map === 'object') setReactionsMap(map); })
            .catch(() => {});
        }
      }
    } catch {
      if (!hasCached.current) setError('加载失败');
    }
    setLoading(false);
  }, []);

  const toggleReaction = useCallback(async (photoKey: string, emoji: string) => {
    try {
      const res = await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'photo', id: photoKey, emoji }),
      });
      const data = await res.json();
      if (data.ok) {
        setReactionsMap(prev => {
          const cur = prev[photoKey] || { reactions: [], mine: [] };
          let reactions = [...cur.reactions];
          let mine = [...cur.mine];
          const idx = reactions.findIndex(r => r.emoji === emoji);
          if (data.action === 'added') {
            if (!mine.includes(emoji)) mine.push(emoji);
            if (idx >= 0) reactions[idx] = { emoji, count: data.count };
            else reactions.push({ emoji, count: data.count });
          } else {
            mine = mine.filter(e => e !== emoji);
            if (data.count === 0) reactions = reactions.filter(r => r.emoji !== emoji);
            else if (idx >= 0) reactions[idx] = { emoji, count: data.count };
          }
          return { ...prev, [photoKey]: { reactions, mine } };
        });
      }
    } catch { /* ignore */ }
  }, []);

  const [popoverPhotoKey, setPopoverPhotoKey] = useState<string | null>(null);
  const handlePickEmoji = useCallback((photoKey: string, emoji: string) => {
    toggleReaction(photoKey, emoji);
    setPopoverPhotoKey(null);
  }, [toggleReaction]);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);
  useEffect(() => {
    window.addEventListener('tab-browse-visible', fetchPhotos);
    return () => window.removeEventListener('tab-browse-visible', fetchPhotos);
  }, [fetchPhotos]);
  useEffect(() => {
    const onFilter = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setFilter(detail === '' || detail == null ? null : detail);
    };
    window.addEventListener('fan-member-filter', onFilter);
    return () => window.removeEventListener('fan-member-filter', onFilter);
  }, []);

  useEffect(() => {
    const onFilter = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setEventFilter(detail === '' || detail == null ? null : detail);
    };
    window.addEventListener('fan-event-filter', onFilter);
    return () => window.removeEventListener('fan-event-filter', onFilter);
  }, []);

  const close = useCallback(() => setLightboxIdx(null), []);
  const prev = useCallback(() => setLightboxIdx(i => i !== null ? (i - 1 + visiblePhotos.length) % visiblePhotos.length : null), [visiblePhotos.length]);
  const next = useCallback(() => setLightboxIdx(i => i !== null ? (i + 1) % visiblePhotos.length : null), [visiblePhotos.length]);

  useEffect(() => {
    if (lightboxIdx === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxIdx, close, prev, next]);

  const handleImgError = useCallback((e: React.SyntheticEvent<HTMLImageElement>, fallback: string) => {
    const img = e.currentTarget;
    if (img.dataset.fallback) return;
    img.dataset.fallback = '1';
    img.src = fallback;
  }, []);

  if (!loading && error) return <div className="text-center py-8"><p className="text-gray-400 text-sm mb-2">{error}</p><button onClick={fetchPhotos} className="btn-outline text-xs !px-4 !py-1.5">重试</button></div>;
  if (!loading && photos.length === 0) return <p className="text-center text-gray-400 py-8">还没有返图，切换"发布"来上传第一张吧 ✨</p>;
  if (!loading && visiblePhotos.length === 0) return <p className="text-center text-gray-400 py-8">{(filter || eventFilter) ? '该筛选下还没有返图 ✨' : '还没有返图 ✨'}</p>;

  return (
    <SkeletonSwap
      loading={loading}
      skeleton={
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-3xl border border-white/55 dark:border-white/6" />
          ))}
        </div>
      }
    >
      <>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {visiblePhotos.map((p, i) => {
            const r = reactionsMap[p.key];
            const activeReactions = (r?.reactions || []).filter(x => x.count > 0);
            return (
              <div key={p.key} className="frost-card overflow-hidden group relative transition-all duration-500 hover:-translate-y-1 hover:shadow-md">
                <div className="cursor-pointer" onClick={() => setLightboxIdx(i)}>
                  <img src={p.thumbUrl || p.url} alt="" className="w-full aspect-[4/5] object-cover group-hover:scale-105 transition-transform duration-500 lazy-blur" loading="lazy" decoding="async" onError={(e) => handleImgError(e, p.url)} />
                </div>
                {/* 成员标识（左上，小） */}
                {p.member && metaMap.has(p.member) && (
                  <span
                    className="absolute top-1.5 left-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full backdrop-blur-md"
                    style={{ color: metaMap.get(p.member)!.color, backgroundColor: 'rgba(255,255,255,0.8)' }}
                  >
                    {metaMap.get(p.member)!.emoji} {metaMap.get(p.member)!.name}
                  </span>
                )}
                {/* 场次标识（右上，小） */}
                {p.event && map[p.event] && (
                  <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full backdrop-blur-md bg-white/80 text-gray-600">
                    🎫 {map[p.event].date}
                  </span>
                )}
                {/* 已贴反应（左下，悬浮在图片上） */}
                {activeReactions.length > 0 && (
                  <div className="absolute bottom-1.5 left-1.5 flex flex-wrap gap-1">
                    {activeReactions.map(r => {
                      const isMine = reactionsMap[p.key]?.mine.includes(r.emoji);
                      return (
                        <button
                          key={r.emoji}
                          onClick={(e) => { e.stopPropagation(); toggleReaction(p.key, r.emoji); }}
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] max-sm:text-[11px] backdrop-blur-md transition-all active:scale-90 ${
                            isMine
                              ? 'bg-white/90 ring-1 ring-[var(--accent)]/40'
                              : 'bg-white/75 hover:bg-white/90'
                          }`}
                          aria-label={`${isMine ? '取消' : '贴'} ${r.emoji}（${r.count}）`}
                          aria-pressed={isMine}
                        >
                          <span className="text-xs">{r.emoji}</span>
                          <span className="text-[10px] font-semibold text-gray-600 tabular-nums">{r.count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {/* emoji 按钮（右下，悬浮在图片上） */}
                <div className="absolute bottom-1.5 right-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPopoverPhotoKey(popoverPhotoKey === p.key ? null : p.key); }}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-sm text-gray-500 bg-white/80 backdrop-blur-md hover:text-[var(--accent)] hover:bg-white hover:scale-110 active:scale-90 transition-all"
                    aria-label="贴 emoji 反应"
                    aria-expanded={popoverPhotoKey === p.key}
                    data-emoji-trigger={p.key}
                  >
                    😊
                  </button>
                  {popoverPhotoKey === p.key && createPortal(
                    <>
                      <div className="fixed inset-0 z-[60] bg-black/5 backdrop-blur-sm" onClick={() => setPopoverPhotoKey(null)} aria-hidden="true" />
                      <EmojiPickerPopover
                        emojis={REACTION_EMOJIS}
                        onPick={handlePickEmoji}
                        photoKey={p.key}
                        onClose={() => setPopoverPhotoKey(null)}
                      />
                    </>,
                    document.body
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {lightboxIdx !== null && (
          <ImageLightboxOverlay
            images={lightboxImages}
            currentIndex={lightboxIdx}
            onClose={close}
            onPrev={prev}
            onNext={next}
          />
        )}
      </>
    </SkeletonSwap>
  );
}

// 独立的 EmojiPickerPopover 组件：用 Portal 渲染到 body，避免移动端被父容器裁剪/遮挡
interface EmojiPickerPopoverProps {
  emojis: string[];
  onPick: (id: string, emoji: string) => void;
  photoKey: string;
  onClose: () => void;
}

function EmojiPickerPopover({ emojis, onPick, photoKey, onClose }: EmojiPickerPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // 计算位置：相对于触发按钮，fixed 定位
  const calculatePosition = useCallback(() => {
    const btn = document.querySelector(`[data-emoji-trigger="${photoKey}"]`);
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const popoverWidth = 6 * 36 + 5 * 4 + 32; // ~248px
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // 水平居中于按钮，限制在视口内
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - popoverWidth / 2, viewportWidth - popoverWidth - 8));
    
    // 垂直：按钮上方 8px，但如果顶部空间不足则显示在按钮下方
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    const popoverHeight = 44; // 估算高度
    const top = spaceAbove >= popoverHeight + 16 
      ? rect.top - popoverHeight - 8  // 按钮上方
      : rect.bottom + 8;              // 按钮下方（兜底）
    
    setPosition({ top, left });
  }, [photoKey]);

  // 挂载时计算，滚动/resize 时重新计算
  useEffect(() => {
    calculatePosition();
    window.addEventListener('scroll', calculatePosition, { passive: true });
    window.addEventListener('resize', calculatePosition);
    return () => {
      window.removeEventListener('scroll', calculatePosition);
      window.removeEventListener('resize', calculatePosition);
    };
  }, [calculatePosition]);

  // 点击外部关闭（由 backdrop 处理，这里兜底）
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

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
          onClick={() => onPick(photoKey, emoji)}
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

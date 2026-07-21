import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
            <Skeleton key={i} className="aspect-[4/5] rounded-3xl" />
          ))}
        </div>
      }
    >
      <>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {visiblePhotos.map((p, i) => (
            <div key={p.key} className="frost-card overflow-hidden group relative">
              <div className="cursor-pointer" onClick={() => setLightboxIdx(i)}>
                <img src={p.thumbUrl || p.url} alt="" className="w-full aspect-[4/5] object-cover group-hover:scale-105 transition-transform duration-500 lazy-blur" loading="lazy" decoding="async" onError={(e) => handleImgError(e, p.url)} />
                {p.member && metaMap.has(p.member) && (
                  <span
                    className="absolute top-2 left-2 inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-0.5 rounded-full backdrop-blur"
                    style={{ color: metaMap.get(p.member)!.color, backgroundColor: 'rgba(255,255,255,0.72)' }}
                  >
                    {metaMap.get(p.member)!.emoji} {metaMap.get(p.member)!.name}
                  </span>
                )}
                {p.event && map[p.event] && (
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full backdrop-blur bg-white/75 text-gray-600">
                    🎫 {map[p.event].date}
                  </span>
                )}
              </div>
              {/* Emoji 反应栏 */}
              <div className="flex flex-wrap gap-1 px-2 py-1.5">
                {REACTION_EMOJIS.map(emoji => {
                  const r = reactionsMap[p.key];
                  const reaction = r?.reactions.find(x => x.emoji === emoji);
                  const isMine = r?.mine.includes(emoji);
                  const count = reaction?.count || 0;
                  return (
                    <button
                      key={emoji}
                      onClick={(e) => { e.stopPropagation(); toggleReaction(p.key, emoji); }}
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] transition-all active:scale-90 ${
                        isMine
                          ? 'bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]/30'
                          : 'bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10'
                      }`}
                      aria-label={`${isMine ? '取消' : '贴'} ${emoji} 反应`}
                      aria-pressed={isMine}
                    >
                      <span className="text-xs">{emoji}</span>
                      {count > 0 && <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 tabular-nums">{count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
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

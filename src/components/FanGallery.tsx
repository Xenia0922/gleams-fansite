import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ImageLightboxOverlay from './ImageLightboxOverlay';
import { useEvents } from './useEvents';
import { MEMBER_META, tint } from '../utils/members';
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
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const hasCached = useRef(false);
  const NAMED = ['hakusai', 'kumo', 'yuzi'];
  const visiblePhotos = photos.filter(p =>
    (!filter || (filter === 'other' ? !NAMED.includes(p.member ?? '') : p.member === filter)) &&
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
      }
    } catch {
      if (!hasCached.current) setError('加载失败');
    }
    setLoading(false);
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
            <div key={p.key} className="frost-card overflow-hidden cursor-pointer group relative" onClick={() => setLightboxIdx(i)}>
              <img src={p.thumbUrl || p.url} alt="" className="w-full aspect-[4/5] object-cover group-hover:scale-105 transition-transform duration-500 lazy-blur" loading="lazy" decoding="async" onError={(e) => handleImgError(e, p.url)} />
              {p.member && MEMBER_META[p.member] && (
                <span
                  className="absolute bottom-2 left-2 inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-0.5 rounded-full backdrop-blur"
                  style={{ color: MEMBER_META[p.member].color, backgroundColor: 'rgba(255,255,255,0.72)' }}
                >
                  {MEMBER_META[p.member].emoji} {MEMBER_META[p.member].name}
                </span>
              )}
              {p.event && map[p.event] && (
                <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full backdrop-blur bg-white/75 text-gray-600">
                  🎫 {map[p.event].date}
                </span>
              )}
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

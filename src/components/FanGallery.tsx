import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ImageLightboxOverlay from './ImageLightboxOverlay';

interface Photo {
  key: string;
  url: string;
  uploaded: string;
  member?: string;
  thumbUrl?: string | null;
}

// 展示用成员元数据（含可读文字色）
const MEMBER_META: Record<string, { emoji: string; name: string; color: string }> = {
  hakusai: { emoji: '💛', name: '白菜', color: '#C99A00' },
  kumo:    { emoji: '💙', name: '云团', color: '#2F6FED' },
  yuzi:    { emoji: '💚', name: '柚子', color: '#1E9E6A' },
  other:    { emoji: '🐙', name: '多人·其他', color: '#C2417A' },
};

const tint = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export default function FanGallery() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const hasCached = useRef(false);
  const visiblePhotos = photos.filter(p => !filter || p.member === filter);
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

  if (loading) return <p className="text-center text-gray-400 py-8">加载中...</p>;
  if (error) return <div className="text-center py-8"><p className="text-gray-400 text-sm mb-2">{error}</p><button onClick={fetchPhotos} className="btn-outline text-xs !px-4 !py-1.5">重试</button></div>;
  if (photos.length === 0) return <p className="text-center text-gray-400 py-8">还没有返图，切换"发布"来上传第一张吧 ✨</p>;
  if (visiblePhotos.length === 0) return <p className="text-center text-gray-400 py-8">该成员还没有返图 ✨</p>;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {visiblePhotos.map((p, i) => (
          <div key={p.key} className="frost-card overflow-hidden cursor-pointer group relative" onClick={() => setLightboxIdx(i)}>
            <img src={p.thumbUrl || p.url} alt="" className="w-full aspect-[4/5] object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" onError={(e) => handleImgError(e, p.url)} />
            {p.member && MEMBER_META[p.member] && (
              <span
                className="absolute bottom-2 left-2 inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-0.5 rounded-full backdrop-blur"
                style={{ color: MEMBER_META[p.member].color, backgroundColor: 'rgba(255,255,255,0.72)' }}
              >
                {MEMBER_META[p.member].emoji} {MEMBER_META[p.member].name}
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
  );
}

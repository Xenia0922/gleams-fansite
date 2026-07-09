import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ImageLightboxOverlay from './ImageLightboxOverlay';

interface Photo {
  key: string;
  url: string;
  uploaded: string;
  thumbUrl?: string | null;
}

export default function FanGallery() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const hasCached = useRef(false);
  const lightboxImages = useMemo(() => photos.map(p => ({ src: p.url })), [photos]);

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

  const close = useCallback(() => setLightboxIdx(null), []);
  const prev = useCallback(() => setLightboxIdx(i => i !== null ? (i - 1 + photos.length) % photos.length : null), [photos.length]);
  const next = useCallback(() => setLightboxIdx(i => i !== null ? (i + 1) % photos.length : null), [photos.length]);

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

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {photos.map((p, i) => (
          <div key={p.key} className="frost-card overflow-hidden cursor-pointer group" onClick={() => setLightboxIdx(i)}>
            <img src={p.thumbUrl || p.url} alt="" className="w-full aspect-[4/5] object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" onError={(e) => handleImgError(e, p.url)} />
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

import { useState, useEffect, useCallback, useRef } from 'react';

interface Photo {
  key: string;
  url: string;
  uploaded: string;
}

export default function FanGallery() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const hasCached = useRef(false);

  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch('/api/photos');
      if (!res.ok) throw new Error('加载失败');
      const data = await res.json();
      if (Array.isArray(data)) {
        setPhotos(data);
        setError('');
        hasCached.current = true;
      } else {
        setError('数据格式异常');
      }
    } catch {
      if (!hasCached.current) setError('加载失败，请刷新重试');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  useEffect(() => {
    window.addEventListener('tab-browse-visible', fetchPhotos);
    return () => window.removeEventListener('tab-browse-visible', fetchPhotos);
  }, [fetchPhotos]);

  useEffect(() => {
    if (!lightbox) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [lightbox]);

  const handleImgError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none';
  }, []);

  if (loading) return <p className="text-center text-gray-400 py-8">加载中...</p>;

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400 text-sm mb-2">{error}</p>
        <button onClick={fetchPhotos} className="btn-outline text-xs !px-4 !py-1.5">重试</button>
      </div>
    );
  }

  if (photos.length === 0) {
    return <p className="text-center text-gray-400 py-8">还没有返图，切换"发布"来上传第一张吧 ✨</p>;
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {photos.map(p => (
          <div
            key={p.key}
            onClick={() => setLightbox(p.url)}
            className="frost-card overflow-hidden block group cursor-pointer"
          >
            <img
              src={p.url}
              alt=""
              className="w-full aspect-[4/5] object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              onError={handleImgError}
            />
          </div>
        ))}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center cursor-pointer" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute top-6 right-6 text-white/60 hover:text-white text-sm z-10">✕ 关闭</button>
          <img src={lightbox} alt="" className="max-w-[95vw] max-h-[95vh] object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}

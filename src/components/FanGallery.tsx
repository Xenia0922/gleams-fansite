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

  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch('/api/photos');
      if (!res.ok) throw new Error('加载失败');
      const data = await res.json();
      if (Array.isArray(data)) { setPhotos(data); setError(''); }
    } catch { setError('加载失败'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  if (loading) return <p className="text-center text-gray-400 py-8">加载中...</p>;
  if (error) return <div className="text-center py-8"><p className="text-gray-400 text-sm mb-2">{error}</p><button onClick={fetchPhotos} className="btn-outline text-xs !px-4 !py-1.5">重试</button></div>;
  if (photos.length === 0) return <p className="text-center text-gray-400 py-8">还没有返图，切换"发布"来上传第一张吧 ✨</p>;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {photos.map(p => (
          <div key={p.key} className="frost-card overflow-hidden cursor-pointer group" onClick={() => {
            const full = document.getElementById('fan-full-img') as HTMLImageElement;
            const overlay = document.getElementById('fan-img-overlay');
            if (full && overlay) { full.src = p.url; overlay.classList.remove('hidden'); }
          }}>
            <img src={p.url} alt="" className="w-full aspect-[4/5] object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
          </div>
        ))}
      </div>
      <div id="fan-img-overlay" className="hidden fixed inset-0 z-[100] bg-black/95 flex items-center justify-center cursor-pointer" onclick="this.classList.add('hidden')">
        <img id="fan-full-img" src="" alt="" className="max-w-[95vw] max-h-[95vh] object-contain" onclick="event.stopPropagation()" />
      </div>
      <script dangerouslySetInnerHTML={{__html: `
        document.getElementById('fan-img-overlay')?.addEventListener('keydown', function(e) {
          if (e.key === 'Escape') this.classList.add('hidden');
        });
      `}} />
    </>
  );
}

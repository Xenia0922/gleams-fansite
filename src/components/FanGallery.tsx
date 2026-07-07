import { useState, useEffect } from 'react';

interface Photo {
  key: string;
  url: string;
  uploaded: string;
}

export default function FanGallery() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/photos')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setPhotos(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-center text-gray-400 py-8">加载中...</p>;
  }

  if (photos.length === 0) {
    return <p className="text-center text-gray-400 py-8">还没有返图，切换"发布"来上传第一张吧 ✨</p>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {photos.map(p => (
        <a
          key={p.key}
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          className="frost-card overflow-hidden block group"
        >
          <img
            src={p.url}
            alt=""
            className="w-full aspect-[4/5] object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        </a>
      ))}
    </div>
  );
}

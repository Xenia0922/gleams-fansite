import { useState, useEffect, useCallback } from 'react';

// 所有照片来自成员个人微博，来源可追溯
const galleryImages = [
  // 白菜个人微博 (uid=3639876511)
  '/images/members/hakusai/hakusai_01.jpg',
  '/images/members/hakusai/hakusai_02.jpg',
  '/images/members/hakusai/hakusai_03.jpg',
  '/images/members/hakusai/hakusai_05.jpg',
  '/images/members/hakusai/hakusai_06.jpg',
  // 云团个人微博 (uid=5432863560)
  '/images/members/kumo/kumo_01.jpg',
  '/images/members/kumo/kumo_05.jpg',
  '/images/members/kumo/kumo_06.jpg',
  '/images/members/kumo/kumo_04.jpg',
  // 柚子个人微博 (uid=7148114625)
  '/images/members/yuzi/yuzi_02.jpg',
  '/images/members/yuzi/yuzi_05.jpg',
  '/images/members/yuzi/yuzi_06.jpg',
];

export default function GalleryGrid() {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const close = useCallback(() => setLightboxIdx(null), []);
  const prev = useCallback(() => setLightboxIdx(i => i !== null ? (i - 1 + galleryImages.length) % galleryImages.length : null), []);
  const next = useCallback(() => setLightboxIdx(i => i !== null ? (i + 1) % galleryImages.length : null), []);

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

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {galleryImages.map((src, i) => (
          <div
            key={i}
            className="aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-pointer group"
            onClick={() => setLightboxIdx(i)}
          >
            <img
              src={src}
              alt={`Gleams photo ${i + 1}`}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              loading="lazy"
            />
          </div>
        ))}
      </div>

      {lightboxIdx !== null && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={close}>
          <button onClick={close} className="absolute top-6 right-6 text-white/60 hover:text-white text-sm z-10">✕ 关闭</button>
          <span className="absolute top-6 left-6 text-white/40 text-sm z-10">{lightboxIdx + 1} / {galleryImages.length}</span>

          <button onClick={e => { e.stopPropagation(); prev(); }} className="absolute left-4 text-white/60 hover:text-white text-3xl z-10 p-4">‹</button>

          <div className="max-w-[90vw] max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <img src={galleryImages[lightboxIdx]} alt="" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
          </div>

          <button onClick={e => { e.stopPropagation(); next(); }} className="absolute right-4 text-white/60 hover:text-white text-3xl z-10 p-4">›</button>
        </div>
      )}
    </>
  );
}

import { useState, useEffect, useCallback } from 'react';

// 使用下载的真实照片
const galleryImages = [
  '/images/members/Sat_Jun_27_5314209019859106_0.jpg',
  '/images/members/Sat_Feb_14_5266137572705216_0.jpg',
  '/images/members/Thu_Sep_04_5207065433737260_0.jpg',
  '/images/members/Mon_Jul_06_5317726201713318_0.jpg',
  '/images/members/Mon_Jul_06_5317726201713318_1.jpg',
  '/images/members/Tue_Jun_09_5307988046775909_0.jpg',
  '/images/members/Fri_Feb_06_5263289829294666_rt_0.jpg',
  '/images/members/Fri_Feb_06_5263289829294666_rt_1.jpg',
  '/images/members/Fri_May_01_5293827222670761_0.jpg',
  '/images/members/Fri_May_01_5293827222670761_1.jpg',
  '/images/members/Sun_Jun_28_5314726717294930_1.jpg',
  '/images/members/Sat_Mar_14_5276494972591479_0.jpg',
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

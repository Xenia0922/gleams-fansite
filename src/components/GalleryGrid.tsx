import { useState, useEffect, useCallback, useMemo } from 'react';

const allImages = [
  { src: '/images/members/hakusai/hakusai_01.webp', member: 'hakusai' },
  { src: '/images/members/hakusai/hakusai_02.webp', member: 'hakusai' },
  { src: '/images/members/hakusai/hakusai_03.webp', member: 'hakusai' },
  { src: '/images/members/hakusai/hakusai_04.webp', member: 'hakusai' },
  { src: '/images/members/hakusai/hakusai_05.webp', member: 'hakusai' },
  { src: '/images/members/hakusai/hakusai_06.webp', member: 'hakusai' },
  { src: '/images/members/hakusai/hakusai_07.webp', member: 'hakusai' },
  { src: '/images/members/hakusai/hakusai_08.webp', member: 'hakusai' },
  { src: '/images/members/kumo/kumo_01.webp', member: 'kumo' },
  { src: '/images/members/kumo/kumo_02.webp', member: 'kumo' },
  { src: '/images/members/kumo/kumo_03.webp', member: 'kumo' },
  { src: '/images/members/kumo/kumo_04.webp', member: 'kumo' },
  { src: '/images/members/kumo/kumo_05.webp', member: 'kumo' },
  { src: '/images/members/kumo/kumo_06.webp', member: 'kumo' },
  { src: '/images/members/kumo/kumo_07.webp', member: 'kumo' },
  { src: '/images/members/kumo/kumo_08.webp', member: 'kumo' },
  { src: '/images/members/yuzi/yuzi_02.webp', member: 'yuzi' },
  { src: '/images/members/yuzi/yuzi_03.webp', member: 'yuzi' },
  { src: '/images/members/yuzi/yuzi_04.webp', member: 'yuzi' },
  { src: '/images/members/yuzi/yuzi_05.webp', member: 'yuzi' },
  { src: '/images/members/yuzi/yuzi_06.webp', member: 'yuzi' },
  { src: '/images/members/yuzi/yuzi_07.webp', member: 'yuzi' },
  { src: '/images/members/yuzi/yuzi_08.webp', member: 'yuzi' },
];

type Filter = 'all' | 'hakusai' | 'kumo' | 'yuzi';

const filters: { key: Filter; label: string; emoji: string; color: string }[] = [
  { key: 'all', label: '全部', emoji: '⭐', color: '#e83e8c' },
  { key: 'hakusai', label: '白菜', emoji: '💛', color: '#FFD700' },
  { key: 'kumo', label: '云团', emoji: '💙', color: '#4DA6FF' },
  { key: 'yuzi', label: '柚子', emoji: '💚', color: '#48D1A0' },
];

export default function GalleryGrid() {
  const [filter, setFilter] = useState<Filter>('all');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const filtered = useMemo(() =>
    filter === 'all' ? allImages : allImages.filter(img => img.member === filter),
    [filter]
  );

  const close = useCallback(() => setLightboxIdx(null), []);
  const prev = useCallback(() => setLightboxIdx(i => i !== null ? (i - 1 + filtered.length) % filtered.length : null), [filtered.length]);
  const next = useCallback(() => setLightboxIdx(i => i !== null ? (i + 1) % filtered.length : null), [filtered.length]);

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
      {/* 成员筛选按钮 */}
      <div className="flex justify-center gap-2 mb-8 flex-wrap">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setLightboxIdx(null); }}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              filter === f.key
                ? 'text-white shadow-md'
                : 'text-gray-500 bg-gray-100 hover:bg-gray-200'
            }`}
            style={filter === f.key ? { backgroundColor: f.color } : {}}
          >
            <span>{f.emoji}</span>
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      {/* 图片网格 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((item, i) => (
          <div
            key={`${item.member}-${i}`}
            className="aspect-[4/5] rounded-3xl overflow-hidden glass cursor-pointer group"
            onClick={() => setLightboxIdx(i)}
          >
            <img
              src={item.src}
              alt=""
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 lazy-blur"
              loading="lazy"
            />
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">暂无照片</div>
      )}

      {/* 灯箱 */}
      {lightboxIdx !== null && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={close}>
          <button onClick={close} className="absolute top-6 right-6 text-white/60 hover:text-white text-sm z-10">✕ 关闭</button>
          <span className="absolute top-6 left-6 text-white/40 text-sm z-10">{lightboxIdx + 1} / {filtered.length}</span>

          <button onClick={e => { e.stopPropagation(); prev(); }} className="absolute left-4 text-white/60 hover:text-white text-3xl z-10 p-4">‹</button>

          <div className="max-w-[90vw] max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <img src={filtered[lightboxIdx].src} alt="" className="max-w-full max-h-[85vh] object-contain rounded-2xl" />
          </div>

          <button onClick={e => { e.stopPropagation(); next(); }} className="absolute right-4 text-white/60 hover:text-white text-3xl z-10 p-4">›</button>
        </div>
      )}
    </>
  );
}

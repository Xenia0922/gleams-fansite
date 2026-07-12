import { useState, useEffect, useCallback, useMemo } from 'react';
import ImageLightboxOverlay from './ImageLightboxOverlay';

interface Photo {
  id: string;
  url: string;
  member: string;
}

interface FanPhoto {
  key: string;
  url: string;
  thumbUrl?: string | null;
  member?: string;
}

const META: Record<string, { name: string; emoji: string; color: string }> = {
  hakusai: { name: '白菜', emoji: '💛', color: '#FFD700' },
  kumo: { name: '云团', emoji: '💙', color: '#4DA6FF' },
  yuzi: { name: '柚子', emoji: '💚', color: '#48D1A0' },
};

export default function GalleryGrid() {
  const [filter, setFilter] = useState('all');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [featuredFan, setFeaturedFan] = useState<FanPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const [galleryRes, photosRes, siteRes] = await Promise.all([
        fetch('/api/gallery'),
        fetch('/api/photos'),
        fetch('/api/site'),
      ]);
      const galleryData = await galleryRes.json();
      const photosData = await photosRes.json();
      const siteData = await siteRes.json();

      if (Array.isArray(galleryData.photos)) setPhotos(galleryData.photos);

      // 广场返图精选：兼容旧格式 string[] 和新格式 { key, galleryId }[]
      const raw = siteData.featured_square || [];
      const featuredKeys: string[] = Array.isArray(raw)
        ? raw.map((e: string | { key: string }) => (typeof e === 'string' ? e : e.key))
        : [];
      if (Array.isArray(photosData) && featuredKeys.length > 0) {
        const keySet = new Set(featuredKeys);
        const matched = photosData.filter((p: FanPhoto) => keySet.has(p.key));
        setFeaturedFan(matched);
      } else {
        setFeaturedFan([]);
      }
    } catch {
      /* offline */
    }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const memberIds = useMemo(() => Object.keys(META), []);

  const groups = useMemo(() => {
    const map = new Map<string, Photo[]>();
    for (const p of photos) {
      const key = META[p.member] ? p.member : '__other__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    const ordered: { id: string; name: string; emoji: string; color: string; items: Photo[] }[] = [];
    for (const id of memberIds) {
      if (map.has(id)) ordered.push({ id, name: META[id].name, emoji: META[id].emoji, color: META[id].color, items: map.get(id)! });
    }
    if (map.has('__other__')) ordered.push({ id: '__other__', name: '其他', emoji: '⭐', color: '#e83e8c', items: map.get('__other__')! });
    return ordered;
  }, [photos, memberIds]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const visibleFlat = useMemo(
    () => (filter === 'all' ? flat : flat.filter((p) => p.member === filter)),
    [filter, flat]
  );
  const lightboxImages = useMemo(() => visibleFlat.map((p) => ({ src: p.url })), [visibleFlat]);

  const close = useCallback(() => setLightboxIdx(null), []);
  const prev = useCallback(
    () => setLightboxIdx((i) => (i !== null ? (i - 1 + visibleFlat.length) % visibleFlat.length : null)),
    [visibleFlat.length]
  );
  const next = useCallback(
    () => setLightboxIdx((i) => (i !== null ? (i + 1) % visibleFlat.length : null)),
    [visibleFlat.length]
  );

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

  const filters = useMemo(
    () => [
      { key: 'all', label: '全部', emoji: '⭐', color: '#e83e8c' },
      ...groups.map((g) => ({ key: g.id, label: g.name, emoji: g.emoji, color: g.color })),
    ],
    [groups]
  );

  const idxOf = (id: string) => visibleFlat.findIndex((p) => p.id === id);

  // 精选 fan 照片的灯箱
  const [fanLightboxIdx, setFanLightboxIdx] = useState<number | null>(null);
  const fanLightboxImages = useMemo(() => featuredFan.map((p) => ({ src: p.url })), [featuredFan]);

  return (
    <>
      {/* 成员筛选按钮 */}
      <div className="flex justify-center gap-2 mb-8 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setLightboxIdx(null); }}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${filter === f.key ? 'text-white shadow-md' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'}`}
            style={filter === f.key ? { backgroundColor: f.color } : {}}
          >
            <span>{f.emoji}</span>
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      {/* 图片网格（按成员分组） */}
      {loading ? (
        <p className="text-center text-gray-400 py-16">加载中...</p>
      ) : (
        <div className="space-y-8">
          {groups
            .filter((g) => filter === 'all' || g.id === filter)
            .map((g) => (
              <div key={g.id}>
                {filter === 'all' && (
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm font-bold" style={{ color: g.color }}>
                      {g.emoji} {g.name}
                    </span>
                    <span className="text-xs text-gray-400">{g.items.length} 张</span>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {g.items.map((p) => {
                    const i = idxOf(p.id);
                    return (
                      <div
                        key={p.id}
                        className="relative aspect-[4/5] rounded-3xl overflow-hidden glass cursor-pointer group"
                        onClick={() => i >= 0 && setLightboxIdx(i)}
                      >
                        <img
                          src={p.url}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          loading="lazy"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          {photos.length === 0 && <div className="text-center py-16 text-gray-400">画廊还空着，敬请期待</div>}
        </div>
      )}

      {/* 骑士团精选 — 来自广场返图 */}
      {!loading && featuredFan.length > 0 && (
        <div className="mt-12">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-bold text-[var(--accent)]">骑士团精选</span>
            <span className="text-xs text-gray-400">{featuredFan.length} 张</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {featuredFan.map((p, i) => (
              <div
                key={p.key}
                className="relative aspect-[4/5] rounded-3xl overflow-hidden glass cursor-pointer group ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-transparent"
                onClick={() => setFanLightboxIdx(i)}
              >
                <img
                  src={p.thumbUrl || p.url}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {lightboxIdx !== null && (
        <ImageLightboxOverlay
          images={lightboxImages}
          currentIndex={lightboxIdx}
          onClose={close}
          onPrev={prev}
          onNext={next}
        />
      )}

      {fanLightboxIdx !== null && (
        <ImageLightboxOverlay
          images={fanLightboxImages}
          currentIndex={fanLightboxIdx}
          onClose={() => setFanLightboxIdx(null)}
          onPrev={() => setFanLightboxIdx((i) => (i !== null ? (i - 1 + featuredFan.length) % featuredFan.length : null))}
          onNext={() => setFanLightboxIdx((i) => (i !== null ? (i + 1) % featuredFan.length : null))}
        />
      )}
    </>
  );
}

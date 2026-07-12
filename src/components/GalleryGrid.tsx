import { useState, useEffect, useCallback, useMemo } from 'react';
import ImageLightboxOverlay from './ImageLightboxOverlay';

// 画廊页为纯展示：只读取 /api/gallery 返回的 gallery_photos（后台独立维护的快照），
// 前台不提供任何上传/删除入口——编辑全部在后台「画廊」Tab 进行，粉丝投稿请去广场。
interface Photo {
  id: string;
  url: string;
  member: string;
  featured?: number;
}

const META: Record<string, { name: string; emoji: string; color: string }> = {
  hakusai: { name: '白菜', emoji: '💛', color: '#FFD700' },
  kumo: { name: '云团', emoji: '💙', color: '#4DA6FF' },
  yuzi: { name: '柚子', emoji: '💚', color: '#48D1A0' },
};

// 精选卡片渐变色（按成员）
const FEATURED_ACCENT: Record<string, string> = {
  hakusai: 'from-yellow-100/70 to-amber-50/40',
  kumo: 'from-blue-100/70 to-sky-50/40',
  yuzi: 'from-emerald-100/70 to-green-50/40',
  __extra__: 'from-pink-100/70 to-rose-50/40',
};

export default function GalleryGrid() {
  const [filter, setFilter] = useState('all');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [featured, setFeatured] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/gallery');
      const data = await res.json();
      if (Array.isArray(data.photos)) setPhotos(data.photos);
      if (Array.isArray(data.featured)) setFeatured(data.featured);
    } catch {
      /* 离线时保留当前 */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const memberIds = useMemo(() => Object.keys(META), []);

  // 按成员分组（保持 META 顺序），便于浏览与筛选
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

  return (
    <>
      {/* 成员筛选按钮 */}
      <div className="flex justify-center gap-2 mb-8 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setFilter(f.key);
              setLightboxIdx(null);
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              filter === f.key ? 'text-white shadow-md' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'
            }`}
            style={filter === f.key ? { backgroundColor: f.color } : {}}
          >
            <span>{f.emoji}</span>
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      {/* 骑士团精选 */}
      {!loading && featured.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-bold text-[var(--accent)]">✨ 骑士团精选</span>
            <span className="text-xs text-gray-400">管理员甄选 · {featured.length} 张</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {featured.map((p) => {
              const m = META[p.member] || { name: '其他', emoji: '⭐', color: '#e83e8c' };
              const i = idxOf(p.id);
              return (
                <div
                  key={`feat-${p.id}`}
                  className="relative aspect-[4/5] rounded-3xl overflow-hidden glass cursor-pointer group ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-transparent"
                  onClick={() => i >= 0 && setLightboxIdx(i)}
                >
                  <img
                    src={p.url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    loading="lazy"
                  />
                  <span
                    className="absolute bottom-2 left-2 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full backdrop-blur bg-white/75"
                    style={{ color: m.color }}
                  >
                    {m.emoji} {m.name}
                  </span>
                  <span className="absolute top-2 right-2 text-[10px] bg-[var(--accent)] text-white font-bold px-2 py-0.5 rounded-full">
                    精选
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 图片网格（按成员分组，纯展示） */}
      {loading ? (
        <p className="text-center text-gray-400 py-16">加载中…</p>
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
          {photos.length === 0 && <div className="text-center py-16 text-gray-400">画廊还空着，敬请期待 ✨</div>}
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
    </>
  );
}

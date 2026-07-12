import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ImageUpload from './ImageUpload';
import ImageLightboxOverlay from '../ImageLightboxOverlay';

interface Photo {
  id: string;
  url: string;
  member: string;
}

// 与公网画廊一致的分组顺序：成员（白菜/云团/柚子）→ 不分类
const GROUPS: { key: string; name: string; emoji: string; color: string }[] = [
  { key: 'hakusai', name: '白菜', emoji: '💛', color: '#FFD700' },
  { key: 'kumo', name: '云团', emoji: '💙', color: '#4DA6FF' },
  { key: 'yuzi', name: '柚子', emoji: '💚', color: '#48D1A0' },
  { key: '__extra__', name: '全部 / 不分类', emoji: '⭐', color: '#e83e8c' },
];

// 上传时可选择的分类（与分组一一对应）
const CATEGORY_OPTS = GROUPS.map((g) => ({ value: g.key, label: `${g.emoji} ${g.name}` }));

// 后台「画廊」管理：编辑的是已独立的 gallery_photos（首次从成员简介九宫格复制的快照）。
// 按成员分组展示，组内可单独拖拽排序；在此增删/排序只影响画廊页，与成员简介九宫格完全隔离。
// 前台画廊按 sort 顺序分组展示，与此处一一对应。
export default function AdminGalleryEdit({ code }: { code: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [cat, setCat] = useState('__extra__');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: { src: string }[]; idx: number } | null>(null);
  const photosRef = useRef<Photo[]>([]);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gallery');
      const data = await res.json();
      if (Array.isArray(data.photos)) setPhotos(data.photos);
      else if (data.error) setErr(data.error);
    } catch {
      setErr('加载失败');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (url: string) => {
    if (!url) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify({ url, member: cat }),
      });
      const data = await res.json();
      if (data.ok) {
        setDraft('');
        load();
      } else setErr(data.error || '添加失败');
    } catch {
      setErr('添加失败');
    } finally {
      setBusy(false);
    }
  };

  const del = async (p: Photo) => {
    if (!confirm('从画廊删除这张照片？')) return;
    try {
      const res = await fetch('/api/gallery?id=' + encodeURIComponent(p.id), {
        method: 'DELETE',
        headers: { 'x-admin-code': code },
      });
      const data = await res.json();
      if (data.ok) load();
      else alert(data.error || '删除失败');
    } catch {
      alert('删除失败');
    }
  };

  // ---- 组内拖拽排序：仅在同一成员分组内重排，本地即时更新并写回 sort ----
  const getMember = (id: string) => photosRef.current.find((p) => p.id === id)?.member;

  const applyReorder = (member: string, fromId: string, toId: string) => {
    const prev = photosRef.current;
    const sub = prev.filter((p) => p.member === member);
    const from = sub.findIndex((p) => p.id === fromId);
    const to = sub.findIndex((p) => p.id === toId);
    if (from < 0 || to < 0 || from === to) return; // 跨分组 or 无效 → 不处理
    const nextSub = [...sub];
    const [item] = nextSub.splice(from, 1);
    nextSub.splice(to, 0, item);
    const newFlat = [...prev];
    let k = 0;
    for (let i = 0; i < newFlat.length; i++) {
      if (newFlat[i].member === member) newFlat[i] = nextSub[k++];
    }
    photosRef.current = newFlat; // 立即同步 ref，保证落库顺序准确
    setPhotos(newFlat);
  };

  const persistOrder = useCallback(
    async (arr: Photo[]) => {
      setSaving(true);
      const groups = GROUPS.map((g) => ({
        member: g.key,
        ids: arr.filter((p) => p.member === g.key).map((p) => p.id),
      }));
      try {
        await fetch('/api/gallery', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
          body: JSON.stringify({ groups }),
        });
      } catch {
        /* 忽略 */
      } finally {
        setTimeout(() => setSaving(false), 800);
      }
    },
    [code]
  );

  // 按成员分组（与公网顺序一致），便于浏览与组内排序
  const grouped = useMemo(() => {
    const map = new Map<string, Photo[]>();
    for (const g of GROUPS) map.set(g.key, []);
    for (const p of photos) {
      const key = map.has(p.member) ? p.member : '__extra__';
      map.get(key)!.push(p);
    }
    return GROUPS.map((g) => ({ ...g, items: map.get(g.key)! }));
  }, [photos]);

  const badgeOf = (m: string) => GROUPS.find((g) => g.key === m) || GROUPS[GROUPS.length - 1];

  return (
    <div className="frost-card p-5">
      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">画廊照片（独立）</h3>
      <p className="text-xs text-gray-400 mb-3">
        按成员分组管理（与公网画廊一致）。在此增删/排序只影响画廊页，不碰成员简介九宫格；拖拽卡片可在<strong>同组内</strong>调整顺序，松手自动保存，前台画廊按此分组与顺序展示。
      </p>

      <div className="flex items-center gap-2 mb-4">
        <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">上传到</label>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="flex-1 px-3 py-2 rounded-full text-sm bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-[var(--accent)] transition-colors"
        >
          {CATEGORY_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <ImageUpload
        code={code}
        section="gallery"
        value={draft}
        onChange={(u) => {
          if (u) add(u);
          setDraft('');
        }}
        label={`添加画廊照片（${badgeOf(cat).emoji} ${badgeOf(cat).name}）`}
      />
      {busy && <p className="text-xs text-gray-400 mt-2">上传中…</p>}
      {err && <p className="text-xs text-red-500 mt-2">{err}</p>}

      {loading ? (
        <p className="text-center text-gray-400 py-6">加载中…</p>
      ) : (
        <div className="space-y-6 mt-5">
          {grouped.map((g) => (
            <div key={g.key}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold" style={{ color: g.color }}>
                  {g.emoji} {g.name}
                </span>
                <span className="text-xs text-gray-400">{g.items.length} 张</span>
                {g.items.length > 1 && (
                  <span className="text-[10px] text-gray-300 dark:text-gray-500">· 可拖拽排序</span>
                )}
              </div>
              {g.items.length === 0 ? (
                <p className="text-xs text-gray-300 dark:text-gray-600 py-2">暂无照片</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {g.items.map((p) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => setDragId(p.id)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragId && dragId !== p.id) applyReorder(getMember(dragId) || '', dragId, p.id);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragId(null);
                        persistOrder(photosRef.current);
                      }}
                      onClick={() => setLightbox({ images: g.items.map((x) => ({ src: x.url })), idx: g.items.indexOf(p) })}
                      className={`relative aspect-[4/5] rounded-3xl overflow-hidden glass cursor-grab active:cursor-grabbing group ${
                        dragId === p.id ? 'ring-2 ring-[var(--accent)] opacity-60' : ''
                      }`}
                    >
                      <img
                        src={p.url}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        loading="lazy"
                        draggable={false}
                      />
                      <span className="absolute top-2 left-2 text-[10px] bg-black/45 text-white px-2 py-1 rounded-full">
                        {badgeOf(p.member).emoji}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          del(p);
                        }}
                        className="absolute top-2 right-2 text-xs bg-red-500/80 hover:bg-red-600 text-white px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {saving && <p className="text-xs text-gray-400 mt-3 text-center">排序已保存</p>}

      {lightbox && (
        <ImageLightboxOverlay
          images={lightbox.images}
          currentIndex={lightbox.idx}
          onClose={() => setLightbox(null)}
          onPrev={() => setLightbox((l) => (l ? { ...l, idx: (l.idx - 1 + l.images.length) % l.images.length } : l))}
          onNext={() => setLightbox((l) => (l ? { ...l, idx: (l.idx + 1) % l.images.length } : l))}
        />
      )}
    </div>
  );
}

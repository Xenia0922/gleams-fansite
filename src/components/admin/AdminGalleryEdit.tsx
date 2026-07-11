import { useState, useEffect, useCallback, useRef } from 'react';
import ImageUpload from './ImageUpload';
import ImageLightboxOverlay from '../ImageLightboxOverlay';

interface Photo {
  id: string;
  url: string;
  member: string;
}

const META: Record<string, string> = {
  hakusai: '💛 白菜',
  kumo: '💙 云团',
  yuzi: '💚 柚子',
};

// 上传时可选择的分类：全部(不分类) / 各成员
const CATEGORY_OPTS: { value: string; label: string }[] = [
  { value: '__extra__', label: '全部 / 不分类' },
  { value: 'hakusai', label: '💛 白菜' },
  { value: 'kumo', label: '💙 云团' },
  { value: 'yuzi', label: '💚 柚子' },
];

// 后台「画廊」管理：编辑的是已独立的 gallery_photos（首次从成员简介九宫格复制的快照）。
// 在此增删/排序只影响画廊页，与成员简介九宫格完全隔离；前台画廊按 sort 顺序展示，与此处一一对应。
export default function AdminGalleryEdit({ code }: { code: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [cat, setCat] = useState('__extra__');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
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

  // ---- 拖拽排序：本地重排后写回 sort ----
  const moveTo = useCallback((fromId: string, toId: string) => {
    setPhotos((prev) => {
      const from = prev.findIndex((p) => p.id === fromId);
      const to = prev.findIndex((p) => p.id === toId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  const saveOrder = useCallback(async () => {
    setSaving(true);
    try {
      await fetch('/api/gallery', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify({ order: photosRef.current.map((p) => p.id) }),
      });
    } catch {
      /* 忽略 */
    } finally {
      setTimeout(() => setSaving(false), 800);
    }
  }, [code]);

  const labelOf = (m: string) => META[m] || (m === '__extra__' ? '全部 / 不分类' : m);

  return (
    <div className="frost-card p-5">
      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">画廊照片（独立）</h3>
      <p className="text-xs text-gray-400 mb-3">
        这里展示的是画廊页的独立照片（首次部署已从成员简介九宫格复制了一份快照）。在此增删/排序只影响画廊页，不碰成员简介九宫格；拖拽卡片可调整顺序，松手自动保存，前台画廊按此顺序展示。
      </p>

      <div className="flex items-center gap-2 mb-3">
        <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">分类</label>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="flex-1 px-3 py-2 rounded-full text-sm bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-[var(--accent)] transition-colors"
        >
          {CATEGORY_OPTS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
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
        label="添加画廊照片"
      />
      {busy && <p className="text-xs text-gray-400 mt-2">上传中…</p>}
      {err && <p className="text-xs text-red-500 mt-2">{err}</p>}

      {loading ? (
        <p className="text-center text-gray-400 py-6">加载中…</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
          {photos.map((p, i) => (
            <div
              key={p.id}
              draggable
              onDragStart={() => setDragId(p.id)}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragId && dragId !== p.id) moveTo(dragId, p.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragId(null);
                saveOrder();
              }}
              onClick={() => setLightboxIdx(i)}
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
                {labelOf(p.member)}
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
          {photos.length === 0 && (
            <p className="text-center text-gray-400 py-6 col-span-full">还没有照片，上方添加第一张吧</p>
          )}
        </div>
      )}

      {saving && <p className="text-xs text-gray-400 mt-2 text-center">排序已保存</p>}

      {lightboxIdx !== null && (
        <ImageLightboxOverlay
          images={photos.map((p) => ({ src: p.url }))}
          currentIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onPrev={() => setLightboxIdx((i) => (i !== null ? (i - 1 + photos.length) % photos.length : null))}
          onNext={() => setLightboxIdx((i) => (i !== null ? (i + 1) % photos.length : null))}
        />
      )}
    </div>
  );
}

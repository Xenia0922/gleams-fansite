import { useState, useEffect, useCallback } from 'react';
import ImageUpload from './ImageUpload';

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

// 后台「画廊」管理：编辑的是已独立的 gallery_photos（首次从成员简介九宫格复制的快照）。
// 在此增删只影响画廊页，与成员简介九宫格完全隔离。
export default function AdminGalleryEdit({ code }: { code: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

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
        body: JSON.stringify({ url }),
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

  const labelOf = (m: string) => META[m] || (m === '__extra__' ? '独立添加' : m);

  return (
    <div className="frost-card p-5">
      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">画廊照片（独立）</h3>
      <p className="text-xs text-gray-400 mb-3">
        这里展示的是画廊页的独立照片（首次部署已从成员简介九宫格复制了一份快照）。在此增删只影响画廊页，不碰成员简介九宫格。
      </p>

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
          {photos.map((p) => (
            <div key={p.id} className="frost-card overflow-hidden group relative">
              <img src={p.url} alt="" className="w-full aspect-[4/5] object-cover" loading="lazy" />
              <div className="absolute bottom-0 left-0 right-0 bg-black/45 text-white text-[10px] px-2 py-1 truncate">
                {labelOf(p.member)}
              </div>
              <button
                onClick={() => del(p)}
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
    </div>
  );
}

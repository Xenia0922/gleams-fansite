import { useState, useEffect, useCallback } from 'react';
import ImageUpload from './ImageUpload';

interface Extra {
  id: string;
  url: string;
  caption: string;
}

// 后台「画廊页独立照片」管理：这些照片只展示在照片画廊页，
// 与成员简介九宫格（members.gallery）完全独立，互不影响。
export default function AdminGalleryExtras({ code }: { code: string }) {
  const [extras, setExtras] = useState<Extra[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gallery');
      const data = await res.json();
      if (Array.isArray(data.extras)) setExtras(data.extras);
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

  const del = async (e: Extra) => {
    if (!confirm('从画廊页删除这张照片？')) return;
    try {
      const res = await fetch('/api/gallery?id=' + encodeURIComponent(e.id), {
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

  return (
    <div className="frost-card p-5">
      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">画廊页独立照片</h3>
      <p className="text-xs text-gray-400 mb-3">
        这些照片只展示在「照片画廊」页，和成员简介九宫格互不影响，可单独增删。
      </p>

      <ImageUpload
        code={code}
        section="gallery"
        value={draft}
        onChange={(u) => {
          if (u) add(u);
          setDraft('');
        }}
        label="添加画廊页照片"
      />
      {busy && <p className="text-xs text-gray-400 mt-2">上传中…</p>}
      {err && <p className="text-xs text-red-500 mt-2">{err}</p>}

      {loading ? (
        <p className="text-center text-gray-400 py-6">加载中…</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
          {extras.map((e) => (
            <div key={e.id} className="frost-card overflow-hidden group relative">
              <img src={e.url} alt="" className="w-full aspect-[4/5] object-cover" loading="lazy" />
              <button
                onClick={() => del(e)}
                className="absolute top-2 right-2 text-xs bg-red-500/80 hover:bg-red-600 text-white px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                删除
              </button>
            </div>
          ))}
          {extras.length === 0 && (
            <p className="text-center text-gray-400 py-6 col-span-full">还没有独立照片，上方添加第一张吧</p>
          )}
        </div>
      )}
    </div>
  );
}

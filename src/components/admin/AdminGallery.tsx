import { useState, useEffect, useCallback } from 'react';
import { useEvents } from '../useEvents';

interface Photo {
  key: string;
  url: string;
  uploaded: string;
  member?: string;
  event?: string | null;
  thumbUrl?: string | null;
}

const MEMBER_OPTS = [
  { id: 'hakusai', label: '💛 白菜' },
  { id: 'kumo', label: '💙 云团' },
  { id: 'yuzi', label: '💚 柚子' },
  { id: 'huangyuyu', label: '🩷 黄鱼鱼' },
  { id: 'other', label: '🐙 其他' },
];

export default function AdminGallery({ code }: { code: string }) {
  const { events } = useEvents();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [member, setMember] = useState('other');
  const [event, setEvent] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/photos');
      const data = await res.json();
      if (Array.isArray(data)) setPhotos(data);
      else if (data.error) setErr(data.error);
    } catch { setErr('加载失败'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const upload = async () => {
    if (!file) return;
    setBusy(true); setErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('member', member);
      fd.append('event', event);
      const res = await fetch('/api/photos', { method: 'POST', headers: { 'x-admin-code': code }, body: fd });
      const data = await res.json();
      if (data.ok) { setFile(null); load(); }
      else setErr(data.error || '上传失败');
    } catch { setErr('上传失败'); }
    finally { setBusy(false); }
  };

  const del = async (p: Photo) => {
    if (!confirm('删除这张照片？')) return;
    try {
      const res = await fetch('/api/photos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify({ key: p.key }),
      });
      const data = await res.json();
      if (data.ok) load();
      else alert(data.error || '删除失败');
    } catch { alert('删除失败'); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="frost-card p-4">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">广场返图</h3>
        <p className="text-xs text-gray-400 mb-3">粉丝在广场上传的应援返图（与下方「画廊页独立照片」不是同一处）。</p>
        <div className="flex items-center gap-3 flex-wrap">
          <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} className="text-xs" />
          <select value={member} onChange={e => setMember(e.target.value)} className="text-sm px-3 py-2 rounded-xl bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
            {MEMBER_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <select value={event} onChange={e => setEvent(e.target.value)} className="text-sm px-3 py-2 rounded-xl bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
            <option value="">🎫 关联场次（选填）</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.date} {ev.title}</option>)}
          </select>
          <button onClick={upload} disabled={!file || busy} className="btn-pink text-xs !px-4 !py-1.5 disabled:opacity-50">
            {busy ? '上传中…' : '上传'}
          </button>
        </div>
        {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
      </div>

      {loading ? <p className="text-center text-gray-400 py-8">加载中…</p> : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photos.map(p => (
            <div key={p.key} className="frost-card overflow-hidden group relative">
              <img src={p.thumbUrl || p.url} alt="" className="w-full aspect-[4/5] object-cover" loading="lazy" />
              <button onClick={() => del(p)} className="absolute top-2 right-2 text-xs bg-red-500/80 hover:bg-red-600 text-white px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                删除
              </button>
            </div>
          ))}
          {photos.length === 0 && <p className="text-center text-gray-400 py-8 col-span-full">暂无照片</p>}
        </div>
      )}
    </div>
  );
}

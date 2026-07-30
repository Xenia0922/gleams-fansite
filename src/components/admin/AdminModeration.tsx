import { useState, useEffect, useCallback } from 'react';

interface Photo {
  key: string;
  url: string;
  uploaded: string;
  member?: string;
  event?: string | null;
  status: string;
}

const MEMBER_LABEL: Record<string, string> = {
  hakusai: '💛 白菜',
  kumo: '💙 云团',
  yuzi: '💚 柚子',
  other: '⭐ 多人/其他',
};

/**
 * 待审图片直链（/api/photos?key=uploads/pending/...）会被 servePhoto 强制 403，
 * 普通 <img> 又带不上 x-admin-code 头，所以这里用带鉴权头的 fetch 取成 blob 再渲染。
 * 公众仍无法通过直链看到待审图（无 admin 头即 403）。
 */
function ModerationImage({ url, code }: { url: string; code: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    fetch(url, { headers: { 'x-admin-code': code } })
      .then(r => {
        if (!r.ok) throw new Error('load failed');
        return r.blob();
      })
      .then(blob => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setSrc(objectUrl);
      })
      .catch(() => { if (active) setFailed(true); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, code]);

  if (failed) {
    return <div className="w-full h-full flex items-center justify-center text-[11px] text-red-400">图片加载失败</div>;
  }
  if (!src) {
    return <div className="w-full h-full animate-pulse bg-white/10" />;
  }
  return <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />;
}

export default function AdminModeration({ code }: { code: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/photos?all=1', { headers: { 'x-admin-code': code } });
      const data = await res.json();
      if (Array.isArray(data)) {
        setPhotos(data.filter((p: Photo) => p.status === 'pending'));
      }
    } catch { if (!silent) setErr('加载失败'); }
    if (!silent) setLoading(false);
  }, [code]);

  useEffect(() => { load(); }, [load]);

  const moderate = async (key: string, action: 'approve' | 'reject') => {
    if (action === 'reject' && !confirm('确定拒绝这张照片？将永久删除。')) return;
    setBusy(key);
    setErr('');
    try {
      const res = await fetch('/api/photos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify({ key, action }),
      });
      const data = await res.json();
      if (data.ok) {
        setPhotos(prev => prev.filter(p => p.key !== key));
        setSelected(prev => prev.filter(k => k !== key));
        load(true); // 静默重新拉取，确保与服务端真实状态一致（服务端已写后校验，此处防边缘情况）
      } else {
        setErr(data.error || '操作失败');
      }
    } catch { setErr('操作失败'); }
    setBusy(null);
  };

  const toggleSelect = (key: string) =>
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const allSelected = photos.length > 0 && selected.length === photos.length;
  const toggleSelectAll = () => setSelected(allSelected ? [] : photos.map(p => p.key));

  const batchModerate = async (action: 'approve' | 'reject') => {
    if (selected.length === 0 || batchBusy) return;
    if (action === 'reject' && !confirm(`确定拒绝选中的 ${selected.length} 张照片？将永久删除。`)) return;
    setBatchBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/photos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify({ keys: selected, action }),
      });
      const data = await res.json();
      if (data && data.ok) {
        const okKeys = (data.results || []).filter((r: { ok: boolean }) => r.ok).map((r: { key: string }) => r.key);
        setPhotos(prev => prev.filter(p => !okKeys.includes(p.key)));
        setSelected([]);
        load(true); // 静默重新拉取，确保与服务端真实状态一致
      } else {
        setErr(data?.error || '批量操作失败');
      }
    } catch { setErr('批量操作失败'); }
    setBatchBusy(false);
  };

  if (loading) return <p className="text-center text-gray-400 py-8">加载中…</p>;

  return (
    <div className="frost-card p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">返图审核</h3>
        <div className="flex items-center gap-3">
          {photos.length > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="accent-[var(--accent)] w-4 h-4"
                aria-label="全选待审照片"
              />
              全选
            </label>
          )}
          {photos.length > 0 && (
            <span className="text-xs text-[var(--accent)] font-bold">{photos.length} 张待审</span>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        粉丝上传的照片默认待审核，审核通过后才在广场公开展示。拒绝会永久删除。勾选多张可一键批量通过 / 拒绝。
      </p>
      {err && <p className="text-xs text-red-500 mb-3">{err}</p>}

      {photos.length === 0 ? (
        <p className="text-center text-gray-400 py-8">没有待审核的照片 ✨</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photos.map(p => {
            const isSel = selected.includes(p.key);
            return (
              <div
                key={p.key}
                className={`relative aspect-[4/5] rounded-3xl overflow-hidden glass group ${isSel ? 'ring-2 ring-[var(--accent)]' : ''}`}
              >
                <ModerationImage url={p.url} code={code} />
                {p.member && MEMBER_LABEL[p.member] && (
                  <span className="absolute top-2 left-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/75 backdrop-blur text-gray-600">
                    {MEMBER_LABEL[p.member]}
                  </span>
                )}
                <label
                  className="absolute top-2 right-2 z-10 flex items-center justify-center w-7 h-7 rounded-full bg-black/35 hover:bg-black/55 cursor-pointer backdrop-blur transition-colors"
                  title="选择"
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggleSelect(p.key)}
                    className="accent-[var(--accent)] w-4 h-4"
                    aria-label={`选择 ${p.key}`}
                  />
                </label>
                <div className="absolute inset-x-0 bottom-0 p-2 flex gap-2 bg-gradient-to-t from-black/70 to-transparent">
                  <button
                    onClick={() => moderate(p.key, 'approve')}
                    disabled={busy === p.key || batchBusy}
                    className="flex-1 text-xs bg-green-500 hover:bg-green-600 text-white py-1.5 rounded-full disabled:opacity-50 transition-colors"
                  >通过</button>
                  <button
                    onClick={() => moderate(p.key, 'reject')}
                    disabled={busy === p.key || batchBusy}
                    className="flex-1 text-xs bg-red-500 hover:bg-red-600 text-white py-1.5 rounded-full disabled:opacity-50 transition-colors"
                  >拒绝</button>
                </div>
                {busy === p.key && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 批量操作条：选中后吸底出现 */}
      {selected.length > 0 && (
        <div className="sticky bottom-0 mt-4 -mx-5 -mb-5 px-5 py-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
          <span className="text-xs text-gray-600 dark:text-gray-300">已选 {selected.length} 张</span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelected([])}
              disabled={batchBusy}
              className="text-xs px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-50 transition-colors"
            >取消</button>
            <button
              onClick={() => batchModerate('reject')}
              disabled={batchBusy}
              className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-full disabled:opacity-50 transition-colors"
            >拒绝选中</button>
            <button
              onClick={() => batchModerate('approve')}
              disabled={batchBusy}
              className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-full disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {batchBusy && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              通过选中 {selected.length} 张
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

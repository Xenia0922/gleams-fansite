import { useState } from 'react';

interface Props {
  code: string;
  section: string;
  value: string;
  onChange: (url: string) => void;
  label?: string;
}

const INPUT =
  'w-full px-3 py-2 rounded-xl text-sm bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-[var(--accent)] transition-colors';

// 后台图片上传控件：选图上传到 R2，或粘贴已有图片链接
export default function ImageUpload({ code, section, value, onChange, label = '图片' }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('section', section);
      const res = await fetch('/api/upload', { method: 'POST', headers: { 'x-admin-code': code }, body: fd });
      const data = await res.json();
      if (data.ok) onChange(data.url);
      else setErr(data.error || '上传失败');
    } catch {
      setErr('上传失败，请重试');
    } finally {
      setBusy(false);
      setFile(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt="" className="w-16 h-16 rounded-xl object-cover border border-gray-200 dark:border-white/10" />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-gray-800" />
        )}
        <div className="flex-1 min-w-0">
          <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} className="text-xs w-full" />
          <div className="flex gap-2 mt-1">
            <button type="button" onClick={upload} disabled={!file || busy} className="btn-outline text-xs !px-3 !py-1 disabled:opacity-50">
              {busy ? '上传中…' : '上传'}
            </button>
            {value && (
              <button type="button" onClick={() => onChange('')} className="text-xs text-red-400 hover:text-red-600 px-2 py-1">
                清除
              </button>
            )}
          </div>
        </div>
      </div>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="或粘贴图片链接（/images/... 或 http(s)://）"
        className={INPUT + ' mt-2'}
      />
      {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
    </div>
  );
}

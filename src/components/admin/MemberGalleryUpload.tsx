import { useRef, useState } from 'react';

interface Props {
  code: string;
  section: string;
  value: string[];
  onChange: (urls: string[]) => void;
  label?: string;
}

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX = 15 * 1024 * 1024;

// 成员画廊（九宫格）多图上传：逐个上传 + 缩略图 + 拖动排序
export default function MemberGalleryUpload({ code, section, value, onChange, label = '画廊图片' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const add = async (file?: File | null) => {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) { setErr('仅支持 JPG / PNG / WEBP / GIF'); return; }
    if (file.size > MAX) { setErr('图片过大，请控制在 15MB 以内'); return; }
    setBusy(true);
    setErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('section', section);
      const res = await fetch('/api/upload', { method: 'POST', headers: { 'x-admin-code': code }, body: fd });
      const data = await res.json();
      if (data.ok) onChange([...value, data.url]);
      else setErr(data.error || '上传失败');
    } catch {
      setErr('上传失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    add(e.target.files?.[0]);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    add(e.dataTransfer.files?.[0]);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
    if (item) { e.preventDefault(); add(item.getAsFile()); }
  };

  const handleReorder = (i: number) => {
    if (dragIdx === null || dragIdx === i) return;
    const next = [...value];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(i, 0, moved);
    onChange(next);
    setDragIdx(null);
  };

  return (
    <div onPaste={onPaste}>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {value.map((url, i) => (
          <div
            key={i}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleReorder(i)}
            onDragEnd={() => setDragIdx(null)}
            className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-white/10 cursor-grab active:cursor-grabbing"
          >
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="删除图片"
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            >×</button>
          </div>
        ))}
        <div
          onClick={() => !busy && inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!busy) inputRef.current?.click(); } }}
          aria-label={`${label}：点击或拖拽图片上传`}
          className={
            'relative flex items-center justify-center aspect-square rounded-xl cursor-pointer border transition-colors ' +
            (drag
              ? 'border-[var(--accent)] bg-[var(--accent)]/5'
              : 'border-dashed border-gray-300 dark:border-white/15 hover:border-[var(--accent)]')
          }
        >
          {busy ? (
            <span className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className="text-gray-300 dark:text-gray-600 text-2xl">＋</span>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
      {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
      <p className="text-[10px] text-gray-400 mt-1">逐个上传，拖动缩略图可调整顺序；JPG / PNG / WEBP / GIF，≤15MB</p>
    </div>
  );
}

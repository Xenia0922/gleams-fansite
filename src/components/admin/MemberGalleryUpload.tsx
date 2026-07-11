import { useRef, useState, useEffect } from 'react';

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

  // 渲染期把最新 value 直接挂到 ref（React 官方推荐的「最新值」写法，比 useEffect 异步同步更及时、无时序缝隙）。
  // 所有写操作都基于它累加，彻底杜绝「旧 prop / 异步上传相交导致添加丢图、删错图」。
  const valueRef = useRef<string[]>(value);
  valueRef.current = value;

  // 单一入口：基于最新值计算新数组并回传。添加 / 删除 / 排序全部走这里，互不覆盖。
  const commit = (updater: (prev: string[]) => string[]) => {
    onChange(updater(valueRef.current));
  };

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
      if (data.ok) commit(prev => [...prev, data.url]);
      else setErr(data.error || '上传失败');
    } catch {
      setErr('上传失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  // 文档级粘贴捕获（焦点不在输入框时）。用 ref 持有最新 add，避免反复绑定 / 解绑。
  const addRef = useRef<(f?: File | null) => void>(() => {});
  addRef.current = add;
  useEffect(() => {
    const onDocPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'));
      if (item) {
        e.preventDefault();
        addRef.current(item.getAsFile());
      }
    };
    document.addEventListener('paste', onDocPaste);
    return () => document.removeEventListener('paste', onDocPaste);
  }, []);

  // 删除按 URL 而非下标：无论列表顺序、并发上传如何变化，都精确删掉点的那张，绝不误删。
  const remove = (url: string) => commit(prev => prev.filter(u => u !== url));

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    add(e.target.files?.[0]);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    add(e.dataTransfer.files?.[0]);
  };

  const handleReorder = (i: number) => {
    if (dragIdx === null || dragIdx === i) return;
    commit(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(i, 0, moved);
      return next;
    });
    setDragIdx(null);
  };

  return (
    <div>
      <div className={'grid grid-cols-3 sm:grid-cols-4 gap-2 ' + (drag ? 'rounded-xl ring-2 ring-[var(--accent)]/40' : '')}>
        {value.map((url, i) => (
          <div
            key={url}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleReorder(i)}
            onDragEnd={() => setDragIdx(null)}
            className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-white/10 cursor-grab active:cursor-grabbing"
          >
            <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
            <button
              type="button"
              onClick={e => { e.stopPropagation(); e.preventDefault(); remove(url); }}
              onMouseDown={e => e.stopPropagation()}
              onDragStart={e => e.stopPropagation()}
              aria-label="删除图片"
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity z-10"
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
          aria-label={`${label}：点击或拖拽图片上传，也可直接粘贴剪贴板图片`}
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
      <p className="text-[10px] text-gray-400 mt-1">逐个上传，拖动缩略图可调整顺序；也可直接 Ctrl/⌘+V 粘贴剪贴板图片；JPG / PNG / WEBP / GIF，≤15MB</p>
    </div>
  );
}

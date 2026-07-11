import { useState, useRef, useCallback, useEffect } from 'react';
import { useEvents } from './useEvents';

const MEMBERS = [
  { id: 'hakusai', emoji: '💛', name: '白菜' },
  { id: 'kumo', emoji: '💙', name: '云团' },
  { id: 'yuzi', emoji: '💚', name: '柚子' },
  { id: 'other', emoji: '⭐', name: '多人/其他' },
];

const MAX_FILES = 9;
const MAX_SIZE = 23 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function getCode(): string | null {
  if (typeof window === 'undefined') return null;
  const entry = localStorage.getItem('gleams-code');
  if (!entry) return null;
  try {
    const { code, ts } = JSON.parse(entry);
    if (Date.now() - ts < 30 * 60 * 1000) return code;
    localStorage.removeItem('gleams-code');
  } catch {
    localStorage.removeItem('gleams-code');
  }
  return null;
}

interface Item { id: string; file: File; preview: string; }

export default function FanUpload() {
  const { events } = useEvents();
  const [member, setMember] = useState('other');
  const [event, setEvent] = useState('');
  const [nickname, setNickname] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [code, setCode] = useState(() => getCode() || '');
  const [verified, setVerified] = useState(() => !!getCode());
  const fileRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    items.forEach(it => URL.revokeObjectURL(it.preview));
    mountedRef.current = false;
  }, []); // eslint-disable-line

  const addFiles = useCallback((list: FileList | null) => {
    if (!list || list.length === 0) return;
    const accepted: File[] = [];
    for (const f of Array.from(list)) {
      if (!ALLOWED.includes(f.type)) { setMsg('❌ 仅支持 JPG/PNG/WEBP/GIF'); return; }
      if (f.size > MAX_SIZE) { setMsg('❌ 单张图片不能超过 23MB'); return; }
      accepted.push(f);
    }
    setItems(prev => {
      const next = [...prev, ...accepted.map(f => ({ id: (crypto as any).randomUUID(), file: f, preview: URL.createObjectURL(f) }))];
      if (next.length > MAX_FILES) {
        next.slice(MAX_FILES).forEach(it => URL.revokeObjectURL(it.preview));
        setMsg(`⚠️ 一次最多 ${MAX_FILES} 张，已保留前 ${MAX_FILES} 张`);
        return next.slice(0, MAX_FILES);
      }
      setMsg('');
      return next;
    });
  }, []);

  const removeItem = (id: string) => {
    setItems(prev => {
      const target = prev.find(it => it.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter(it => it.id !== id);
    });
  };

  const handleVerify = () => {
    if (!code.trim()) return;
    localStorage.setItem('gleams-code', JSON.stringify({ code: code.trim(), ts: Date.now() }));
    window.dispatchEvent(new Event('gleams-code-set'));
    setVerified(true);
  };

  useEffect(() => {
    const onSet = () => { const c = getCode(); if (c) { setCode(c); setVerified(true); } };
    const onClear = () => { setCode(''); setVerified(false); };
    window.addEventListener('gleams-code-set', onSet);
    window.addEventListener('gleams-code-clear', onClear);
    return () => {
      window.removeEventListener('gleams-code-set', onSet);
      window.removeEventListener('gleams-code-clear', onClear);
    };
  }, []);

  const handleUpload = async () => {
    if (items.length === 0) return;
    setUploading(true);
    setMsg('');
    const fd = new FormData();
    items.forEach(it => fd.append('files', it.file));
    fd.append('member', member);
    fd.append('nickname', nickname || '匿名骑士');
    fd.append('event', event);
    fd.append('code', code.trim());
    try {
      const res = await fetch('/api/photos', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.ok) {
        setMsg(`✅ 已上传 ${data.count || items.length} 张，感谢分享！`);
        items.forEach(it => URL.revokeObjectURL(it.preview));
        setItems([]);
        // 刷新浏览区的画廊
        window.dispatchEvent(new Event('tab-browse-visible'));
        timerRef.current = setTimeout(() => { if (mountedRef.current) setMsg(''); }, 3000);
      } else {
        setMsg('❌ ' + (data.error || '上传失败'));
        if (res.status === 403) {
          localStorage.removeItem('gleams-code');
          window.dispatchEvent(new Event('gleams-code-clear'));
          setVerified(false);
        }
      }
    } catch {
      setMsg('❌ 网络错误');
    }
    setUploading(false);
  };

  if (!verified) {
    return (
      <div className="frost-card p-8 text-center">
        <p className="text-gray-500 mb-4 text-sm">请输入骑士团暗号以上传照片</p>
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="暗号（在 QQ 群获取）"
          className="w-full max-w-xs px-4 py-2 rounded-full text-sm text-center bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-[var(--accent)] transition-colors"
          onKeyDown={e => e.key === 'Enter' && handleVerify()}
        />
        <button onClick={handleVerify} className="btn-pink text-xs mt-3 !px-4 !py-1.5">验证</button>
      </div>
    );
  }

  const selCls = 'w-full px-4 py-2 rounded-full text-sm text-center bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-[var(--accent)] transition-colors';

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2 mb-4 justify-center">
        {MEMBERS.map(m => (
          <button
            key={m.id}
            onClick={() => setMember(m.id)}
            className={`inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              member === m.id ? 'text-white shadow-md' : 'text-gray-500 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10'
            }`}
            style={member === m.id ? { backgroundColor: m.id === 'hakusai' ? '#FFD700' : m.id === 'kumo' ? '#4DA6FF' : m.id === 'yuzi' ? '#48D1A0' : '#e83e8c' } : {}}
          >
            {m.emoji} {m.name}
          </button>
        ))}
      </div>

      {/* 关联场次 */}
      <select value={event} onChange={e => setEvent(e.target.value)} className={`${selCls} max-w-xs mx-auto block mb-4`}>
        <option value="">🎫 关联场次（选填）</option>
        {events.map(e => (
          <option key={e.id} value={e.id}>{e.date} {e.title}</option>
        ))}
      </select>

      <div className="frost-card p-6 text-center">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={e => { addFiles(e.target.files); if (e.target) (e.target as HTMLInputElement).value = ''; }}
          className="hidden"
          id="fan-upload-input"
        />
        <label htmlFor="fan-upload-input" className="cursor-pointer inline-flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-3xl glass flex items-center justify-center text-3xl">📸</div>
          <span className="text-sm text-gray-400">点击选择照片（最多 9 张，单张 ≤23MB）</span>
        </label>

        {items.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-4">
            {items.map(it => (
              <div key={it.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-white/10 group">
                <img src={it.preview} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeItem(it.id)}
                  aria-label="移除这张"
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >×</button>
              </div>
            ))}
          </div>
        )}

        <input
          type="text"
          value={nickname}
          onChange={e => setNickname(e.target.value)}
          placeholder="你的昵称（选填）"
          maxLength={20}
          className={`${selCls} mt-4 block mx-auto w-full max-w-xs`}
        />

        <button
          onClick={handleUpload}
          disabled={items.length === 0 || uploading}
          className="btn-pink mt-4 text-sm disabled:opacity-50"
        >
          {uploading ? '上传中...' : `上传 ${items.length > 0 ? items.length + ' 张' : ''}`.trim()}
        </button>

        {msg && (
          <p className={`mt-3 text-sm ${msg.startsWith('❌') ? 'text-red-400' : msg.startsWith('⚠️') ? 'text-amber-500' : 'text-green-500'}`}>
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}

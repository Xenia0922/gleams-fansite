import { useState, useRef, useCallback, useEffect } from 'react';

const MEMBERS = [
  { id: 'hakusai', emoji: '💛', name: '白菜' },
  { id: 'kumo', emoji: '💙', name: '云团' },
  { id: 'yuzi', emoji: '💚', name: '柚子' },
  { id: 'other', emoji: '⭐', name: '多人/其他' },
];

/**
 * 浏览器端生成缩略图：把原图按长边缩放到 maxEdge，导出 webp（不支持则 jpeg）。
 * 返回 null 时调用方应回退为只上传原图。
 */
async function makeThumbnail(file: File, maxEdge = 480): Promise<File | null> {
  try {
    if (typeof document === 'undefined') return null;
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bmp.close?.();
      return null;
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob(res, 'image/webp', 0.82)
    );
    if (!blob) return null;
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], `thumb.${ext}`, { type: blob.type });
  } catch {
    return null;
  }
}

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

export default function FanUpload() {
  const [member, setMember] = useState('other');
  const [nickname, setNickname] = useState('');
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [code, setCode] = useState(() => getCode() || '');
  const [verified, setVerified] = useState(() => !!getCode());
  const fileRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<FileReader | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    readerRef.current?.abort();
    if (timerRef.current) clearTimeout(timerRef.current);
    mountedRef.current = false;
  }, []);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(f.type)) {
      setMsg('❌ 仅支持 JPG/PNG/WEBP/GIF/HEIC');
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      setMsg('❌ 图片不能超过 15MB');
      return;
    }
    setMsg('');
    const reader = new FileReader();
    readerRef.current = reader;
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }, []);

  const handleVerify = () => {
    if (!code.trim()) return;
    localStorage.setItem('gleams-code', JSON.stringify({ code: code.trim(), ts: Date.now() }));
    window.dispatchEvent(new Event('gleams-code-set'));
    setVerified(true);
  };

  useEffect(() => {
    const onSet = () => {
      const c = getCode();
      if (c) { setCode(c); setVerified(true); }
    };
    const onClear = () => { setCode(''); setVerified(false); };
    window.addEventListener('gleams-code-set', onSet);
    window.addEventListener('gleams-code-clear', onClear);
    return () => {
      window.removeEventListener('gleams-code-set', onSet);
      window.removeEventListener('gleams-code-clear', onClear);
    };
  }, []);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg('');
    const thumb = await makeThumbnail(file);
    const fd = new FormData();
    fd.append('file', file);
    if (thumb) fd.append('thumb', thumb);
    fd.append('member', member);
    fd.append('nickname', nickname || '匿名骑士');
    fd.append('code', code.trim());
    try {
      const res = await fetch('/api/photos', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.ok) {
        setMsg('上传成功！感谢分享 ✨');
        setPreview(null);
        if (fileRef.current) fileRef.current.value = '';
        timerRef.current = setTimeout(() => {
          if (mountedRef.current) setMsg('');
        }, 3000);
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
          className="w-full max-w-xs px-4 py-2 rounded-full text-sm text-center bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-pink-400 transition-colors"
          onKeyDown={e => e.key === 'Enter' && handleVerify()}
        />
        <button onClick={handleVerify} className="btn-pink text-xs mt-3 !px-4 !py-1.5">
          验证
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2 mb-4 justify-center">
        {MEMBERS.map(m => (
          <button
            key={m.id}
            onClick={() => setMember(m.id)}
            className={`inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              member === m.id
                ? 'text-white shadow-md'
                : 'text-gray-500 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10'
            }`}
            style={member === m.id ? { backgroundColor: m.id === 'hakusai' ? '#FFD700' : m.id === 'kumo' ? '#4DA6FF' : m.id === 'yuzi' ? '#48D1A0' : '#e83e8c' } : {}}
          >
            {m.emoji} {m.name}
          </button>
        ))}
      </div>

      <div className="frost-card p-6 text-center">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFile}
          className="hidden"
          id="fan-upload-input"
        />
        <label
          htmlFor="fan-upload-input"
          className="cursor-pointer inline-flex flex-col items-center gap-3"
        >
          {preview ? (
            <img src={preview} alt="预览" className="max-h-48 rounded-3xl shadow-lg" />
          ) : (
            <div className="w-20 h-20 rounded-3xl glass flex items-center justify-center text-3xl">
              📸
            </div>
          )}
          <span className="text-sm text-gray-400">点击选择照片（最大 15MB）</span>
        </label>

        <input
          type="text"
          value={nickname}
          onChange={e => setNickname(e.target.value)}
          placeholder="你的昵称（选填）"
          maxLength={20}
          className="mt-4 block mx-auto w-full max-w-xs px-4 py-2 rounded-full text-sm text-center bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-pink-400 transition-colors"
        />

        <button
          onClick={handleUpload}
          disabled={!preview || uploading}
          className="btn-pink mt-4 text-sm"
        >
          {uploading ? '上传中...' : '上传照片'}
        </button>

        {msg && (
          <p className={`mt-3 text-sm ${msg.startsWith('❌') ? 'text-red-400' : 'text-green-500'}`}>
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}

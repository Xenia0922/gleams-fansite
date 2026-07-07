import { useState, useRef, useCallback } from 'react';

const MEMBERS = [
  { id: 'hakusai', emoji: '💛', name: '白菜' },
  { id: 'kumo', emoji: '💙', name: '云团' },
  { id: 'yuzi', emoji: '💚', name: '柚子' },
  { id: 'other', emoji: '⭐', name: '多人/其他' },
];

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

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }, []);

  const handleVerify = () => {
    if (!code.trim()) return;
    localStorage.setItem('gleams-code', JSON.stringify({ code: code.trim(), ts: Date.now() }));
    setVerified(true);
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg('');
    const fd = new FormData();
    fd.append('file', file);
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
      } else {
        setMsg('❌ ' + (data.error || '上传失败'));
        if (res.status === 403) {
          localStorage.removeItem('gleams-code');
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
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic"
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
          <span className="text-sm text-gray-400">点击选择照片（最大 8MB）</span>
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

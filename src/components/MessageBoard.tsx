import { useState, useEffect, useCallback } from 'react';

const MEMBERS = [
  { id: 'hakusai', emoji: '💛', name: '白菜' },
  { id: 'kumo', emoji: '💙', name: '云团' },
  { id: 'yuzi', emoji: '💚', name: '柚子' },
  { id: null, emoji: '⭐', name: '全员' },
];

interface Message {
  id: string;
  name: string;
  message: string;
  member: string | null;
  created_at: string;
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

export default function MessageBoard({ readonly }: { readonly?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [member, setMember] = useState<string | null>(null);
  const [code, setCode] = useState(() => getCode() || '');
  const [verified, setVerified] = useState(() => !!getCode());
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/messages');
      const data = await res.json();
      if (Array.isArray(data)) setMessages(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

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

  const handleVerify = () => {
    if (!code.trim()) return;
    localStorage.setItem('gleams-code', JSON.stringify({ code: code.trim(), ts: Date.now() }));
    window.dispatchEvent(new Event('gleams-code-set'));
    setVerified(true);
  };

  const handlePost = async () => {
    if (!text.trim()) return;
    setPosting(true);
    setMsg('');
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || '匿名骑士',
          message: text.trim(),
          member,
          code: code.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setText('');
        await fetchMessages();
      } else {
        setMsg('❌ ' + (data.error || '发送失败'));
        if (res.status === 403) {
          localStorage.removeItem('gleams-code');
          window.dispatchEvent(new Event('gleams-code-clear'));
          setVerified(false);
        }
      }
    } catch {
      setMsg('❌ 网络错误');
    }
    setPosting(false);
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts + 'Z');
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const messageListEl = (
    <div className="space-y-3">
      {messages.map(msg => (
        <div key={msg.id} className="frost-card p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{msg.name}</span>
            {msg.member && (
              <span className="text-xs bg-white/40 dark:bg-white/10 px-2 py-0.5 rounded-full text-gray-500">
                {MEMBERS.find(m => m.id === msg.member)?.emoji}
              </span>
            )}
            <span className="text-xs text-gray-400 ml-auto">{formatTime(msg.created_at)}</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words">{msg.message}</p>
        </div>
      ))}
    </div>
  );

  if (readonly) {
    if (loading) return <p className="text-center text-gray-400 py-8">加载中...</p>;
    if (messages.length === 0) return <p className="text-center text-gray-400 py-8">还没有留言 ✨</p>;
    return messageListEl;
  }

  if (!verified) {
    return (
      <div className="frost-card p-8 text-center">
        <p className="text-gray-500 mb-4 text-sm">请输入骑士团暗号以参与互动</p>
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
      {/* 发留言 */}
      <div className="frost-card p-5 mb-6">
        <div className="flex flex-wrap gap-1.5 mb-3 justify-center">
          {MEMBERS.map(m => (
            <button
              key={String(m.id)}
              onClick={() => setMember(m.id)}
              className={`text-xs px-3 py-1 rounded-full transition-all ${
                member === m.id
                  ? 'text-white'
                  : 'bg-gray-100 dark:bg-white/5 text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10'
              }`}
              style={member === m.id ? { backgroundColor: m.id === 'hakusai' ? '#FFD700' : m.id === 'kumo' ? '#4DA6FF' : m.id === 'yuzi' ? '#48D1A0' : '#e83e8c' } : {}}
            >
              {m.emoji} {m.name}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="你的昵称（选填）"
          maxLength={30}
          className="w-full px-4 py-2 rounded-full text-sm bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-pink-400 transition-colors mb-3"
        />
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="写下你想对 Gleams 说的话..."
          maxLength={500}
          rows={3}
          className="w-full px-4 py-3 rounded-3xl text-sm bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-pink-400 transition-colors resize-none"
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-gray-400">{text.length}/500</span>
          <button
            onClick={handlePost}
            disabled={!text.trim() || posting}
            className="btn-pink text-xs !px-4 !py-1.5"
          >
            {posting ? '发送中...' : '发送留言'}
          </button>
        </div>
        {msg && <p className={`mt-2 text-xs ${msg.startsWith('❌') ? 'text-red-400' : 'text-green-500'}`}>{msg}</p>}
      </div>

      {/* 留言列表 */}
      {loading ? (
        <p className="text-center text-gray-400 py-8">加载中...</p>
      ) : messages.length === 0 ? (
        <p className="text-center text-gray-400 py-8">还没有留言，来当第一个吧 ✨</p>
      ) : (
        messageListEl
      )}
    </div>
  );
}

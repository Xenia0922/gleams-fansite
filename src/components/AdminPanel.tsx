import { useState, useEffect, useCallback } from 'react';

interface Photo {
  key: string;
  url: string;
  uploaded: string;
  thumbUrl?: string | null;
}

interface Message {
  id: string;
  name: string;
  message: string;
  member: string | null;
  created_at: string;
}

export default function AdminPanel() {
  const [code, setCode] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('gleams-admin') || '';
    return '';
  });
  const [authed, setAuthed] = useState(() => {
    if (typeof window !== 'undefined') return !!localStorage.getItem('gleams-admin');
    return false;
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [tab, setTab] = useState<'messages' | 'photos'>('messages');
  const [loading, setLoading] = useState(false);

  const login = () => {
    if (!code.trim()) return;
    localStorage.setItem('gleams-admin', code.trim());
    setAuthed(true);
  };

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/messages');
      const data = await res.json();
      if (Array.isArray(data)) setMessages(data);
    } catch {}
    setLoading(false);
  }, []);

  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/photos');
      const data = await res.json();
      if (Array.isArray(data)) setPhotos(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authed) return;
    if (tab === 'messages') fetchMessages();
    else fetchPhotos();
  }, [authed, tab, fetchMessages, fetchPhotos]);

  const delMessage = async (m: Message) => {
    if (!confirm(`删除「${m.name}」的留言？`)) return;
    try {
      const res = await fetch('/api/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify({ id: m.id }),
      });
      const data = await res.json();
      if (data.ok) fetchMessages();
      else alert(data.error || '删除失败');
    } catch {
      alert('网络错误，删除失败');
    }
  };

  const delPhoto = async (p: Photo) => {
    if (!confirm('删除这张照片？')) return;
    try {
      const res = await fetch('/api/photos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify({ key: p.key }),
      });
      const data = await res.json();
      if (data.ok) fetchPhotos();
      else alert(data.error || '删除失败');
    } catch {
      alert('网络错误，删除失败');
    }
  };

  if (!authed) {
    return (
      <div className="frost-card p-8 text-center max-w-sm mx-auto">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">管理员登录</h2>
        <input
          type="password"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="管理员暗号"
          className="w-full px-4 py-2 rounded-full text-sm text-center bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-pink-400 transition-colors mb-3"
          onKeyDown={e => e.key === 'Enter' && login()}
        />
        <button onClick={login} className="btn-pink text-xs !px-4 !py-1.5">进入</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-3 mb-6 justify-center">
        <button
          onClick={() => setTab('messages')}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
            tab === 'messages' ? 'btn-pink' : 'btn-outline'
          }`}
        >
          留言管理
        </button>
        <button
          onClick={() => setTab('photos')}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
            tab === 'photos' ? 'btn-pink' : 'btn-outline'
          }`}
        >
          照片管理
        </button>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-8">加载中...</p>
      ) : tab === 'messages' ? (
        <div className="space-y-3">
          {messages.map(m => (
            <div key={m.id} className="frost-card p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{m.name}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(m.created_at + 'Z').toLocaleString('zh-CN')}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 break-words">{m.message}</p>
              </div>
              <button
                onClick={() => delMessage(m)}
                className="flex-shrink-0 text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                删除
              </button>
            </div>
          ))}
          {messages.length === 0 && <p className="text-center text-gray-400 py-8">暂无留言</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photos.map(p => (
            <div key={p.key} className="frost-card overflow-hidden group relative">
              <img src={p.thumbUrl || p.url} alt="" className="w-full aspect-[4/5] object-cover" loading="lazy" />
              <button
                onClick={() => delPhoto(p)}
                className="absolute top-2 right-2 text-xs bg-red-500/80 hover:bg-red-600 text-white px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
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

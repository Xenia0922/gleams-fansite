import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useEvents } from './useEvents';
import { tint } from '../utils/members';
import Skeleton from './Skeleton';
import SkeletonSwap from './SkeletonSwap';
import Turnstile from './Turnstile';
import EmojiPicker from './EmojiPicker';

// 默认成员列表（SSR 未注入时的 fallback）
const FALLBACK_MEMBERS = [
  { id: 'hakusai', emoji: '💛', name: '白菜', color: '#C99A00' },
  { id: 'kumo', emoji: '💙', name: '云团', color: '#2F6FED' },
  { id: 'yuzi', emoji: '💚', name: '柚子', color: '#1E9E6A' },
  { id: null as string | null, emoji: '⭐', name: '全员', color: '#e83e8c' },
];

// 与返图发布页（FanUpload）同款下拉/输入框样式，保证两套表单视觉一致
const selCls = 'w-full px-4 py-2 rounded-full text-sm text-center bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-[var(--accent)] transition-colors';

interface Message {
  id: string;
  name: string;
  message: string;
  member: string | null;
  event?: string | null;
  created_at: string;
}

export default function MessageBoard({ readonly }: { readonly?: boolean }) {
  const { events, map } = useEvents();
  const ssr = typeof window !== 'undefined' ? (window as any).__SSR_DATA__ : null;

  // 动态成员列表 + metaMap：优先 SSR 注入，fallback 硬编码
  const members = useMemo(() => {
    if (ssr?.membersMeta && ssr.membersMeta.length) {
      return [
        ...ssr.membersMeta.map((m: any) => ({ id: m.id, emoji: m.emoji || '⭐', name: m.name, color: m.color || '#e83e8c' })),
        { id: null as string | null, emoji: '⭐', name: '全员', color: '#e83e8c' },
      ];
    }
    return FALLBACK_MEMBERS;
  }, [ssr]);

  const metaMap = useMemo(() => {
    const m = new Map<string, { emoji: string; name: string; color: string }>();
    for (const mm of members) {
      if (mm.id) m.set(mm.id, { emoji: mm.emoji, name: mm.name, color: mm.color });
    }
    return m;
  }, [members]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [member, setMember] = useState<string | null>(null);
  const [event, setEvent] = useState('');
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 在 textarea 光标处插入 emoji
  const insertEmoji = useCallback((emoji: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setText(prev => prev + emoji);
      return;
    }
    const start = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? text.length;
    const newText = text.slice(0, start) + emoji + text.slice(end);
    setText(newText);
    // 恢复光标到 emoji 后
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + emoji.length;
      ta.setSelectionRange(pos, pos);
    });
  }, [text]);

  // Turnstile：site key 硬编码在组件内（公开值），未配置 secret 时后端 fail-open
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileReady, setTurnstileReady] = useState(false);

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
    window.addEventListener('tab-browse-visible', fetchMessages);
    return () => window.removeEventListener('tab-browse-visible', fetchMessages);
  }, [fetchMessages]);

  useEffect(() => {
    const onFilter = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setFilter(detail === '' || detail == null ? null : detail);
    };
    window.addEventListener('fan-member-filter', onFilter);
    const onEventFilter = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setEventFilter(detail === '' || detail == null ? null : detail);
    };
    window.addEventListener('fan-event-filter', onEventFilter);
    return () => {
      window.removeEventListener('fan-member-filter', onFilter);
      window.removeEventListener('fan-event-filter', onEventFilter);
    };
  }, []);

  const handlePost = async () => {
    if (!text.trim()) return;
    if (turnstileReady && !turnstileToken) {
      setMsg('❌ 请先完成人机验证');
      return;
    }
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
          event: event || null,
          turnstileToken,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setText('');
        setTurnstileToken('');
        await fetchMessages();
      } else {
        setMsg('❌ ' + (data.error || '发送失败'));
      }
    } catch {
      setMsg('❌ 网络错误');
    }
    setPosting(false);
  };

  const formatTime = (ts: string) => {
    if (!ts) return '';
    const d = new Date(ts.endsWith('Z') ? ts : ts + 'Z');
    if (isNaN(d.getTime())) return '';
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const NAMED = ['hakusai', 'kumo', 'yuzi'];
  const visibleMessages = messages.filter(m =>
    (!filter || (filter === 'other' ? !NAMED.includes(m.member ?? '') : m.member === filter)) &&
    (!eventFilter || m.event === eventFilter)
  );

  const messageListEl = (
    <div className="space-y-3">
      {visibleMessages.map(msg => (
        <div key={msg.id} className="frost-card p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{msg.name}</span>
            {msg.member && metaMap.has(msg.member) && (() => {
              const m = metaMap.get(msg.member)!;
              return (
                <span
                  className="inline-flex items-center gap-1 text-[13px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ color: m.color, backgroundColor: tint(m.color, 0.12) }}
                >
                  {m.emoji} {m.name}
                </span>
              );
            })()}
            {msg.event && map[msg.event] && (
              <span className="inline-flex items-center gap-1 text-[12px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400">
                🎫 {map[msg.event].date} {map[msg.event].title}
              </span>
            )}
            <span className="text-xs text-gray-400 ml-auto">{formatTime(msg.created_at)}</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words">{msg.message}</p>
        </div>
      ))}
      {visibleMessages.length === 0 && (
        <p className="text-center text-gray-400 py-8">{(filter || eventFilter) ? '该筛选下还没有留言 ✨' : '该成员还没有留言 ✨'}</p>
      )}
    </div>
  );

  if (readonly) {
    if (!loading && visibleMessages.length === 0) return <p className="text-center text-gray-400 py-8">{(filter || eventFilter) ? '该筛选下还没有留言 ✨' : '还没有留言 ✨'}</p>;
    return (
      <SkeletonSwap
        loading={loading}
        skeleton={
          <div className="space-y-3" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="frost-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="h-4 w-20 rounded-full" />
                  <Skeleton className="h-3 w-14 rounded-full ml-auto" />
                </div>
                <Skeleton className="h-3 rounded-full w-full mb-1.5" />
                <Skeleton className="h-3 rounded-full w-2/3" />
              </div>
            ))}
          </div>
        }
      >
        {messageListEl}
      </SkeletonSwap>
    );
  }

  return (
    <div className="w-full">
      {/* 成员选择 + 关联场次 — 与返图发布页一致，置于白框外 */}
      <div className="flex flex-wrap gap-2 mb-4 justify-center">
        {members.map(m => (
          <button
            key={String(m.id)}
            onClick={() => setMember(m.id)}
            className={`inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              member === m.id ? 'text-white shadow-md' : 'text-gray-500 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10'
            }`}
            style={member === m.id ? { backgroundColor: m.color } : {}}
          >
            {m.emoji} {m.name}
          </button>
        ))}
      </div>

      <select
        value={event}
        onChange={e => setEvent(e.target.value)}
        className={`${selCls} max-w-xs mx-auto block mb-4`}
      >
        <option value="">🎫 关联场次（选填）</option>
        {events.map(e => (
          <option key={e.id} value={e.id}>{e.date} {e.title}</option>
        ))}
      </select>

      {/* 白框内只放正文 + 底部昵称 + 验证 + 发送 */}
      <div className="frost-card p-6 text-center">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="写下你想对 Gleams 说的话..."
            maxLength={500}
            rows={3}
            className="w-full px-4 py-3 pr-12 rounded-3xl text-sm text-left bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-[var(--accent)] transition-colors resize-none"
          />
          <button
            type="button"
            onClick={() => setEmojiOpen(v => !v)}
            className="absolute right-3 bottom-3 w-8 h-8 rounded-full flex items-center justify-center text-lg hover:bg-[var(--accent-soft)] hover:scale-110 active:scale-95 transition-all"
            aria-label="插入 emoji"
            aria-expanded={emojiOpen}
          >
            😊
          </button>
          {emojiOpen && (
            <EmojiPicker onPick={insertEmoji} onClose={() => setEmojiOpen(false)} />
          )}
        </div>

        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="你的昵称（选填）"
          maxLength={30}
          className={`${selCls} mt-4 block mx-auto w-full max-w-xs`}
        />

        <div className="mt-4">
          <Turnstile onToken={setTurnstileToken} onReady={() => setTurnstileReady(true)} />
        </div>

        <button
          onClick={handlePost}
          disabled={!text.trim() || posting || (turnstileReady && !turnstileToken)}
          className="btn-pink mt-4 text-sm disabled:opacity-50"
        >
          {posting ? '发送中...' : '发送留言'}
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

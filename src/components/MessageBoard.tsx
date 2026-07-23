import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEvents } from './useEvents';
import { tint, FALLBACK_MEMBERS } from '../utils/members';
import Skeleton from './Skeleton';
import SkeletonSwap from './SkeletonSwap';
import Turnstile from './Turnstile';

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

  // 动态成员列表 + metaMap：优先 SSR 注入，fallback 走 utils/members 的 MEMBER_META 派生（单一来源）
  const members = useMemo(() => {
    if (ssr?.membersMeta && ssr.membersMeta.length) {
      return [
        ...ssr.membersMeta.map((m: any) => ({ id: m.id, emoji: m.emoji || '⭐', name: m.name, color: m.color || '#e83e8c' })),
        FALLBACK_MEMBERS[FALLBACK_MEMBERS.length - 1], // "全员" 收尾项
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
  const [popoverMsgId, setPopoverMsgId] = useState<string | null>(null);

  // Turnstile：site key 硬编码在组件内（公开值），未配置 secret 时后端 fail-open
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileReady, setTurnstileReady] = useState(false);

  // Emoji 反应：reactionsMap[msgId] = { reactions: [{emoji,count}], mine: [emoji] }
  const [reactionsMap, setReactionsMap] = useState<Record<string, { reactions: { emoji: string; count: number }[]; mine: string[] }>>({});
  const REACTION_EMOJIS = ['👍', '❤️', '😂', '🥰', '😢', '👏'];

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/messages');
      const data = await res.json();
      if (Array.isArray(data)) {
        setMessages(data);
        // 批量获取反应统计
        if (data.length) {
          const ids = data.map((m: Message) => m.id).join(',');
          fetch(`/api/reactions?type=message&ids=${encodeURIComponent(ids)}`)
            .then(r => r.json())
            .then(map => { if (map && typeof map === 'object') setReactionsMap(map); })
            .catch(() => {});
        }
      }
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

  const toggleReaction = useCallback(async (msgId: string, emoji: string) => {
    try {
      const res = await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'message', id: msgId, emoji }),
      });
      const data = await res.json();
      if (data.ok) {
        setReactionsMap(prev => {
          const cur = prev[msgId] || { reactions: [], mine: [] };
          let reactions = [...cur.reactions];
          let mine = [...cur.mine];
          const idx = reactions.findIndex(r => r.emoji === emoji);
          if (data.action === 'added') {
            if (!mine.includes(emoji)) mine.push(emoji);
            if (idx >= 0) reactions[idx] = { emoji, count: data.count };
            else reactions.push({ emoji, count: data.count });
          } else {
            mine = mine.filter(e => e !== emoji);
            if (data.count === 0) reactions = reactions.filter(r => r.emoji !== emoji);
            else if (idx >= 0) reactions[idx] = { emoji, count: data.count };
          }
          return { ...prev, [msgId]: { reactions, mine } };
        });
      }
    } catch { /* ignore */ }
  }, []);

  const handlePickEmoji = useCallback((msgId: string, emoji: string) => {
    toggleReaction(msgId, emoji);
    setPopoverMsgId(null);
  }, [toggleReaction]);

  const messageListEl = (
    <div className="space-y-3">
      {visibleMessages.map(msg => (
        <div key={msg.id} className="frost-card p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm">
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
          {/* Emoji 反应栏：左已贴 + 右按钮（Telegram 风格） */}
          <div className="flex items-center justify-between mt-2.5 gap-2">
            <div className="flex flex-wrap gap-1.5">
              {(reactionsMap[msg.id]?.reactions || []).filter(r => r.count > 0).map(r => {
                const isMine = reactionsMap[msg.id]?.mine.includes(r.emoji);
                return (
                  <button
                    key={r.emoji}
                    onClick={() => toggleReaction(msg.id, r.emoji)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all active:scale-90 ${
                      isMine
                        ? 'bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]/30'
                        : 'bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10'
                    }`}
                    aria-label={`${isMine ? '取消' : '贴'} ${r.emoji}（${r.count}）`}
                    aria-pressed={isMine}
                  >
                    <span className="text-sm">{r.emoji}</span>
                    <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 tabular-nums">{r.count}</span>
                  </button>
                );
              })}
            </div>
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setPopoverMsgId(popoverMsgId === msg.id ? null : msg.id)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-base text-gray-400 hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] hover:scale-110 active:scale-90 transition-all"
                aria-label="贴 emoji 反应"
                aria-expanded={popoverMsgId === msg.id}
                data-emoji-trigger={msg.id}
              >
                😊
              </button>
              {popoverMsgId === msg.id && createPortal(
                <>
                  <div className="fixed inset-0 z-[60] bg-black/5 backdrop-blur-sm" onClick={() => setPopoverMsgId(null)} aria-hidden="true" />
                  <EmojiPickerPopover
                    emojis={REACTION_EMOJIS}
                    onPick={handlePickEmoji}
                    photoKey={msg.id}
                    onClose={() => setPopoverMsgId(null)}
                  />
                </>,
                document.body
              )}
            </div>
          </div>
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
                <Skeleton className="h-3 rounded-full w-2/3 mb-2.5" />
                {/* 反应栏占位（与实际留言的反应栏高度一致） */}
                <div className="flex items-center justify-between mt-2.5">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-7 w-7 rounded-full" />
                </div>
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
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="写下你想对 Gleams 说的话..."
          maxLength={500}
          rows={3}
          className="w-full px-4 py-3 rounded-3xl text-sm text-left bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-[var(--accent)] transition-colors resize-none"
        />

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

// 共用的 EmojiPickerPopover 组件：用 Portal 渲染到 body，避免移动端被父容器裁剪/遮挡
interface EmojiPickerPopoverProps {
  emojis: string[];
  onPick: (id: string, emoji: string) => void;
  photoKey: string;
  onClose: () => void;
}

function EmojiPickerPopover({ emojis, onPick, photoKey, onClose }: EmojiPickerPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // 计算位置：相对于触发按钮，fixed 定位
  const calculatePosition = useCallback(() => {
    const btn = document.querySelector(`[data-emoji-trigger="${photoKey}"]`);
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const popoverWidth = 6 * 36 + 5 * 4 + 32; // ~248px
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 水平居中于按钮，限制在视口内
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - popoverWidth / 2, viewportWidth - popoverWidth - 8));

    // 垂直：按钮上方 8px，但如果顶部空间不足则显示在按钮下方
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    const popoverHeight = 44; // 估算高度
    const top = spaceAbove >= popoverHeight + 16
      ? rect.top - popoverHeight - 8  // 按钮上方
      : rect.bottom + 8;              // 按钮下方（兜底）

    setPosition({ top, left });
  }, [photoKey]);

  // 挂载时计算，滚动/resize 时重新计算
  useEffect(() => {
    calculatePosition();
    window.addEventListener('scroll', calculatePosition, { passive: true });
    window.addEventListener('resize', calculatePosition);
    return () => {
      window.removeEventListener('scroll', calculatePosition);
      window.removeEventListener('resize', calculatePosition);
    };
  }, [calculatePosition]);

  // 点击外部关闭（由 backdrop 处理，这里兜底）
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[61] flex gap-1 p-2 rounded-2xl frost-card shadow-lg emoji-picker-enter pointer-events-auto"
      style={{ top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
      role="menu"
      aria-label="选择表情"
    >
      {emojis.map(emoji => (
        <button
          key={emoji}
          onClick={() => onPick(photoKey, emoji)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-base hover:bg-[var(--accent-soft)] hover:scale-125 active:scale-90 transition-all duration-150"
          role="menuitem"
          aria-label={`贴 ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

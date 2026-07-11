import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';

// 登录失败次数限制：30 分钟内最多 5 次，超出锁定至窗口结束
const ATT_KEY = 'gleams-admin-attempts';
const ATT_MAX = 5;
const ATT_WINDOW = 30 * 60 * 1000;

function getAttempts() {
  try {
    const a = JSON.parse(localStorage.getItem(ATT_KEY) || 'null');
    if (a && typeof a.count === 'number' && typeof a.firstTs === 'number') {
      if (Date.now() - a.firstTs > ATT_WINDOW) return { count: 0, firstTs: 0 }; // 窗口已过，重置
      return a;
    }
  } catch (e) {}
  return { count: 0, firstTs: 0 };
}
function recordAttempt() {
  const a = getAttempts();
  if (a.count === 0) a.firstTs = Date.now();
  a.count += 1;
  try { localStorage.setItem(ATT_KEY, JSON.stringify(a)); } catch (e) {}
  return a;
}
function clearAttempts() {
  try { localStorage.removeItem(ATT_KEY); } catch (e) {}
}
function lockReleaseText() {
  const a = getAttempts();
  if (!a.firstTs) return '';
  const t = new Date(a.firstTs + ATT_WINDOW);
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');
  return hh + ':' + mm;
}

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

interface Recruit {
  id: number;
  title: string;
  subtitle: string | null;
  body: string;
  cta_text: string;
  cta_url: string;
  deadline: string | null;
  enabled: number;
  sort_order: number;
  created_at: string;
}

interface RecruitForm {
  id: number | null;
  title: string;
  subtitle: string;
  body: string;
  cta_text: string;
  cta_url: string;
  deadline: string;
  enabled: boolean;
  sort_order: number;
}

const INPUT_CLS =
  'w-full px-3 py-2 rounded-xl text-sm bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-[var(--accent)] transition-colors';

export default function AdminPanel() {
  const [code, setCode] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('gleams-admin') || '';
    return '';
  });
  const [authed, setAuthed] = useState(false); // 初始一律未登录，由挂载校验决定
  const [err, setErr] = useState(() =>
    getAttempts().count >= ATT_MAX ? `尝试次数过多，请于 ${lockReleaseText()} 后再试` : ''
  );
  const [checking, setChecking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [recruits, setRecruits] = useState<Recruit[]>([]);
  const [tab, setTab] = useState<'messages' | 'photos' | 'recruits'>('messages');
  const [loading, setLoading] = useState(false);

  // 挂载时校验已存储的暗号：仅服务端 200 才放行，否则清空并停在登录态
  const inited = useRef(false);
  useEffect(() => {
    if (inited.current) return;
    inited.current = true;
    const stored = (typeof window !== 'undefined') ? (localStorage.getItem('gleams-admin') || '') : '';
    if (!stored) return;
    (async () => {
      try {
        const res = await fetch('/api/recruits?all=1', { headers: { 'x-admin-code': stored } });
        if (res.ok) {
          setCode(stored);
          setAuthed(true);
          clearAttempts();
        } else if (res.status === 403) {
          localStorage.removeItem('gleams-admin');
          setCode('');
          setAuthed(false);
        } else {
          // 网络/5xx：不放心，停在登录态（保留存储，登录时可重试）
          setAuthed(false);
        }
      } catch (e) {
        setAuthed(false);
      }
    })();
  }, []);

  // 登录：先用服务端校验暗号，正确才存储并放行；错误累计尝试次数
  const login = async () => {
    if (getAttempts().count >= ATT_MAX) {
      setErr(`尝试次数过多，请于 ${lockReleaseText()} 后再试`);
      return;
    }
    const c = code.trim();
    if (!c) { setErr('请输入管理暗号'); return; }
    setErr('');
    setChecking(true);
    try {
      const res = await fetch('/api/recruits?all=1', { headers: { 'x-admin-code': c } });
      if (res.ok) {
        localStorage.setItem('gleams-admin', c);
        clearAttempts();
        setErr('');
        setAuthed(true);
      } else if (res.status === 403) {
        const a = recordAttempt();
        if (a.count >= ATT_MAX) setErr(`尝试次数过多，请于 ${lockReleaseText()} 后再试`);
        else setErr(`暗号错误，还剩 ${ATT_MAX - a.count} 次机会`);
      } else {
        setErr('验证失败，请稍后重试');
      }
    } catch (e) {
      setErr('验证失败，请稍后重试');
    } finally {
      setChecking(false);
    }
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

  const fetchRecruits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recruits?all=1', { headers: { 'x-admin-code': code } });
      const data = await res.json();
      if (Array.isArray(data)) setRecruits(data);
      else if (data.error) alert(data.error);
    } catch {}
    setLoading(false);
  }, [code]);

  useEffect(() => {
    if (!authed) return;
    if (tab === 'messages') fetchMessages();
    else if (tab === 'photos') fetchPhotos();
    else fetchRecruits();
  }, [authed, tab, fetchMessages, fetchPhotos, fetchRecruits]);

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

  // ---------- 广告管理 ----------
  const EMPTY_FORM: RecruitForm = {
    id: null, title: '', subtitle: '', body: '', cta_text: '',
    cta_url: '', deadline: '', enabled: true, sort_order: 0,
  };
  const [form, setForm] = useState<RecruitForm>(EMPTY_FORM);

  const editRecruit = (r: Recruit) => {
    setForm({
      id: r.id, title: r.title, subtitle: r.subtitle || '', body: r.body, cta_text: r.cta_text,
      cta_url: r.cta_url, deadline: r.deadline || '',
      enabled: !!r.enabled, sort_order: r.sort_order,
    });
  };

  const submitRecruit = async () => {
    if (!form.title.trim() || !form.body.trim() || !form.cta_url.trim()) {
      alert('标题 / 正文 / 链接必填');
      return;
    }
    if (!/^https?:\/\//.test(form.cta_url.trim())) {
      alert('链接需以 http(s):// 开头');
      return;
    }
    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      body: form.body.trim(),
      cta_text: form.cta_text.trim(),
      cta_url: form.cta_url.trim(),
      deadline: form.deadline || null,
      enabled: form.enabled ? 1 : 0,
      sort_order: Number(form.sort_order) || 0,
    };
    try {
      const res = await fetch('/api/recruits', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify(form.id ? { ...payload, id: form.id } : payload),
      });
      const data = await res.json();
      if (data.ok) { setForm(EMPTY_FORM); fetchRecruits(); }
      else alert(data.error || '保存失败');
    } catch {
      alert('网络错误，保存失败');
    }
  };

  const delRecruit = async (r: Recruit) => {
    if (!confirm(`删除「${r.title}」？`)) return;
    try {
      const res = await fetch('/api/recruits', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify({ id: r.id }),
      });
      const data = await res.json();
      if (data.ok) fetchRecruits();
      else alert(data.error || '删除失败');
    } catch {
      alert('网络错误，删除失败');
    }
  };

  // 批量重排：按传入顺序重写每条的 sort_order
  const reorderRecruits = async (order: { id: number; sort_order: number }[]) => {
    try {
      const res = await fetch('/api/recruits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify({ order }),
      });
      const data = await res.json();
      if (data.ok) fetchRecruits();
      else alert(data.error || '排序保存失败');
    } catch {
      alert('网络错误，排序保存失败');
    }
  };

  const [dragId, setDragId] = useState<number | null>(null);
  const handleDrop = (targetId: number) => {
    if (dragId == null || dragId === targetId) { setDragId(null); return; }
    const from = recruits.findIndex(r => r.id === dragId);
    const to = recruits.findIndex(r => r.id === targetId);
    if (from === -1 || to === -1) { setDragId(null); return; }
    const next = [...recruits];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setRecruits(next);
    reorderRecruits(next.map((r, i) => ({ id: r.id, sort_order: i })));
    setDragId(null);
  };

  // 广告实时预览（浅色 / 暗色），随表单输入即时更新
  const fmtDeadline = (d: string) => {
    if (!d) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    if (!m) return d;
    return parseInt(m[2], 10) + '.' + m[3];
  };

  const AdCard = ({ dark }: { dark: boolean }) => {
    const title = form.title.trim() || '主标题';
    const subtitle = form.subtitle.trim() ? form.subtitle.trim() : '';
    const body = form.body.trim() || '正文内容';
    const ctaRaw = form.cta_text.trim() || '查看详情 →';
    const cta = /[→›❯]/u.test(ctaRaw) ? ctaRaw : ctaRaw + ' →';
    const dl = fmtDeadline(form.deadline);
    const accent = 'var(--accent)';
    const cardStyle: CSSProperties = dark
      ? {
          background: 'linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.035))',
          border: '1px solid rgba(255,255,255,0.09)',
          borderLeft: `3px solid ${accent}`,
          color: '#c8c3da',
          boxShadow: 'var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.07)',
        }
      : {
          background: 'linear-gradient(160deg, rgba(255,255,255,0.72), rgba(255,255,255,0.52))',
          border: '1px solid rgba(255,255,255,0.6)',
          borderLeft: `3px solid ${accent}`,
          color: 'var(--text)',
          boxShadow: 'var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.5)',
        };
    return (
      <div style={cardStyle} className="rounded-2xl p-4">
        <p style={{ color: accent }} className="font-bold text-[15px] leading-snug mb-1.5">{title}</p>
        <p style={{ color: dark ? '#a59fc0' : 'var(--text-soft)' }} className="text-xs leading-snug mb-2">{subtitle || '副标题'}</p>
        <p style={{ color: dark ? '#a59fc0' : 'var(--text-soft)' }} className="text-xs leading-snug mb-2.5">
          {dl ? (
            <><span style={{ color: accent }} className="font-bold">报名截止 {dl}</span> · {body || '正文内容'}</>
          ) : (
            body
          )}
        </p>
        <span style={{ color: accent }} className="inline-flex items-center gap-1 text-[13px] font-bold">{cta}</span>
      </div>
    );
  };

  // 新建广告时，排序号自动填入「当前最大 + 1」，让用户直接看到将排到第几位
  const nextSortOrder = () => {
    if (recruits.length === 0) return 1;
    return Math.max(...recruits.map(r => Number(r.sort_order) || 0)) + 1;
  };
  useEffect(() => {
    if (tab === 'recruits' && !form.id && form.sort_order === 0 && !loading) {
      setForm(f => ({ ...f, sort_order: nextSortOrder() }));
    }
  }, [tab, form.id, form.sort_order, loading, recruits]);

  if (!authed) {
    const effLocked = getAttempts().count >= ATT_MAX;
    const lockMsg = `尝试次数过多，请于 ${lockReleaseText()} 后再试`;
    return (
      <div className="frost-card p-8 text-center max-w-sm mx-auto">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">管理员登录</h2>
        <input
          type="password"
          value={code}
          disabled={effLocked || checking}
          onChange={e => setCode(e.target.value)}
          placeholder="管理员暗号"
          aria-invalid={!!err}
          className="w-full px-4 py-2 rounded-full text-sm text-center bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-[var(--accent)] transition-colors mb-2 disabled:opacity-50"
          onKeyDown={e => e.key === 'Enter' && !effLocked && login()}
        />
        <p className={`text-xs mb-3 min-h-[1rem] ${effLocked || err ? 'text-red-500 dark:text-red-400' : 'text-transparent'}`}>
          {effLocked ? lockMsg : (err || ' ')}
        </p>
        <button
          onClick={login}
          disabled={effLocked || checking}
          className="btn-pink text-xs !px-4 !py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {checking ? '验证中…' : effLocked ? '已锁定' : '进入'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-3 mb-6 justify-center flex-wrap">
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
        <button
          onClick={() => setTab('recruits')}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
            tab === 'recruits' ? 'btn-pink' : 'btn-outline'
          }`}
        >
          广告
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
      ) : tab === 'photos' ? (
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
      ) : (
        <div className="max-w-2xl mx-auto space-y-4">
          {/* 列表 */}
          <div className="space-y-3">
            <p className="text-[11px] text-gray-400">拖动卡片左侧 ⠿ 可调整投放顺序（越靠前越优先展示）</p>
            {recruits.map(r => (
              <div
                key={r.id}
                className="frost-card p-4"
                draggable
                onDragStart={(e) => { setDragId(r.id); e.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                onDrop={() => handleDrop(r.id)}
                onDragEnd={() => setDragId(null)}
                style={dragId === r.id ? { opacity: 0.4 } : undefined}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex-shrink-0 cursor-grab active:cursor-grabbing select-none text-gray-300 dark:text-gray-600 mt-0.5 text-lg leading-none"
                    title="拖动调整顺序"
                  >⠿</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-bold text-[var(--accent)]">{r.title}</span>
                      {r.enabled ? (
                        <span className="chip text-[10px] !py-0">投放中</span>
                      ) : (
                        <span className="text-[10px] bg-gray-200 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">已停投</span>
                      )}
                      {r.deadline && <span className="text-xs text-gray-400">截止 {r.deadline}</span>}
                      <span className="text-xs text-gray-300 dark:text-gray-600">#{r.sort_order}</span>
                    </div>
                    {r.subtitle && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 break-words">{r.subtitle}</p>
                    )}
                    <p className="text-sm text-gray-600 dark:text-gray-300 break-words">
                      {r.deadline && <span className="text-[var(--accent)] font-semibold">报名截止 {r.deadline.slice(5).replace('-', '.')} · </span>}
                      {r.body}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{r.cta_url}</p>
                  </div>
                  <div className="flex-shrink-0 flex flex-col gap-1">
                    <button
                      onClick={() => editRecruit(r)}
                      className="text-xs text-[var(--accent)] hover:opacity-70 px-2 py-1 rounded-full hover:bg-white/40 dark:hover:bg-white/5 transition-colors"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => delRecruit(r)}
                      className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {recruits.length === 0 && (
              <p className="text-center text-gray-400 py-8">暂无广告，在下方表单新建第一条</p>
            )}
          </div>

          {/* 实时预览：浅色 / 暗色 */}
          <div className="frost-card p-5">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-3">实时预览（浅色 / 暗色）</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] text-gray-400 mb-1.5">浅色模式</p>
                <div style={{ background: '#f5f2fb', padding: '10px', borderRadius: '16px' }}>
                  <AdCard dark={false} />
                </div>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 mb-1.5">暗色模式</p>
                <div style={{ background: '#0c0b14', padding: '10px', borderRadius: '16px' }}>
                  <AdCard dark={true} />
                </div>
              </div>
            </div>
          </div>

          {/* 新建 / 编辑表单 */}
          <div className="frost-card p-5">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-4">
              {form.id ? `编辑 #${form.id}` : '新建广告'}
            </h3>
            <div className="space-y-3">
              <input
                value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="标题（如：研修生招募）" className={INPUT_CLS}
              />
              <input
                value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })}
                placeholder="副标题（如：公主风王道系地下偶像团体）" className={INPUT_CLS}
              />
              <textarea
                value={form.body} onChange={e => setForm({ ...form, body: e.target.value })}
                placeholder="正文（如：微博转发关注抽 52 元偶活基金）"
                rows={2} className={`${INPUT_CLS} resize-none`}
              />
              <input
                value={form.cta_text} onChange={e => setForm({ ...form, cta_text: e.target.value })}
                placeholder="按钮文案（可留空，默认「查看详情 →」）" className={INPUT_CLS}
              />
              <input
                value={form.cta_url} onChange={e => setForm({ ...form, cta_url: e.target.value })}
                placeholder="跳转链接（需 http(s):// 开头）" className={INPUT_CLS}
              />
              <div className="flex gap-3 flex-wrap items-center">
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  截止日
                  <input
                    type="date" value={form.deadline}
                    onChange={e => setForm({ ...form, deadline: e.target.value })}
                    className={`${INPUT_CLS} w-auto`}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  排序
                  <input
                    type="number" value={form.sort_order}
                    onChange={e => setForm({ ...form, sort_order: +e.target.value })}
                    className={`${INPUT_CLS} w-20`}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox" checked={form.enabled}
                    onChange={e => setForm({ ...form, enabled: e.target.checked })}
                  />
                  投放中
                </label>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={submitRecruit} className="btn-pink text-xs !px-4 !py-1.5">
                  {form.id ? '保存修改' : '创建投放'}
                </button>
                {form.id && (
                  <button onClick={() => setForm(EMPTY_FORM)} className="btn-outline text-xs !px-4 !py-1.5">
                    取消
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

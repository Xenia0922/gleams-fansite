import { useState, useEffect } from 'react';

interface EventRow {
  id: string;
  title: string;
  date: string;
  time?: string;
  venue?: string;
  status?: string;
  [k: string]: any;
}

function firstUpcoming(list: EventRow[]): EventRow | null {
  const up = (list || [])
    .filter((e) => e.status === 'upcoming')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return up.length > 0 ? up[0] : null;
}

function calc(target: string) {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

const fm = (n: number) => String(n).padStart(2, '0');
const W = ['日', '一', '二', '三', '四', '五', '六'];

/**
 * 倒计时卡片（首屏唯一的数据岛）。
 *
 * 首绘策略（消除「种子过期 → 先闪空白占位」）：
 *   - 初始态优先读 window.__SSR_DATA__.events（middleware 在边缘注入的 D1 实时数据，永远新鲜），
 *     种子 initial 仅作「无 CF / 本地预览」兜底。
 *   - 卡片结构常量化：title/date/venue 用 data-countdown 钩子渲染（即便暂无场次也渲染空壳），
 *     由 _middleware.js 的 applyCountdown 在「服务端」直填真实值再下发——故浏览器首屏（pre-JS）即见真实场次，
 *     不会经历「空白 → 填充」的闪动（与 hero 的 applyHero 同模式）。
 *   - 跳动的秒数：服务端渲染固定占位 00:00:00，客户端首帧同值 → 无 hydration 不匹配。
 *   - hydration 后，仅当运行期 D1 的「最近 upcoming」与当前不是同一场（id 变化）才更新，避免「旧→新」整块闪动。
 *   - 种子与运行时都无 upcoming 时，兜底 fetch 一次确认，仍无则显示「暂无即将到来的演出」。
 */
export default function CountdownCard({ initial = [] }: { initial?: EventRow[] }) {
  const ssr = typeof window !== 'undefined' ? (window as any).__SSR_DATA__ : null;
  const [event, setEvent] = useState<EventRow | null>(
    () => firstUpcoming((ssr?.events as EventRow[]) || []) || firstUpcoming(initial as EventRow[]) || null
  );
  const [text, setText] = useState('');
  const [confirmedNo, setConfirmedNo] = useState(false);

  useEffect(() => {
    const runtime = firstUpcoming((ssr?.events as EventRow[]) || []);
    // 运行时与当前是同一场 → 不动（无闪动）；不同场（后台新增更近场次）→ 更新
    if (runtime && runtime.id !== event?.id) {
      setEvent(runtime);
      return;
    }
    // 种子与运行时都无 upcoming：兜底拉一次确认（异常恢复）
    if (!runtime && !event) {
      let alive = true;
      fetch('/api/events')
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          const up = firstUpcoming(Array.isArray(d) ? d : []);
          if (up) setEvent(up);
          else setConfirmedNo(true);
        })
        .catch(() => {
          if (alive) setConfirmedNo(true);
        });
      return () => {
        alive = false;
      };
    }
  }, [event?.id]);

  useEffect(() => {
    if (!event) return;
    const target = event.time ? event.date + 'T' + event.time + ':00' : event.date + 'T00:00:00';
    const tick = () => {
      const cd = calc(target);
      setText(
        cd
          ? cd.days > 0
            ? `${cd.days} 天 ${fm(cd.hours)}:${fm(cd.minutes)}:${fm(cd.seconds)}`
            : `${fm(cd.hours)}:${fm(cd.minutes)}:${fm(cd.seconds)}`
          : '已开始'
      );
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [event]);

  if (confirmedNo && !event) {
    return <p className="text-center text-gray-400 text-sm py-4">暂无即将到来的演出</p>;
  }

  const dd = event ? new Date(event.date + 'T00:00:00') : null;
  const ds = dd
    ? String(dd.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(dd.getDate()).padStart(2, '0') +
      ' 周' +
      W[dd.getDay()]
    : '';

  // 始终渲染卡片空壳（即便暂无场次），供 middleware 边缘直填；无 upcoming 时浏览器首屏即为已填真实值。
  return (
    <div className="frost-card p-4 text-center max-w-sm mx-auto">
      <div className="flex items-center justify-center gap-2 mb-1">
        <span className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider">Next Live</span>
        <span className="text-xs text-gray-400">·</span>
        <span className="text-xs text-gray-400" data-countdown="date">
          {ds}
        </span>
      </div>
      <p className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1" data-countdown="title">
        {event?.title || ''}
      </p>
      <p className="text-[11px] text-gray-400 mb-1.5" data-countdown="venue">
        {event?.venue || ''}
      </p>
      <span
        className="text-xl font-black text-[var(--accent)] tabular-nums font-mono"
        suppressHydrationWarning
      >
        {text || `${fm(0)}:${fm(0)}:${fm(0)}`}
      </span>
    </div>
  );
}

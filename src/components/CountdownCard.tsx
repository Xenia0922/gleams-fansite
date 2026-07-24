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
 * - 服务端用构建种子 initial 直接渲染真实内容 → 首屏零骨架、可见真实内容（种子新鲜时）。
 * - 客户端 hydration 后仅当运行时 D1 的「最近 upcoming」与种子不是同一场（id 变化，
 *   如后台新增了更近的场次）才更新，避免「旧→新」整块闪动。
 * - 种子与运行时都无 upcoming 时，才兜底 fetch 一次（异常恢复，非正常流程）。
 * - 跳动的秒数：服务端渲染固定占位 00:00:00，客户端首帧同值 → 无 hydration 不匹配。
 */
export default function CountdownCard({ initial = [] }: { initial?: EventRow[] }) {
  const ssr = typeof window !== 'undefined' ? (window as any).__SSR_DATA__ : null;
  const [event, setEvent] = useState<EventRow | null>(() => firstUpcoming(initial as EventRow[]) || null);
  const [text, setText] = useState('');
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    const runtime = firstUpcoming((ssr?.events as EventRow[]) || []);
    // 运行时与种子是同一场 → 不动（无闪动）；不同场（后台新增更近场次）→ 更新
    if (runtime && runtime.id !== event?.id) {
      setEvent(runtime);
      return;
    }
    // 种子与运行时都无 upcoming：兜底拉一次（异常恢复）
    if (!runtime && !event) {
      let alive = true;
      fetch('/api/events')
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          const up = firstUpcoming(Array.isArray(d) ? d : []);
          if (up) setEvent(up);
          else setEmpty(true);
        })
        .catch(() => { if (alive) setEmpty(true); });
      return () => { alive = false; };
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

  if (empty && !event) {
    return <p className="text-center text-gray-400 text-sm py-4">暂无即将到来的演出</p>;
  }

  const dd = event ? new Date(event.date + 'T00:00:00') : null;
  const ds = dd ? String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0') + ' 周' + W[dd.getDay()] : '';

  return (
    <div className="frost-card p-4 text-center max-w-sm mx-auto">
      <div className="flex items-center justify-center gap-2 mb-1">
        <span className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider">Next Live</span>
        {ds && (
          <>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-400">{ds}</span>
          </>
        )}
      </div>
      <p className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">{event?.title || ''}</p>
      {event?.venue && <p className="text-[11px] text-gray-400 mb-1.5">{event.venue}</p>}
      <span
        className="text-xl font-black text-[var(--accent)] tabular-nums font-mono"
        suppressHydrationWarning
      >
        {text || `${fm(0)}:${fm(0)}:${fm(0)}`}
      </span>
    </div>
  );
}

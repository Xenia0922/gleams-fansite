import { useState, useEffect } from 'react';
import { type EventRow } from './EventCardGrid';

function firstUpcoming(list: EventRow[]): EventRow | null {
  const up = list
    .filter((e) => e.status === 'upcoming')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return up.length > 0 ? up[0] : null;
}

function calcCountdown(target: Date) {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}
function fm(n: number) { return String(n).padStart(2, '0'); }

export default function UpcomingCountdown({ initial = [] }: { initial?: EventRow[] }) {
  const ssr = typeof window !== 'undefined' ? (window as any).__SSR_DATA__ : null;
  const [event, setEvent] = useState<EventRow | null>(() =>
    ssr?.events ? firstUpcoming(ssr.events) : firstUpcoming(initial)
  );
  const [cd, setCd] = useState<ReturnType<typeof calcCountdown>>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ssr?.events) return; // 已有 SSR 实时数据
    if (initial && initial.length > 0) return; // 有构建期种子，无需请求
    let alive = true;
    setLoading(true);
    fetch('/api/events')
      .then((r) => r.json())
      .then((data) => {
        if (!alive || !Array.isArray(data)) return;
        const up = firstUpcoming(data);
        if (up) setEvent(up);
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!event) return;
    const tick = () => {
      const d = event.time ? event.date + 'T' + event.time + ':00' : event.date + 'T00:00:00';
      setCd(calcCountdown(new Date(d)));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [event]);

  if (loading) {
    return (
      <div className="frost-card p-4 max-w-sm mx-auto animate-pulse" aria-hidden="true">
        <div className="h-3 w-24 mx-auto rounded bg-gray-200 dark:bg-gray-700 mb-2" />
        <div className="h-4 w-40 mx-auto rounded bg-gray-200 dark:bg-gray-700 mb-2" />
        <div className="h-6 w-32 mx-auto rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  if (!event || !cd) return null;

  const text = cd.days > 0
    ? cd.days + ' 天 ' + fm(cd.hours) + ':' + fm(cd.minutes) + ':' + fm(cd.seconds)
    : fm(cd.hours) + ':' + fm(cd.minutes) + ':' + fm(cd.seconds);

  const dd = new Date(event.date);
  const w = ['日', '一', '二', '三', '四', '五', '六'];
  const ds = String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0') + ' 周' + w[dd.getDay()];

  return (
    <div className="frost-card p-4 text-center max-w-sm mx-auto">
      <div className="flex items-center justify-center gap-2 mb-1">
        <span className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider">Next Live</span>
        <span className="text-xs text-gray-400">·</span>
        <span className="text-xs text-gray-400">{ds}</span>
      </div>
      <p className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">{event.title}</p>
      {event.venue && <p className="text-[11px] text-gray-400 mb-1.5">{event.venue}</p>}
      <p className="text-xl font-black text-[var(--accent)] tabular-nums font-mono">{text}</p>
    </div>
  );
}

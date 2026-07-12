import { useState, useEffect, useCallback } from 'react';

interface UpcomingEvent {
  id: string;
  date: string;
  time: string;
  title: string;
  venue: string;
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

function fmt(n: number) {
  return String(n).padStart(2, '0');
}

export default function UpcomingCountdown() {
  const [event, setEvent] = useState<UpcomingEvent | null>(null);
  const [countdown, setCountdown] = useState<ReturnType<typeof calcCountdown>>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/events');
      const data = await res.json();
      if (Array.isArray(data)) {
        const upcoming = data
          .filter((e: { status: string }) => e.status === 'upcoming')
          .sort((a: { date: string }, b: { date: string }) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
          );
        if (upcoming.length > 0) setEvent(upcoming[0]);
      }
    } catch { /* offline */ }
    setReady(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!event) return;
    const tick = () => {
      const dateStr = event.time
        ? event.date + 'T' + event.time + ':00'
        : event.date + 'T00:00:00';
      setCountdown(calcCountdown(new Date(dateStr)));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [event]);

  const fmtDate = (date: string) => {
    const d = new Date(date);
    const week = ['日', '一', '二', '三', '四', '五', '六'];
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return mm + '-' + dd + ' 周' + week[d.getDay()];
  };

  // 无 upcoming 日程时完全不渲染任何 DOM
  if (ready && !event) return null;
  // 加载中也不渲染（避免白块闪烁）
  if (!ready) return null;

  const cdText = countdown
    ? countdown.days > 0
      ? countdown.days + ' 天 ' + fmt(countdown.hours) + ':' + fmt(countdown.minutes) + ':' + fmt(countdown.seconds)
      : fmt(countdown.hours) + ':' + fmt(countdown.minutes) + ':' + fmt(countdown.seconds)
    : '即将开始';

  return (
    <section className="max-w-2xl mx-auto px-4 -mt-6 mb-8 relative z-10">
      <div className="frost-card p-5 text-center" data-reveal>
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider">
            Next Live
          </span>
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs text-gray-400">{fmtDate(event.date)}</span>
        </div>
        <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-1">
          {event.title}
        </h3>
        {event.venue && (
          <p className="text-xs text-gray-400 mb-2">{event.venue}</p>
        )}
        <p className="text-2xl sm:text-3xl font-black text-[var(--accent)] tabular-nums tracking-tight font-mono">
          {cdText}
        </p>
      </div>
    </section>
  );
}

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

function fmt(n: number) { return String(n).padStart(2, '0'); }

export default function UpcomingCountdown() {
  const [event, setEvent] = useState<UpcomingEvent | null>(null);
  const [countdown, setCountdown] = useState<ReturnType<typeof calcCountdown>>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/events')
      .then(r => r.json())
      .then(data => {
        if (!alive || !Array.isArray(data)) return;
        const upcoming = data
          .filter((e: { status: string }) => e.status === 'upcoming')
          .sort((a: { date: string }, b: { date: string }) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
          );
        if (upcoming.length > 0) setEvent(upcoming[0]);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!event) return;
    const tick = () => {
      const d = event.time ? event.date + 'T' + event.time + ':00' : event.date + 'T00:00:00';
      setCountdown(calcCountdown(new Date(d)));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [event]);

  const show = event && countdown;
  const cdText = countdown
    ? countdown.days > 0
      ? countdown.days + ' 天 ' + fmt(countdown.hours) + ':' + fmt(countdown.minutes) + ':' + fmt(countdown.seconds)
      : fmt(countdown.hours) + ':' + fmt(countdown.minutes) + ':' + fmt(countdown.seconds)
    : '';

  const fmtDate = (d: string) => {
    const dd = new Date(d);
    const w = ['日', '一', '二', '三', '四', '五', '六'];
    return String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0') + ' 周' + w[dd.getDay()];
  };

  return (
    <section
      className="max-w-2xl mx-auto px-4 relative z-10 transition-all duration-300"
      style={{ marginTop: show ? '-1.5rem' : '0', marginBottom: show ? '2rem' : '0' }}
    >
      {show && (
        <div className="frost-card p-5 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider">Next Live</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-400">{fmtDate(event.date)}</span>
          </div>
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-1">{event.title}</h3>
          {event.venue && <p className="text-xs text-gray-400 mb-2">{event.venue}</p>}
          <p className="text-2xl sm:text-3xl font-black text-[var(--accent)] tabular-nums tracking-tight font-mono">{cdText}</p>
        </div>
      )}
    </section>
  );
}

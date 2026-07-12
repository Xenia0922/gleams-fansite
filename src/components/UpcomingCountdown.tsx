import { useState, useEffect } from 'react';

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

export default function UpcomingCountdown() {
  const [event, setEvent] = useState<any>(null);
  const [cd, setCd] = useState<ReturnType<typeof calcCountdown>>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/events')
      .then(r => r.json())
      .then(data => {
        if (!alive || !Array.isArray(data)) return;
        const up = data
          .filter((e: any) => e.status === 'upcoming')
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        if (up.length > 0) setEvent(up[0]);
      })
      .catch(() => {});
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

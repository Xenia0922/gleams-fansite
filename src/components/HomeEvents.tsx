import { useState, useEffect, useMemo } from 'react';
import { getEventImage } from '../utils/eventImages';

interface EventRow {
  id: string;
  date: string;
  time?: string;
  title: string;
  venue?: string;
  status?: string;
}

export default function HomeEvents({
  initial,
}: {
  initial: EventRow[];
}) {
  const [events, setEvents] = useState<EventRow[]>(initial || []);

  useEffect(() => {
    let alive = true;
    fetch('/api/events')
      .then(r => r.json())
      .then(d => { if (alive && Array.isArray(d) && d.length) setEvents(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const past = useMemo(
    () =>
      [...events]
        .filter(e => e.status === 'past')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 4),
    [events]
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
      {past.map(evt => {
        const d = new Date(evt.date);
        const img = getEventImage(evt.id, '/images/events/live-2026-01-31.webp');
        return (
          <a key={evt.id} href={'/schedule/' + evt.id} className="card group">
            <div className="aspect-[16/9] overflow-hidden bg-gray-100 dark:bg-gray-800">
              <img src={img} alt={evt.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-pink-500">{d.getMonth() + 1}/{d.getDate()}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{d.getFullYear()}</span>
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-2">{evt.title}</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{evt.venue}</p>
            </div>
          </a>
        );
      })}
    </div>
  );
}

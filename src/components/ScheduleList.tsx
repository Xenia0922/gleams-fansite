import { useState, useEffect, useMemo } from 'react';
import { getEventImage } from '../utils/eventImages';

interface EventRow {
  id: string;
  date: string;
  time?: string;
  title: string;
  venue?: string;
  performers?: string[];
  status?: string;
  image?: string;
}
interface Member {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
}

export default function ScheduleList({
  initial,
  initialMembers,
}: {
  initial: EventRow[];
  initialMembers: Member[];
}) {
  const [events, setEvents] = useState<EventRow[]>(initial || []);
  const [members, setMembers] = useState<Member[]>(initialMembers || []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch('/api/events').then(r => r.json()),
      fetch('/api/members').then(r => r.json()),
    ])
      .then(([ev, mb]) => {
        if (!alive) return;
        if (Array.isArray(ev) && ev.length) setEvents(ev);
        if (Array.isArray(mb) && mb.length) setMembers(mb);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const memberMap = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);

  const grouped = useMemo(() => {
    const g: Record<string, EventRow[]> = {};
    [...events]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .forEach(e => {
        const d = new Date(e.date);
        const key = d.getFullYear() + '年' + (d.getMonth() + 1) + '月';
        (g[key] = g[key] || []).push(e);
      });
    return g;
  }, [events]);

  if (events.length === 0) return <p className="text-center text-gray-400 py-16">暂无日程</p>;

  return (
    <>
      {Object.entries(grouped).map(([month, evs]) => (
        <div className="mb-10" key={month}>
          <h2 className="text-sm font-bold text-pink-500 tracking-widest mb-4">{month}</h2>
          <div className="space-y-2">
            {evs.map(evt => {
              const d = new Date(evt.date);
              const isPast = evt.status === 'past';
              const img = evt.image || getEventImage(evt.id);
              return (
                <a
                  key={evt.id}
                  href={'/schedule/' + evt.id}
                  className={
                    'flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-3xl transition-opacity group ' +
                    (isPast ? 'opacity-65 hover:opacity-100 glass' : 'frost-card shadow-md')
                  }
                >
                  <div className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-3xl overflow-hidden glass">
                    <img src={img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                  </div>
                  <div className="flex-shrink-0 text-center min-w-[44px] sm:min-w-[50px]">
                    <span className={'text-base sm:text-lg font-extrabold ' + (isPast ? 'text-gray-400' : 'text-pink-500')}>
                      {d.getMonth() + 1}/{d.getDate()}
                    </span>
                    {evt.time && <p className="text-[10px] text-gray-400 mt-0.5">{evt.time}</p>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={'text-sm font-bold truncate ' + (isPast ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100')}>{evt.title}</h3>
                      {isPast && <span className="badge flex-shrink-0">已结束</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{evt.venue}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(evt.performers || []).map(pid => {
                        const m = memberMap.get(pid);
                        return m ? <span key={pid} className="chip">{m.emoji} {m.name}</span> : null;
                      })}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

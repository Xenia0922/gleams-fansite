import { useEffect, useState } from 'react';

export interface EventItem {
  id: string;
  date: string;
  title: string;
  venue?: string;
}

/** 拉取公开日程，供广场的「关联场次」下拉与展示用。 */
export function useEvents() {
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    let alive = true;
    fetch('/api/events')
      .then(r => r.json())
      .then(d => {
        if (alive && Array.isArray(d)) {
          const list = d.map((e: any) => ({ id: e.id, date: e.date, title: e.title, venue: e.venue }));
          // 按日期升序，方便下拉按时间顺序选择
          list.sort((a: EventItem, b: EventItem) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
          setEvents(list);
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const map: Record<string, EventItem> = {};
  for (const e of events) map[e.id] = e;

  return { events, map };
}

/** 把日期格式化为「07-04」便于展示。 */
export function fmtEventDate(date?: string) {
  if (!date) return '';
  const [, m, d] = date.split('-');
  return `${m}-${d}`;
}

import { useState, useEffect, useMemo } from 'react';
import { getEventImage } from '../utils/eventImages';

export interface EventRow {
  id: string;
  date: string;
  time?: string;
  title: string;
  venue?: string;
  performers?: string[];
  status?: string;
  image?: string;
}

interface EventCardGridProps {
  initial: EventRow[];
  filter: 'past' | 'upcoming';
  /** 日期排序方向 */
  sortDir?: 'asc' | 'desc';
  /** 展示上限条数，默认 4 */
  limit?: number;
  fallbackImg?: string;
}

/**
 * 日程卡片网格（竖向卡片），用于首页「即将到来」与「过往行程」。
 * HomeEvents 与 UpcomingEvents 只是本组件的薄封装。
 *
 * 数据优先来自 window.__SSR_DATA__.events（middleware 注入），
 * 无 SSR 时才回退一次 fetch（极少见）。
 */
function EventSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card overflow-hidden">
          <div className="aspect-[16/9] bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <div className="p-4 space-y-2">
            <div className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EventEmpty({ filter }: { filter: 'past' | 'upcoming' }) {
  return (
    <div className="text-center py-10">
      <p className="text-sm text-[var(--text-soft)]">{filter === 'upcoming' ? '暂无即将到来的公演，敬请期待 ✦' : '暂无过往行程'}</p>
    </div>
  );
}

export default function EventCardGrid({
  initial,
  filter,
  sortDir = 'desc',
  limit = 4,
  fallbackImg = '/images/events/live-2026-01-31.webp',
}: EventCardGridProps) {
  const ssr = typeof window !== 'undefined' ? (window as any).__SSR_DATA__ : null;
  const [events, setEvents] = useState<EventRow[]>(ssr?.events || initial || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 有 SSR 实时数据（middleware 注入）或构建期种子，无需再请求
    if (ssr?.events) return;
    if (initial && initial.length > 0) return;
    let alive = true;
    setLoading(true);
    fetch('/api/events')
      .then((r) => r.json())
      .then((d) => { if (alive && Array.isArray(d) && d.length) setEvents(d); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const list = [...events]
      .filter((e) => e.status === filter)
      .sort((a, b) => {
        const diff = new Date(sortDir === 'asc' ? a.date : b.date).getTime() -
                     new Date(sortDir === 'asc' ? b.date : a.date).getTime();
        return sortDir === 'asc' ? -diff : diff;
      })
      .slice(0, limit);
    // 最终按展示顺序：past 用降序（最新在前），upcoming 用升序（最近在前）
    // sort 已经处理，这里只需保持
    return list;
  }, [events, filter, sortDir, limit]);

  if (loading) return <EventSkeleton count={limit} />;
  if (filtered.length === 0) return <EventEmpty filter={filter} />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
      {filtered.map((evt) => {
        const d = new Date(evt.date);
        const img = evt.image || getEventImage(evt.id, fallbackImg);
        return (
          <a key={evt.id} href={'/schedule/' + evt.id} className="card group">
            <div className="aspect-[16/9] overflow-hidden bg-gray-100 dark:bg-gray-800">
              <img
                src={img}
                alt={evt.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
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

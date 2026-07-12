import { useState, useEffect } from 'react';
import { marked } from 'marked';

interface EventDetailProps {
  id: string;
}

export default function EventDetail({ id }: EventDetailProps) {
  const [ev, setEv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/events?id=' + encodeURIComponent(id))
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('not found'))))
      .then(d => { if (alive) { setEv(d); setLoading(false); } })
      .catch(() => { if (alive) { setNotFound(true); setLoading(false); } });
    return () => { alive = false; };
  }, [id]);

  if (loading) return <p className="text-center text-gray-400 py-16">加载中…</p>;
  if (notFound || !ev) return <p className="text-center text-gray-400 py-16">未找到该日程</p>;

  const d = new Date(ev.date);
  const html = (typeof marked.parse === 'function'
    ? marked.parse(ev.body || '', { async: false })
    : marked(ev.body || '')) as string;

  return (
    <article className="max-w-3xl mx-auto px-4 py-12 md:py-16">
      <a href="/schedule" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 mb-6">← 返回日程</a>

      <div className="flex flex-wrap gap-2 mb-6 text-sm">
        <span className="bg-pink-50 dark:bg-gray-800 text-pink-600 dark:text-pink-300 px-3 py-1.5 rounded-full font-medium">
          {d.getMonth() + 1}月{d.getDate()}日
        </span>
        {ev.time && <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-full">{ev.time}</span>}
        {ev.venue && <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-full">{ev.venue}</span>}
      </div>

      <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-2">{ev.title}</h1>

      {ev.image && (
        <img
          src={ev.image}
          alt={ev.title}
          className="w-full rounded-2xl overflow-hidden object-cover max-h-[500px] mb-8 bg-gray-100 dark:bg-gray-800"
        />
      )}

      <div className="event-detail" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}

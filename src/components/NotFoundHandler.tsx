import { useState } from 'react';
import EventDetail from './EventDetail';

// 404 页面兜底：如果 URL 是 /schedule/xxx，直接渲染日程详情
export default function NotFoundHandler() {
  // 同步检查避免闪烁
  const [id] = useState(() => {
    if (typeof window === 'undefined') return null;
    const m = location.pathname.match(/^\/schedule\/(live-[\w-]+)/);
    return m ? m[1] : null;
  });

  if (id) return <EventDetail id={id} />;

  return (
    <section className="min-h-[60vh] flex items-center justify-center px-4 text-center">
      <div>
        <p className="text-8xl font-extrabold text-pink-200 mb-4">404</p>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">页面未找到</h1>
        <p className="text-gray-400 mb-8">公主们不在这里，返回首页吧</p>
        <div className="flex justify-center gap-3">
          <a href="/" className="btn-pink">返回首页</a>
          <a href="/schedule" className="btn-outline">公演日程</a>
        </div>
      </div>
    </section>
  );
}

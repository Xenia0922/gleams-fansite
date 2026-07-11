import { useState, useEffect, useMemo, useCallback } from 'react';
import ImageLightboxOverlay from './ImageLightboxOverlay';

interface Member {
  id: string;
  name: string;
  name_jp?: string;
  color?: string;
  emoji?: string;
  birthday?: string;
  constellation?: string;
  status?: string;
  image?: string;
  gallery?: string[];
  weibo?: string;
  weibo_name?: string;
  weibo_desc?: string;
  intro?: string;
}

export default function MemberDetail({ slug, initial }: { slug?: string; initial?: Member | null }) {
  const id = useMemo(() => {
    if (slug) return slug;
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('id');
      if (p) return p;
    }
    return '';
  }, [slug]);

  const [member, setMember] = useState<Member | null>(initial || null);
  const [loading, setLoading] = useState(!initial);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [activeColor, setActiveColor] = useState('');

  useEffect(() => {
    setActiveColor(typeof window !== 'undefined' ? (localStorage.getItem('gleams-accent') || '') : '');
    const onTheme = (e: Event) => setActiveColor((e as CustomEvent<{ color: string }>).detail?.color || '');
    window.addEventListener('gleams:theme', onTheme as EventListener);
    return () => window.removeEventListener('gleams:theme', onTheme as EventListener);
  }, []);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    fetch('/api/members?id=' + encodeURIComponent(id))
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d && !d.error) setMember(d); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  const gallery = member?.gallery || [];
  const lightboxImages = gallery.map(src => ({ src, alt: member?.name || '' }));
  const close = useCallback(() => setLightboxIdx(null), []);
  const prev = useCallback(
    () => setLightboxIdx(i => (i !== null ? (i - 1 + gallery.length) % gallery.length : null)),
    [gallery.length]
  );
  const next = useCallback(
    () => setLightboxIdx(i => (i !== null ? (i + 1) % gallery.length : null)),
    [gallery.length]
  );

  useEffect(() => {
    if (lightboxIdx === null) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [lightboxIdx, close, prev, next]);

  if (loading) return <p className="text-center text-gray-400 py-16">加载中…</p>;
  if (!member) return <p className="text-center text-gray-400 py-16">未找到该成员</p>;

  const [month, day] = (member.birthday || '--').split('-');

  return (
    <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-center md:items-start">
      <div className="md:w-80 flex-shrink-0 max-w-56 md:max-w-none">
        <div className="aspect-[4/5] rounded-3xl overflow-hidden glass shadow-lg">
          {member.image ? (
            <img src={member.image} alt={member.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">{member.emoji}</div>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-5 w-full">
        <div className="flex items-center gap-2 mb-1 justify-center md:justify-start">
          <span className="text-2xl">{member.emoji}</span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-gray-100">{member.name}</h1>
          <span className="text-sm text-gray-400">{member.name_jp}</span>
        </div>

        <div className="flex flex-wrap gap-2 text-sm justify-center md:justify-start">
          <span className="frost-card px-3 py-1 rounded-full text-gray-600">{month}月{day}日</span>
          <span className="frost-card px-3 py-1 rounded-full text-gray-600">{member.constellation}</span>
          <span
            data-member-color={member.id}
            data-color={member.color}
            className={'inline-flex items-center gap-1.5 frost-card px-3 py-1 rounded-full text-gray-600 cursor-pointer ' + (activeColor && activeColor.toLowerCase() === (member.color || '').toLowerCase() ? 'ring-2 ring-[var(--accent)]' : '')}
            title={`切换${member.name}主题色`}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: member.color }} />成员色
          </span>
        </div>

        <div className="frost-card p-4">
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{member.intro}</p>
        </div>

        {member.weibo && (
          <div>
            <a href={member.weibo} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-sm text-pink-500 hover:text-pink-600 font-medium">
              {member.weibo_name}
            </a>
            <p className="text-xs text-gray-400 mt-1">{member.weibo_desc}</p>
          </div>
        )}

        {gallery.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-center md:text-left text-gray-900 dark:text-gray-100 mb-3">更多照片</h3>
            <div className="grid grid-cols-3 gap-2">
              {gallery.map((img, i) => (
                <div
                  key={i}
                  className="aspect-[4/5] rounded-3xl overflow-hidden glass block w-full cursor-pointer group"
                  onClick={() => setLightboxIdx(i)}
                >
                  <img src={img} alt={member.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {lightboxIdx !== null && (
        <ImageLightboxOverlay images={lightboxImages} currentIndex={lightboxIdx} onClose={close} onPrev={prev} onNext={next} />
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';

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
}

export default function HomeMembers({ initial }: { initial: Member[] }) {
  const ssr = typeof window !== 'undefined' ? (window as any).__SSR_DATA__ : null;
  const [members, setMembers] = useState<Member[]>(ssr?.members || initial || []);
  const [activeColor, setActiveColor] = useState('');

  useEffect(() => {
    if (ssr?.members) return;
    let alive = true;
    fetch('/api/members')
      .then(r => r.json())
      .then(d => { if (alive && Array.isArray(d) && d.length) setMembers(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    setActiveColor(typeof window !== 'undefined' ? (localStorage.getItem('gleams-accent') || '') : '');
    const onTheme = (e: Event) => setActiveColor((e as CustomEvent<{ color: string }>).detail?.color || '');
    window.addEventListener('gleams:theme', onTheme as EventListener);
    return () => window.removeEventListener('gleams:theme', onTheme as EventListener);
  }, []);

  const isActive = (c?: string) =>
    !!c && !!activeColor && c.toLowerCase() === activeColor.toLowerCase();

  const active = members.filter(m => m.status !== 'graduated');

  return (
    <div className="grid grid-cols-3 gap-4 sm:gap-6">
      {active.map(m => (
        <a
          key={m.id}
          href={`/members/detail?id=${m.id}`}
          className="group block text-center transition-transform duration-300 group-hover:-translate-y-1"
        >
          <div className="aspect-[4/5] rounded-3xl overflow-hidden mb-3 glass shadow-md group-hover:shadow-lg transition-shadow">
            {m.image ? (
              <img src={m.image} alt={m.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl">{m.emoji}</div>
            )}
          </div>
          <span className="text-xl">{m.emoji}</span>
          <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">{m.name}</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500">{m.name_jp}</p>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span
              data-member-color={m.id}
              data-color={m.color}
              className={'inline-block w-2.5 h-2.5 rounded-full ' + (isActive(m.color) ? 'ring-2 ring-offset-1 dark:ring-offset-gray-900 ring-[var(--accent)]' : '')}
              style={{ background: m.color }}
              title={`切换${m.name}主题色`}
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">{m.birthday} · {m.constellation}</span>
          </div>
        </a>
      ))}
    </div>
  );
}

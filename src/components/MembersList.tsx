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

export default function MembersList({ initial }: { initial: Member[] }) {
  const [members, setMembers] = useState<Member[]>(initial || []);

  useEffect(() => {
    let alive = true;
    fetch('/api/members')
      .then(r => r.json())
      .then(d => { if (alive && Array.isArray(d) && d.length) setMembers(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const active = members.filter(m => m.status !== 'graduated');
  const graduated = members.filter(m => m.status === 'graduated');

  const Card = ({ m }: { m: Member }) => (
    <a href={`/members/detail?id=${m.id}`} className="group block text-center">
      <div className="aspect-[4/5] rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-3 shadow-sm group-hover:shadow-md transition-shadow">
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
        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
        <span className="text-xs text-gray-500 dark:text-gray-400">{m.birthday} · {m.constellation}</span>
      </div>
    </a>
  );

  if (members.length === 0) return <p className="text-center text-gray-400 py-16">暂无成员</p>;

  return (
    <>
      <p className="text-xs font-bold text-pink-500 tracking-widest text-center mb-5">正在活动</p>
      <div className="grid grid-cols-3 gap-4 sm:gap-6 mb-16">
        {active.map(m => <Card key={m.id} m={m} />)}
      </div>

      {graduated.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-800 pt-10">
          <p className="text-xs font-bold text-gray-400 tracking-widest text-center mb-5">已毕业</p>
          <div className="grid grid-cols-3 gap-4 sm:gap-6">
            {graduated.map(m => <Card key={m.id} m={m} />)}
          </div>
        </div>
      )}
    </>
  );
}

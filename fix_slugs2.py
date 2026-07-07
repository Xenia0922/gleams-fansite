import os

# Rewrite schedule.astro cleanly with proper slugs
content = '''---
import BaseLayout from '../layouts/BaseLayout.astro';
import scheduleData from '../data/schedule.json';
import membersData from '../data/members.json';

const memberMap = new Map(membersData.members.map(m => [m.id, m]));
const allEvents = [...scheduleData.events].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

const newsSlugs: Record<string, string> = {
  '2026-01-25': '2026-01-25-sunday-candy',
  '2026-01-31': '2026-01-31-comic-expo',
  '2026-02-15': '2026-02-15-guiping',
  '2026-02-23': '2026-02-23-akatsuki-24',
  '2026-03-14': '2026-03-14-white-valentine',
  '2026-03-28': '2026-03-28-akatsuki-25',
  '2026-04-26': '2026-04-26-puppy-club',
  '2026-05-16': '2026-05-16-fes',
  '2026-07-04': '2026-07-04-nez-fes',
};

const eventImages: Record<string, string> = {
  'live-2026-01-25': '/images/events/live-2026-01-25.webp',
  'live-2026-01-31': '/images/events/live-2026-01-31.webp',
  'live-2026-02-15': '/images/events/live-2026-02-15.webp',
  'live-2026-02-23': '/images/events/live-2026-02-23.webp',
  'live-2026-03-14': '/images/events/live-2026-03-14.webp',
  'live-2026-03-28': '/images/events/live-2026-03-28.webp',
  'live-2026-04-26': '/images/events/live-2026-04-26.webp',
  'live-2026-05-16': '/images/events/live-2026-05-16.webp',
  'live-2026-07-04': '/images/events/live-2026-07-04.webp',
};

const grouped: Record<string, any[]> = {};
allEvents.forEach((e: any) => {
  const d = new Date(e.date);
  const key = d.getFullYear() + '年' + (d.getMonth() + 1) + '月';
  if (!grouped[key]) grouped[key] = [];
  grouped[key].push(e);
});
---

<BaseLayout title="日程">
  <section class="max-w-4xl mx-auto px-4 py-12 sm:py-16 md:py-20">
    <div class="text-center mb-10">
      <p class="section-title-en">✦</p>
      <h1 class="section-title">日程</h1>
    </div>
    {Object.keys(grouped).length === 0 ? (
      <p class="text-center text-gray-400 py-16">暂无日程</p>
    ) : (
      Object.entries(grouped).map(([month, events]) => (
        <div class="mb-10" data-reveal>
          <h2 class="text-sm font-bold text-pink-500 tracking-widest mb-4">{month}</h2>
          <div class="space-y-2">
            {events.map((evt: any) => {
              const d = new Date(evt.date);
              const isPast = evt.status === 'past';
              const img = eventImages[evt.id] || '/images/events/live-2026-07-04.webp';
              const slug = newsSlugs[evt.date] || evt.date;
              return (
                <a href={'/news/' + slug} class={'flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl transition-opacity group ' + (isPast ? 'opacity-65 hover:opacity-100 bg-gray-50' : 'bg-pink-50')}>
                  <div class="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-gray-100">
                    <img src={img} alt="" class="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                  </div>
                  <div class="flex-shrink-0 text-center min-w-[44px] sm:min-w-[50px]">
                    <span class={'text-base sm:text-lg font-extrabold ' + (isPast ? 'text-gray-400' : 'text-pink-500')}>
                      {d.getMonth() + 1}/{d.getDate()}
                    </span>
                    {evt.time && <p class="text-[10px] text-gray-400 mt-0.5">{evt.time}</p>}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h3 class={'text-sm font-bold ' + (isPast ? 'text-gray-600' : 'text-gray-900')}>{evt.title}</h3>
                      {isPast && <span class="text-[10px] bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">已结束</span>}
                    </div>
                    <p class="text-xs text-gray-400 mt-1">{evt.venue}</p>
                    <div class="flex flex-wrap gap-1 mt-1.5">
                      {evt.performers.map((pid: string) => {
                        const m = memberMap.get(pid);
                        return m ? <span class="text-[10px] bg-white/80 text-gray-500 px-2 py-0.5 rounded-full">{m.emoji} {m.name}</span> : null;
                      })}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      ))
    )}
  </section>
</BaseLayout>
'''

with open('src/pages/schedule.astro', 'w', encoding='utf-8') as f:
    f.write(content)
print('Schedule rewritten')

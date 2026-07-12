import { useState, useEffect } from 'react';
import { SiteSocial } from './SiteBits';

interface Cfg {
  about_worldview?: string;
  about_intro?: string;
  weidian?: string;
  staff_qq?: string;
  weibo?: string;
  weibo_name?: string;
  weibo_desc?: string;
  xiaohongshu?: string;
  douyin?: string;
}

const DEFAULTS: Cfg = {
  about_worldview:
    '「在星界尽头，存在着一座神秘王国，由水晶支撑着整个王国的运转。有天能蚕食人间星光的阴霾突然降临，王国赖以生存的水晶随之日渐暗淡无光。正是在此存亡之际，来自不同城堡的公主，在命运的指引下相聚于此，公主们开始踏上寻找名为『Gleams』的能量宝石来守护他们的世界。」',
  about_intro:
    'Gleams 是一支来自广西南宁的地下偶像团体。三位成员以「公主」的身份活跃于南宁及两广地区的 Livehouse 和动漫展会。',
};

export default function AboutContent({ siteName, initial }: { siteName: string; initial: Cfg }) {
  const ssr = typeof window !== 'undefined' ? (window as any).__SSR_DATA__ : null;
  const [cfg, setCfg] = useState<Cfg>(() => ({ ...DEFAULTS, ...(initial || {}), ...(ssr?.siteConfig || {}) }));

  useEffect(() => {
    if (ssr?.siteConfig) return; // 已有 SSR 数据
    let alive = true;
    fetch('/api/site')
      .then(r => r.json())
      .then(d => { if (alive && d) setCfg({ ...DEFAULTS, ...d }); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <>
      <div className="card p-8 mb-8" data-reveal style={{ ['--reveal-delay' as any]: '0ms' }}>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">✦ 世界观</h2>
        <blockquote className="text-gray-600 dark:text-gray-400 leading-relaxed italic border-l-4 border-pink-300 pl-4">
          {cfg.about_worldview}
        </blockquote>
      </div>

      <div className="card p-8 mb-8" data-reveal style={{ ['--reveal-delay' as any]: '70ms' }}>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">✦ {siteName}</h2>
        <p className="text-gray-600 leading-relaxed mb-4">{cfg.about_intro}</p>
      </div>

      <div className="card p-8 mb-8" data-reveal style={{ ['--reveal-delay' as any]: '140ms' }}>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">✦ 支持公主</h2>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="rounded-3xl p-4 backdrop-blur-sm bg-white/30 dark:bg-white/[0.02] flex flex-col items-center">
            <p className="text-xs text-gray-400 mb-1">微店</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{cfg.weidian}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">官方周边</p>
          </div>
          <div className="rounded-3xl p-4 backdrop-blur-sm bg-white/30 dark:bg-white/[0.02] flex flex-col items-center">
            <p className="text-xs text-gray-400 mb-1">官方QQ</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{cfg.staff_qq}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">电切电聊</p>
          </div>
        </div>
      </div>

      <div className="card p-8 text-center" data-reveal style={{ ['--reveal-delay' as any]: '210ms' }}>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-6">✦ 关注 Gleams</h2>
        <SiteSocial variant="buttons" />
      </div>
    </>
  );
}

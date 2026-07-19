import { useState, useEffect, useCallback } from 'react';
import ImageUpload from './ImageUpload';

const INPUT =
  'w-full px-3 py-2 rounded-xl text-sm bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-[var(--accent)] transition-colors';

interface HeroCfg {
  title?: string;
  subtitle?: string;
  logo?: string;
  bg?: string;
  bgOpacity?: number;
  bgPosition?: string;
}

interface SiteCfg {
  about_worldview?: string;
  about_intro?: string;
  weidian?: string;
  staff_qq?: string;
  weibo?: string;
  weibo_name?: string;
  weibo_desc?: string;
  xiaohongshu?: string;
  douyin?: string;
  hero_config?: HeroCfg;
}

export default function AdminSite({ code }: { code: string }) {
  const [cfg, setCfg] = useState<SiteCfg>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/site');
      const data = await res.json();
      setCfg(data);
    } catch { setErr('加载失败'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k: keyof SiteCfg, v: string) => { setCfg(c => ({ ...c, [k]: v })); setSaved(false); };
  const setHero = (k: keyof HeroCfg, v: string | number) => {
    setCfg(c => ({ ...c, hero_config: { ...(c.hero_config || {}), [k]: v } }));
    setSaved(false);
  };
  // 解析 bgPosition（"x% y%" 或 "center center"/"top"/"bottom"）为 [x, y] 百分比
  const parsePos = (pos?: string): [number, number] => {
    if (!pos) return [50, 50];
    const m = pos.match(/(\d+)%\s+(\d+)%/);
    if (m) return [parseInt(m[1]), parseInt(m[2])];
    if (/top/i.test(pos)) return [50, 0];
    if (/bottom/i.test(pos)) return [50, 100];
    return [50, 50];
  };
  const setHeroPos = (x: number, y: number) => setHero('bgPosition', `${x}% ${y}%`);

  const save = async () => {
    setErr(''); setSaved(false);
    try {
      const res = await fetch('/api/site', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify(cfg),
      });
      const data = await res.json();
      if (data.ok) setSaved(true);
      else setErr(data.error || '保存失败');
    } catch { setErr('保存失败'); }
  };

  if (loading) return <p className="text-center text-gray-400 py-8">加载中…</p>;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-2">关于 · 世界观</h3>
        <textarea value={cfg.about_worldview || ''} onChange={e => set('about_worldview', e.target.value)} rows={4} className={INPUT + ' resize-none'} />
      </div>
      <div>
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-2">关于 · 团体介绍</h3>
        <textarea value={cfg.about_intro || ''} onChange={e => set('about_intro', e.target.value)} rows={3} className={INPUT + ' resize-none'} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="微店名">
          <input value={cfg.weidian || ''} onChange={e => set('weidian', e.target.value)} className={INPUT} />
        </Labeled>
        <Labeled label="官方QQ">
          <input value={cfg.staff_qq || ''} onChange={e => set('staff_qq', e.target.value)} className={INPUT} />
        </Labeled>
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-2">首页 Hero 栏</h3>
        <p className="text-xs text-gray-400 mb-3">主标题、副标题、Logo、背景图、透明度与焦点位置。简介复用下方「微博简介」。</p>
        <div className="grid md:grid-cols-2 gap-4">
          {/* 左：控件 */}
          <div className="space-y-3">
            <Labeled label="主标题">
              <input value={cfg.hero_config?.title || ''} onChange={e => setHero('title', e.target.value)} className={INPUT} />
            </Labeled>
            <Labeled label="副标题">
              <input value={cfg.hero_config?.subtitle || ''} onChange={e => setHero('subtitle', e.target.value)} className={INPUT} />
            </Labeled>
            <Labeled label="Logo 图片">
              <ImageUpload code={code} section="hero" value={cfg.hero_config?.logo || ''} onChange={u => setHero('logo', u)} label="Logo" />
            </Labeled>
            <Labeled label="背景图">
              <ImageUpload code={code} section="hero" value={cfg.hero_config?.bg || ''} onChange={u => setHero('bg', u)} label="背景图" />
            </Labeled>
            <Labeled label={`背景透明度 ${Math.round((cfg.hero_config?.bgOpacity ?? 0.22) * 100)}%`}>
              <input type="range" min={0} max={1} step={0.02} value={cfg.hero_config?.bgOpacity ?? 0.22} onChange={e => setHero('bgOpacity', parseFloat(e.target.value))} className="w-full accent-[var(--accent)]" />
            </Labeled>
            {(() => {
              const [px, py] = parsePos(cfg.hero_config?.bgPosition);
              return (
                <>
                  <Labeled label={`背景焦点 水平 ${px}%（0=左 50=中 100=右）`}>
                    <input type="range" min={0} max={100} step={1} value={px} onChange={e => setHeroPos(parseInt(e.target.value), py)} className="w-full accent-[var(--accent)]" />
                  </Labeled>
                  <Labeled label={`背景焦点 垂直 ${py}%（0=上 50=中 100=下）`}>
                    <input type="range" min={0} max={100} step={1} value={py} onChange={e => setHeroPos(px, parseInt(e.target.value))} className="w-full accent-[var(--accent)]" />
                  </Labeled>
                </>
              );
            })()}
          </div>
          {/* 右：实时预览 */}
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">实时预览（亮色模式）</span>
            <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-900">
              <img src={cfg.hero_config?.bg || '/hero-bg.webp'} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: cfg.hero_config?.bgOpacity ?? 0.22, objectPosition: cfg.hero_config?.bgPosition || 'center center' }} />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                <img src={cfg.hero_config?.logo || '/logo.png'} alt="" className="w-10 h-10 rounded-full shadow mb-1.5 object-cover" />
                <p className="text-[10px] text-gray-500 mb-0.5">{cfg.hero_config?.subtitle || '副标题'}</p>
                <h3 className="text-lg font-extrabold text-gradient">{cfg.hero_config?.title || 'Gleams'}</h3>
                <p className="text-[9px] text-gray-400 mt-1">{cfg.weibo_desc || '简介'}</p>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">暗色模式下透明度会自动按比例降低，保持整体协调。</p>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-2">微博 / 社交</h3>
        <div className="space-y-3">
          <Labeled label="微博链接">
            <input value={cfg.weibo || ''} onChange={e => set('weibo', e.target.value)} className={INPUT} />
          </Labeled>
          <Labeled label="微博名">
            <input value={cfg.weibo_name || ''} onChange={e => set('weibo_name', e.target.value)} className={INPUT} />
          </Labeled>
          <Labeled label="微博简介">
            <input value={cfg.weibo_desc || ''} onChange={e => set('weibo_desc', e.target.value)} className={INPUT} />
          </Labeled>
          <Labeled label="小红书">
            <input value={cfg.xiaohongshu || ''} onChange={e => set('xiaohongshu', e.target.value)} className={INPUT} />
          </Labeled>
          <Labeled label="抖音">
            <input value={cfg.douyin || ''} onChange={e => set('douyin', e.target.value)} className={INPUT} />
          </Labeled>
        </div>
      </div>

      {err && <p className="text-xs text-red-500">{err}</p>}
      {saved && <p className="text-xs text-green-500">已保存</p>}
      <button onClick={save} className="btn-pink text-xs !px-4 !py-1.5">保存站点设置</button>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

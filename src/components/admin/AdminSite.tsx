import { useState, useEffect, useCallback } from 'react';

const INPUT =
  'w-full px-3 py-2 rounded-xl text-sm bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-[var(--accent)] transition-colors';

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

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import ImageLightboxOverlay from './ImageLightboxOverlay';
import ImageUpload from './admin/ImageUpload';

// 构建期骨架：首屏先显示成员本地图，挂载后由 /api/gallery 拉取 D1 实时数据覆盖。
const initialImages = [
  { src: '/images/members/hakusai/hakusai_01.webp', member: 'hakusai' },
  { src: '/images/members/hakusai/hakusai_02.webp', member: 'hakusai' },
  { src: '/images/members/hakusai/hakusai_03.webp', member: 'hakusai' },
  { src: '/images/members/hakusai/hakusai_04.webp', member: 'hakusai' },
  { src: '/images/members/hakusai/hakusai_05.webp', member: 'hakusai' },
  { src: '/images/members/hakusai/hakusai_06.webp', member: 'hakusai' },
  { src: '/images/members/hakusai/hakusai_07.webp', member: 'hakusai' },
  { src: '/images/members/hakusai/hakusai_08.webp', member: 'hakusai' },
  { src: '/images/members/hakusai/hakusai_09.webp', member: 'hakusai' },
  { src: '/images/members/kumo/kumo_01.webp', member: 'kumo' },
  { src: '/images/members/kumo/kumo_02.webp', member: 'kumo' },
  { src: '/images/members/kumo/kumo_03.webp', member: 'kumo' },
  { src: '/images/members/kumo/kumo_04.webp', member: 'kumo' },
  { src: '/images/members/kumo/kumo_05.webp', member: 'kumo' },
  { src: '/images/members/kumo/kumo_06.webp', member: 'kumo' },
  { src: '/images/members/kumo/kumo_07.webp', member: 'kumo' },
  { src: '/images/members/kumo/kumo_08.webp', member: 'kumo' },
  { src: '/images/members/kumo/kumo_09.webp', member: 'kumo' },
  { src: '/images/members/yuzi/yuzi_main.webp', member: 'yuzi' },
  { src: '/images/members/yuzi/yuzi_02.webp', member: 'yuzi' },
  { src: '/images/members/yuzi/yuzi_03.webp', member: 'yuzi' },
  { src: '/images/members/yuzi/yuzi_04.webp', member: 'yuzi' },
  { src: '/images/members/yuzi/yuzi_05.webp', member: 'yuzi' },
  { src: '/images/members/yuzi/yuzi_06.webp', member: 'yuzi' },
  { src: '/images/members/yuzi/yuzi_07.webp', member: 'yuzi' },
  { src: '/images/members/yuzi/yuzi_08.webp', member: 'yuzi' },
  { src: '/images/members/yuzi/yuzi_09.webp', member: 'yuzi' },
];

interface MemberGroup {
  id: string;
  name: string;
  emoji: string;
  color: string;
  gallery: string[];
}
interface Extra {
  id: string;
  url: string;
  caption: string;
}
type Cell = { src: string; member: string; id?: string };

const META: Record<string, { name: string; emoji: string; color: string }> = {
  hakusai: { name: '白菜', emoji: '💛', color: '#FFD700' },
  kumo: { name: '云团', emoji: '💙', color: '#4DA6FF' },
  yuzi: { name: '柚子', emoji: '💚', color: '#48D1A0' },
};

const initialMembers: MemberGroup[] = (() => {
  const map = new Map<string, MemberGroup>();
  for (const im of initialImages) {
    if (!map.has(im.member)) {
      map.set(im.member, { id: im.member, name: im.member, emoji: '⭐', color: '#e83e8c', gallery: [] });
    }
    map.get(im.member)!.gallery.push(im.src);
  }
  for (const m of map.values()) {
    const x = META[m.id];
    if (x) {
      m.name = x.name;
      m.emoji = x.emoji;
      m.color = x.color;
    }
  }
  return [...map.values()];
})();

export default function GalleryGrid() {
  const [filter, setFilter] = useState('all');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [members, setMembers] = useState<MemberGroup[]>(initialMembers);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // 拉取实时数据：聚合成员 9 宫格 + 后台独立照片；若本浏览器已登录后台则显示增删控件。
  const reload = useCallback(async () => {
    const code =
      adminCode || (typeof localStorage !== 'undefined' ? localStorage.getItem('gleams-admin') || '' : '');
    try {
      const res = await fetch('/api/gallery', code ? { headers: { 'x-admin-code': code } } : undefined);
      const data = await res.json();
      if (Array.isArray(data.members) && data.members.length) setMembers(data.members);
      if (Array.isArray(data.extras)) setExtras(data.extras);
      if (data.isAdmin) {
        setIsAdmin(true);
        setAdminCode(code);
      }
    } catch {
      /* 离线时保留骨架 */
    }
  }, [adminCode]);

  useEffect(() => {
    reload();
  }, [reload]);

  const filters = useMemo(
    () => [
      { key: 'all', label: '全部', emoji: '⭐', color: '#e83e8c' },
      ...members.map((m) => ({ key: m.id, label: m.name, emoji: m.emoji, color: m.color })),
    ],
    [members]
  );

  const memberPhotos = useMemo(
    () => members.flatMap((m) => (m.gallery || []).map((src) => ({ src, member: m.id }))),
    [members]
  );
  const extraPhotos = useMemo(
    () => extras.map((e) => ({ src: e.url, member: '__extra__', id: e.id })),
    [extras]
  );
  const displayList = useMemo<Cell[]>(() => {
    const m = filter === 'all' ? memberPhotos : memberPhotos.filter((p) => p.member === filter);
    const e = filter === 'all' ? extraPhotos : [];
    return [...m, ...e];
  }, [filter, memberPhotos, extraPhotos]);
  const firstExtraIdx = displayList.findIndex((p) => p.member === '__extra__');
  const lightboxImages = useMemo(() => displayList.map((p) => ({ src: p.src })), [displayList]);

  const close = useCallback(() => setLightboxIdx(null), []);
  const prev = useCallback(
    () => setLightboxIdx((i) => (i !== null ? (i - 1 + displayList.length) % displayList.length : null)),
    [displayList.length]
  );
  const next = useCallback(
    () => setLightboxIdx((i) => (i !== null ? (i + 1) % displayList.length : null)),
    [displayList.length]
  );

  useEffect(() => {
    if (lightboxIdx === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxIdx, close, prev, next]);

  const addExtra = async (url: string) => {
    if (!url || !isAdmin) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': adminCode },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.ok) {
        setDraft('');
        reload();
      } else setErr(data.error || '添加失败');
    } catch {
      setErr('添加失败');
    } finally {
      setBusy(false);
    }
  };

  const delExtra = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm('从画廊页删除这张照片？')) return;
    try {
      const res = await fetch('/api/gallery?id=' + encodeURIComponent(id), {
        method: 'DELETE',
        headers: { 'x-admin-code': adminCode },
      });
      const data = await res.json();
      if (data.ok) reload();
      else alert(data.error || '删除失败');
    } catch {
      alert('删除失败');
    }
  };

  return (
    <>
      {/* 成员筛选按钮 */}
      <div className="flex justify-center gap-2 mb-8 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setFilter(f.key);
              setLightboxIdx(null);
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              filter === f.key ? 'text-white shadow-md' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'
            }`}
            style={filter === f.key ? { backgroundColor: f.color } : {}}
          >
            <span>{f.emoji}</span>
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      {/* 后台：添加画廊页照片（仅已登录后台的浏览器显示） */}
      {isAdmin && (
        <div className="max-w-md mx-auto mb-8">
          <ImageUpload
            code={adminCode}
            section="gallery"
            value={draft}
            onChange={(u) => {
              if (u) addExtra(u);
              setDraft('');
            }}
            label="添加画廊页照片"
          />
          {busy && <p className="text-xs text-gray-400 mt-1 text-center">上传中…</p>}
          {err && <p className="text-xs text-red-500 mt-1 text-center">{err}</p>}
          <p className="text-[11px] text-gray-400 mt-2 text-center">
            这些照片只显示在画廊页，删除也不会动到成员简介九宫格。
          </p>
        </div>
      )}

      {/* 图片网格 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {displayList.map((item, i) => (
          <Fragment key={item.member === '__extra__' ? `ex-${item.id}` : `${item.member}-${i}`}>
            {item.member === '__extra__' && i === firstExtraIdx && (
              <div className="col-span-full flex items-center gap-3 mt-2 mb-1">
                <span className="text-sm font-bold text-gray-400">✨ 画廊页照片</span>
                <span className="text-xs text-gray-400">（后台管理 · 不影响成员简介九宫格）</span>
              </div>
            )}
            <div
              className="relative aspect-[4/5] rounded-3xl overflow-hidden glass cursor-pointer group"
              onClick={() => setLightboxIdx(i)}
            >
              <img
                src={item.src}
                alt=""
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                loading="lazy"
              />
              {isAdmin && item.member === '__extra__' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    delExtra(item.id as string);
                  }}
                  className="absolute top-2 right-2 text-xs bg-red-500/80 hover:bg-red-600 text-white px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  删除
                </button>
              )}
            </div>
          </Fragment>
        ))}
      </div>

      {displayList.length === 0 && <div className="text-center py-16 text-gray-400">暂无照片</div>}

      {lightboxIdx !== null && (
        <ImageLightboxOverlay
          images={lightboxImages}
          currentIndex={lightboxIdx}
          onClose={close}
          onPrev={prev}
          onNext={next}
        />
      )}
    </>
  );
}

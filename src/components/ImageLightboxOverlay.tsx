import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface LightboxImage {
  src: string;
  alt?: string;
}

interface ImageLightboxOverlayProps {
  images: LightboxImage[];
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

const ZOOM = 2.5;
const LENS = 150; // 桌面放大镜镜头直径(px)

export default function ImageLightboxOverlay({
  images,
  currentIndex,
  onClose,
  onPrev,
  onNext,
}: ImageLightboxOverlayProps) {
  const image = images[currentIndex];
  if (!image) return null;

  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [magnify, setMagnify] = useState(false); // 放大镜模式开关
  const [lens, setLens] = useState<{ x: number; y: number; bgX: number; bgY: number } | null>(null);
  const [zoomed, setZoomed] = useState(false); // 移动端点按放大态
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  const canHover =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover)').matches;

  // 切换图片时重置所有局部状态
  useEffect(() => {
    setLoaded(false);
    setMagnify(false);
    setLens(null);
    setZoomed(false);
    setPan({ x: 0, y: 0 });
  }, [currentIndex]);

  const showLens = magnify && canHover && loaded;

  const onMove = useCallback(
    (e: React.MouseEvent) => {
      if (!showLens) return;
      const img = imgRef.current;
      if (!img || !img.naturalWidth) return;
      const rect = img.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        setLens(null);
        return;
      }
      const fx = x / rect.width;
      const fy = y / rect.height;
      const nx = fx * img.naturalWidth * ZOOM;
      const ny = fy * img.naturalHeight * ZOOM;
      const bgX = Math.min(Math.max(nx - LENS / 2, 0), img.naturalWidth * ZOOM - LENS);
      const bgY = Math.min(Math.max(ny - LENS / 2, 0), img.naturalHeight * ZOOM - LENS);
      setLens({ x: e.clientX, y: e.clientY, bgX, bgY });
    },
    [showLens]
  );

  // 移动端点按放大 + 拖动平移
  const onPointerDown = (e: React.PointerEvent) => {
    if (!magnify || canHover) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!magnify || canHover || !dragRef.current) return;
    if (zoomed) {
      const dx = e.clientX - dragRef.current.sx;
      const dy = e.clientY - dragRef.current.sy;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true;
      setPan({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy });
    }
  };
  const onPointerUp = () => {
    if (!magnify || canHover) return;
    if (dragRef.current && !dragRef.current.moved) {
      setZoomed(v => !v);
      setPan({ x: 0, y: 0 });
    }
    dragRef.current = null;
  };

  const imgStyle: React.CSSProperties =
    zoomed && !canHover
      ? { transform: `translate(${pan.x}px, ${pan.y}px) scale(${ZOOM})`, transformOrigin: 'center center', cursor: 'grab' }
      : {};

  const hint = magnify
    ? canHover
      ? '移动鼠标查看细节'
      : zoomed
        ? '拖动查看 · 再次点击还原'
        : '点击放大 · 拖动查看'
    : '';

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/95" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute top-5 right-5 sm:top-6 sm:right-6 text-white/60 hover:text-white text-sm z-20 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
      >
        ✕ 关闭
      </button>
      <span className="absolute top-5 left-5 sm:top-6 sm:left-6 text-white/40 text-sm z-20 select-none">
        {currentIndex + 1} / {images.length}
      </span>

      {/* 放大镜开关 */}
      <button
        onClick={e => {
          e.stopPropagation();
          setMagnify(v => !v);
          setLens(null);
          setZoomed(false);
          setPan({ x: 0, y: 0 });
        }}
        className={`absolute top-5 left-1/2 -translate-x-1/2 z-20 text-sm px-4 py-1.5 rounded-full transition-colors ${
          magnify ? 'bg-white text-black' : 'bg-white/10 text-white/70 hover:bg-white/20'
        }`}
      >
        🔍 放大镜
      </button>

      {hint && (
        <span className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/40 text-xs z-20 select-none">
          {hint}
        </span>
      )}

      {images.length > 1 && (
        <>
          <button
            onClick={e => {
              e.stopPropagation();
              onPrev();
            }}
            className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-3xl z-20 p-4"
          >
            ‹
          </button>
          <button
            onClick={e => {
              e.stopPropagation();
              onNext();
            }}
            className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-3xl z-20 p-4"
          >
            ›
          </button>
        </>
      )}

      <div
        className="absolute inset-0 flex items-center justify-center"
        onClick={e => e.stopPropagation()}
      >
        <img
          ref={imgRef}
          src={image.src}
          alt={image.alt || ''}
          onLoad={() => setLoaded(true)}
          onMouseMove={onMove}
          onMouseLeave={() => setLens(null)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="max-w-full max-h-full object-contain select-none"
          style={imgStyle}
          draggable={false}
        />
      </div>

      {/* 桌面放大镜镜头 */}
      {lens && (
        <div
          className="fixed rounded-full pointer-events-none z-[110]"
          style={{
            left: lens.x,
            top: lens.y,
            width: LENS,
            height: LENS,
            transform: 'translate(-50%, -50%)',
            border: '2px solid rgba(255,255,255,0.9)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            backgroundImage: `url(${image.src})`,
            backgroundSize: `${imgRef.current ? imgRef.current.naturalWidth * ZOOM : 0}px ${imgRef.current ? imgRef.current.naturalHeight * ZOOM : 0}px`,
            backgroundPosition: `${-lens.bgX}px ${-lens.bgY}px`,
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}
    </div>,
    document.body
  );
}

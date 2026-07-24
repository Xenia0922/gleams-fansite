import { useCallback, useEffect, useRef, useState } from 'react';
import ImageLightboxOverlay, { type LightboxImage } from './ImageLightboxOverlay';

interface StaticImageLightboxProps {
  images: LightboxImage[];
  mode: 'grid' | 'single';
  gridClassName?: string;
  itemClassName?: string;
  imageClassName?: string;
}

export default function StaticImageLightbox({
  images,
  mode,
  gridClassName = '',
  itemClassName = '',
  imageClassName = '',
}: StaticImageLightboxProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);

  const close = useCallback(() => setLightboxIdx(null), []);
  const prev = useCallback(() => setLightboxIdx(i => i !== null ? (i - 1 + images.length) % images.length : null), [images.length]);
  const next = useCallback(() => setLightboxIdx(i => i !== null ? (i + 1) % images.length : null), [images.length]);

  // 用原生 addEventListener 绑定点击，避免 Astro SSG 下 React 合成事件不触发
  useEffect(() => {
    const handlers: { el: HTMLImageElement; fn: () => void }[] = [];
    imgRefs.current.forEach((el, i) => {
      if (!el) return;
      const fn = () => setLightboxIdx(i);
      el.addEventListener('click', fn);
      handlers.push({ el, fn });
    });
    return () => {
      handlers.forEach(({ el, fn }) => el.removeEventListener('click', fn));
    };
  }, [images]);

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

  if (images.length === 0) return null;

  return (
    <>
      {mode === 'grid' ? (
        <div className={gridClassName}>
          {images.map((image, i) => (
            <div key={`${image.src}-${i}`} className={itemClassName}>
              <img
                ref={el => { imgRefs.current[i] = el; }}
                src={image.src}
                alt={image.alt || ''}
                className={`${imageClassName} cursor-zoom-in`}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className={itemClassName}>
          <img
            ref={el => { imgRefs.current[0] = el; }}
            src={images[0].src}
            alt={images[0].alt || ''}
            className={`${imageClassName} cursor-zoom-in`}
            loading="lazy"
          />
        </div>
      )}

      {lightboxIdx !== null && (
        <ImageLightboxOverlay
          images={images}
          currentIndex={lightboxIdx}
          onClose={close}
          onPrev={prev}
          onNext={next}
        />
      )}
    </>
  );
}

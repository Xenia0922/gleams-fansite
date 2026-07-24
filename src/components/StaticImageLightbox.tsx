import { useCallback, useEffect, useState } from 'react';
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

  const close = useCallback(() => setLightboxIdx(null), []);
  const prev = useCallback(() => setLightboxIdx(i => i !== null ? (i - 1 + images.length) % images.length : null), [images.length]);
  const next = useCallback(() => setLightboxIdx(i => i !== null ? (i + 1) % images.length : null), [images.length]);

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

  // 直接用 <img onClick> 而非 <button> 包裹——避免 Astro SSG 下 button 事件丢失
  const imageNodes = images.map((image, i) => (
    <img
      key={`${image.src}-${i}`}
      src={image.src}
      alt={image.alt || ''}
      className={`${imageClassName} cursor-zoom-in`}
      loading="lazy"
      onClick={() => setLightboxIdx(i)}
    />
  ));

  return (
    <>
      {mode === 'grid' ? (
        <div className={`${gridClassName} ${itemClassName}`}>
          {imageNodes.map((node, i) => (
            <div key={i} className={itemClassName}>{node}</div>
          ))}
        </div>
      ) : (
        <div className={itemClassName}>{imageNodes[0]}</div>
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

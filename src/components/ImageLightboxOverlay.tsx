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

export default function ImageLightboxOverlay({
  images,
  currentIndex,
  onClose,
  onPrev,
  onNext,
}: ImageLightboxOverlayProps) {
  const image = images[currentIndex];
  if (!image) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black" onClick={onClose}>
      <button onClick={onClose} className="absolute top-6 right-6 text-white/60 hover:text-white text-sm z-10">
        ✕ 关闭
      </button>
      <span className="absolute top-6 left-6 text-white/40 text-sm z-10">
        {currentIndex + 1} / {images.length}
      </span>
      {images.length > 1 && (
        <>
          <button onClick={e => { e.stopPropagation(); onPrev(); }} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-3xl z-10 p-4">
            ‹
          </button>
          <button onClick={e => { e.stopPropagation(); onNext(); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-3xl z-10 p-4">
            ›
          </button>
        </>
      )}
      <img
        src={image.src}
        alt={image.alt || ''}
        className="w-screen h-screen object-contain"
        onClick={e => e.stopPropagation()}
      />
    </div>,
    document.body
  );
}

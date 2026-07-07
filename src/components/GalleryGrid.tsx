import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface GalleryItem {
  src: string;
  alt: string;
  category: string;
}

const defaultGallery: GalleryItem[] = [
  { src: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop', alt: 'Live 现场 1', category: 'live' },
  { src: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&h=1000&fit=crop', alt: '公演舞台', category: 'live' },
  { src: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&h=600&fit=crop', alt: '演唱会', category: 'live' },
  { src: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800&h=800&fit=crop', alt: '后台花絮', category: 'behind' },
  { src: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&h=600&fit=crop', alt: '音乐节', category: 'live' },
  { src: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&h=800&fit=crop', alt: '幕后准备', category: 'behind' },
  { src: 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=800&h=600&fit=crop', alt: '日常瞬间 1', category: 'daily' },
  { src: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&h=1000&fit=crop', alt: '公演现场', category: 'live' },
  { src: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=600&fit=crop', alt: '日常瞬间 2', category: 'daily' },
  { src: 'https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?w=800&h=800&fit=crop', alt: '后台花絮 2', category: 'behind' },
  { src: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=800&h=600&fit=crop', alt: '日常瞬间 3', category: 'daily' },
  { src: 'https://images.unsplash.com/photo-1499364615650-ec38552f4f34?w=800&h=800&fit=crop', alt: '纪念照', category: 'behind' },
];

const categories = [
  { key: 'all', label: '全部' },
  { key: 'live', label: '公演现场' },
  { key: 'behind', label: '幕后花絮' },
  { key: 'daily', label: '日常' },
];

export default function GalleryGrid() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const filtered = activeCategory === 'all'
    ? defaultGallery
    : defaultGallery.filter(item => item.category === activeCategory);

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  const prevImage = () => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex - 1 + filtered.length) % filtered.length);
  };
  const nextImage = () => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex + 1) % filtered.length);
  };

  // Keyboard navigation
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'ArrowRight') nextImage();
    });
  }

  return (
    <>
      {/* Filter Tabs */}
      <div className="flex justify-center gap-2 mb-10 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
              activeCategory === cat.key
                ? 'bg-gleams-500/10 text-gleams-400 border border-gleams-500/20'
                : 'text-white/40 hover:text-white/70 border border-transparent hover:border-white/10'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Masonry Grid */}
      <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
        {filtered.map((item, index) => (
          <div
            key={index}
            className="break-inside-avoid glass-card overflow-hidden cursor-pointer group animate-fade-in"
            onClick={() => openLightbox(index)}
          >
            <div className="relative overflow-hidden">
              <img
                src={item.src}
                alt={item.alt}
                className="w-full object-cover transition-transform duration-700 group-hover:scale-110"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-4">
                <span className="text-white text-sm">{item.alt}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-white/30">
          <span className="text-4xl mb-4 block">📷</span>
          <p>该分类下暂无照片</p>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-6 right-6 text-white/60 hover:text-white transition-colors z-10"
          >
            <X className="w-8 h-8" />
          </button>

          {/* Counter */}
          <div className="absolute top-6 left-6 text-white/40 text-sm z-10">
            {lightboxIndex + 1} / {filtered.length}
          </div>

          {/* Prev */}
          <button
            onClick={(e) => { e.stopPropagation(); prevImage(); }}
            className="absolute left-4 md:left-8 text-white/60 hover:text-white transition-colors z-10 p-2"
          >
            <ChevronLeft className="w-8 h-8 md:w-10 md:h-10" />
          </button>

          {/* Image */}
          <div
            className="max-w-[90vw] max-h-[85vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={filtered[lightboxIndex].src}
              alt={filtered[lightboxIndex].alt}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-fade-in"
            />
          </div>

          {/* Next */}
          <button
            onClick={(e) => { e.stopPropagation(); nextImage(); }}
            className="absolute right-4 md:right-8 text-white/60 hover:text-white transition-colors z-10 p-2"
          >
            <ChevronRight className="w-8 h-8 md:w-10 md:h-10" />
          </button>

          {/* Caption */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-sm">
            {filtered[lightboxIndex].alt}
          </div>
        </div>
      )}
    </>
  );
}

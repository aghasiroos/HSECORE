import React, { useState, useEffect, useMemo } from 'react';

interface NotificationCarouselProps {
  images: string[];
}

export const NotificationCarousel: React.FC<NotificationCarouselProps> = React.memo(({ images }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const safeImages = useMemo(() => images || [], [images]);
  const imagesCount = safeImages.length;

  useEffect(() => {
    if (imagesCount <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % imagesCount);
    }, 60000);
    return () => clearInterval(interval);
  }, [imagesCount]);

  if (imagesCount === 0) return null;

  return (
    <div className="relative w-full h-24 mt-1 mb-1 rounded overflow-hidden" id="notification-carousel">
      {safeImages.map((img, idx) => (
        <img 
          key={idx}
          src={img} 
          alt="Notification attachment" 
          referrerPolicy="no-referrer"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            idx === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
          }`} 
        />
      ))}
      {imagesCount > 1 && (
        <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[8px] px-1.5 py-0.5 rounded z-20 font-mono">
          {currentIndex + 1} / {imagesCount}
        </div>
      )}
    </div>
  );
});

NotificationCarousel.displayName = 'NotificationCarousel';

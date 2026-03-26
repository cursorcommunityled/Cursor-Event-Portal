'use client';

import React, { useMemo, useState, useCallback, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Users, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { pastEvents } from '@/content/events';
import { useI18n } from '@/lib/i18n';
import type { EventWithPhotos } from '@/lib/supabase/queries';

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

interface RecapEvent {
  id: string;
  title: string;
  date: string;
  attendees?: number;
  thumbnail?: string;
  galleryImages?: string[];
  allPhotos: string[];
}

const PHOTOS_PER_PAGE = 6;

function prefetchUrls(urls: string[]) {
  for (const url of urls) {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }
}

const PhotoGallery = memo(function PhotoGallery({ photos, title }: { photos: string[]; title: string }) {
  const [page, setPage] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const totalPages = Math.ceil(photos.length / PHOTOS_PER_PAGE);

  const goPage = useCallback(
    (dir: 'left' | 'right') => {
      setPage((p) => {
        const next = dir === 'right' ? Math.min(p + 1, totalPages - 1) : Math.max(p - 1, 0);
        return next;
      });
    },
    [totalPages]
  );

  // Warm cache for prev/next page so arrow clicks feel instant
  useEffect(() => {
    if (photos.length === 0 || totalPages <= 1) return;
    const urls: string[] = [];
    if (page > 0) {
      const o = (page - 1) * PHOTOS_PER_PAGE;
      urls.push(...photos.slice(o, o + PHOTOS_PER_PAGE));
    }
    if (page < totalPages - 1) {
      const o = (page + 1) * PHOTOS_PER_PAGE;
      urls.push(...photos.slice(o, o + PHOTOS_PER_PAGE));
    }
    prefetchUrls(urls);
  }, [page, photos, totalPages]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const neighbors: string[] = [];
    if (lightboxIndex > 0) neighbors.push(photos[lightboxIndex - 1]);
    if (lightboxIndex < photos.length - 1) neighbors.push(photos[lightboxIndex + 1]);
    prefetchUrls(neighbors);
  }, [lightboxIndex, photos]);

  if (photos.length === 0) return null;

  const pageOffset = page * PHOTOS_PER_PAGE;
  const pagePhotos = photos.slice(pageOffset, pageOffset + PHOTOS_PER_PAGE);

  return (
    <>
      <div className="relative group/gallery [contain:layout]">
        <div className="overflow-hidden">
          <div className="grid grid-cols-3 gap-1 aspect-[3/1]">
            {pagePhotos.map((src, i) => (
              <button
                key={`${pageOffset + i}-${src}`}
                type="button"
                className="relative min-h-0 overflow-hidden cursor-pointer bg-black/20"
                onClick={() => setLightboxIndex(pageOffset + i)}
              >
                <img
                  src={src}
                  alt={`${title} photo ${pageOffset + i + 1}`}
                  loading="lazy"
                  decoding="async"
                  fetchPriority={page === 0 && i < 3 ? "high" : "low"}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        {totalPages > 1 && (
          <>
            <button
              type="button"
              onClick={() => goPage('left')}
              className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/75 text-white/90 hover:bg-black/90 ${page === 0 ? 'pointer-events-none opacity-0' : 'opacity-0 group-hover/gallery:opacity-100'}`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => goPage('right')}
              className={`absolute right-2 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/75 text-white/90 hover:bg-black/90 ${page >= totalPages - 1 ? 'pointer-events-none opacity-0' : 'opacity-0 group-hover/gallery:opacity-100'}`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 z-10 flex max-w-[90%] -translate-x-1/2 items-center gap-1.5 overflow-x-auto py-1">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setPage(i)}
                  className={`h-1.5 shrink-0 rounded-full ${i === page ? 'w-4 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'}`}
                />
              ))}
            </div>
          </>
        )}

        {photos.length > 0 && (
          <div className="absolute right-2 top-2 z-10 rounded-full border border-white/15 bg-black/75 px-2 py-0.5 text-[10px] tabular-nums text-white/80">
            {photos.length} photo{photos.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/92"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 z-10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          {lightboxIndex > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              className="absolute left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/12 text-white hover:bg-white/20"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {lightboxIndex < photos.length - 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              className="absolute right-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/12 text-white hover:bg-white/20"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
          <div className="relative w-full max-w-4xl max-h-[85vh] mx-6 flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* Native img: one decode at a time, avoids stacking Next/Image buffers when paging fast */}
            <img
              key={lightboxIndex}
              src={photos[lightboxIndex]}
              alt={`${title} photo ${lightboxIndex + 1}`}
              decoding="async"
              className="max-h-[75vh] max-w-full w-auto h-auto object-contain"
            />
            <p className="text-center text-xs text-white/50 mt-3 tabular-nums">
              {lightboxIndex + 1} / {photos.length}
            </p>
          </div>
        </div>
      )}
    </>
  );
});

interface PastEventsProps {
  eventsWithPhotos?: EventWithPhotos[];
}

const PastEvents: React.FC<PastEventsProps> = ({ eventsWithPhotos = [] }) => {
  const { t, locale } = useI18n();

  const mergedEvents = useMemo(() => {
    const staticRecaps: RecapEvent[] = pastEvents.map((e) => ({
      id: e.id,
      title: e.title,
      date: e.date,
      attendees: e.attendees,
      thumbnail: e.thumbnail,
      galleryImages: e.galleryImages,
      allPhotos: [e.thumbnail, ...(e.galleryImages || [])].filter(Boolean) as string[],
    }));

    const staticIds = new Set(pastEvents.map((e) => e.id));

    const dbRecaps: RecapEvent[] = eventsWithPhotos
      .filter((ev) => ev.photos.length > 0 && !staticIds.has(ev.slug))
      .map((ev) => ({
        id: ev.slug || ev.id,
        title: ev.name,
        date: ev.start_time ? ev.start_time.split('T')[0] : '',
        thumbnail: ev.photos[0]?.file_url,
        galleryImages: ev.photos.slice(1, 3).map((p) => p.file_url),
        allPhotos: ev.photos.map((p) => p.file_url),
      }));

    const enhanced = staticRecaps.map((se) => {
      const dbMatch = eventsWithPhotos.find((ev) => ev.slug === se.id);
      if (!dbMatch || dbMatch.photos.length === 0) return se;
      return {
        ...se,
        thumbnail: dbMatch.photos[0]?.file_url ?? se.thumbnail,
        galleryImages: dbMatch.photos.length > 1
          ? dbMatch.photos.slice(1, 3).map((p) => p.file_url)
          : se.galleryImages,
        allPhotos: dbMatch.photos.map((p) => p.file_url),
      };
    });

    return [...dbRecaps, ...enhanced].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [eventsWithPhotos]);

  if (mergedEvents.length === 0) {
    return null;
  }

  return (
    <motion.section
      id="recaps"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5 }}
      className="mb-16 scroll-mt-20"
    >
      <p className="text-xs uppercase tracking-wider text-cursor-text-muted font-medium mb-2">
        {t('home.pastEvents')}
      </p>
      <h2 className="text-2xl md:text-3xl font-bold text-cursor-text mb-6">
        {t('home.pastEventsHeading')}
      </h2>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-50px' }}
        className="space-y-6 -mx-3 sm:mx-0"
      >
        {mergedEvents.map((event) => {
          const displayDate = event.date
            ? new Date(`${event.date}T00:00:00`).toLocaleDateString(
                locale === 'en' ? 'en-US' : locale,
                { year: 'numeric', month: 'long', day: 'numeric' }
              )
            : '';

          return (
            <motion.div key={event.id} variants={itemVariants}>
              <div className="relative bg-[#1B1913] border border-cursor-border rounded-none sm:rounded-md overflow-hidden transition-all duration-300 hover:border-white/20 hover:shadow-[0_0_30px_rgba(255,255,255,0.06)]">
                <div className="pointer-events-none absolute -inset-px sm:rounded-md bg-[radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.04),transparent_60%)] opacity-0 hover:opacity-100 transition-opacity duration-500 z-10" />
                <PhotoGallery photos={event.allPhotos} title={event.title} />
                <div className="px-5 py-4">
                  <h3 className="text-lg text-cursor-text font-medium mb-1.5">{event.title}</h3>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-cursor-text-muted">
                    {displayDate && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        <span>{displayDate}</span>
                      </div>
                    )}
                    {event.attendees ? (
                      <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4" />
                        <span>{t('home.attendees', { count: String(event.attendees) })}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.section>
  );
};

export default PastEvents;

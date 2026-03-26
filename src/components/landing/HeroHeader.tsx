'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import BentoGrid from '@/components/landing/BentoGrid';
import { headerPhotos } from '@/content/header-photos';
import type { HeaderPhoto } from '@/lib/landing-types';
import type { EventWithPhotos } from '@/lib/supabase/queries';

interface HeroHeaderProps {
  eventsWithPhotos?: EventWithPhotos[];
  heroFeaturedIds?: string[];
}

const HeroHeader: React.FC<HeroHeaderProps> = ({ eventsWithPhotos = [], heroFeaturedIds = [] }) => {
  const photos = useMemo(() => {
    const slotCount = headerPhotos.length;
    const allDbPhotos = eventsWithPhotos.flatMap((ev) =>
      ev.photos.map((p) => ({ id: p.id, url: p.file_url, eventName: ev.name }))
    );

    // 1. Admin-curated featured photos fill first
    const featured = heroFeaturedIds
      .map((id) => allDbPhotos.find((p) => p.id === id))
      .filter(Boolean) as { id: string; url: string; eventName: string }[];

    // 2. Fill remaining slots proportionally across events (round-robin)
    const usedIds = new Set(featured.map((p) => p.id));
    const remaining = slotCount - featured.length;

    const filler: { url: string; eventName: string }[] = [];
    if (remaining > 0) {
      const eventsWithUnused = eventsWithPhotos
        .map((ev) => ({
          name: ev.name,
          photos: ev.photos.filter((p) => !usedIds.has(p.id)),
        }))
        .filter((ev) => ev.photos.length > 0);

      if (eventsWithUnused.length > 0) {
        let round = 0;
        while (filler.length < remaining && round < 20) {
          for (const ev of eventsWithUnused) {
            if (round < ev.photos.length && filler.length < remaining) {
              filler.push({ url: ev.photos[round].file_url, eventName: ev.name });
            }
          }
          round++;
        }
      }
    }

    const combined = [
      ...featured.map((p) => ({ url: p.url, eventName: p.eventName })),
      ...filler,
    ];

    if (combined.length === 0) return headerPhotos;

    const result: HeaderPhoto[] = headerPhotos.map((slot, i) => {
      if (i < combined.length) {
        return { ...slot, src: combined[i].url, alt: `${combined[i].eventName} event photo` };
      }
      return slot;
    });

    return result;
  }, [eventsWithPhotos, heroFeaturedIds]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="h-[calc(100svh-56px)] border-t border-cursor-border overflow-hidden"
      style={{
        maskImage: 'linear-gradient(to bottom, black 85%, transparent)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent)',
      }}
    >
      <BentoGrid photos={photos} cols={4} rows={4} mobileCols={2} mobileRows={4} />
    </motion.div>
  );
};

export default HeroHeader;

'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import BentoGrid from '@/components/landing/BentoGrid';
import { headerPhotos } from '@/content/header-photos';
import type { HeaderPhoto } from '@/lib/landing-types';
import type { EventWithPhotos } from '@/lib/supabase/queries';

interface HeroHeaderProps {
  eventsWithPhotos?: EventWithPhotos[];
}

const HeroHeader: React.FC<HeroHeaderProps> = ({ eventsWithPhotos = [] }) => {
  const photos = useMemo(() => {
    const allDbPhotos = eventsWithPhotos.flatMap((ev) =>
      ev.photos.map((p) => ({ url: p.file_url, eventName: ev.name }))
    );

    if (allDbPhotos.length === 0) return headerPhotos;

    // Pick DB photos round-robin across events for variety
    const byEvent = eventsWithPhotos
      .filter((ev) => ev.photos.length > 0)
      .map((ev) => ev.photos.map((p) => ({ url: p.file_url, name: ev.name })));

    const mixed: { url: string; name: string }[] = [];
    let round = 0;
    while (mixed.length < 7 && round < 10) {
      for (const eventPhotos of byEvent) {
        if (round < eventPhotos.length && mixed.length < 7) {
          mixed.push(eventPhotos[round]);
        }
      }
      round++;
    }

    if (mixed.length === 0) return headerPhotos;

    // Map the static grid layout positions, replacing src with DB photos
    const result: HeaderPhoto[] = headerPhotos.map((slot, i) => {
      if (i < mixed.length) {
        return { ...slot, src: mixed[i].url, alt: `${mixed[i].name} event photo` };
      }
      return slot;
    });

    return result;
  }, [eventsWithPhotos]);

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

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
    const eventsWithDbPhotos = eventsWithPhotos.filter((ev) => ev.photos.length > 0);
    if (eventsWithDbPhotos.length === 0) return headerPhotos;

    // Pick one random photo per event, then swap into a few static slots
    const picks = eventsWithDbPhotos.map((ev) => {
      const idx = Math.floor(Math.random() * ev.photos.length);
      return { url: ev.photos[idx].file_url, name: ev.name };
    });

    // Only replace up to 2 static photos (keep the curated mix mostly intact)
    const maxReplacements = Math.min(picks.length, 2);
    const replacementSlots = [3, 5];

    const result: HeaderPhoto[] = headerPhotos.map((slot, i) => {
      const ri = replacementSlots.indexOf(i);
      if (ri !== -1 && ri < maxReplacements) {
        return { ...slot, src: picks[ri].url, alt: `${picks[ri].name} event photo` };
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

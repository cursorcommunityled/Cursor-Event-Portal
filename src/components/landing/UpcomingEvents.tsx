'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { upcomingEvents } from '@/content/events';
import { useI18n } from '@/lib/i18n';

const UpcomingEvents: React.FC = () => {
  const { t, locale } = useI18n();

  if (upcomingEvents.length === 0) {
    return null;
  }

  const formatDate = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString(locale === 'en' ? 'en-US' : locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  return (
    <motion.section
      id="upcoming"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5 }}
      className="mb-16 scroll-mt-20"
    >
      <p className="text-xs uppercase tracking-wider text-cursor-text-muted font-medium mb-2">
        {t('home.upcomingEvents')}
      </p>
      <h2 className="text-2xl md:text-3xl font-bold text-cursor-text mb-6">
        {t('home.upcomingHeading')}
      </h2>

      <div className="space-y-4">
        {upcomingEvents.map((event, index) => {
          const eventCity = event.location.split(',')[0].trim();

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              className="relative overflow-hidden bg-cursor-surface border border-cursor-border border-l-2 border-l-cursor-accent-blue rounded-lg p-5"
            >
              <div className="pointer-events-none absolute -inset-px rounded-lg bg-[radial-gradient(ellipse_at_bottom_left,rgba(168,180,200,0.06),transparent_60%)]" />
              <div className="flex items-center gap-2 text-sm text-cursor-text-muted mb-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cursor-accent-blue opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cursor-accent-blue" />
                </span>
                <span>{event.displayDate ?? formatDate(event.date)}</span>
                <span className="text-cursor-text-faint">&middot;</span>
                <span>{eventCity}</span>
              </div>
              <h3 className="text-2xl font-bold text-cursor-text mb-3">{event.title}</h3>
              {event.lumaUrl ? (
                <a
                  href={event.lumaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-cursor-text text-cursor-bg rounded-md px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  {t('home.register')}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : null}
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
};

export default UpcomingEvents;

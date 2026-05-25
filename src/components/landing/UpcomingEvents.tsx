'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { eventLinks } from '@/content/events';
import { useI18n } from '@/lib/i18n';

const EVENT_LINKS_PER_PAGE = 2;

const UpcomingEvents: React.FC = () => {
  const { t, locale } = useI18n();
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(eventLinks.length / EVENT_LINKS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const visibleEvents = useMemo(() => {
    const offset = currentPage * EVENT_LINKS_PER_PAGE;
    return eventLinks.slice(offset, offset + EVENT_LINKS_PER_PAGE);
  }, [currentPage]);

  if (eventLinks.length === 0) {
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
        {t('home.eventLinks')}
      </p>
      <h2 className="text-2xl md:text-3xl font-bold text-cursor-text mb-6">
        {t('home.eventLinksHeading')}
      </h2>

      <div className="space-y-4">
        {visibleEvents.map((event, index) => {
          const eventCity = event.location.split(',')[0].trim();
          const isPast = event.status === 'past';

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              className={`relative overflow-hidden bg-cursor-surface border border-cursor-border border-l-2 rounded-lg p-5 ${
                isPast ? 'border-l-cursor-text-faint' : 'border-l-cursor-accent-blue'
              }`}
            >
              <div className="pointer-events-none absolute -inset-px rounded-lg bg-[radial-gradient(ellipse_at_bottom_left,rgba(168,180,200,0.06),transparent_60%)]" />
              <div className="flex items-center gap-2 text-sm text-cursor-text-muted mb-2">
                <span className="relative flex h-2.5 w-2.5">
                  {!isPast && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cursor-accent-blue opacity-75" />
                  )}
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isPast ? 'bg-cursor-text-faint' : 'bg-cursor-accent-blue'}`} />
                </span>
                <span>{event.displayDate ?? formatDate(event.date)}</span>
                <span className="text-cursor-text-faint">&middot;</span>
                <span>{eventCity}</span>
                {isPast && (
                  <>
                    <span className="text-cursor-text-faint">&middot;</span>
                    <span>{t('home.pastEvent')}</span>
                  </>
                )}
              </div>
              <h3 className="text-2xl font-bold text-cursor-text mb-3">{event.title}</h3>
              {event.description ? (
                <p className="text-sm text-cursor-text-muted leading-relaxed mb-4">
                  {event.description}
                </p>
              ) : null}
              {event.lumaUrl ? (
                <a
                  href={event.lumaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-cursor-text text-cursor-bg rounded-md px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  {isPast ? t('home.viewOnLuma') : t('home.register')}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : null}
            </motion.div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-cursor-text-muted">
            {t('home.eventsPage', {
              current: String(currentPage + 1),
              total: String(totalPages),
            })}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(p - 1, 0))}
              disabled={currentPage === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-cursor-border px-3 py-2 text-xs font-medium text-cursor-text-muted transition-colors hover:border-white/25 hover:text-cursor-text disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              {t('home.newerEvents')}
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
              disabled={currentPage >= totalPages - 1}
              className="inline-flex items-center gap-1.5 rounded-md border border-cursor-border px-3 py-2 text-xs font-medium text-cursor-text-muted transition-colors hover:border-white/25 hover:text-cursor-text disabled:pointer-events-none disabled:opacity-40"
            >
              {t('home.olderEvents')}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </motion.section>
  );
};

export default UpcomingEvents;

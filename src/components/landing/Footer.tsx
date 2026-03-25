'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { ExternalLink } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { siteConfig } from '@/content/site.config';
import { upcomingEvents } from '@/content/events';
import Partners from '@/components/landing/Partners';

const LandingFooter: React.FC = () => {
  const { t } = useI18n();
  const nextEvent = upcomingEvents[0];

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5 }}
      className="mt-24 pt-8 border-t border-cursor-border"
    >
      <Partners />

      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <svg viewBox="0 0 466.73 532.09" className="h-5 w-auto text-cursor-text-muted" aria-hidden="true">
              <path fill="currentColor" d="M457.43,125.94L244.42,2.96c-6.84-3.95-15.28-3.95-22.12,0L9.3,125.94c-5.75,3.32-9.3,9.46-9.3,16.11v247.99c0,6.65,3.55,12.79,9.3,16.11l213.01,122.98c6.84,3.95,15.28,3.95,22.12,0l213.01-122.98c5.75-3.32,9.3-9.46,9.3-16.11v-247.99c0-6.65-3.55-12.79-9.3-16.11h-.01ZM444.05,151.99l-205.63,356.16c-1.39,2.4-5.06,1.42-5.06-1.36v-233.21c0-4.66-2.49-8.97-6.53-11.31L24.87,145.67c-2.4-1.39-1.42-5.06,1.36-5.06h411.26c5.84,0,9.49,6.33,6.57,11.39h-.01Z"/>
            </svg>
            <span className="text-cursor-text-muted text-sm">
              Cursor {siteConfig.communityNameLocal}
            </span>
          </div>
          <p className="text-cursor-text-muted text-sm leading-relaxed">
            {siteConfig.footerTagline || t('footer.madeWith')}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <a
            href={siteConfig.lumaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-cursor-text-secondary hover:text-cursor-text transition-colors inline-flex items-center gap-1.5"
          >
            {t('footer.allEvents')}
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href={siteConfig.cursorCommunityUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-cursor-text-secondary hover:text-cursor-text transition-colors inline-flex items-center gap-1.5"
          >
            {t('footer.community')}
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://x.com/cursor_ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-cursor-text-secondary hover:text-cursor-text transition-colors inline-flex items-center gap-1.5"
          >
            {t('footer.followUs')}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="md:text-right">
          {nextEvent?.lumaUrl && (
            <a
              href={nextEvent.lumaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white border border-white/20 rounded-md hover:bg-white/20 transition-colors text-sm font-medium"
            >
              {t('footer.joinNext')}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      <p className="text-cursor-text-faint text-xs text-center mt-10 pb-6">
        {siteConfig.footerTagline || t('footer.madeWith')}
      </p>
    </motion.footer>
  );
};

export default LandingFooter;

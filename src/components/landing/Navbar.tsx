'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import LanguageToggle from '@/components/landing/LanguageToggle';
import { siteConfig } from '@/content/site.config';

const NAV_LINKS = [
  { href: '#upcoming', key: 'home.upcomingEvents' },
  { href: '#recaps', key: 'home.pastEvents' },
] as const;

function useScrollState() {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);

      const sections = ['upcoming', 'recaps'];
      let current: string | null = null;
      for (const id of sections) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 120 && rect.bottom > 120) {
            current = id;
          }
        }
      }
      setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return { scrolled, activeSection };
}

export default function Navbar({ onOpenPortal }: { onOpenPortal: () => void }) {
  const { t } = useI18n();
  const { scrolled, activeSection } = useScrollState();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 640) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <>
      <nav
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled
            ? 'bg-cursor-bg/90 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.4)] border-b border-cursor-border'
            : 'bg-cursor-bg/80 backdrop-blur-md border-b border-transparent'
        }`}
      >
        <div className="flex justify-between items-center px-6 md:px-12 lg:px-16 h-14">
          <a href="#" className="flex items-center gap-2.5">
            <svg viewBox="0 0 466.73 532.09" className="h-6 md:h-7 w-auto text-cursor-text opacity-80" aria-hidden="true">
              <path fill="currentColor" d="M457.43,125.94L244.42,2.96c-6.84-3.95-15.28-3.95-22.12,0L9.3,125.94c-5.75,3.32-9.3,9.46-9.3,16.11v247.99c0,6.65,3.55,12.79,9.3,16.11l213.01,122.98c6.84,3.95,15.28,3.95,22.12,0l213.01-122.98c5.75-3.32,9.3-9.46,9.3-16.11v-247.99c0-6.65-3.55-12.79-9.3-16.11h-.01ZM444.05,151.99l-205.63,356.16c-1.39,2.4-5.06,1.42-5.06-1.36v-233.21c0-4.66-2.49-8.97-6.53-11.31L24.87,145.67c-2.4-1.39-1.42-5.06,1.36-5.06h411.26c5.84,0,9.49,6.33,6.57,11.39h-.01Z"/>
            </svg>
            <span className="text-lg md:text-xl font-semibold tracking-tight text-cursor-text">
              {siteConfig.communityName}
              {siteConfig.communityNameLocal ? (
                <span className="font-bold tracking-wide text-xl md:text-2xl text-cursor-text-secondary ml-2">
                  {siteConfig.communityNameLocal}
                </span>
              ) : null}
            </span>
          </a>

          <div className="hidden sm:flex items-center gap-6">
            {NAV_LINKS.map(({ href, key }) => {
              const sectionId = href.replace('#', '');
              const isActive = activeSection === sectionId;
              return (
                <a
                  key={href}
                  href={href}
                  className={`text-sm transition-colors ${
                    isActive
                      ? 'text-cursor-text font-medium'
                      : 'text-cursor-text-muted hover:text-cursor-text'
                  }`}
                >
                  {t(key)}
                </a>
              );
            })}
            <button
              onClick={onOpenPortal}
              className="text-sm font-medium px-3.5 py-1.5 rounded-md bg-[#f54e00] text-white hover:bg-[#e04500] transition-colors"
            >
              {t('nav.eventPortal')}
            </button>
            <LanguageToggle />
          </div>

          <div className="flex sm:hidden items-center gap-3">
            <LanguageToggle />
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-1.5 text-cursor-text-muted hover:text-cursor-text transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 top-14 z-30 bg-cursor-bg/95 backdrop-blur-md sm:hidden">
          <div className="flex flex-col items-center gap-6 pt-12">
            {NAV_LINKS.map(({ href, key }) => (
              <a
                key={href}
                href={href}
                onClick={closeMobile}
                className="text-lg text-cursor-text-muted hover:text-cursor-text transition-colors"
              >
                {t(key)}
              </a>
            ))}
            <button
              onClick={() => {
                closeMobile();
                onOpenPortal();
              }}
              className="text-base font-medium px-5 py-2.5 rounded-md bg-[#f54e00] text-white hover:bg-[#e04500] transition-colors"
            >
              {t('nav.eventPortal')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

'use client';

import React, { useState } from 'react';
import { I18nProvider } from '@/lib/i18n';
import Navbar from '@/components/landing/Navbar';
import HeroHeader from '@/components/landing/HeroHeader';
import AmbassadorSection from '@/components/landing/AmbassadorSection';
import FeaturedSection from '@/components/landing/FeaturedSection';
import UpcomingEvents from '@/components/landing/UpcomingEvents';
import PastEvents from '@/components/landing/PastEvents';
import GlobalEvents from '@/components/landing/GlobalEvents';
import SectionDivider from '@/components/landing/SectionDivider';
import LandingFooter from '@/components/landing/Footer';
import JsonLd from '@/components/landing/JsonLd';
import EventPortalPopup from '@/components/landing/EventPortalPopup';
import { siteConfig } from '@/content/site.config';
import { upcomingEvents } from '@/content/events';
import type { EventWithPhotos } from '@/lib/supabase/queries';

function buildHomeJsonLd() {
  const org = {
    '@type': 'Organization',
    name: `${siteConfig.communityName} ${siteConfig.communityNameLocal}`,
    url: siteConfig.cursorCommunityUrl,
  };

  const eventItems = upcomingEvents.map((event) => ({
    '@type': 'Event',
    name: event.title,
    startDate: event.date,
    location: {
      '@type': 'Place',
      name: event.location,
    },
    organizer: org,
    ...(event.lumaUrl ? { url: event.lumaUrl } : {}),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
  }));

  return {
    '@context': 'https://schema.org',
    '@graph': [org, ...eventItems],
  };
}

interface LandingPageProps {
  activeEventSlug: string;
  eventsWithPhotos?: EventWithPhotos[];
  heroFeaturedIds?: string[];
}

export default function LandingPage({ activeEventSlug, eventsWithPhotos = [], heroFeaturedIds = [] }: LandingPageProps) {
  const [showPortal, setShowPortal] = useState(false);

  return (
    <I18nProvider>
      <main className="min-h-screen bg-cursor-bg text-cursor-text scroll-smooth">
        <JsonLd data={buildHomeJsonLd()} />
        <Navbar onOpenPortal={() => setShowPortal(true)} />
        <HeroHeader eventsWithPhotos={eventsWithPhotos} heroFeaturedIds={heroFeaturedIds} />

        <div className="max-w-5xl mx-auto px-6 py-16 md:py-24">
          <AmbassadorSection />
          <SectionDivider />
          <FeaturedSection />
          <SectionDivider />
          <UpcomingEvents />
          <SectionDivider />
          <PastEvents eventsWithPhotos={eventsWithPhotos} />
          <SectionDivider />
          <GlobalEvents />
          <LandingFooter />
        </div>

        <EventPortalPopup
          isOpen={showPortal}
          onClose={() => setShowPortal(false)}
          activeEventSlug={activeEventSlug}
        />
      </main>
    </I18nProvider>
  );
}

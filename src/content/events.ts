import { CursorEvent } from '@/lib/landing-types';

export const events: CursorEvent[] = [
  {
    id: 'cafe-cursor-calgary-aug-2026',
    title: 'Cafe Cursor Calgary',
    date: '2026-08-02',
    displayDate: 'August 2, 2026 - 9:00 AM-5:00 PM MDT',
    description: 'A daytime Cafe Cursor co-working event at HOUSE 831. Bring your laptop, work alongside local Cursor users, and drop in for building, coffee, and community.',
    location: 'HOUSE 831, Calgary, Canada',
    lumaUrl: 'https://luma.com/6z1eyz1l',
    portalPath: '/cafe-cursor-calgary-aug-2026',
    status: 'upcoming',
  },
  {
    id: 'calgary-july-2026',
    title: 'Cursor Calgary Meetup - July',
    date: '2026-07-29',
    displayDate: 'July 29, 2026 - 5:30-9:00 PM MDT',
    description: 'Sponsored by ZayZoon. Bring your laptop for speakers, a micro-hackathon build session, demos, and networking.',
    location: 'ZayZoon, Calgary, Canada',
    lumaUrl: 'https://luma.com/y6o5mr37',
    portalPath: '/calgary-july-2026',
    status: 'upcoming',
  },
  {
    id: 'calgary-june-2026',
    title: 'Cursor Calgary Meetup - June',
    date: '2026-06-24',
    displayDate: 'June 24, 2026 - 5:30-8:30 PM MDT',
    description: 'Hosted at ZayZoon. Bring your laptop for speakers, a hands-on build session, demos, and networking.',
    location: 'ZayZoon, Calgary, Canada',
    lumaUrl: 'https://luma.com/cursor-t2wq',
    portalPath: '/calgary-june-2026',
    status: 'past',
  },
  {
    id: 'calgary-hackathon-sait-may-2026',
    title: 'Cursor Calgary Hackathon - SAIT',
    date: '2026-05-23',
    displayDate: 'May 23–24, 2026 · 9:00 AM–3:30 PM',
    location: 'Calgary, Canada',
    lumaUrl: 'https://luma.com/e4l2gbj2',
    status: 'past',
  },
  {
    id: 'calgary-may-2026',
    title: 'Cursor Calgary Meetup - May',
    date: '2026-05-27',
    displayDate: 'May 27, 2026 - 5:30-8:30 PM MDT',
    location: 'Calgary, Canada',
    lumaUrl: 'https://luma.com/kjchw3e3',
    status: 'past',
  },
  {
    id: 'calgary-apr-2026',
    title: 'Cursor Meetup — April',
    date: '2026-04-29',
    displayDate: 'April 29, 2026',
    location: 'Calgary, Canada',
    lumaUrl: 'https://lu.ma/onlcm9o9',
    status: 'past',
  },
  {
    id: 'calgary-feb-2026',
    title: 'Cursor Calgary Meetup',
    date: '2026-02-25',
    displayDate: 'February 25, 2026',
    attendees: 40,
    location: 'Calgary, Canada',
    thumbnail: '/feb-meetup-group.jpg',
    galleryImages: ['/feb-meetup-vr.jpg', '/feb-meetup-coding.jpg'],
    status: 'past',
  },
];

export const upcomingEvents = events.filter((e) => e.status === 'upcoming');
export const pastEvents = events.filter((e) => e.status === 'past');
export const eventLinks = events
  .filter((e) => e.lumaUrl || e.portalPath)
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

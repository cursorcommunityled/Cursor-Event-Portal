import { CursorEvent } from '@/lib/landing-types';

export const events: CursorEvent[] = [
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
    id: 'calgary-hackathon-sait-may-2026',
    title: 'Cursor Hackathon — SAIT',
    date: '2026-05-23',
    displayDate: 'May 23–24, 2026',
    location: 'Calgary, Canada',
    lumaUrl: 'https://luma.com/e4l2gbj2',
    status: 'upcoming',
  },
  {
    id: 'calgary-may-2026',
    title: 'Cursor Calgary Meetup - May',
    date: '2026-05-27',
    displayDate: 'May 27, 2026 - 5:30-8:30 PM CST',
    location: 'Calgary, Canada',
    lumaUrl: 'https://luma.com/kjchw3e3',
    status: 'upcoming',
  },
  {
    id: 'calgary-hackathon-mar-2026',
    title: 'Cursor Hackathon UCalgary',
    date: '2026-03-14',
    displayDate: 'March 14–15, 2026',
    attendees: 72,
    location: 'Calgary, Canada',
    thumbnail: '/event-venue-wide.jpg',
    galleryImages: ['/event-winners-1st.jpg', '/event-winners-3rd.jpg'],
    status: 'past',
  },
  {
    id: 'calgary-coworking-mar-2026',
    title: 'Cursor Coworking Calgary',
    date: '2026-03-11',
    displayDate: 'March 11, 2026',
    location: 'Calgary, Canada',
    thumbnail: '/coworking-venue.jpg',
    galleryImages: ['/coworking-whiteboard.jpg', '/coworking-group.jpg'],
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
export const lumaEvents = events
  .filter((e) => e.lumaUrl)
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

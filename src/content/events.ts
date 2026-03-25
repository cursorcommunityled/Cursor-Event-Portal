import { CursorEvent } from '@/lib/landing-types';

export const events: CursorEvent[] = [
  {
    id: 'calgary-apr-2026',
    title: 'Cursor Meetup Calgary April',
    date: '2026-04-29',
    displayDate: 'April 29, 2026',
    location: 'Calgary, Canada',
    lumaUrl: 'https://lu.ma/onlcm9o9',
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

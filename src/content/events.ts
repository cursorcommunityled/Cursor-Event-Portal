import { CursorEvent } from '@/lib/landing-types';

export const events: CursorEvent[] = [
  {
    id: 'calgary-apr-2026',
    title: 'Cursor Calgary Meetup',
    date: '2026-04-22',
    displayDate: 'April 22, 2026',
    location: 'Calgary, Canada',
    lumaUrl: 'https://lu.ma/cursor-calgary',
    status: 'upcoming',
  },
  {
    id: 'calgary-feb-2026',
    title: 'Cursor Calgary — Community Builder',
    date: '2026-02-25',
    displayDate: 'February 25, 2026',
    attendees: 40,
    location: 'Calgary, Canada',
    thumbnail: '/event-venue-wide.jpg',
    galleryImages: ['/event-winners-1st.jpg', '/event-winners-3rd.jpg'],
    status: 'past',
  },
];

export const upcomingEvents = events.filter((e) => e.status === 'upcoming');
export const pastEvents = events.filter((e) => e.status === 'past');

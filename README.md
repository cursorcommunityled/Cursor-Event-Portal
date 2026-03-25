# Cursor Event Portal

An open-source event management portal for Cursor community meetups, built by the community.

## Features

- **Registration & Check-in** — QR code registration and staff check-in tools
- **Event Experience** — Agenda, venues, resources, and real-time announcements
- **Q&A System** — Real-time questions with upvoting and moderation
- **Polls & Surveys** — Live polls during events and post-event feedback collection
- **Slide Deck Viewer** — Upload and present PDF slide decks with real-time page sync
- **Competitions** — Demo sign-ups, voting, and media uploads
- **Speed Networking** — Suggested conversation groups with table assignments
- **Easter Egg Hunt** — Cursor Credits scavenger hunt via QR codes
- **Exchange Board** — Attendee-to-attendee skill/resource exchange
- **Admin Dashboard** — Full event management, analytics, and moderation tools
- **Multi-event Support** — Manage multiple events with per-event configuration
- **i18n Ready** — Internationalisation support built in

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL + Realtime)
- **Styling**: Tailwind CSS
- **Email**: Resend
- **Hosting**: Render (see `render.yaml`)

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` and fill in your values:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
RESEND_API_KEY=your_resend_api_key
```

### 3. Set up the database

Apply the base schema to your Supabase project:

```bash
# In the Supabase SQL Editor, run:
supabase/schema.sql
```

Then apply the incremental migrations in `supabase/migrations/` in order. These add features like competitions, speed networking, slide decks, venues, credits, and more.

### 4. Run the development server

```bash
npm run dev
```

---

## Migration Guides

> **If you are upgrading an existing deployment**, read these guides before pulling new changes.

### Slide Deck Migration

The slides system was migrated from individual slide management to single PDF deck uploads per event. This is a breaking change for existing slide data.

**Full guide: [`SLIDE_DECK_MIGRATION.md`](./SLIDE_DECK_MIGRATION.md)**

Quick steps:
1. Clear existing slides (`npm run clear-slides` or run `supabase/migrations/clear_all_slides.sql`)
2. Deploy — the new `SlideDeckAdminClient` component takes over automatically
3. Upload your PDF deck via the admin panel

### Database Migrations

All incremental schema changes live in `supabase/migrations/`. When pulling updates, check for new `.sql` files and apply them to your Supabase project via the SQL Editor. Key migrations include:

| Migration | What it does |
|---|---|
| `20260201_competitions.sql` | Competition system with demos and voting |
| `add_speed_networking.sql` | Speed networking groups and table assignments |
| `add_cursor_credits.sql` | Cursor Credits and easter egg hunt |
| `add_exchange_board.sql` | Attendee exchange board |
| `add_venues.sql` | Venue management with images |
| `add_app_settings_active_event.sql` | App-level settings and active event config |
| `comprehensive_analytics_tracking.sql` | Event analytics and tracking |

See `supabase/migrations/` for the complete list.

---

## Database Schema

See `supabase/schema.sql` for the base schema. Incremental changes are in `supabase/migrations/`.

## Deployment

This project is configured for deployment on **Render**. See `render.yaml` for the full configuration.

## Contributing

This is a community-led project. Contributions, feature requests, and bug reports are welcome.

## License

Open source — built for and by the Cursor community.


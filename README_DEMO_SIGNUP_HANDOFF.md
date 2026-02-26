# Demo Signup Handoff (Project + Supabase Owner)

This document is for handing off the attendee demo-slot signup feature to the person who owns the codebase and Supabase project.

## Current Status

- Product rules are finalized:
  - Demo signup opens at `18:30` and closes at `20:00` (event timezone).
  - Slots are `5 minutes` each.
  - Capacity is `2` attendees per slot.
  - Each attendee can book `1` slot total.
  - No waitlist; full slots are blocked.
- Implementation plan is defined.
- If this branch does not yet include the full code/migration changes, use this as the source of truth for completing rollout.

## What Is Implemented (Feature Behavior Target)

- Attendees can sign up to speaker demo slots from the portal.
- Signup is available only to users who:
  - have a valid event portal session, and
  - are checked in (`registrations.checked_in_at` is not null).
- Demo signup window is enforced server-side:
  - before open: cannot book
  - during window: can book if slot has space
  - after close: cannot book
- Slot capacity and one-slot-per-attendee are enforced with DB constraints plus server validation.
- Admin can view slot occupancy and attendee assignments, and control enable/open/close settings.

## Supabase Owner Checklist

## 1) Apply Database Migration

Apply the migration that creates:

- `demo_signup_settings` (per-event config + open/close)
- `demo_slots` (5-minute windows + capacity)
- `demo_slot_signups` (attendee bookings)

Required constraint behavior:

- `UNIQUE (event_id, starts_at)` on `demo_slots`
- `UNIQUE (slot_id, user_id)` on `demo_slot_signups`
- `UNIQUE (event_id, user_id)` on `demo_slot_signups` (one slot per attendee)

If your deployment uses migration tooling, run the normal migration pipeline for staging then production.

## 2) Verify Event Timezone

In `events.timezone`, ensure the event is set correctly (for Calgary usually `America/Edmonton`).

Reason: open/close logic depends on event timezone when creating/interpreting `18:30` and `20:00`.

## 3) Seed or Configure Demo Settings Per Event

For the event row in `demo_signup_settings`, confirm:

- `is_enabled = true`
- `opens_at = <event date at 18:30 in UTC>`
- `closes_at = <event date at 20:00 in UTC>`

Important: store UTC timestamps in DB. UI can show local time.

## 4) Confirm Service Role Access

Server actions use service-role client patterns already used elsewhere in the app. Confirm deployment env vars are correct:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

If service-role key is missing in the host environment, bookings and admin writes will fail.

## 5) Validate Policies / RLS Alignment

Match existing project conventions:

- Reads that must be public or session-gated should continue to work as expected.
- Writes should be performed by trusted server actions (service role).

If your Supabase project has stricter policies than local/dev, verify new tables are usable by server-side flows.

## 6) Optional Realtime

Realtime is optional for this feature.

- If enabled, slot occupancy can live-update.
- If not enabled, standard revalidation/refresh still works.

## 7) Smoke Test in Production-like Environment

Run this exact checklist:

1. Checked-in attendee opens demos page during window and books one slot.
2. Same attendee cannot book a second slot.
3. Two distinct attendees can fill a slot; third attendee is blocked.
4. Non-checked-in attendee cannot book.
5. Before `18:30`, bookings are blocked.
6. After `20:00`, bookings are blocked.
7. Admin page shows occupancy and attendee assignment correctly.

## Operational Notes

- If the event date changes, update `opens_at` and `closes_at` for that event.
- If capacity should change in future, update `demo_slots.capacity` and keep server checks aligned.
- Keep one-slot-per-attendee rule unless product explicitly changes.

## Troubleshooting

- "Not authenticated" or redirect loops:
  - Check portal session cookie flow and event slug/session event ID match.
- "Not checked in":
  - Validate `registrations.checked_in_at` is set for that user/event.
- "Window closed" unexpectedly:
  - Verify `events.timezone`, `opens_at`, and `closes_at` UTC conversions.
- "Failed to book" with low detail:
  - Check server logs and Supabase logs for unique constraint violations or RLS blocks.


-- Pizza alarm: admin triggers a timestamp; attendees see a fun overlay via realtime.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS pizza_alarm_at TIMESTAMPTZ;

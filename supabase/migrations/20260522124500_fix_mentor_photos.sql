DO \$\$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT id INTO v_event_id
  FROM public.events
  WHERE slug = 'calgary-hackathon-sait-may-2026'
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.mentors
  SET photo_url = '/avatars/hackathon/sait-may-2026/jia-ming-huang.jpg',
      bio = 'Founder, Entrepreneur in Residence at Antler, Cursor Ambassador for Calgary and Toronto, and host at Cappis. Jia brings startup, product, community, and data science perspective from building ventures and organizing large builder events.'
  WHERE event_id = v_event_id AND name = 'Jia Ming Huang';

  UPDATE public.mentors
  SET photo_url = '/avatars/hackathon/sait-may-2026/cal-leung.jpg'
  WHERE event_id = v_event_id AND name = 'Cal Leung';

  UPDATE public.mentors
  SET photo_url = '/avatars/hackathon/sait-may-2026/audrey-aui-yong.jpg'
  WHERE event_id = v_event_id AND name = 'Audrey Aui Yong';

  UPDATE public.mentors
  SET photo_url = '/avatars/hackathon/sait-may-2026/simon-loewen.jpg'
  WHERE event_id = v_event_id AND name = 'Simon Loewen';

  UPDATE public.mentors
  SET photo_url = '/avatars/hackathon/sait-may-2026/trystan-keller.jpg'
  WHERE event_id = v_event_id AND name = 'Trystan Keller';

  UPDATE public.mentors
  SET photo_url = '/avatars/hackathon/sait-may-2026/david-lynch.jpg'
  WHERE event_id = v_event_id AND name = 'David Lynch';

  UPDATE public.mentors
  SET photo_url = '/avatars/hackathon/sait-may-2026/anvil-palamattam.jpg'
  WHERE event_id = v_event_id AND name = 'Anvil Palamattam';

  UPDATE public.mentors
  SET photo_url = '/avatars/hackathon/sait-may-2026/suprita-shankar.jpg'
  WHERE event_id = v_event_id AND name = 'Suprita Shankar';

END \$\$;
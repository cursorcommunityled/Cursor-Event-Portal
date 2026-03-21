"use client";

import { useEffect, useRef } from "react";

const EASTER_EVENT_SLUG = "calgary-march-2026";

export function ResourcesEggTrigger({ eventSlug }: { eventSlug: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const triggered = useRef(false);

  useEffect(() => {
    if (eventSlug !== EASTER_EVENT_SLUG) return;

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !triggered.current) {
          triggered.current = true;
          window.dispatchEvent(
            new CustomEvent("egg-found", { detail: { eggId: "egg_2" } })
          );
        }
      },
      { threshold: 1.0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [eventSlug]);

  if (eventSlug !== EASTER_EVENT_SLUG) return null;

  // Invisible sentinel — positioned at the very bottom of the page
  return <div ref={ref} className="h-1 w-full" aria-hidden="true" />;
}

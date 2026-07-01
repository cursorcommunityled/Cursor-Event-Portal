import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  normalizeLumaGuest,
  syncLumaGuestToPortal,
  verifyLumaWebhookSignature,
  lumaGuestEmail,
} from "@/lib/luma";

export const dynamic = "force-dynamic";

// Receives Luma webhooks (Guest Registered / Guest Updated / Ticket Registered).
// When a guest is checked in via the Luma app, this checks them into the portal
// and assigns their participant Cursor credit — no CSV export needed.
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.LUMA_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[luma-webhook] LUMA_WEBHOOK_SECRET is not configured");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }

    const rawBody = await request.text();
    const signatureHeader = request.headers.get("webhook-signature");

    if (!verifyLumaWebhookSignature(secret, signatureHeader, rawBody)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const type = typeof payload.type === "string" ? payload.type : "";
    const data = (payload.data ?? {}) as Record<string, unknown>;

    // Only guest/ticket events carry check-in info; acknowledge everything else
    // so Luma doesn't retry.
    if (type && !/guest|ticket/i.test(type)) {
      return NextResponse.json({ ok: true, ignored: type });
    }

    const guest = normalizeLumaGuest(data);
    const lumaEventId =
      (data.event_api_id as string | undefined) ??
      (data.event_id as string | undefined) ??
      ((data.event as Record<string, unknown> | undefined)?.api_id as string | undefined) ??
      null;

    if (!lumaEventId || !lumaGuestEmail(guest)) {
      console.warn("[luma-webhook] Missing event id or guest email", { type });
      return NextResponse.json({ ok: true, ignored: "missing event id or guest email" });
    }

    const supabase = await createServiceClient();

    const { data: linked } = await supabase
      .from("events")
      .select("id")
      .eq("luma_event_id", lumaEventId)
      .maybeSingle();

    let portalEventId = linked?.id as string | undefined;

    // Fallback: no portal event is linked to this Luma event yet. There is
    // always exactly one "live" event (the current/next one), so attach the
    // webhook to it and save the link — no manual ID matching needed. Once a
    // live event is linked, webhooks from other Luma events are ignored.
    if (!portalEventId) {
      const { data: liveEvent } = await supabase
        .from("events")
        .select("id, luma_event_id")
        .in("status", ["published", "active"])
        .order("start_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (liveEvent && !liveEvent.luma_event_id) {
        const { error: linkError } = await supabase
          .from("events")
          .update({ luma_event_id: lumaEventId })
          .eq("id", liveEvent.id);

        if (!linkError) {
          console.log("[luma-webhook] Auto-linked Luma event to live portal event", {
            lumaEventId,
            portalEventId: liveEvent.id,
          });
          portalEventId = liveEvent.id;
        }
      }
    }

    if (!portalEventId) {
      // No linked event and the live event is already tied to a different
      // Luma event — nothing to do.
      return NextResponse.json({ ok: true, ignored: `unlinked event ${lumaEventId}` });
    }

    const result = await syncLumaGuestToPortal(supabase, portalEventId, guest);

    if (result.status === "error") {
      console.error("[luma-webhook] Sync failed:", result.error);
      // 500 so Luma retries the delivery.
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    if (result.noCodesLeft) {
      console.warn("[luma-webhook] Guest checked in but no credit codes left", {
        eventId: portalEventId,
      });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[luma-webhook] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

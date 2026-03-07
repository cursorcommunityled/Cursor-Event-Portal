import { createServiceClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import type { NotificationType } from "@/types";

const PREF_INAPP: Record<NotificationType, string> = {
  poll_opened:          "poll_opened_inapp",
  table_assigned:       "table_assigned_inapp",
  demo_slot_available:  "demo_slot_inapp",
  survey_live:          "survey_live_inapp",
  announcement:         "announcements_inapp",
};

const PREF_EMAIL: Record<NotificationType, string> = {
  poll_opened:          "poll_opened_email",
  table_assigned:       "table_assigned_email",
  demo_slot_available:  "demo_slot_email",
  survey_live:          "survey_live_email",
  announcement:         "announcements_email",
};

/**
 * Fan out an in-app (and optionally email) notification to all registered
 * attendees of an event, respecting their individual preferences.
 */
export async function fanOutNotification(
  eventId: string,
  type: NotificationType,
  title: string,
  body: string,
  actionPath?: string  // relative path, e.g. "/event-slug/polls"
) {
  try {
    const supabase = await createServiceClient();

    // 1. Get all registered user IDs for this event
    const { data: regs } = await supabase
      .from("registrations")
      .select("user_id")
      .eq("event_id", eventId);

    if (!regs?.length) return;

    const userIds = regs.map((r) => r.user_id);

    // 2. Get user details (for email)
    const { data: users } = await supabase
      .from("users")
      .select("id, email, name")
      .in("id", userIds);

    // 3. Get preferences for this event
    const inappField = PREF_INAPP[type];
    const emailField = PREF_EMAIL[type];

    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select(`user_id, ${inappField}, ${emailField}`)
      .eq("event_id", eventId)
      .in("user_id", userIds);

    type PrefRow = { user_id: string; [k: string]: unknown };
    const prefMap = new Map(((prefs || []) as unknown as PrefRow[]).map((p) => [p.user_id, p]));

    const toInsert: object[] = [];
    const toEmail: { email: string; name: string }[] = [];

    for (const user of users || []) {
      const pref = prefMap.get(user.id);
      // Default: inapp=true, email=false when no preference row exists
      const inappOn = pref != null ? (pref as Record<string, boolean>)[inappField] : true;
      const emailOn  = pref != null ? (pref as Record<string, boolean>)[emailField]  : false;

      if (inappOn) {
        toInsert.push({
          user_id:    user.id,
          event_id:   eventId,
          type,
          title,
          body,
          action_url: actionPath ?? null,
        });
      }

      if (emailOn && user.email) {
        toEmail.push({ email: user.email, name: user.name });
      }
    }

    // 4. Batch insert in-app notifications
    if (toInsert.length > 0) {
      await supabase.from("in_app_notifications").insert(toInsert);
    }

    // 5. Send emails via Resend
    if (toEmail.length > 0 && process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const base = process.env.NEXT_PUBLIC_BASE_URL || "";
      await Promise.allSettled(
        toEmail.map(({ email }) =>
          resend.emails.send({
            from: "Cursor Pop-Up Portal <noreply@updates.cursor.com>",
            to: email,
            subject: title,
            html: `
              <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;background:#fff;border-radius:12px;">
                <h2 style="color:#111;margin:0 0 12px;">${title}</h2>
                <p style="color:#555;margin:0 0 20px;line-height:1.6;">${body}</p>
                ${
                  actionPath
                    ? `<a href="${base}${actionPath}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;">View Now</a>`
                    : ""
                }
              </div>
            `,
          })
        )
      );
    }
  } catch (err) {
    // Non-fatal — don't break the primary action if notifications fail
    console.error("[fanOutNotification] Error:", err);
  }
}

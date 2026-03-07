"use server";

import OpenAI from "openai";
import { createServiceClient } from "@/lib/supabase/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================================================
// TYPES
// ============================================================================

export interface OpsMetrics {
  eventId: string;
  eventTitle: string;
  checkedIn: number;
  totalRegistered: number;
  openQuestions: Array<{
    id: string;
    content: string;
    ageMinutes: number;
    upvotes: number;
  }>;
  waitingHelpRequests: Array<{
    id: string;
    category: string;
    ageMinutes: number;
  }>;
  activePolls: Array<{
    id: string;
    question: string;
    voteCount: number;
    checkedInCount: number;
    votePercent: number;
  }>;
  snapshotAt: string;
}

export interface Recommendation {
  signalKey: string;
  signal: "checkin_pace" | "qa_age" | "help_queue" | "poll_dropoff";
  severity: "info" | "warn" | "urgent";
  headline: string;
  detail: string;
  action: {
    type: "announcement" | "timer" | "poll_nudge" | "staff_alert";
    label: string;
    payload: {
      content?: string;
      durationMinutes?: number;
      pollId?: string;
    };
  } | null;
}

// ============================================================================
// METRICS
// ============================================================================

export async function getOpsMetrics(eventId: string): Promise<OpsMetrics> {
  const supabase = await createServiceClient();
  const now = new Date();

  const [
    { data: event },
    { data: registrations },
    { data: questions },
    { data: helpRequests },
    { data: polls },
  ] = await Promise.all([
    supabase.from("events").select("title").eq("id", eventId).single(),
    supabase.from("registrations").select("checked_in_at").eq("event_id", eventId),
    supabase
      .from("questions")
      .select("id, content, created_at, upvotes")
      .eq("event_id", eventId)
      .eq("status", "open")
      .order("created_at", { ascending: true }),
    supabase
      .from("help_requests")
      .select("id, category, created_at")
      .eq("event_id", eventId)
      .eq("status", "waiting")
      .order("created_at", { ascending: true }),
    supabase
      .from("polls")
      .select("id, question")
      .eq("event_id", eventId)
      .eq("active", true),
  ]);

  const checkedIn = (registrations || []).filter((r) => r.checked_in_at).length;
  const totalRegistered = (registrations || []).length;

  const openQuestions = (questions || []).map((q) => ({
    id: q.id,
    content: q.content,
    ageMinutes: Math.floor((now.getTime() - new Date(q.created_at).getTime()) / 60000),
    upvotes: q.upvotes,
  }));

  const waitingHelpRequests = (helpRequests || []).map((r) => ({
    id: r.id,
    category: r.category,
    ageMinutes: Math.floor((now.getTime() - new Date(r.created_at).getTime()) / 60000),
  }));

  const activePolls = await Promise.all(
    (polls || []).map(async (poll) => {
      const { count } = await supabase
        .from("poll_votes")
        .select("id", { count: "exact", head: true })
        .eq("poll_id", poll.id);
      const voteCount = count || 0;
      return {
        id: poll.id,
        question: poll.question,
        voteCount,
        checkedInCount: checkedIn,
        votePercent: checkedIn > 0 ? Math.round((voteCount / checkedIn) * 100) : 0,
      };
    })
  );

  return {
    eventId,
    eventTitle: (event as any)?.title || "Event",
    checkedIn,
    totalRegistered,
    openQuestions,
    waitingHelpRequests,
    activePolls,
    snapshotAt: now.toISOString(),
  };
}

// ============================================================================
// AI RECOMMENDATIONS
// ============================================================================

export async function getOpsRecommendations(
  eventId: string
): Promise<{ recommendations: Recommendation[]; metrics: OpsMetrics }> {
  const metrics = await getOpsMetrics(eventId);

  const prompt = `You are an AI ops copilot for a live tech event facilitator. Analyze the real-time event metrics below and return a JSON array of actionable recommendations.

Current metrics:
${JSON.stringify(metrics, null, 2)}

Guidelines:
- Only flag genuine issues that need facilitator attention. If things look healthy, return an empty array.
- For announcements and poll_nudge, write warm, friendly copy — not alarming. Keep it short (max 120 chars).
- severity: "info" for awareness, "warn" for action recommended soon, "urgent" for immediate action.
- signalKey must change when the underlying metric changes materially (e.g. number of waiting requests increases).
- Consider: check-in rate below 60% of registered is worth flagging; questions open > 10 min need attention; help queue >= 3 waiting is urgent; poll vote rate < 40% of checked-in attendees is low.

Respond with ONLY a raw JSON array (no wrapper object, no markdown):
[
  {
    "signalKey": "<unique stable string reflecting current metric state>",
    "signal": "checkin_pace" | "qa_age" | "help_queue" | "poll_dropoff",
    "severity": "info" | "warn" | "urgent",
    "headline": "<max 60 chars>",
    "detail": "<max 120 chars>",
    "action": {
      "type": "announcement" | "timer" | "poll_nudge" | "staff_alert",
      "label": "<button label, max 30 chars>",
      "payload": {
        "content": "<optional announcement text>",
        "durationMinutes": <optional number>,
        "pollId": "<optional poll id>"
      }
    }
  }
]`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "[]";
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
    let parsed: Recommendation[] = [];
    try {
      const obj = JSON.parse(cleaned);
      parsed = Array.isArray(obj) ? obj : (obj.recommendations || []);
    } catch {
      parsed = [];
    }

    return { recommendations: parsed, metrics };
  } catch (err) {
    console.error("[copilot] OpenAI error:", err);
    return { recommendations: [], metrics };
  }
}

// ============================================================================
// TWILIO SMS
// ============================================================================

export async function sendStaffAlertSMS(
  message: string,
  eventId: string
): Promise<{ success: boolean; sent: number; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, sent: 0, error: "Twilio not configured" };
  }

  const supabase = await createServiceClient();
  const { data: admins } = await supabase
    .from("users")
    .select("phone, name")
    .eq("role", "admin")
    .not("phone", "is", null);

  if (!admins || admins.length === 0) {
    return { success: false, sent: 0, error: "No admin phone numbers on file" };
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  let sent = 0;
  for (const admin of admins) {
    if (!admin.phone) continue;
    try {
      const body = new URLSearchParams({
        From: fromNumber,
        To: admin.phone,
        Body: `[Cursor Popup Ops] ${message}`,
      });
      const res = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });
      if (res.ok) sent++;
      else {
        const errBody = await res.text();
        console.error(`[copilot] SMS to ${admin.phone} failed:`, errBody);
      }
    } catch (err) {
      console.error(`[copilot] SMS exception for ${admin.phone}:`, err);
    }
  }

  return { success: sent > 0, sent };
}

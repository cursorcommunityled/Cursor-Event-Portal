"use server";

import OpenAI from "openai";
import { getOpsMetrics } from "./copilot";
import { getAgendaItems, getQuestionsForAdmin, getHelpRequestsForAdmin, getAllPolls, getAllSurveys } from "../supabase/queries";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function adminChat(
  eventId: string,
  adminCode: string,
  messages: ChatMessage[]
): Promise<{ reply: string; error?: string }> {
  try {
    const [metrics, agendaItems, questions, helpRequests, polls, surveys] = await Promise.all([
      getOpsMetrics(eventId),
      getAgendaItems(eventId),
      getQuestionsForAdmin(eventId, "new", true),
      getHelpRequestsForAdmin(eventId),
      getAllPolls(eventId),
      getAllSurveys(eventId),
    ]);

    const systemPrompt = `You are the Ops Copilot for a live Cursor Pop-Up tech event. You have full access to real-time event data and help the admin/facilitator manage the event effectively. Be concise, direct, and actionable. Respond in plain sentences — no markdown, no bullet symbols.

Current event snapshot:
${JSON.stringify(
  {
    metrics,
    schedule: agendaItems.map((a) => ({ title: a.title, start: a.start_time, end: a.end_time })),
    openQuestions: questions.filter((q) => q.status === "open").slice(0, 15).map((q) => ({ content: q.content, upvotes: q.upvotes })),
    helpRequests: helpRequests.slice(0, 10).map((h) => ({ category: h.category, status: h.status })),
    polls: polls.map((p) => ({ question: p.question, is_active: p.is_active })),
    surveys: surveys.map((s) => ({ title: s.title, published: !!s.published_at })),
  },
  null,
  2
)}

You can help with: current event status, Q&A management, help queue, polls, announcements, schedule questions, or general ops decisions. Keep replies under 3 sentences unless the question genuinely needs more.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.35,
      max_tokens: 400,
    });

    return { reply: response.choices[0]?.message?.content?.trim() || "No response." };
  } catch (err) {
    console.error("[copilot-chat]", err);
    return { reply: "", error: "Failed to reach AI. Check your OpenAI key." };
  }
}

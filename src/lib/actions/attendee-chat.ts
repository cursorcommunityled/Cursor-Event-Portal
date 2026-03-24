"use server";

import OpenAI from "openai";
import {
  getEventBySlug,
  getAgendaItems,
  getActivePolls,
  getEventThemeSelection,
  getConversationThemes,
  getOpenExchangePosts,
  getActiveCompetitions,
} from "../supabase/queries";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const EASTER_EVENT_SLUG = "calgary-march-2026";
const EASTER_KEYWORDS = [
  "easter",
  "egg hunt",
  "easter egg",
  "easter eggs",
  "cursor egg",
  "cursor eggs",
  "$50",
  "50 credit",
  "cursor credit",
  "hidden egg",
  "egg credit",
  "egg hunt credit",
];

export async function attendeeChat(
  eventSlug: string,
  messages: ChatMessage[]
): Promise<{ reply: string; error?: string; eggTriggered?: string }> {
  try {
    const event = await getEventBySlug(eventSlug);
    if (!event) return { reply: "", error: "Event not found." };

    // Easter egg trigger — chatbot egg_3
    if (eventSlug === EASTER_EVENT_SLUG) {
      const lastUserMsg = messages[messages.length - 1]?.content?.toLowerCase() ?? "";
      const isEasterQuery = EASTER_KEYWORDS.some((kw) => lastUserMsg.includes(kw));
      if (isEasterQuery) {
        return {
          reply:
            "🥚 You whispered the magic words... something is hatching on your screen right now. Check it out!",
          eggTriggered: "egg_3",
        };
      }
    }

    const [agendaItems, activePolls, themeSelection, themes, exchangePosts, competitions] =
      await Promise.all([
        getAgendaItems(event.id),
        getActivePolls(event.id),
        getEventThemeSelection(event.id),
        getConversationThemes(),
        getOpenExchangePosts(event.id),
        getActiveCompetitions(event.id),
      ]);

    const activeTheme = themeSelection
      ? themes.find((t) => t.id === themeSelection.theme_id)
      : null;

    const systemPrompt = `You are the event assistant for ${event.name}, a live tech pop-up event. You help attendees in a friendly, concise way. Only share information that attendees can access — no internal admin data, no attendee personal info. Respond in plain, conversational language. Keep replies short (2-3 sentences max unless specifically asked for more detail).

Tonight's event:
- Name: ${event.name}
- Venue: ${event.venue || "Check the app"}

Schedule:
${
  agendaItems.length > 0
    ? agendaItems
        .map(
          (item) =>
            `${item.start_time ? item.start_time + " — " : ""}${item.title}${item.description ? " (" + item.description + ")" : ""}`
        )
        .join("\n")
    : "Schedule not published yet."
}

Tonight's discussion theme: ${activeTheme ? `${activeTheme.name} — ${activeTheme.description ?? ""}` : "Not set yet."}

Live polls: ${activePolls.length > 0 ? activePolls.map((p) => `"${p.question}"`).join(", ") : "None active right now."}

Competitions: ${competitions.length > 0 ? competitions.map((c) => c.title).join(", ") : "None currently."}

Exchange board: ${exchangePosts.length} active need/offer posts.

App features you can mention:
- Socials → Q&A: ask questions to the group
- Socials → Connect: Exchange board (post needs/offers) and Speed Networking
- Demos: book a demo slot
- Polls: vote on live polls
- Compete: submit competition entries
- Slides: follow along with presentations
- Resources: download resources

If you don't know something specific, direct them to the relevant section of the app or suggest they ask the facilitator.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.5,
      max_tokens: 300,
    });

    return { reply: response.choices[0]?.message?.content?.trim() || "No response." };
  } catch (err) {
    console.error("[attendee-chat]", err);
    return { reply: "", error: "Failed to reach AI. Try again." };
  }
}

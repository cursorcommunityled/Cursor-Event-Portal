import { notFound } from "next/navigation";
import { getEventBySlug } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { getMyNotifications } from "@/lib/actions/notifications";
import { NotificationPreferencesPanel } from "@/components/notifications/NotificationPreferences";
import { NotificationsListClient } from "@/components/notifications/NotificationsListClient";
import { createServiceClient } from "@/lib/supabase/server";

interface NotificationsPageProps {
  params: Promise<{ eventSlug: string }>;
}

export default async function NotificationsPage({ params }: NotificationsPageProps) {
  const { eventSlug } = await params;
  const event = await getEventBySlug(eventSlug);
  if (!event) notFound();

  const session = await getSession();
  const userId = session?.eventId === event.id ? session.userId : null;

  if (!userId) {
    return (
      <main className="max-w-lg mx-auto px-6 py-12 text-center">
        <p className="text-gray-500 text-sm">Sign in to see your notifications.</p>
      </main>
    );
  }

  // Get user email to determine if email prefs should be enabled
  const supabase = await createServiceClient();
  const { data: user } = await supabase
    .from("users")
    .select("email")
    .eq("id", userId)
    .single();

  const notifications = await getMyNotifications(userId, event.id, 50);

  return (
    <main className="max-w-lg mx-auto px-6 py-12 space-y-10 animate-fade-in">
      <div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-bold mb-1">
          Activity
        </p>
        <h1 className="text-3xl font-light text-white">Notifications</h1>
      </div>

      <NotificationsListClient
        userId={userId}
        eventId={event.id}
        initialNotifications={notifications}
      />

      <div className="pt-4">
        <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-bold mb-4">
          Preferences
        </p>
        <NotificationPreferencesPanel
          userId={userId}
          eventId={event.id}
          hasEmail={!!user?.email}
        />
      </div>
    </main>
  );
}

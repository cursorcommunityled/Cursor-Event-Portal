import { getEventStats, getQuestions, getSurveyResponses, getPublishedSurvey } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import {
  Users,
  UserCheck,
  MessageCircle,
  ClipboardCheck,
  ArrowRight,
  Upload,
  Calendar,
  BarChart3,
  Database,
  Trophy,
  MonitorPlay,
  CalendarDays,
} from "lucide-react";
import { SimulateStartButton } from "@/components/admin/SimulateStartButton";
import { EventSocialCard } from "@/components/admin/EventSocialCard";
import { checkAndUnlockAtStartTime } from "@/lib/actions/seating";
import { getEventForAdmin } from "@/lib/utils/admin";

interface AdminDashboardProps {
  params: Promise<{ adminCode: string }>;
}

export const revalidate = 0;

export default async function AdminDashboard({ params }: AdminDashboardProps) {
  const { adminCode } = await params;
  const event = await getEventForAdmin(adminCode);
  const eventSlug = event.slug;

  const supabase = await createClient();

  const [stats, questions] = await Promise.all([
    getEventStats(event.id),
    getQuestions(event.id),
  ]);

  const openQuestions = questions.filter((q) => q.status === "open").length;
  const survey = await getPublishedSurvey(event.id);
  let surveyResponses = 0;
  if (survey) {
    const responses = await getSurveyResponses(survey.id);
    surveyResponses = responses.length;
  }

  await checkAndUnlockAtStartTime(event.id, eventSlug);

  return (
    <div className="min-h-screen bg-black-gradient text-white flex flex-col relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-white/[0.01] rounded-full blur-[150px] pointer-events-none" />

      <AdminHeader
        adminCode={adminCode}
        title="Calgary Cursor Meetup"
        subtitle="Admin Dashboard"
        showBackArrow={false}
      />

      <main className="max-w-4xl mx-auto px-6 py-8 pb-16 w-full space-y-8 z-10 flex-1">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="glass rounded-3xl p-6 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group animate-slide-up shadow-sm" style={{ animationDelay: "0ms" }}>
            <Users className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors mb-3" />
            <p className="text-4xl font-light tracking-tight tabular-nums">{stats.registered}</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mt-1">Registered</p>
          </div>
          <div className="glass rounded-3xl p-6 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group animate-slide-up shadow-sm" style={{ animationDelay: "30ms" }}>
            <UserCheck className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors mb-3" />
            <p className="text-4xl font-light tracking-tight tabular-nums">{stats.checkedIn}</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mt-1">Checked In</p>
          </div>
          <div className="glass rounded-3xl p-6 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group animate-slide-up shadow-sm" style={{ animationDelay: "60ms" }}>
            <MessageCircle className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors mb-3" />
            <p className="text-4xl font-light tracking-tight tabular-nums">{openQuestions}</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mt-1">Open Q&A</p>
          </div>
          <div className="glass rounded-3xl p-6 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group animate-slide-up shadow-sm" style={{ animationDelay: "90ms" }}>
            <ClipboardCheck className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors mb-3" />
            <p className="text-4xl font-light tracking-tight tabular-nums">{surveyResponses}</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mt-1">Surveys</p>
          </div>
        </div>

        <div className="glass rounded-[40px] p-10 border-white/20 animate-slide-up shadow-lg" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-2">
              <h3 className="text-[11px] uppercase tracking-[0.4em] text-gray-400 font-medium">Event Capacity</h3>
              <p className="text-2xl font-light tracking-tight text-white/90">
                {stats.registered} registered · {stats.checkedIn} checked in
              </p>
            </div>
            <div className="text-4xl font-light tracking-tight text-white/50 tabular-nums">
              {Math.round((stats.checkedIn / event.capacity) * 100)}%
            </div>
          </div>
          <div className="h-[2px] bg-white/20 rounded-full overflow-hidden">
            <div className="h-full shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              <div className="bg-white transition-all duration-1000 h-full" style={{ width: `${(stats.checkedIn / event.capacity) * 100}%` }} />
            </div>
          </div>
          <div className="flex gap-8 mt-6">
            <span className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" />Checking In
            </span>
            <span className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-white/20" />Capacity ({event.capacity - stats.checkedIn} left)
            </span>
          </div>
        </div>

        {event.seat_lockout_active && (
          <SimulateStartButton event={event} eventSlug={eventSlug} adminCode={adminCode} />
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <Link href={`/admin/${adminCode}/checkin`} prefetch={false} className="animate-slide-up" style={{ animationDelay: "150ms" }}>
            <div className="glass rounded-[40px] p-8 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all shadow-inner-glow">
                    <UserCheck className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-light tracking-tight text-white/90">Check-In</h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">Manage Attendance</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </Link>

          <EventSocialCard
            event={event}
            eventSlug={eventSlug}
            adminCode={adminCode}
            initialOpenQuestions={openQuestions}
            initialQuestions={questions}
          />

          <Link href={`/admin/${adminCode}/event-dashboard`} prefetch={false} className="animate-slide-up" style={{ animationDelay: "210ms" }}>
            <div className="glass rounded-[40px] p-8 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all shadow-inner-glow">
                    <Calendar className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-light tracking-tight text-white/90">Event Dashboard</h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">Agenda · Themes · Calendar</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </Link>

          <Link href={`/admin/${adminCode}/events`} prefetch={false} className="animate-slide-up" style={{ animationDelay: "225ms" }}>
            <div className="glass rounded-[40px] p-8 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all shadow-inner-glow">
                    <CalendarDays className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-light tracking-tight text-white/90">Events</h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">Active Venue</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </Link>

          <Link href={`/admin/${adminCode}/demos`} prefetch={false} className="animate-slide-up" style={{ animationDelay: "240ms" }}>
            <div className="glass rounded-[40px] p-8 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all shadow-inner-glow">
                    <MonitorPlay className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-light tracking-tight text-white/90">Demos</h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">Signup Management</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </Link>

          <Link href={`/admin/${adminCode}/groups`} prefetch={false} className="animate-slide-up" style={{ animationDelay: "255ms" }}>
            <div className="glass rounded-[40px] p-8 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all shadow-inner-glow">
                    <Users className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-light tracking-tight text-white/90">Seating</h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">Table Management</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </Link>

          <Link href={`/admin/${adminCode}/slides`} prefetch={false} className="animate-slide-up" style={{ animationDelay: "270ms" }}>
            <div className="glass rounded-[40px] p-8 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all shadow-inner-glow">
                    <Upload className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-light tracking-tight text-white/90">Slide Deck</h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">PDF Upload</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </Link>

          <Link href={`/admin/${adminCode}/analytics`} prefetch={false} className="animate-slide-up" style={{ animationDelay: "300ms" }}>
            <div className="glass rounded-[40px] p-8 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all shadow-inner-glow">
                    <BarChart3 className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-light tracking-tight text-white/90">Analytics</h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">Insights & Reports</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </Link>

          <Link href={`/admin/${adminCode}/data`} prefetch={false} className="animate-slide-up" style={{ animationDelay: "330ms" }}>
            <div className="glass rounded-[40px] p-8 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all shadow-inner-glow">
                    <Database className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-light tracking-tight text-white/90">Data Management</h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">Import & Export</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </Link>

          <Link href={`/admin/${adminCode}/competitions`} prefetch={false} className="animate-slide-up" style={{ animationDelay: "360ms" }}>
            <div className="glass rounded-[40px] p-8 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all shadow-inner-glow">
                    <Trophy className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-light tracking-tight text-white/90">Competitions</h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">Project Showcase</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </Link>

          <Link href={`/${eventSlug}/agenda`} prefetch={false} className="animate-slide-up" style={{ animationDelay: "390ms" }}>
            <div className="glass rounded-[40px] p-8 border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-400/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] transition-all group cursor-pointer relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:scale-105 transition-all">
                    <ArrowRight className="w-6 h-6 text-blue-400 group-hover:text-blue-300 transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-light tracking-tight text-white/90">Enter Portal</h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-blue-400/60 font-medium">Attendee View</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-blue-400/50 group-hover:text-blue-300 group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </Link>
        </div>
      </main>

      <footer className="py-12 px-6 border-t border-white/20 flex justify-between items-center z-10">
        <p className="text-[10px] uppercase tracking-[0.6em] text-gray-500 font-medium">Pop-Up System / MMXXVI</p>
        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">Control Center</p>
      </footer>
    </div>
  );
}

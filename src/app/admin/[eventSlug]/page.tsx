import { notFound, redirect } from "next/navigation";
import { getEventBySlug, getEventStats, getQuestions, getSurveyResponses, getPublishedSurvey } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { AdminHeader } from "@/components/admin/AdminHeader";
import {
  Users,
  UserCheck,
  MessageCircle,
  ClipboardCheck,
  ArrowRight,
  Download,
  Megaphone,
  Upload,
  Sparkles,
  Vote,
  Calendar,
} from "lucide-react";
import { SimulateStartButton } from "@/components/admin/SimulateStartButton";
import { checkAndUnlockAtStartTime } from "@/lib/actions/seating";
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";

interface AdminDashboardProps {
  params: Promise<{ eventSlug: string }>;
}

export default async function AdminDashboard({ params }: AdminDashboardProps) {
  const { eventSlug } = await params;

  const event = await getEventBySlug(eventSlug);
  if (!event) {
    notFound();
  }

  // Check if admin
  const session = await getSession();
  if (!session) {
    redirect(`/${eventSlug}`);
  }

  const supabase = await createClient();
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .single();

  if (!user || user.role !== "admin") {
    redirect(`/${eventSlug}/agenda`);
  }

  // Redirect to new admin URL format with adminCode
  if (event.admin_code) {
    redirect(`/admin/${eventSlug}/${event.admin_code}`);
  }

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

  // Check and auto-unlock at event start time
  await checkAndUnlockAtStartTime(event.id, eventSlug);

  return (
    <div className="min-h-screen bg-black-gradient text-white flex flex-col relative overflow-hidden">
      {/* Subtle Depth Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-white/[0.01] rounded-full blur-[150px] pointer-events-none" />

      <AdminHeader 
        eventSlug={eventSlug} 
        subtitle="Admin Dashboard"
        showBackArrow={false}
      />

      <main className="max-w-4xl mx-auto px-6 py-8 pb-16 w-full space-y-8 z-10 flex-1">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="glass rounded-3xl p-6 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group animate-slide-up shadow-sm" style={{ animationDelay: "100ms" }}>
            <Users className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors mb-3" />
            <p className="text-4xl font-light tracking-tight tabular-nums">{stats.registered}</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mt-1">Registered</p>
          </div>
          <div className="glass rounded-3xl p-6 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group animate-slide-up shadow-sm" style={{ animationDelay: "200ms" }}>
            <UserCheck className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors mb-3" />
            <p className="text-4xl font-light tracking-tight tabular-nums">{stats.checkedIn}</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mt-1">Checked In</p>
          </div>
          <div className="glass rounded-3xl p-6 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group animate-slide-up shadow-sm" style={{ animationDelay: "300ms" }}>
            <MessageCircle className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors mb-3" />
            <p className="text-4xl font-light tracking-tight tabular-nums">{openQuestions}</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mt-1">Open Q&A</p>
          </div>
          <div className="glass rounded-3xl p-6 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group animate-slide-up shadow-sm" style={{ animationDelay: "400ms" }}>
            <ClipboardCheck className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors mb-3" />
            <p className="text-4xl font-light tracking-tight tabular-nums">{surveyResponses}</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mt-1">Surveys</p>
          </div>
        </div>

        {/* Capacity Progress */}
        <div className="glass rounded-[40px] p-10 border-white/20 animate-slide-up shadow-lg" style={{ animationDelay: "500ms" }}>
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-2">
              <h3 className="text-[11px] uppercase tracking-[0.4em] text-gray-400 font-medium">
                Resource Allocation
              </h3>
              <p className="text-2xl font-light tracking-tight text-white/90">
                {stats.registered} registered · {stats.checkedIn} checked in
              </p>
            </div>
            <div className="text-4xl font-light tracking-tight text-white/50 tabular-nums">
              {Math.round((stats.registered / event.capacity) * 100)}%
            </div>
          </div>
          <div className="h-[2px] bg-white/20 rounded-full overflow-hidden">
            <div className="h-full flex shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              <div
                className="bg-white transition-all duration-1000"
                style={{
                  width: `${(stats.checkedIn / event.capacity) * 100}%`,
                }}
              />
              <div
                className="bg-white/20 transition-all duration-1000"
                style={{
                  width: `${((stats.registered - stats.checkedIn) / event.capacity) * 100}%`,
                }}
              />
            </div>
          </div>
          <div className="flex gap-8 mt-6">
            <span className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
              Checked
            </span>
            <span className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
              Pending
            </span>
            <span className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
              Capacity ({event.capacity - stats.registered} left)
            </span>
          </div>
        </div>

        {/* Simulate Start Button - For Testing */}
        {event.seat_lockout_active && (
          <SimulateStartButton event={event} eventSlug={eventSlug} adminCode={undefined} />
        )}

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          <Link href={`/staff/${eventSlug}/checkin`} className="animate-slide-up" style={{ animationDelay: "600ms" }}>
            <div className="glass rounded-[40px] p-8 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all shadow-inner-glow">
                    <UserCheck className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-light tracking-tight text-white/90">
                      Check-In
                    </h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
                      Manage Attendance
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </Link>

          <Link href={`/admin/${eventSlug}/agenda`} className="animate-slide-up" style={{ animationDelay: "700ms" }}>
            <div className="glass rounded-[40px] p-8 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all shadow-inner-glow">
                    <Calendar className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-light tracking-tight text-white/90">
                      Agenda
                    </h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
                      Schedule Management
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </Link>

          <AdminDashboardClient
            event={event}
            eventSlug={eventSlug}
            adminCode={undefined}
            initialOpenQuestions={openQuestions}
            initialQuestions={questions}
          />

          <Link href={`/admin/${eventSlug}/announcements`} className="animate-slide-up" style={{ animationDelay: "900ms" }}>
            <div className="glass rounded-[40px] p-8 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all shadow-inner-glow">
                    <Megaphone className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-light tracking-tight text-white/90">
                      Bulletin
                    </h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
                      Broadcast Signal
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </Link>

          <Link href={`/admin/${eventSlug}/polls`} className="animate-slide-up" style={{ animationDelay: "1000ms" }}>
            <div className="glass rounded-[40px] p-8 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all shadow-inner-glow">
                    <Vote className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-light tracking-tight text-white/90">
                      Live Polls
                    </h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
                      Audience Engagement
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </Link>

          <Link href={`/admin/${eventSlug}/groups`} className="animate-slide-up" style={{ animationDelay: "1100ms" }}>
            <div className="glass rounded-[40px] p-8 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all shadow-inner-glow">
                    <Users className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-light tracking-tight text-white/90">
                      Seating
                    </h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
                      Table Management
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </Link>

          <Link href={`/admin/${eventSlug}/surveys`} className="animate-slide-up" style={{ animationDelay: "1200ms" }}>
            <div className="glass rounded-[40px] p-8 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all shadow-inner-glow">
                    <ClipboardCheck className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-light tracking-tight text-white/90">
                      Surveys
                    </h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
                      Feedback Collection
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </Link>

          <Link href={`/admin/${eventSlug}/slides`} className="animate-slide-up" style={{ animationDelay: "1300ms" }}>
            <div className="glass rounded-[40px] p-8 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all shadow-inner-glow">
                    <Upload className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-light tracking-tight text-white/90">
                      Slide Deck
                    </h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
                      PDF Upload
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </Link>

          <Link href={`/admin/${eventSlug}/registrations/import`} className="animate-slide-up" style={{ animationDelay: "1400ms" }}>
            <div className="glass rounded-[40px] p-8 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all shadow-inner-glow">
                    <Upload className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-light tracking-tight text-white/90">
                      Import
                    </h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
                      Luma Sync
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </Link>

          <Link href={`/admin/${eventSlug}/export`} className="animate-slide-up" style={{ animationDelay: "1500ms" }}>
            <div className="glass rounded-[40px] p-8 border-white/20 hover:bg-white/10 hover:shadow-glow transition-all group cursor-pointer relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all shadow-inner-glow">
                    <Download className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-light tracking-tight text-white/90">
                      Data Export
                    </h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
                      Export CSV Files
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </Link>
        </div>

        {/* View Event */}
        <div className="mt-12 animate-slide-up" style={{ animationDelay: "1600ms" }}>
          <Link href={`/${eventSlug}/agenda`}>
            <div className="glass rounded-[40px] p-10 border-white/20 hover:bg-white/10 transition-all group cursor-pointer mb-8">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h3 className="text-2xl font-light tracking-tight text-white/90">
                    Enter Portal
                  </h3>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
                    View Attendee Perspective
                  </p>
                </div>
                <div className="px-8 py-3 bg-white text-black rounded-full font-medium text-sm group-hover:scale-105 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                  Launch Portal
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </Link>
        </div>
      </main>

      <footer className="py-12 px-6 border-t border-white/20 flex justify-between items-center z-10">
        <p className="text-[10px] uppercase tracking-[0.6em] text-gray-500 font-medium">Pop-Up System / MMXXVI</p>
        <div className="flex items-center gap-6">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">Control Center</p>
        </div>
      </footer>
    </div>
  );
}

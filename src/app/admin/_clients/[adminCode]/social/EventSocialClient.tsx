"use client";

import { useState, useEffect } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { MessageCircle, ClipboardCheck, Vote, Megaphone, Bot, Zap, Users2, Send, Camera } from "lucide-react";
import { AdminQAClient } from "../../qa/AdminQAClient";
import { PollsAdminClient } from "../../polls/PollsAdminClient";
import { AnnouncementsClient } from "../../announcements/AnnouncementsClient";
import { HelpQueueAdmin } from "@/components/help/HelpQueueAdmin";
import { ExchangeAdminBoard } from "@/components/exchange/ExchangeAdminBoard";
import { NetworkingAdminClient } from "../../networking/NetworkingAdminClient";
import { CopilotTab } from "./CopilotTab";
import { FollowUpAdminClient } from "../../follow-up/FollowUpAdminClient";
import { PhotosAdminTab } from "./PhotosAdminTab";
import { cn } from "@/lib/utils";
import type { Event, Question, Poll, Announcement, Survey, HelpRequest, ExchangePost, SpeedNetworkingSession, SpeedNetworkingRound, SpeedNetworkingPair, EventPhoto } from "@/types";

interface EventSocialClientProps {
  event: Event;
  eventSlug: string;
  adminCode: string;
  userId?: string;
  initialQuestions: Question[];
  initialPolls: Poll[];
  initialAnnouncements: Announcement[];
  initialSurveys: Survey[];
  initialHelpRequests: HelpRequest[];
  initialExchangePosts: ExchangePost[];
  initialNetworkingSession: SpeedNetworkingSession | null;
  initialNetworkingRound: SpeedNetworkingRound | null;
  initialNetworkingPairs: SpeedNetworkingPair[];
  initialPhotos: EventPhoto[];
  initialHeroFeaturedIds?: string[];
  sortBy: "new" | "trending";
  statusFilter: "all" | "open" | "answered" | "pinned" | "hidden";
  activeTab: TabType;
}

type TabType = "qa" | "connect" | "follow-up" | "polls" | "announcements" | "copilot" | "photos";
type QASubTab = "questions" | "help";
type ConnectSubTab = "exchange" | "networking";

const TABS: Array<{ id: TabType; label: string; icon: typeof MessageCircle; description: string }> = [
  {
    id: "copilot",
    label: "Copilot",
    icon: Bot,
    description: "AI ops recommendations",
  },
  {
    id: "qa",
    label: "Q&A",
    icon: MessageCircle,
    description: "Questions & help desk",
  },
  {
    id: "connect",
    label: "Connect",
    icon: Zap,
    description: "Exchange & networking",
  },
  {
    id: "polls",
    label: "Polls",
    icon: Vote,
    description: "Live audience voting",
  },
  {
    id: "announcements",
    label: "Broadcast",
    icon: Megaphone,
    description: "Send announcements",
  },
  {
    id: "follow-up",
    label: "Follow-Up",
    icon: Send,
    description: "Surveys & post-event emails",
  },
  {
    id: "photos",
    label: "Photos",
    icon: Camera,
    description: "Attendee photo submissions",
  },
];

function SubToggle<T extends string>({
  options,
  active,
  onChange,
}: {
  options: { id: T; label: string }[];
  active: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={cn(
            "px-5 py-2 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold transition-all duration-200",
            active === opt.id
              ? "bg-white/10 text-white border border-white/20"
              : "text-gray-500 hover:text-white"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function EventSocialClient({
  event,
  eventSlug,
  adminCode,
  userId,
  initialQuestions,
  initialPolls,
  initialAnnouncements,
  initialSurveys,
  initialHelpRequests,
  initialExchangePosts,
  initialNetworkingSession,
  initialNetworkingRound,
  initialNetworkingPairs,
  initialPhotos,
  initialHeroFeaturedIds = [],
  sortBy,
  statusFilter,
  activeTab: initialActiveTab
}: EventSocialClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialActiveTab);
  const [qaSubTab, setQaSubTab] = useState<QASubTab>("questions");
  const [connectSubTab, setConnectSubTab] = useState<ConnectSubTab>("exchange");

  // Sync state if prop changes (e.g. via URL navigation)
  useEffect(() => {
    setActiveTab(initialActiveTab);
  }, [initialActiveTab]);

  const updateTab = (newTab: TabType) => {
    setActiveTab(newTab);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', newTab);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  };

  const activeTabData = TABS.find((t) => t.id === activeTab)!;
  const Icon = activeTabData.icon;

  const renderActiveTab = () => {
    switch (activeTab) {
      case "copilot":
        return <CopilotTab event={event} adminCode={adminCode} />;

      case "qa":
        return (
          <>
            <SubToggle
              options={[
                { id: "questions", label: "Questions" },
                { id: "help", label: "Help Desk" },
              ]}
              active={qaSubTab}
              onChange={setQaSubTab}
            />
            {qaSubTab === "questions" && (
              <AdminQAClient
                event={event}
                initialQuestions={initialQuestions}
                eventSlug={eventSlug}
                adminCode={adminCode}
                userId={userId}
                sortBy={sortBy}
                statusFilter={statusFilter}
                isEmbedded={true}
              />
            )}
            {qaSubTab === "help" && (
              <HelpQueueAdmin
                initialRequests={initialHelpRequests}
                eventId={event.id}
                eventSlug={eventSlug}
                adminCode={adminCode}
              />
            )}
          </>
        );

      case "connect":
        return (
          <>
            <SubToggle
              options={[
                { id: "exchange", label: "Exchange" },
                { id: "networking", label: "Networking" },
              ]}
              active={connectSubTab}
              onChange={setConnectSubTab}
            />
            {connectSubTab === "exchange" && (
              <ExchangeAdminBoard
                eventId={event.id}
                adminCode={adminCode}
                initialPosts={initialExchangePosts}
              />
            )}
            {connectSubTab === "networking" && (
              <NetworkingAdminClient
                eventId={event.id}
                adminCode={adminCode}
                initialSession={initialNetworkingSession}
                initialRound={initialNetworkingRound}
                initialPairs={initialNetworkingPairs}
              />
            )}
          </>
        );

      case "polls":
        return (
          <PollsAdminClient
            event={event}
            eventSlug={eventSlug}
            adminCode={adminCode}
            initialPolls={initialPolls}
            isEmbedded={true}
          />
        );

      case "announcements":
        return (
          <AnnouncementsClient
            event={event}
            eventSlug={eventSlug}
            adminCode={adminCode}
            initialAnnouncements={initialAnnouncements}
            isEmbedded={true}
          />
        );

      case "follow-up":
        return (
          <FollowUpAdminClient
            event={event}
            eventSlug={eventSlug}
            adminCode={adminCode}
            initialSurveys={initialSurveys}
          />
        );

      case "photos":
        return (
          <PhotosAdminTab
            event={event}
            adminCode={adminCode}
            initialPhotos={initialPhotos}
            initialHeroFeaturedIds={initialHeroFeaturedIds}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-black-gradient text-white flex flex-col relative overflow-hidden">
      {/* Subtle Depth Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-white/[0.01] rounded-full blur-[150px] pointer-events-none" />

      <AdminHeader
        eventSlug={eventSlug}
        adminCode={adminCode}
        subtitle="Event Social"
        showBackArrow={true}
      />

      <main className="max-w-4xl mx-auto px-6 py-8 w-full z-10 flex-1">
        {/* Compact Tab Switcher (Pill style) */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => updateTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-full transition-all duration-300",
                  isActive
                    ? "bg-white text-black shadow-glow scale-105"
                    : "bg-white/5 text-gray-500 hover:text-white hover:bg-white/10"
                )}
              >
                <TabIcon className={cn("w-4 h-4", isActive ? "text-black" : "text-gray-600")} />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Content Area */}
        <div className="animate-fade-in pb-20">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Icon className="w-5 h-5 text-white/60" />
            </div>
            <div>
              <h2 className="text-xl font-light text-white">{activeTabData.label}</h2>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-bold">
                {activeTabData.description}
              </p>
            </div>
          </div>
          {renderActiveTab()}
        </div>
      </main>

      <footer className="py-12 px-6 border-t border-white/[0.03] flex justify-between items-center z-10 mt-auto">
        <p className="text-[10px] uppercase tracking-[0.6em] text-gray-500 font-medium">Pop-Up System / MMXXVI</p>
        <div className="flex items-center gap-6">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">{activeTabData.label}</p>
        </div>
      </footer>
    </div>
  );
}

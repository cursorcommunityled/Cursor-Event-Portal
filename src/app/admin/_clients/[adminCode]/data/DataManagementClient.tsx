"use client";

import { useState } from "react";
import { Download, Upload, Users, MessageCircle, ClipboardCheck, UserCheck, Lock, X, Activity, Layers } from "lucide-react";
import type { Event, Registration, Question, Survey, SurveyResponse } from "@/types";
import {
  getDetailedAttendeeData,
  getAnalyticsExport,
  getAllEventsRegistrations,
  getAllEventsQuestions,
  getAllEventsSurveyResponses,
  getAllEventsDetailedAttendeeData,
} from "@/lib/actions/export";
import { ImportRegistrationsClient } from "@/components/admin/ImportRegistrationsClient";

const DOWNLOAD_PASSWORD = "CursorCalgary2026";

interface DataManagementClientProps {
  event: Event;
  eventSlug: string;
  adminCode?: string;
  registrations: Registration[];
  questions: Question[];
  survey: Survey | null;
  surveyResponses: SurveyResponse[];
}

export function DataManagementClient({
  event,
  eventSlug,
  adminCode,
  registrations,
  questions,
  survey,
  surveyResponses,
}: DataManagementClientProps) {
  const [activeTab, setActiveTab] = useState<"import" | "export">("export");
  const [allEvents, setAllEvents] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [pendingExport, setPendingExport] = useState<(() => void) | null>(null);

  const verifyPassword = () => {
    if (passwordInput === DOWNLOAD_PASSWORD) {
      setIsAuthenticated(true);
      setShowPasswordModal(false);
      setPasswordError("");
      setPasswordInput("");
      if (pendingExport) {
        pendingExport();
        setPendingExport(null);
      }
    } else {
      setPasswordError("Incorrect password. Please try again.");
    }
  };

  const requirePassword = (exportFn: () => void) => {
    if (isAuthenticated) {
      exportFn();
    } else {
      setPendingExport(() => exportFn);
      setShowPasswordModal(true);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            if (value === null || value === undefined) return "";
            if (typeof value === "object") return JSON.stringify(value);
            return String(value).replace(/"/g, '""');
          })
          .map((v) => `"${v}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportRegistrations = async () => {
    setExporting("registrations");
    try {
      if (allEvents) {
        const result = await getAllEventsRegistrations();
        if ("error" in result) { alert(result.error); return; }
        exportToCSV(result.data ?? [], "all-events-registrations");
      } else {
        const data = registrations.map((reg) => ({
          name: reg.user?.name || "",
          email: reg.user?.email || "",
          checked_in: reg.checked_in_at ? "Yes" : "No",
          checked_in_at: reg.checked_in_at || "",
          registered_at: reg.created_at,
          source: reg.source,
        }));
        exportToCSV(data, `${event.slug}-registrations`);
      }
    } finally {
      setTimeout(() => setExporting(null), 1000);
    }
  };

  const exportQuestions = async () => {
    setExporting("questions");
    try {
      if (allEvents) {
        const result = await getAllEventsQuestions();
        if ("error" in result) { alert(result.error); return; }
        exportToCSV(result.data ?? [], "all-events-questions");
      } else {
        const data = questions.map((q) => ({
          content: q.content,
          author: q.user?.name || "Anonymous",
          upvotes: q.upvotes,
          status: q.status,
          tags: q.tags.join("; "),
          created_at: q.created_at,
          answer_count: q.answers?.length || 0,
        }));
        exportToCSV(data, `${event.slug}-questions`);
      }
    } finally {
      setTimeout(() => setExporting(null), 1000);
    }
  };

  const exportSurveyResponses = async () => {
    setExporting("survey");
    try {
      if (allEvents) {
        const result = await getAllEventsSurveyResponses();
        if ("error" in result) { alert(result.error); return; }
        exportToCSV(result.data ?? [], "all-events-survey-responses");
      } else {
        if (!survey) { alert("No survey available"); return; }
        const data = surveyResponses.map((response) => ({
          user_id: response.user_id || "anonymous",
          responses: JSON.stringify(response.responses),
          created_at: response.created_at,
        }));
        exportToCSV(data, `${event.slug}-survey-responses`);
      }
    } finally {
      setTimeout(() => setExporting(null), 1000);
    }
  };

  const exportDetailedAttendees = async () => {
    setExporting("detailed");
    try {
      if (allEvents) {
        const result = await getAllEventsDetailedAttendeeData();
        if ("error" in result) { alert(result.error); return; }
        if (result.data) exportToCSV(result.data, "all-events-detailed-attendees");
      } else {
        const result = await getDetailedAttendeeData(event.id);
        if ("error" in result) { alert(result.error); return; }
        if (result.data) exportToCSV(result.data, `${event.slug}-detailed-attendees`);
      }
    } catch (err) {
      alert("Failed to export detailed attendee data");
      console.error(err);
    } finally {
      setTimeout(() => setExporting(null), 1000);
    }
  };

  const exportAnalytics = async () => {
    setExporting("analytics");
    try {
      const result = await getAnalyticsExport(event.id);
      if ("error" in result) { alert(result.error); return; }
      if (result.data) {
        const pageViewsData = (result.data.pageViews || []).map((pv: any) => ({
          type: "page_view",
          user_id: pv.user_id || "anonymous",
          page_path: pv.page_path,
          page_type: pv.page_type,
          device_type: pv.device_type || "",
          duration_ms: pv.duration_ms || "",
          timestamp: pv.created_at,
        }));
        const interactionsData = (result.data.featureInteractions || []).map((fi: any) => ({
          type: "interaction",
          user_id: fi.user_id,
          page_path: "",
          page_type: fi.feature_type,
          device_type: "",
          duration_ms: "",
          timestamp: fi.created_at,
        }));
        const combinedData = [...pageViewsData, ...interactionsData].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        if (combinedData.length > 0) {
          exportToCSV(combinedData, `${event.slug}-analytics`);
        } else {
          alert("No analytics data to export yet");
        }
      }
    } catch (err) {
      alert("Failed to export analytics data");
      console.error(err);
    } finally {
      setTimeout(() => setExporting(null), 1000);
    }
  };

  const existingEmails = registrations
    .map((r) => r.user?.email?.toLowerCase())
    .filter(Boolean) as string[];

  const regCount = allEvents ? null : registrations.length;
  const qCount   = allEvents ? null : questions.length;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Tab Switcher */}
      <div className="flex gap-4 border-b border-white/10">
        <button
          onClick={() => setActiveTab("export")}
          className={`px-6 py-3 text-sm font-medium transition-all border-b-2 ${
            activeTab === "export"
              ? "border-white text-white"
              : "border-transparent text-gray-600 hover:text-white/70"
          }`}
        >
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Data
          </div>
        </button>
        <button
          onClick={() => setActiveTab("import")}
          className={`px-6 py-3 text-sm font-medium transition-all border-b-2 ${
            activeTab === "import"
              ? "border-white text-white"
              : "border-transparent text-gray-600 hover:text-white/70"
          }`}
        >
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Import Registrations
          </div>
        </button>
      </div>

      {/* Export Tab */}
      {activeTab === "export" && (
        <div className="space-y-6">
          {/* All-events toggle */}
          <div className="flex items-center justify-between glass rounded-[24px] px-6 py-4 border border-white/5">
            <div className="flex items-center gap-3">
              <Layers className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-white/80">All Events</p>
                <p className="text-[10px] text-gray-600 uppercase tracking-[0.15em]">
                  {allEvents ? "Exporting across all events" : `Exporting ${event.name} only`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setAllEvents(!allEvents)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                allEvents ? "bg-white" : "bg-white/10"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-200 ${
                  allEvents ? "left-7 bg-black" : "left-1 bg-white/40"
                }`}
              />
            </button>
          </div>

          {/* Registrations */}
          <div className="glass rounded-[40px] p-10 border-white/[0.03] group hover:bg-white/[0.01] transition-all">
            <div className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-6 flex-1">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all">
                  <Users className="w-6 h-6 text-gray-700 group-hover:text-white transition-colors" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-light tracking-tight text-white/90">Identity Matrix</h3>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-800 font-medium">
                    {regCount !== null ? `${regCount} Verified Registrations` : "All Events"}
                  </p>
                  <p className="text-[9px] text-gray-700 mt-2 tracking-tight">
                    Export attendee registration data including check-in status
                  </p>
                </div>
              </div>
              <button
                onClick={() => requirePassword(exportRegistrations)}
                disabled={exporting !== null || (!allEvents && registrations.length === 0)}
                className={`px-8 py-4 rounded-2xl font-medium text-sm transition-all flex items-center gap-3 ${
                  exporting !== null || (!allEvents && registrations.length === 0)
                    ? "bg-white/5 text-white/20 cursor-not-allowed"
                    : "bg-white text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                }`}
              >
                {exporting === "registrations" ? (
                  <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download CSV
              </button>
            </div>
          </div>

          {/* Questions */}
          <div className="glass rounded-[40px] p-10 border-white/[0.03] group hover:bg-white/[0.01] transition-all">
            <div className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-6 flex-1">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all">
                  <MessageCircle className="w-6 h-6 text-gray-700 group-hover:text-white transition-colors" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-light tracking-tight text-white/90">Query Streams</h3>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-800 font-medium">
                    {qCount !== null ? `${qCount} Active Submissions` : "All Events"}
                  </p>
                  <p className="text-[9px] text-gray-700 mt-2 tracking-tight">
                    Export Q&A questions with upvotes, status, and answer counts
                  </p>
                </div>
              </div>
              <button
                onClick={() => requirePassword(exportQuestions)}
                disabled={exporting !== null || (!allEvents && questions.length === 0)}
                className={`px-8 py-4 rounded-2xl font-medium text-sm transition-all flex items-center gap-3 ${
                  exporting !== null || (!allEvents && questions.length === 0)
                    ? "bg-white/5 text-white/20 cursor-not-allowed"
                    : "bg-white text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                }`}
              >
                {exporting === "questions" ? (
                  <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download CSV
              </button>
            </div>
          </div>

          {/* Detailed Attendee Data */}
          <div className="glass rounded-[40px] p-10 border-white/[0.03] group hover:bg-white/[0.01] transition-all">
            <div className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-6 flex-1">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all">
                  <UserCheck className="w-6 h-6 text-gray-700 group-hover:text-white transition-colors" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-light tracking-tight text-white/90">Attendee Profiles</h3>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-800 font-medium">
                    {allEvents ? "All Events" : "Complete Activity Data"}
                  </p>
                  <p className="text-[9px] text-gray-700 mt-2 tracking-tight">
                    Export comprehensive attendee data including intake, poll votes, Q&A history, and more
                  </p>
                </div>
              </div>
              <button
                onClick={() => requirePassword(exportDetailedAttendees)}
                disabled={exporting !== null || (!allEvents && registrations.length === 0)}
                className={`px-8 py-4 rounded-2xl font-medium text-sm transition-all flex items-center gap-3 ${
                  exporting !== null || (!allEvents && registrations.length === 0)
                    ? "bg-white/5 text-white/20 cursor-not-allowed"
                    : "bg-white text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                }`}
              >
                {exporting === "detailed" ? (
                  <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download CSV
              </button>
            </div>
          </div>

          {/* Analytics & Engagement — single-event only */}
          {!allEvents && (
            <div className="glass rounded-[40px] p-10 border-white/[0.03] group hover:bg-white/[0.01] transition-all">
              <div className="flex items-center justify-between gap-8">
                <div className="flex items-center gap-6 flex-1">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all">
                    <Activity className="w-6 h-6 text-gray-700 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-light tracking-tight text-white/90">Engagement Analytics</h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-800 font-medium">
                      Page Views & Interactions
                    </p>
                    <p className="text-[9px] text-gray-700 mt-2 tracking-tight">
                      Export user page views, time on page, clicks, and feature interactions
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => requirePassword(exportAnalytics)}
                  disabled={exporting !== null}
                  className={`px-8 py-4 rounded-2xl font-medium text-sm transition-all flex items-center gap-3 ${
                    exporting !== null
                      ? "bg-white/5 text-white/20 cursor-not-allowed"
                      : "bg-white text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                  }`}
                >
                  {exporting === "analytics" ? (
                    <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Download CSV
                </button>
              </div>
            </div>
          )}

          {/* Survey Responses */}
          {allEvents ? (
            <div className="glass rounded-[40px] p-10 border-white/[0.03] group hover:bg-white/[0.01] transition-all">
              <div className="flex items-center justify-between gap-8">
                <div className="flex items-center gap-6 flex-1">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all">
                    <ClipboardCheck className="w-6 h-6 text-gray-700 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-light tracking-tight text-white/90">Feedback Surveys</h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-800 font-medium">All Events</p>
                  </div>
                </div>
                <button
                  onClick={() => requirePassword(exportSurveyResponses)}
                  disabled={exporting !== null}
                  className={`px-8 py-4 rounded-2xl font-medium text-sm transition-all flex items-center gap-3 ${
                    exporting !== null
                      ? "bg-white/5 text-white/20 cursor-not-allowed"
                      : "bg-white text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                  }`}
                >
                  {exporting === "survey" ? (
                    <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Download CSV
                </button>
              </div>
            </div>
          ) : survey ? (
            <div className="glass rounded-[40px] p-10 border-white/[0.03] group hover:bg-white/[0.01] transition-all">
              <div className="flex items-center justify-between gap-8">
                <div className="flex items-center gap-6 flex-1">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center group-hover:scale-105 transition-all">
                    <ClipboardCheck className="w-6 h-6 text-gray-700 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-light tracking-tight text-white/90">Feedback Surveys</h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-800 font-medium">
                      {surveyResponses.length} Received Inputs
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => requirePassword(exportSurveyResponses)}
                  disabled={exporting !== null || surveyResponses.length === 0}
                  className={`px-8 py-4 rounded-2xl font-medium text-sm transition-all flex items-center gap-3 ${
                    exporting !== null || surveyResponses.length === 0
                      ? "bg-white/5 text-white/20 cursor-not-allowed"
                      : "bg-white text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                  }`}
                >
                  {exporting === "survey" ? (
                    <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Download CSV
                </button>
              </div>
            </div>
          ) : (
            <div className="glass rounded-[40px] p-12 text-center border-dashed border-white/5">
              <p className="text-[10px] uppercase tracking-[0.3em] font-medium text-gray-700 mb-3">
                No Survey Published
              </p>
              <p className="text-[9px] text-gray-800 tracking-tight max-w-md mx-auto">
                Create and publish a survey from the admin dashboard to collect feedback responses. Once published, survey responses will appear here for export.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Import Tab */}
      {activeTab === "import" && (
        <ImportRegistrationsClient
          eventId={event.id}
          eventSlug={eventSlug}
          existingEmails={existingEmails}
          adminCode={adminCode}
        />
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass rounded-[32px] p-8 max-w-md w-full mx-4 border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-white/70" />
                </div>
                <h3 className="text-xl font-light text-white">Download Protection</h3>
              </div>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordError("");
                  setPasswordInput("");
                  setPendingExport(null);
                }}
                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-white/50" />
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-6">
              Please enter the password to download event data.
            </p>

            <div className="space-y-4">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") verifyPassword();
                }}
                placeholder="Enter password"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 transition-colors"
                autoFocus
              />

              {passwordError && (
                <p className="text-red-400 text-sm">{passwordError}</p>
              )}

              <button
                onClick={verifyPassword}
                className="w-full px-6 py-3 rounded-xl bg-white text-black font-medium hover:scale-[1.02] transition-transform"
              >
                Verify & Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

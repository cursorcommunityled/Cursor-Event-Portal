"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  logError,
  recordPageView,
  recordUxEvent,
  type PageType,
  type DeviceType,
} from "@/lib/actions/analytics";

interface PageTrackerProps {
  eventId: string;
}

function getDeviceType(): DeviceType {
  if (typeof window === "undefined") return "desktop";
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function getPageType(pathname: string): PageType | null {
  if (pathname.includes("/admin")) return "admin";
  if (pathname.includes("/staff")) return "staff";
  if (pathname.includes("/display")) return "display";
  if (pathname.includes("/agenda")) return "agenda";
  if (pathname.includes("/qa") || pathname.includes("/questions")) return "qa";
  if (pathname.includes("/polls")) return "polls";
  if (pathname.includes("/slides")) return "slides";
  if (pathname.includes("/resources")) return "resources";
  if (pathname.includes("/feedback") || pathname.includes("/survey")) return "feedback";
  if (pathname.includes("/intake")) return "intake";
  if (pathname.includes("/register")) return "registration";
  // Landing page is typically the event root
  if (pathname.match(/^\/[^\/]+\/?$/)) return "landing";
  return null;
}

const MODULE_LABELS: Record<string, string> = {
  landing: "Home",
  registration: "Registration",
  intake: "Intake",
  agenda: "Agenda",
  qa: "Q&A",
  questions: "Q&A",
  polls: "Polls",
  slides: "Slides",
  resources: "Resources",
  feedback: "Feedback",
  survey: "Feedback",
  display: "Display",
  admin: "Admin",
  staff: "Staff",
  hackathon: "Hackathon",
  competitions: "Competitions",
  socials: "Socials",
  photos: "Photos",
  checkin: "Check-in",
};

function getModuleName(pathname: string): string {
  if (pathname.includes("/admin")) return "Admin";
  if (pathname.includes("/staff")) return "Staff";

  const pageType = getPageType(pathname);
  if (pageType && MODULE_LABELS[pageType]) return MODULE_LABELS[pageType];

  const segments = pathname.split("?")[0].split("/").filter(Boolean);
  const routeSegment = segments.length > 1 ? segments[1] : segments[0];
  if (!routeSegment) return "Home";
  return MODULE_LABELS[routeSegment] || routeSegment.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getSessionId(): string {
  let sessionId = localStorage.getItem("popup_session_id");
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    localStorage.setItem("popup_session_id", sessionId);
  }
  return sessionId;
}

function truncateLabel(label: string | null | undefined) {
  if (!label) return null;
  const normalized = label.replace(/\s+/g, " ").trim();
  return normalized.length > 140 ? `${normalized.substring(0, 137)}...` : normalized;
}

function getElementLabel(element: HTMLElement) {
  if (element instanceof HTMLInputElement) {
    return truncateLabel(element.getAttribute("aria-label") || element.value || element.name || element.type);
  }

  return truncateLabel(
    element.getAttribute("aria-label") ||
      element.getAttribute("title") ||
      element.textContent ||
      (element instanceof HTMLAnchorElement ? element.href : null)
  );
}

function getElementMetadata(element: HTMLElement): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  if (element.id) metadata.id = element.id;
  if (element.getAttribute("role")) metadata.role = element.getAttribute("role");
  if (element instanceof HTMLAnchorElement) metadata.href = element.getAttribute("href");
  if (element instanceof HTMLButtonElement && element.type) metadata.buttonType = element.type;
  if (element instanceof HTMLInputElement && element.type) metadata.inputType = element.type;
  return metadata;
}

export function PageTracker({ eventId }: PageTrackerProps) {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    // Don't track the same page twice in a row
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;

    const pageType = getPageType(pathname);
    if (!pageType) return;

    recordPageView(eventId, pathname, pageType, {
      referrer: document.referrer || undefined,
      userAgent: navigator.userAgent,
      deviceType: getDeviceType(),
      sessionId: getSessionId(),
    });
  }, [pathname, eventId]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const element = target?.closest(
        "a, button, [role='button'], input[type='button'], input[type='submit'], summary"
      );

      if (!(element instanceof HTMLElement)) return;

      void recordUxEvent(eventId, {
        eventType: "action",
        action: "click",
        element: element.tagName.toLowerCase(),
        label: getElementLabel(element),
        module: getModuleName(pathname),
        pagePath: pathname,
        metadata: getElementMetadata(element),
        sessionId: getSessionId(),
        userAgent: navigator.userAgent,
      });
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, [eventId, pathname]);

  useEffect(() => {
    const logClientError = (
      errorType: string,
      errorMessage: string,
      errorStack?: string,
      metadata?: Record<string, unknown>
    ) => {
      void logError({
        eventId,
        errorType,
        errorMessage,
        errorStack,
        pagePath: pathname,
        userAgent: navigator.userAgent,
        sessionId: getSessionId(),
        metadata,
      });
    };

    const handleError = (event: ErrorEvent) => {
      logClientError(event.error?.name || "javascript", event.message, event.error?.stack, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };

    const handleResourceError = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      logClientError("resource_error", `Failed to load ${target.tagName.toLowerCase()}`, undefined, {
        tagName: target.tagName.toLowerCase(),
        source: target.getAttribute("src") || target.getAttribute("href"),
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      logClientError(reason instanceof Error ? reason.name : "unhandled_rejection", message, reason?.stack);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("error", handleResourceError, true);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("error", handleResourceError, true);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [eventId, pathname]);

  return null;
}

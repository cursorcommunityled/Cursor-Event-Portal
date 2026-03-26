import type { Metadata, Viewport } from "next";
import { Toaster } from "react-hot-toast";
import { ChunkLoadErrorHandler } from "@/components/ChunkLoadErrorHandler";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cursor Calgary — Community Meetups",
  description: "Calgary's Cursor community. Join us for hands-on AI-powered development meetups, workshops, and demos.",
  openGraph: {
    title: "Cursor Calgary",
    description: "Calgary's Cursor community. Join us for hands-on AI-powered development meetups.",
    url: "https://cursorcalgary.com",
    siteName: "Cursor Calgary",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Ensure no route is cached: all attendees and admins see fresh data everywhere
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 dark:bg-gray-950 antialiased">
        <GoogleAnalytics />
        <ChunkLoadErrorHandler />
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#1a1a1a",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "16px",
              fontSize: "14px",
            },
            success: {
              iconTheme: { primary: "#22c55e", secondary: "#fff" },
            },
            error: {
              iconTheme: { primary: "#ef4444", secondary: "#fff" },
            },
          }}
        />
        <footer className="fixed bottom-4 left-0 right-0 text-center pointer-events-none z-40">
          <span className="text-[9px] text-gray-500 uppercase tracking-[0.3em] font-medium inline-flex items-center gap-1.5">
            Coded With
            <svg viewBox="0 0 466.73 532.09" className="w-2.5 h-2.5 inline-block opacity-50" aria-hidden="true">
              <path fill="currentColor" d="M457.43,125.94L244.42,2.96c-6.84-3.95-15.28-3.95-22.12,0L9.3,125.94c-5.75,3.32-9.3,9.46-9.3,16.11v247.99c0,6.65,3.55,12.79,9.3,16.11l213.01,122.98c6.84,3.95,15.28,3.95,22.12,0l213.01-122.98c5.75-3.32,9.3-9.46,9.3-16.11v-247.99c0-6.65-3.55-12.79-9.3-16.11h-.01ZM444.05,151.99l-205.63,356.16c-1.39,2.4-5.06,1.42-5.06-1.36v-233.21c0-4.66-2.49-8.97-6.53-11.31L24.87,145.67c-2.4-1.39-1.42-5.06,1.36-5.06h411.26c5.84,0,9.49,6.33,6.57,11.39h-.01Z"/>
            </svg>
            Cursor
          </span>
        </footer>
      </body>
    </html>
  );
}

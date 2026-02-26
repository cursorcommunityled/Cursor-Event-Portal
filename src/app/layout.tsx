import type { Metadata, Viewport } from "next";
import { Toaster } from "react-hot-toast";
import { ChunkLoadErrorHandler } from "@/components/ChunkLoadErrorHandler";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cursor Pop-Up Portal",
  description: "Event portal for Cursor community meetups",
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
          <span className="text-[9px] text-gray-500 uppercase tracking-[0.3em] font-medium">
            Coded With Cursor
          </span>
        </footer>
      </body>
    </html>
  );
}

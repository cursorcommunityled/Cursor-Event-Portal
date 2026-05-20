"use server";

import { cookies } from "next/headers";
import { PORTAL_SESSION_COOKIE_NAME } from "@/lib/auth/portal-session";

export async function logoutAttendee() {
  const cookieStore = await cookies();
  cookieStore.set(PORTAL_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
    path: "/",
  });
}

"use server";

import { cookies } from "next/headers";

export async function logoutAttendee() {
  const cookieStore = await cookies();
  cookieStore.set("portal_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
    path: "/",
  });
}

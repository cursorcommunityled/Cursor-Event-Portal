import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendMagicLink(email: string, token: string, eventName: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const magicLink = `${baseUrl}/auth/verify?token=${token}`;

  try {
    const { error } = await resend.emails.send({
      from: "Cursor Pop-Up Portal <onboarding@resend.dev>",
      to: email,
      subject: `Sign in to ${eventName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; padding: 40px 20px;">
            <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 32px;">
                <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: #7c3aed; border-radius: 12px; color: white; font-weight: bold; font-size: 20px;">
                  C
                </div>
              </div>

              <h1 style="font-size: 24px; font-weight: 600; color: #111827; text-align: center; margin: 0 0 16px;">
                Sign in to ${eventName}
              </h1>

              <p style="font-size: 16px; color: #6b7280; text-align: center; margin: 0 0 32px; line-height: 1.5;">
                Click the button below to sign in to the event portal. This link will expire in 15 minutes.
              </p>

              <a href="${magicLink}" style="display: block; width: 100%; background: #7c3aed; color: white; text-decoration: none; padding: 14px 24px; border-radius: 8px; font-weight: 500; text-align: center; font-size: 16px; box-sizing: border-box;">
                Sign in to Portal
              </a>

              <p style="font-size: 14px; color: #9ca3af; text-align: center; margin: 24px 0 0; line-height: 1.5;">
                If you didn't request this link, you can safely ignore this email.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("Failed to send magic link:", error);
      return { error: "Failed to send email" };
    }

    return { success: true };
  } catch (error) {
    console.error("Email error:", error);
    return { error: "Failed to send email" };
  }
}

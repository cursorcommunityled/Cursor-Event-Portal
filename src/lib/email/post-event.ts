// Post-event email templates — three modes: host blast, survey, connection recommendation

export type PostEventEmailMode = "host-blast" | "survey" | "connection-recommend";

interface Groupmate {
  name: string;
  linkedin?: string | null;
  github?: string | null;
  website?: string | null;
  matchReason?: string | null;
}

const baseStyles = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: #f9fafb;
  padding: 40px 20px;
  margin: 0;
`;

const cardStyle = `
  max-width: 520px;
  margin: 0 auto;
  background: white;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
`;

const logoHtml = `
  <div style="text-align: center; margin-bottom: 28px;">
    <div style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; background: #7c3aed; border-radius: 10px; color: white; font-weight: 700; font-size: 18px;">C</div>
  </div>
`;

function linkBadges(m: Groupmate): string {
  const links: string[] = [];
  if (m.linkedin) links.push(`<a href="${m.linkedin}" style="display:inline-block;color:#7c3aed;font-size:12px;font-weight:500;text-decoration:none;background:#f3f0ff;padding:3px 10px;border-radius:20px;margin-right:6px;">LinkedIn →</a>`);
  if (m.github) links.push(`<a href="${m.github}" style="display:inline-block;color:#374151;font-size:12px;font-weight:500;text-decoration:none;background:#f3f4f6;padding:3px 10px;border-radius:20px;margin-right:6px;">GitHub →</a>`);
  if (m.website) links.push(`<a href="${m.website}" style="display:inline-block;color:#374151;font-size:12px;font-weight:500;text-decoration:none;background:#f3f4f6;padding:3px 10px;border-radius:20px;margin-right:6px;">Website →</a>`);
  return links.join("");
}

// ─── Mode 1: Host Thank-You Blast ─────────────────────────────────────────────

export function buildHostBlastEmail({
  recipientName,
  eventName,
  groupmates,
}: {
  recipientName: string;
  eventName: string;
  groupmates: Groupmate[];
}): { subject: string; html: string } {
  const subject = `Thanks for joining ${eventName}!`;

  const groupmateRows = groupmates
    .map(
      (m) => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-weight: 600; color: #111827; font-size: 15px;">${m.name}</div>
          <div style="margin-top: 4px;">${linkBadges(m)}</div>
        </td>
      </tr>`
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body style="${baseStyles}">
        <div style="${cardStyle}">
          ${logoHtml}
          <h1 style="font-size: 22px; font-weight: 600; color: #111827; text-align: center; margin: 0 0 8px;">Thanks for coming, ${recipientName}!</h1>
          <p style="font-size: 15px; color: #6b7280; text-align: center; margin: 0 0 28px; line-height: 1.6;">It was great having you at <strong style="color: #111827;">${eventName}</strong>. We hope you made some meaningful connections tonight.</p>

          <div style="background: #fafafa; border-radius: 12px; padding: 20px 24px; margin-bottom: 28px;">
            <p style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #9ca3af; margin: 0 0 12px;">You sat with</p>
            <table style="width: 100%; border-collapse: collapse;">
              ${groupmateRows}
            </table>
          </div>

          <p style="font-size: 14px; color: #6b7280; text-align: center; line-height: 1.6; margin: 0;">
            Don't let the conversation end here — reach out, build something, and we'll see you at the next one. 🚀
          </p>
        </div>

        <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 24px;">
          Cursor Pop-Up · You received this because you attended ${eventName} and consented to follow-up emails.
        </p>
      </body>
    </html>
  `;

  return { subject, html };
}

// ─── Mode 2: Post-Event Survey ────────────────────────────────────────────────

export function buildSurveyEmail({
  recipientName,
  eventName,
  groupmates,
  surveyUrl,
}: {
  recipientName: string;
  eventName: string;
  groupmates: Groupmate[];
  surveyUrl: string;
}): { subject: string; html: string } {
  const subject = `How was ${eventName}? We'd love your feedback`;

  const groupmateRows = groupmates
    .map(
      (m) => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-weight: 600; color: #111827; font-size: 15px;">${m.name}</div>
          <div style="margin-top: 4px;">${linkBadges(m)}</div>
        </td>
      </tr>`
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body style="${baseStyles}">
        <div style="${cardStyle}">
          ${logoHtml}
          <h1 style="font-size: 22px; font-weight: 600; color: #111827; text-align: center; margin: 0 0 8px;">Hope you had a great night, ${recipientName}!</h1>
          <p style="font-size: 15px; color: #6b7280; text-align: center; margin: 0 0 24px; line-height: 1.6;">Thanks for joining us at <strong style="color: #111827;">${eventName}</strong>. Your feedback helps us make every event better.</p>

          <a href="${surveyUrl}" style="display: block; width: 100%; background: #7c3aed; color: white; text-decoration: none; padding: 14px 24px; border-radius: 10px; font-weight: 600; text-align: center; font-size: 16px; box-sizing: border-box; margin-bottom: 28px;">
            Share Your Feedback →
          </a>

          <div style="background: #fafafa; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;">
            <p style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #9ca3af; margin: 0 0 12px;">You sat with</p>
            <table style="width: 100%; border-collapse: collapse;">
              ${groupmateRows}
            </table>
          </div>

          <p style="font-size: 14px; color: #6b7280; text-align: center; line-height: 1.6; margin: 0;">
            See you at the next one. 👋
          </p>
        </div>

        <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 24px;">
          Cursor Pop-Up · You received this because you attended ${eventName} and consented to follow-up emails.
        </p>
      </body>
    </html>
  `;

  return { subject, html };
}

// ─── Mode 3: Connection Recommendation ───────────────────────────────────────

export function buildConnectionRecommendEmail({
  recipientName,
  eventName,
  groupmates,
}: {
  recipientName: string;
  eventName: string;
  groupmates: Groupmate[];
}): { subject: string; html: string } {
  const subject = `Your connections from ${eventName}`;

  const groupmateCards = groupmates
    .map(
      (m) => `
      <div style="background: #fafafa; border-radius: 12px; padding: 18px 20px; margin-bottom: 12px;">
        <div style="font-weight: 700; color: #111827; font-size: 16px; margin-bottom: 6px;">${m.name}</div>
        ${m.matchReason ? `<p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 10px;">${m.matchReason}</p>` : ""}
        <div>${linkBadges(m)}</div>
      </div>`
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body style="${baseStyles}">
        <div style="${cardStyle}">
          ${logoHtml}
          <h1 style="font-size: 22px; font-weight: 600; color: #111827; text-align: center; margin: 0 0 8px;">Your connections from ${eventName}</h1>
          <p style="font-size: 15px; color: #6b7280; text-align: center; margin: 0 0 28px; line-height: 1.6;">Hi ${recipientName}, here's who you were matched with tonight — and why we thought you'd click.</p>

          ${groupmateCards}

          <p style="font-size: 14px; color: #6b7280; text-align: center; line-height: 1.6; margin: 16px 0 0;">
            These introductions are based on your goals and what you each bring to the table. Reach out and keep the conversation going!
          </p>
        </div>

        <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 24px;">
          Cursor Pop-Up · You received this because you attended ${eventName} and consented to follow-up emails.<br>
          Match reasons were generated by our AI matching system based on attendee-provided information.
        </p>
      </body>
    </html>
  `;

  return { subject, html };
}

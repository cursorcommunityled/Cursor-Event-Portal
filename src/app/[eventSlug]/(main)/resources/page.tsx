import { notFound, redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import {
  AlertTriangle,
  ChevronRight,
  Clock3,
  Code,
  CreditCard,
  Download,
  ExternalLink,
  Github,
  Handshake,
  HelpCircle,
  Laptop,
  MessageSquare,
  ShieldCheck,
  Star,
  Trophy,
  Upload,
  Users,
  Cpu,
} from "lucide-react";
import { ResourcesEggTrigger } from "@/components/easter/ResourcesEggTrigger";

interface ResourcesPageProps {
  params: Promise<{ eventSlug: string }>;
}

const resources = [
  {
    id: "1",
    category: "Getting Started",
    items: [
      { title: "Download Cursor", description: "Get the AI-powered code editor", url: "https://cursor.com/download", icon: Download },
      { title: "Cursor Documentation", description: "Learn how to use Cursor effectively", url: "https://docs.cursor.com", icon: Code },
    ],
  },
  {
    id: "2",
    category: "Community",
    items: [
      { title: "Cursor Discord", description: "Join the community chat", url: "https://discord.gg/cursor", icon: MessageSquare },
      { title: "Cursor Forum", description: "Ask questions and share tips", url: "https://forum.cursor.com", icon: Users },
    ],
  },
];

const eventQa = [
  {
    question: "How do I redeem my Cursor credits?",
    answer:
      "Go to Event -> Credits in this portal. Open the credit link or QR code in the same browser where you are logged in to the right Cursor account, redeem the $50 credit, then mark it as redeemed in the portal.",
    icon: CreditCard,
  },
  {
    question: "How do project submissions work?",
    answer:
      "Go to Hackathon -> My Team -> Submit Project. Add your project name, concise description, public GitHub repo URL, up to 5 screenshots, and an optional demo URL before the deadline.",
    icon: Upload,
  },
  {
    question: "Can we build before the hackathon starts?",
    answer:
      "No project code should be written before the official hacking window. You can brainstorm, form teams, install tools, create accounts, and read documentation ahead of time.",
    icon: Clock3,
  },
  {
    question: "What collaboration is allowed?",
    answer:
      "Work with your registered team and ask mentors or organizers for guidance. Open-source libraries, APIs, and datasets are allowed when their licenses permit use and your team can explain the work.",
    icon: Handshake,
  },
  {
    question: "How can we use AI fairly?",
    answer:
      "AI tools are allowed, including Cursor, but your team is responsible for understanding and presenting the final project. Do not misrepresent generated, copied, or external work as your own.",
    icon: Laptop,
  },
  {
    question: "What conduct is expected?",
    answer:
      "Be respectful and professional with participants, mentors, judges, and staff. Harassment, discrimination, disruptive behaviour, plagiarism, or cheating can lead to removal or disqualification.",
    icon: ShieldCheck,
  },
];

const creditNotes = [
  "Credits work for individual Cursor accounts only: Free, Pro, Pro+, or Ultra. They do not work on Team plans.",
  "Redeeming adds the $50 credit to Dashboard -> Credits. The credit is applied automatically to the next invoice after a Pro trial or paid subscription starts.",
  "Cursor may require a payment method on file through Stripe for verification. The card should not be charged while credits cover the invoice.",
  "Free users can use the free plan first. After reaching the plan limit, start a Pro trial or Pro account with a valid payment method so the credit can be consumed.",
  "If credits do not appear after redeeming, hard refresh Cursor Dashboard, log out and back in, or check the Stripe checkout screen from your dashboard.",
  "Background Agents and some web features require a paid plan even if credits are available.",
];

export default async function ResourcesPage({ params }: ResourcesPageProps) {
  const { eventSlug } = await params;

  const event = await getEventBySlug(eventSlug);
  if (!event) {
    notFound();
  }

  const session = await getSession();
  if (!session || session.eventId !== event.id) {
    redirect(`/${eventSlug}`);
  }

  return (
    <main className="max-w-lg mx-auto w-full px-6 py-12 space-y-12">
      <div className="animate-fade-in space-y-2">
        <p className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium">
          Knowledge
        </p>
        <h1 className="text-4xl font-light text-white tracking-tight">
          Resources
        </h1>
      </div>

      {resources.map((category, catIndex) => (
        <div key={category.id} className="space-y-6 animate-slide-up" style={{ animationDelay: `${catIndex * 100}ms` }}>
          <div className="flex items-center gap-4 px-2">
            <p className="text-[10px] font-medium text-gray-700 uppercase tracking-[0.4em]">
              {category.category}
            </p>
            <div className="h-[1px] flex-1 bg-white/[0.03]" />
          </div>

          <div className="space-y-4">
            {category.items.map((item, index) => {
              const Icon = item.icon;
              return (
                <a
                  key={index}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <div className="glass rounded-[32px] p-6 flex items-center gap-6 transition-all duration-500 hover:bg-white/[0.03] hover:border-white/10 hover:translate-x-1 border-white/[0.03] relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ExternalLink className="w-3 h-3 text-white/40" />
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/5 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.02)]">
                      <Icon className="w-6 h-6 stroke-[1.5px] opacity-60 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-light text-white tracking-tight">{item.title}</h3>
                      <p className="text-xs text-gray-600 font-light mt-1 tracking-wide">{item.description}</p>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      ))}

      {/* Hackathon Judging Guide */}
      {event.is_hackathon && (
        <div className="space-y-6 animate-slide-up" style={{ animationDelay: "200ms" }}>
          <div className="flex items-center gap-4 px-2">
            <p className="text-[10px] font-medium text-gray-700 uppercase tracking-[0.4em]">
              Hackathon
            </p>
            <div className="h-[1px] flex-1 bg-white/[0.03]" />
          </div>

          <div className="glass rounded-[32px] p-8 border-white/[0.06] space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 text-white/50 stroke-[1.5px]" />
              </div>
              <div>
                <h3 className="text-xl font-light text-white tracking-tight">Judging Process</h3>
                <p className="text-xs text-gray-600 font-light mt-1">How projects are evaluated — from submission to final results</p>
              </div>
            </div>

            {/* Phase cards */}
            {[
              {
                icon: <Github className="w-4 h-4" />,
                phase: "Phase 1 · Submit Your Project",
                steps: [
                  "Go to Hackathon → My Team → Submit Project",
                  "Add your project name, description, and public GitHub repo URL",
                  "Upload up to 5 screenshots — these are used for AI visual review",
                  "Add a demo URL if you have one",
                  "You can update your submission anytime before the deadline",
                ],
              },
              {
                icon: <Cpu className="w-4 h-4" />,
                phase: "Phase 2 · AI Screening",
                steps: [
                  "After build time, admins run Claude AI analysis on all projects",
                  "Claude runs 6 passes: repo structure, code quality, innovation, visual UX, pool comparison, and final synthesis",
                  "Takes about 3 minutes per team — you'll see live progress on your dashboard",
                  "Your project is scored across 7 criteria (Innovation 25%, Technical Execution 20%, Functional Completeness 20%, Problem-Solution Fit 20%, UX 5%, Demo 5%, Ambition 5%)",
                  "You will NOT see your AI score — results pending admin review",
                ],
              },
              {
                icon: <Star className="w-4 h-4" />,
                phase: "Phase 3 · Final Round Judging",
                steps: [
                  "Top 8 AI-scored teams advance to the Final Round",
                  "Human judges review each project and add their own scores",
                  "AI scores are shown to judges as reference, not as final marks",
                  "Aggregate standings are calculated from human judge scorecards",
                ],
              },
              {
                icon: <Trophy className="w-4 h-4" />,
                phase: "Phase 4 · Results",
                steps: [
                  "Admin publishes the Top 3 — visible on the Competitions page",
                  "Leaderboard becomes visible once admin approves scores",
                  "Winners announced in the #announcements channel",
                ],
              },
            ].map((phase, i) => (
              <div key={i} className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/40">
                    {phase.icon}
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">{phase.phase}</p>
                </div>
                <ul className="space-y-2 pl-2">
                  {phase.steps.map((step, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-[13px] text-gray-500 font-light leading-relaxed">
                      <ChevronRight className="w-3 h-3 text-gray-700 shrink-0 mt-1" />
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Scoring table */}
            <div className="rounded-2xl border border-white/[0.05] overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.05]">
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium">Scoring Criteria</p>
              </div>
              {[
                { label: "Innovation & Originality", weight: "25%", note: "How novel and surprising is the concept?" },
                { label: "Technical Execution", weight: "20%", note: "Cleverness of the engineering" },
                { label: "Functional Completeness", weight: "20%", note: "Does the core loop actually work?" },
                { label: "Problem-Solution Fit", weight: "20%", note: "Solving a real problem convincingly" },
                { label: "UX & Design", weight: "5%", note: "Visual polish and usability" },
                { label: "Demo & Communication", weight: "5%", note: "How clearly the project is presented" },
                { label: "Learning & Ambition", weight: "5%", note: "Did the team stretch themselves?" },
              ].map((row, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.03] last:border-0">
                  <span className="text-[12px] text-white/60 font-light flex-1">{row.label}</span>
                  <span className="text-[11px] text-purple-400 font-semibold tabular-nums w-8 text-right shrink-0">{row.weight}</span>
                  <span className="text-[11px] text-gray-600 font-light hidden sm:block w-48 shrink-0">{row.note}</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-gray-700 font-light leading-relaxed">
              Tips: <strong className="font-black text-gray-300">MAKE YOUR REPO PUBLIC BEFORE SUBMISSION.</strong>{" "}
              Upload screenshots — they directly affect your visual score. Keep your pitch text concise and clear about what problem you're solving.
            </p>
          </div>
        </div>
      )}

      {/* Hackathon Event Q&A */}
      {event.is_hackathon && (
        <div className="space-y-6 animate-slide-up" style={{ animationDelay: "300ms" }}>
          <div className="flex items-center gap-4 px-2">
            <p className="text-[10px] font-medium text-gray-700 uppercase tracking-[0.4em]">
              Event Q&A
            </p>
            <div className="h-[1px] flex-1 bg-white/[0.03]" />
          </div>

          <div className="glass rounded-[32px] p-8 border-white/[0.06] space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5 text-white/50 stroke-[1.5px]" />
              </div>
              <div>
                <h3 className="text-xl font-light text-white tracking-tight">Hackathon Guide</h3>
                <p className="text-xs text-gray-600 font-light mt-1">Event protocol, credit redemption, submissions, and fair play</p>
              </div>
            </div>

            <div className="space-y-3">
              {eventQa.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.question}
                    className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-4 transition-colors hover:border-white/[0.08] hover:bg-white/[0.025]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 w-8 h-8 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center text-gray-500 shrink-0">
                        <Icon className="w-4 h-4 stroke-[1.5px]" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-[13px] font-medium text-white/75 tracking-wide">{item.question}</h4>
                        <p className="text-[12px] text-gray-600 font-light leading-relaxed">{item.answer}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="rounded-2xl border border-emerald-400/10 bg-emerald-500/[0.025] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-300/70 shrink-0" />
                <h4 className="text-[13px] font-medium text-white/75 tracking-wide">Cursor Credit Notes</h4>
              </div>
              <ul className="space-y-2">
                {creditNotes.map((note) => (
                  <li key={note} className="flex items-start gap-2.5 text-[11px] text-gray-500 font-light leading-relaxed">
                    <ChevronRight className="w-3 h-3 text-emerald-300/35 shrink-0 mt-0.5" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-red-400/10 bg-red-500/[0.03] p-4 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-red-300/70 shrink-0 mt-0.5" />
              <p className="text-[11px] text-gray-500 font-light leading-relaxed">
                When in doubt, ask an organizer before proceeding. Admins and judges may review submissions, repos, and team conduct if protocol concerns come up.
              </p>
            </div>
          </div>
        </div>
      )}

      <ResourcesEggTrigger eventSlug={eventSlug} />
    </main>
  );
}

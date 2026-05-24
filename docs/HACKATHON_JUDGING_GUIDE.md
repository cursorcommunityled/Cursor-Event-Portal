# Hackathon Judging Process — Step by Step

---

## Phase 1 · Admin Setup (Before the Event)

**1. Create a Competition**
Admin → Competitions → create a new competition and set it to **active**.
This is the container for entries and final-round judging.

**2. Enable Hackathon Mode**
Admin → Hackathon → Settings → toggle Hackathon Mode on.
This makes the Hackathon tab visible to attendees.

**3. Set the Team Formation Window**
In Settings, set when team formation opens and closes.
Once the window closes, teams lock and can no longer add members.

**4. Set the Submission Deadline**
Also in Settings. Teams must submit their project before this time.

---

## Phase 2 · Team Formation (During the Event)

**5. Attendees Land in Spawn Point**
Every attendee starts in the **Spawn Point** chat channel — the unassigned lobby.
They can introduce themselves and find teammates here.

**6. Teams Form**
Attendees go to Hackathon → Open Pool to see who's available.
They send invites; accepted invites create a team with a private team channel.
Once on a team, they leave Spawn Point and join **#general** + their team channel.

**7. Optional: AI Team Matching**
Admin → Hackathon → Chat tab → "Suggest Teams" button.
Claude reads each unassigned attendee's intake profile (skills, goals, experience)
and sends each person a personalised DM suggesting one teammate to invite,
with a one-click invite button.

---

## Phase 3 · Project Submission (During Build Phase)

**8. Teams Submit Their Project**
Hackathon → My Team → Submit Project form:
- Project name and description
- **GitHub repo URL** (must be public — this is what AI analyzes)
- Demo URL (optional)
- **Up to 5 screenshots** (used for AI visual/UX analysis — the more the better)
- Pitch text (optional, helps AI understand intent)

Teams can update their submission at any time before the deadline.

---

## Phase 4 · AI Screening (Admin, After Build Time)

**9. Go to the AI Screen Tab**
Admin → Hackathon → **AI Screen** tab.
This tab is only active once at least 4 projects are submitted.

**10. Run AI Analysis Per Team**
Click **Analyze** on each team card.
Claude runs 6 sequential passes (~3 minutes per team):

| Pass | What It Does |
|------|-------------|
| 1 · Repo Analysis | File structure, tech stack, template detection, commit activity |
| 2 · Code Review | Creative solutions, novel integrations, functional score |
| 3 · Innovation Check | Scores against 13 common hackathon clichés; rates surprise factor |
| 4 · Visual Review | Reviews all 5 screenshots for hierarchy, consistency, UX flow, brand |
| 5 · Pool Comparison | Ranks this team relative to all other analyzed teams |
| 6 · Final Synthesis | Claude Opus produces weighted 6-criteria scorecard with reasoning |

Teams see live pass progress on their own dashboard (pass 1/6, 2/6…).
They do **not** see scores — only "Analysis complete — awaiting admin review."

**11. Review AI Scores**
Each team card shows a full AI report: 6 criteria (Innovation, Technical Execution,
Functional Completeness, Problem-Solution Fit, UX & Design, Learning & Ambition),
each with a score, reasoning, and confidence level.
Also shows: most impressive aspect, concerns, suggested award categories.

**12. Push Top 8 to Final Round**
Click **Push Top 8** at the top of the AI Screen tab.
This ranks all analyzed teams by AI overall score and automatically advances
the top 8 as finalists into the competition — replacing any previous finalist selection.
Confirm the dialog, then move to the Final Round tab.

Alternatively, go to Admin → Competitions and manually tick
**Add to Final Round** per entry for full control.

---

## Phase 5 · Final Round Judging (Admin / Human Judges)

**13. Open the Final Round Tab**
Admin → Hackathon → **Final Round** tab.
Each finalist card shows:
- AI Pre-Screen score and key criteria bars (for reference)
- Judge briefing points from the AI (specific things to look at)
- Your own scoring sliders below

**14. Score Each Finalist**
Use the criteria sliders to add your human judge score for each project.
Add judge notes. Click **Save Scorecard**.
Standings update automatically as scorecards are saved.

**15. Repeat for Each Finalist**
Score all finalists. The aggregate standings show at the bottom of the tab,
ranked by combined scorecard scores across all judges who have submitted.

---

## Phase 6 · Publishing Results

**16. Apply AI Scores to Leaderboard (Optional)**
Back in the AI Screen tab, click **Apply Scores** on any team.
This writes the AI's scores into the main hackathon leaderboard.

**17. Make Leaderboard Visible**
Admin → Hackathon → Settings → toggle **Leaderboard Visible** on.
Teams can now see their scores on their dashboard.

**18. Publish Final Results**
In the Final Round tab, click **Publish Top 3**.
This makes the top 3 results visible on the attendee Competitions page,
complete with placement and final scores.

**19. Announce Winners**
Admin → Hackathon → Chat tab → post in the **#announcements** channel.
Only admins can post in announcements; all attendees receive it.

---

## Summary Flow

```
Attendees arrive → Spawn Point → form teams → build
       ↓
Teams submit: repo URL + screenshots + description
       ↓
Admin: AI Screen → Analyze all teams (Claude, ~3 min each)
       ↓
Admin: Push Top 8 → auto-selects finalists by AI score
       ↓
Admin: Final Round → human judge scores each finalist
       ↓
Admin: Publish Top 3 → results go live for attendees
```

---

## Scoring Criteria (6 Dimensions)

| Criterion | Weight | What It Measures |
|-----------|--------|-----------------|
| Innovation & Originality | 25% | How novel and surprising is the concept? |
| Technical Execution | 25% | Cleverness and quality of the engineering |
| Functional Completeness | 20% | Does the core loop actually work? |
| Problem-Solution Fit | 20% | Is it solving a real problem convincingly? |
| UX & Design | 5% | Visual polish and usability |
| Learning & Ambition | 5% | Did the team stretch themselves? |

---

## Tips

- **Run AI analysis on all teams** before pushing to Final Round — pool comparison (Pass 5) needs at least 4 analyses to rank accurately.
- **Screenshots matter** — Pass 4 (Visual Review) needs screenshots to score UX. Encourage teams to upload at least 2.
- **Public repos only** — the GitHub analysis requires a public repository URL.
- **AI scores are a starting point** — human judges have the final say. Use AI scores to focus attention, not replace judgment.
- **Apply Scores ≠ Leaderboard visible** — these are two separate switches. Apply gives the AI scores to the leaderboard; toggling visibility shows it to attendees.

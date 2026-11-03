// Growth > Hiring plan: the drafted hiring content, seeded once into the HiringPlan entity and then
// edited in place on /growth/hiring. Facts only from Justin's brief (Nov 2026) and the offers in
// Agency Knowledge. Anything not decided yet is a [BRACKETED PLACEHOLDER] and is listed in DECISIONS.

export const SEED_VERSION = 1;

export const OFFICE = "[OFFICE LOCATION — Molalla, OR area?]";
export const SCHEDULE = "Monday–Friday, 6 a.m. to 4 p.m. [CONFIRM HOURS — see decisions], 40 hours a week";
export const PAY = "$10,000/month [CONFIRM: $10,000/mo ≈ $57.69/hr, or $62.50/hr ≈ $10,833/mo]";

export const SOURCES = {
  boli: { url: "https://www.oregon.gov/boli/employers/pages/overtime.aspx", label: "Oregon BOLI — Overtime (For Employers)" },
  meta: { url: "https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/special-ad-category", label: "Meta for Developers — Special Ad Categories" },
};

export const DEFAULT_SETTINGS = {
  target_per_month: 6,
  justin_per_month: 3,
  per_hire_per_month: 3,
  hire_monthly_cost: 10000,
  streak_months: 2,
  streak_min: 4,
  any_month_min: 5,
  ready_min: 3,
};

export const GROUPS = [
  { key: "role", label: "The role" },
  { key: "recruit", label: "Ads & recruiting" },
];

const EEO =
  "Interstellar Strategies is an equal opportunity employer. We hire on skill, work ethic and fit for the job. We do not discriminate on the basis of race, color, religion, sex, sexual orientation, gender identity, national origin, age, disability, veteran status or any other status protected by law.";

const JOB_DESCRIPTION = `# Client Operations & Build Specialist
Interstellar Strategies · ${OFFICE} · In person · Full time

Pay: ${PAY}. Overtime paid per Oregon law.
Schedule: ${SCHEDULE}.
No college degree required. If you have one, great.

## Who we are
Interstellar Strategies is a full-stack digital agency based in Molalla, Oregon. We build custom websites, business systems (CRM, operations and client portals), SEO (including AI search), automations and brands for service businesses. Everything we do runs through Møthership™, our command center.

## The job
I close the sale. You take it from there. You finish onboarding, get every account and integration connected, collect what we need from the client, and get the work done inside our system for the package they bought. You are my right hand: when I hand you something, you own it until it's done.

## What you'll do
- Finish client onboarding after I close the sale.
- Make sure every client account and integration is connected and working.
- Talk with clients through Møthership™ to collect information, content and assets.
- Complete client tasks in the system for the package each client bought.
- Help manage new and existing clients.
- Take what I assign and own it to done inside the system.
- Help refine the design, usability, structure and security of our client and internal apps and websites, public and private.
- Help bring new ideas into Interstellar and make them real.
- Set up research and topic automations (with support) so we keep getting better.

## Who I'm looking for
- Hard-working. No excuses.
- You learn fast and you listen to instruction.
- You want to grow, and you want a job that grows with you.

## Strongly preferred
- Design skill. This matters most.
- Experience with AI tools.
- You make designs, videos and content.

If you're great at design and great with AI, I'll teach you the rest.

## Nice to have
SEO, social media, coding or vibe coding, branding.

## How you grow
- Your growth is tracked. You'll take regular skills tests.
- You get paid to learn.
- There is a real path to training and managing a team as we grow.

## How to apply
Send three things:
1. A link to your portfolio.
2. One design or short video you made with AI tools, and a line on which tools you used.
3. Your answers to the screening questions.

No portfolio, no review. Show me the work.

${EEO}`;

const TITLES = `# Title options
Primary: Client Operations & Build Specialist
Alternate 1: Design & Client Operations Specialist
Alternate 2: Digital Build & Client Success Specialist

Why the primary: it says what the job is (client operations + building) without overselling it, and it leaves room to grow into a lead or manager title later.`;

const INTERVIEW = `# Interview process
Five steps. I decide within 48 hours of each one and tell the candidate either way.

## 1. Portfolio screen (about 10 minutes each)
- Look at the portfolio, the AI-made piece and the screening answers.
- Score 1–5 on design, AI fluency and how clearly they write.
- Anything below a 3 on design stops here.

## 2. Short video call (20 minutes)
- Why this job, why now.
- Walk me through one piece in your portfolio: what you did, what the AI did, what you'd change.
- Tell me about something you taught yourself recently.
- Confirm in person, the schedule and the pay.

## 3. Work-sample test (paid)
- The Mission ALPHA kickoff test (see the test block).
- Sent with a clear deadline. Scored on the rubric, not on gut feel.

## 4. In-person interview at the office (60 minutes)
- Go through their test together. Ask what they'd do with another hour.
- Live mini-task: I give them a sample client intake with gaps. They list what's missing and write the message to the client.
- How they take feedback: I give one piece of direct feedback on the test and watch what they do with it.

## 5. References and offer
- Two references, ideally someone who has given them work and feedback.
- Offer in writing with the final pay structure, schedule and start date (all decided in the decisions box first).`;

const RAMP = `# 30 / 60 / 90-day ramp

## Days 1–30: learn the system
- Shadow every onboarding I run.
- Learn Møthership™ end to end: Clients, Flight Plan, Tasks, Requests, Comms and the package pages.
- Run onboarding for one or two clients with me reviewing every client message before it goes out.
- Own the connection checklist on every new client: domain, Google Business Profile, analytics, Search Console, billing and portal access.
- Day 30: first skills test (design + system).

## Days 31–60: run it with a safety net
- Run onboarding on your own for new Mission ALPHA clients. I review at kickoff and at launch.
- Complete package tasks in the system on schedule.
- Ship your first design or usability improvement on a client site or app.
- Set up one research or topic automation with support.
- Day 60: second skills test.

## Days 61–90: own it
- Own three Mission ALPHA builds a month end to end: onboarding, content and assets, build tasks, launch checks.
- No overdue tasks you own.
- Propose and ship one improvement to our own system or templates.
- Write or refresh one SOP.
- Day 90 review: what's working, what isn't, and the next six-month growth plan.`;

const GROWTH = `# Growth tracking
## Skills scorecard (rated 1–5 every month)
- Design
- AI tools (images, video, writing, research)
- Møthership™ and client systems
- Client communication
- SEO and AI search
- Security and access hygiene
- Coding / vibe coding

## Skills tests
- Monthly for the first three months, then quarterly.
- Each test is a real task with a rubric, saved so progress is visible over time.

## Paid to learn
- Learning time is work time: [CONFIRM: hours per week set aside for learning].
- Courses and tools are paid by the company when approved in advance.

## Path to manager
1. Specialist: owns three builds a month with quality.
2. Lead: owns build quality, writes the templates and SOPs, trains the next hire.
3. Manager: hires, trains and runs a team. Templates raise what each person can ship.

Moving up is earned: consistent output, clean work, written SOPs and a trained teammate.`;

const AD_LINKEDIN = `Headline: Client Operations & Build Specialist — Interstellar Strategies (in person, ${OFFICE})

I'm hiring my right hand.

Interstellar Strategies builds custom websites, business systems, SEO and automations for service businesses. I close the deal. You take it from there: onboarding, connecting every account, collecting what we need from the client, and getting the work done inside Møthership™, our command center.

What I'm looking for:
- Great at design. Great with AI tools. If you have both, I'll teach you the rest.
- Hard-working, no excuses, learns fast, listens to instruction.
- Bonus: SEO, social media, coding / vibe coding, branding.

The details:
- ${PAY}. Overtime paid per Oregon law.
- ${SCHEDULE}. In person.
- No degree required.
- Your growth is tracked, you get paid to learn, and there's a path to training and managing a team.

To apply: send your portfolio, one design or short video you made with AI, and answers to the screening questions. Show me the work.

${EEO}`;

const AD_INDEED = `Job title: Client Operations & Build Specialist
Company: Interstellar Strategies
Location: ${OFFICE} (in person)
Job type: Full time
Pay: ${PAY}. Overtime paid per Oregon law.
Schedule: ${SCHEDULE}

Summary:
Full-stack digital agency in Molalla, OR hiring a Client Operations & Build Specialist. You'll finish client onboarding after the sale, connect client accounts and integrations, collect content and assets through our command center (Møthership™), complete client tasks for each package, and help refine the design, usability and security of the websites and apps we build. Design skill and AI experience strongly preferred. No degree required.

[Paste the full job description from "Job description" below this summary.]

Application: portfolio link required. Include one design or short video you made with AI tools.`;

const AD_FACEBOOK = `Primary text:
Great at design? Great with AI? I'm hiring.

Interstellar Strategies in Molalla, OR builds websites, business systems and SEO for service businesses. I need a Client Operations & Build Specialist: you take clients from signed to live inside our command center, and you help make everything we ship look and work better.

${PAY}. Overtime paid per Oregon law. In person, Monday–Friday. No degree required. Paid to learn, with a path to leading a team.

Apply with your portfolio and one thing you made with AI.

Headline: Hiring: Client Operations & Build Specialist
Description: In person · Molalla, OR area · Full time
Button: Apply now

Campaign setting: Special Ad Category = Employment (required). See "Where to post" for what that changes.`;

const AD_LOCAL = `Short post for college career boards, design programs and community groups:

Hiring in the Molalla area: Client Operations & Build Specialist at Interstellar Strategies.

Design + AI people, this one's for you. You'll take new clients from signed to live: onboarding, connecting their accounts, collecting content, and building inside our command center. Full time, in person, Monday–Friday. ${PAY}. Overtime paid per Oregon law. No degree required. Paid to learn, with a path to leading a team.

Apply with your portfolio and one design or short video you made with AI. [APPLY LINK]`;

const WHERE = `# Where to post (marketing plan for the job)

## 1. LinkedIn
- LinkedIn Jobs post with the screening questions attached.
- A post from Justin's own profile and the Interstellar page (the LinkedIn ad copy works as the post). Personal posts from the founder usually travel further than the company page.
- Optional: promote the job post or run LinkedIn ads once the post is live. Budget: [AD BUDGET — $___/week].

## 2. Indeed
- Sponsored job with the screening questions built in, portfolio link required.
- Budget: [AD BUDGET — $___/week].

## 3. Facebook + Instagram (through Ads Studio)
- The campaign must be set to Special Ad Category: Employment. For US employment ads Meta limits targeting:
  - Age is fixed to 18–65+.
  - Gender can't be chosen.
  - Location targeting must cover at least a 15-mile radius in the US. ZIP codes aren't supported.
  - Detailed targeting exclusions, and demographic and behavior targeting, aren't allowed.
  - Lookalike audiences aren't available.
  Source: Meta for Developers, "Special Ad Categories" (link in the decisions box).
- Use the targeting that's left: a 15+ mile radius around the office, plus broad creative and design interests where Meta still allows them.
- Creative: show the work. A short screen recording of Møthership™ and one strong design beat a stock photo.
- Budget: [AD BUDGET — $___/week].

## 4. Local
- Oregon colleges and design programs: post through each school's career center or job board (many use Handshake). Start with Clackamas Community College, Portland Community College, Portland State University and Oregon State University.
- Molalla and Portland communities: local Facebook groups, the local chamber of commerce and Portland creative / design meetups.
- Portfolio sites: Behance and Dribbble job boards reach designers directly.

## 5. Portfolio-first application
- Every channel asks for the same three things: portfolio link, one AI-made design or short video, screening answers.
- No portfolio, no review. This saves hours of screening.

## Tracking
- Hiring ads run from Ads Studio are tagged Special Ad Category: Employment, so the hiring plan page keeps their spend separate from sales ad spend.`;

const SCREENING = `# Screening questions
1. Link to your portfolio. (required)
2. Link to one design or short video you made with AI tools. Which tools did you use, and what did you do yourself versus the AI?
3. This job is in person at ${OFFICE}, ${SCHEDULE}. Can you work that schedule? (Yes / No)
4. Which AI tools do you use every week, and for what?
5. Tell me about a time someone handed you something unclear and you got it to done. What did you do?
6. Rate yourself 1–5: design, AI tools, SEO, social media, coding / vibe coding, branding.
7. What have you taught yourself in the last six months?
8. Are you legally authorized to work in the United States? (Yes / No)`;

const WORK_SAMPLE = `# Work-sample test: the Mission ALPHA kickoff
Time: about 3 hours. Paid: [CONFIRM: test pay]. Deadline: [CONFIRM: e.g. 72 hours after sending].

## The brief (fictional client)
"Summit Ridge Roofing" is a made-up roofing company. You get a one-page intake with their services, service area, two customer reviews and a rough logo. Some information is missing on purpose.

## What to send back
1. Homepage hero design, desktop and mobile. Use AI tools for any imagery.
2. One 15–30 second promo video or motion piece, or a 3–5 slide social carousel, made with AI tools.
3. The message you'd send the client to get what's missing from the intake. List every gap you found.
4. Three to five improvements to a live page we choose (design, usability, structure or security), each in one or two sentences.
5. A short note: which tools you used, and what you did versus the AI.

## Scoring (100 points)
- Design quality: 30
- AI fluency (good tools, good results, honest about what the AI did): 20
- Client message (clear, friendly, gets the answer): 20
- Attention to detail (found the gaps, followed instructions): 15
- Speed and judgment (on time, sensible trade-offs): 15

Test work is never used for a real client.`;

export const SEED_BLOCKS = [
  { key: "job_description", group: "role", sort: 10, title: "Job description", body: JOB_DESCRIPTION },
  { key: "titles", group: "role", sort: 20, title: "Title options", body: TITLES },
  { key: "interview", group: "role", sort: 30, title: "Interview process", body: INTERVIEW },
  { key: "ramp", group: "role", sort: 40, title: "30 / 60 / 90-day ramp", body: RAMP },
  { key: "growth", group: "role", sort: 50, title: "Growth tracking", body: GROWTH },
  { key: "ad_linkedin", group: "recruit", sort: 10, title: "LinkedIn post / ad", body: AD_LINKEDIN },
  { key: "ad_indeed", group: "recruit", sort: 20, title: "Indeed listing", body: AD_INDEED },
  { key: "ad_facebook", group: "recruit", sort: 30, title: "Facebook / Instagram ad", body: AD_FACEBOOK },
  { key: "ad_local", group: "recruit", sort: 40, title: "Local post (colleges, community)", body: AD_LOCAL },
  { key: "where", group: "recruit", sort: 50, title: "Where to post", body: WHERE },
  { key: "screening", group: "recruit", sort: 60, title: "Screening questions", body: SCREENING },
  { key: "work_sample", group: "recruit", sort: 70, title: "Design / AI work-sample test", body: WORK_SAMPLE },
];

export const SEED_DECISIONS = [
  {
    key: "hours",
    question: "Which hours, exactly?",
    detail: "\"6 a.m. to 4 p.m.\" is a 10-hour window, but the job is 8 hours a day / 40 a week. Either the window includes 2 hours of breaks, or the day is 6–2 or 8–4. If lunch is unpaid, an 8-hour paid day is 8½ hours on site (for example 6–2:30).",
    options: ["6 a.m.–4 p.m. including 2 hours of breaks", "6 a.m.–2 p.m.", "8 a.m.–4 p.m.", "Other"],
    answer: "", decided: false,
  },
  {
    key: "pay",
    question: "Monthly pay or hourly rate?",
    detail: "$10,000/month works out to about $57.69/hour at 40 hours a week ($10,000 × 12 ÷ 52 weeks ÷ 40 hours, the same regular-rate method BOLI uses). $62.50/hour × 40 hours is about $10,833/month. Pick one and use it everywhere.",
    options: ["$10,000/month (≈ $57.69/hr regular rate)", "$62.50/hour (≈ $10,833/month)"],
    answer: "", decided: false,
  },
  {
    key: "overtime",
    question: "Overtime: confirm \"overtime paid per Oregon law\"",
    detail: "Oregon BOLI: most employers must pay overtime at 1.5 times the regular rate for all hours over 40 in a workweek, and salaried employees are owed overtime unless they meet the test for exempt status (the employer has to prove it). So the ads say \"overtime paid per Oregon law\" instead of \"additional agreed-upon pay\". At $57.69/hr overtime is about $86.54/hr; at $62.50/hr it is $93.75/hr. If you want this role treated as exempt, confirm it with your payroll provider or an employment attorney first.",
    options: ["Non-exempt, overtime at 1.5× over 40 hrs/week", "Exempt (confirm with payroll / attorney first)"],
    source_url: SOURCES.boli.url, source_label: SOURCES.boli.label,
    answer: "", decided: false,
  },
  {
    key: "office",
    question: "Office location",
    detail: "The ads say [OFFICE LOCATION — Molalla, OR area?]. Replace it in every block once the office is set.",
    options: [], answer: "", decided: false,
  },
  {
    key: "title",
    question: "Job title",
    detail: "Primary: Client Operations & Build Specialist. Alternates: Design & Client Operations Specialist, Digital Build & Client Success Specialist.",
    options: ["Client Operations & Build Specialist", "Design & Client Operations Specialist", "Digital Build & Client Success Specialist"],
    answer: "", decided: false,
  },
  {
    key: "meta",
    question: "Facebook / Instagram: OK with Employment-category limits?",
    detail: "Hiring ads must run as Special Ad Category: Employment. In the US that fixes age to 18–65+, removes gender targeting, requires at least a 15-mile radius (no ZIP codes), and drops lookalikes and detailed targeting exclusions. Decide whether Meta is worth running under those limits.",
    options: ["Run it (broad, creative-led)", "Skip Meta, LinkedIn + Indeed + local only"],
    source_url: SOURCES.meta.url, source_label: SOURCES.meta.label,
    answer: "", decided: false,
  },
  {
    key: "budget",
    question: "Hiring ad budget per channel",
    detail: "No budget is set. Fill in a weekly amount for LinkedIn, Indeed and Meta. Hiring-ad spend from Ads Studio shows separately on this page once it runs.",
    options: [], answer: "", decided: false,
  },
  {
    key: "access",
    question: "What the hire can see in Møthership™",
    detail: "Today Møthership™ has two kinds of login: admin (sees everything, including Financial, Legal and this page) and client portal. A new admin login would see all of it. Decide before day 1 whether that's OK or whether a limited staff role gets built first.",
    options: ["Full admin access", "Build a limited staff role first"],
    answer: "", decided: false,
  },
  {
    key: "test_pay",
    question: "Work-sample test pay and deadline",
    detail: "The test is about 3 hours. Paying for it is fair and gets better candidates. Set the amount and the deadline.",
    options: [], answer: "", decided: false,
  },
  {
    key: "trigger",
    question: "Hiring trigger rule",
    detail: "Default: start hiring after 2 consecutive months at 4 or more Mission ALPHA + care-plan signings, or any single month at 5 or more. Change it in Trigger settings on this page.",
    options: ["Keep the default", "Change it in Trigger settings"],
    answer: "", decided: false,
  },
];

export const SEED_CHECKLIST = [
  { key: "decisions", label: "Every item in \"Needs Justin's decision\" answered" },
  { key: "placeholders", label: "All [BRACKETED] placeholders replaced in every block" },
  { key: "office", label: "Office ready: desk, computer, accounts" },
  { key: "payroll", label: "Payroll and employer setup confirmed with the accountant / payroll provider (registrations, workers' comp, new-hire reporting)" },
  { key: "offer", label: "Offer letter template reviewed" },
  { key: "access", label: "Møthership™ access plan for the hire decided (own login, never Justin's)" },
  { key: "test", label: "Work-sample test packet ready (brief, intake, deadline, pay)" },
  { key: "tracker", label: "Decide where applicants are tracked and who replies" },
  { key: "linkedin", label: "LinkedIn Jobs post live with screening questions" },
  { key: "linkedin_post", label: "LinkedIn post from Justin's profile + Interstellar page" },
  { key: "indeed", label: "Indeed post live with screening questions" },
  { key: "meta", label: "Facebook / Instagram ad live in Ads Studio (Special Ad Category: Employment)" },
  { key: "local", label: "Local posts sent: college career boards, design programs, community groups" },
  { key: "calendar", label: "Interview time blocked on the calendar" },
  { key: "day1", label: "Day-1 plan ready (30 / 60 / 90 ramp)" },
];

import { Brain, Cpu, Briefcase, Factory, Landmark, TrendingUp, Scale, Home, Megaphone, Bot, Telescope, Lightbulb } from "lucide-react";

// The Future Oracle's topic map. Keys match the OracleTopic / OracleFinding enums.
export const TOPICS = [
  { key: "ai_industry", name: "AI industry", icon: Brain, question: "Where is AI going, who is winning, and how fast is it moving?" },
  { key: "tech", name: "Tech", icon: Cpu, question: "What is shifting in tech platforms, devices and infrastructure?" },
  { key: "jobs_labor", name: "Jobs & labor", icon: Briefcase, question: "How fast is AI replacing white-collar work, and what is the job market doing?" },
  { key: "industries", name: "Industries rising / declining", icon: Factory, question: "Which industries are growing and which are shrinking fastest?" },
  { key: "economy", name: "Economy", icon: Landmark, question: "Inflation, rates, growth: what is the economy doing right now?" },
  { key: "markets", name: "Markets", icon: TrendingUp, question: "What are markets doing and how does it touch a small agency? (informational only)" },
  { key: "politics_policy", name: "Politics & policy", icon: Scale, question: "Which laws and policies change what Justin and his clients can do?" },
  { key: "home_service_local", name: "Home-service & local business", icon: Home, question: "What is happening to the trades and local businesses Interstellar serves?" },
  { key: "marketing_platforms", name: "Marketing, search & social", icon: Megaphone, question: "How are Google, AI search and social platforms changing how customers find businesses?" },
  { key: "robotics_autonomy", name: "Robotics & autonomy", icon: Bot, question: "Where are robots, robotaxis and drones actually deployed today?" },
  { key: "future_signals", name: "Future signals", icon: Telescope, question: "Justin's I, Robot theses: which sci-fi ideas are becoming real?" },
  { key: "opportunities", name: "Opportunities for Interstellar", icon: Lightbulb, question: "What could Interstellar build or sell early because it saw this coming?" },
];

export const TOPIC_BY_KEY = Object.fromEntries(TOPICS.map((t, i) => [t.key, { ...t, order: i }]));

export const HORIZONS = { now: "Now", "6-12mo": "6–12 mo", "1-3yr": "1–3 yr", "3-10yr": "3–10 yr" };

export const REALITY = [
  { key: "scifi", label: "Sci-fi" },
  { key: "pilot", label: "Pilot" },
  { key: "scaling", label: "Scaling" },
  { key: "mainstream", label: "Mainstream" },
];

export const DISCLAIMER = {
  markets: "Informational only · not financial advice. No buy or sell recommendations.",
  politics_policy: "Nonpartisan: reports what policies do and who they affect, not opinions.",
};

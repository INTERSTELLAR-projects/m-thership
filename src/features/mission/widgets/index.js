import { TodayWidget, ClaudeQueueWidget, ProjectsWidget, TimeWeekWidget } from "./WorkWidgets";
import { ClientHealthWidget, ClientRequestsWidget, StarboardWidget } from "./ClientWidgets";
import { GoalWidget, LegalWidget, AutomationsWidget } from "./BusinessWidgets";

// Mission Control tiles. Consecutive tiles on the dashboard pack into one responsive grid.
export const TILE_WIDGETS = [
  { id: "w-today", label: "Today", desc: "Tasks due today + overdue across every client, with one-tap complete", Component: TodayWidget },
  { id: "w-claude", label: "Claude queue", desc: "Jobs waiting on your OK, with summaries", Component: ClaudeQueueWidget },
  { id: "w-projects", label: "Projects in flight", desc: "Active projects, task progress and due dates", Component: ProjectsWidget },
  { id: "w-time", label: "Time this week", desc: "Hours by day, top clients and the running clock", Component: TimeWeekWidget },
  { id: "w-health", label: "Client health", desc: "Constellations score per client, lowest first", Component: ClientHealthWidget },
  { id: "w-requests", label: "Client requests", desc: "Open portal and form requests, urgent first", Component: ClientRequestsWidget },
  { id: "w-starboard", label: "Stärboard", desc: "Google rating and review count per business", Component: StarboardWidget },
  { id: "w-goal", label: "$1M in 2027", desc: "Progress toward the goal, live from Stripe", Component: GoalWidget },
  { id: "w-legal", label: "Next legal deadline", desc: "Countdown to the next filing or renewal", Component: LegalWidget },
  { id: "w-automations", label: "Automations", desc: "Running / setup / paused / error counts and what's broken", Component: AutomationsWidget },
];

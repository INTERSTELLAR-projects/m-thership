export const CATEGORIES = ["Priority", "NextUp"];
export const TASK_TYPES = ["Førge Development", "GBP Update", "Presentation", "New Website Build", "Website Update", "Internal Tasks", "Other Task"];
export const INTERSTELLAR_OPTION = "Interstellar";
export const EST_UNITS = ["Minutes", "Hours", "Days", "Weeks", "Months"];
export const TASK_STATUSES = ["Pending", "In Progress", "Completed"];
export const STATUS_STYLES = {
  Pending: "bg-white/5 text-white/35 border-white/10",
  "In Progress": "bg-orange-500/15 text-orange-400 border-orange-500/25",
  Completed: "bg-green-500/15 text-green-400 border-green-500/25",
};
export const EMPTY_FORM = { title: "", description: "", taskType: "", category: "Priority", dueDate: "", estimatedAmount: "", estimatedUnit: "Hours", assignedTo: "" };

const TO_HOURS = { Minutes: 1 / 60, Hours: 1, Days: 8, Weeks: 40, Months: 160 };

export function toHours(amount, unit) {
  return (parseFloat(amount) || 0) * (TO_HOURS[unit] || 1);
}

export function formatTotal(hours) {
  if (hours >= 160) return `${(hours / 160).toFixed(1)} months`;
  if (hours >= 40) return `${(hours / 40).toFixed(1)} weeks`;
  if (hours >= 8) return `${(hours / 8).toFixed(1)} days`;
  if (hours >= 1) return `${hours.toFixed(0)} hours`;
  return `${(hours * 60).toFixed(0)} minutes`;
}
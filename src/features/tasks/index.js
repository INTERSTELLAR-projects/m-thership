// Public surface of the ported task engine.
export { default as AssistantDock } from "./assistant/AssistantDock";
export { AssistantProvider, useAssistant } from "./assistant/AssistantContext";
export { default as TasksNav } from "./components/TasksNav";
export { TASKS_CHANGED, emitTasksChanged } from "./lib/clients";

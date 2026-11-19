import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDeepLinkFocus } from "@/lib/deepLink";
import { Mic, MousePointerClick, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import TaskFilters from "@/features/tasks/components/TaskFilters";
import TaskTable from "@/features/tasks/components/TaskTable";
import TaskFormDialog from "@/features/tasks/components/TaskFormDialog";
import ClientPicker from "@/features/tasks/components/ClientPicker";
import { PriorityLadder, BoardAndLanes } from "@/features/tasks/components/MatrixViews";
import { ladder as buildLadder, board as buildBoard, lanes as buildLanes } from "@/features/tasks/lib/matrix";
import { IS_PRESENTING } from "@/lib/presentation";
import RollButton from "@/features/tasks/ui-kit/RollButton";
import { statusPatch } from "@/features/tasks/lib/constants";
import { settleTimer } from "@/features/tasks/lib/timer";
import { fetchClients, itemsOf, TASKS_CHANGED } from "@/features/tasks/lib/clients";
import { daysUntil } from "@/features/tasks/lib/format";
import { btnGhost } from "@/features/tasks/lib/ui";

const ALL = "__all__";
const NONE = "__none__"; // internal filter value for "Interstellar" (no client)
const NAME = "name:"; // prefix for clients that only exist as a client_name on tasks
const PAGE = 40;
// Presentation mode keeps its own remembered client so a real client id never leaks into (or empties) the sample board.
const STORE_KEY = IS_PRESENTING ? "mothership:taskboard:client:present" : "mothership:taskboard:client";

// URL / storage token <-> internal filter value.
const toToken = (v) => (v === ALL ? "all" : v === NONE ? "interstellar" : v);
const fromToken = (t) => (!t || t === "all" ? ALL : t === "interstellar" ? NONE : t);

const readStored = () => {
  try {
    return window.localStorage.getItem(STORE_KEY);
  } catch (error) {
    return null;
  }
};
const writeStored = (token) => {
  try {
    window.localStorage.setItem(STORE_KEY, token);
  } catch (error) {
    /* storage unavailable */
  }
};

const isOverdue = (t) => {
  const n = daysUntil(t.due_date);
  return n !== null && n < 0;
};

// Recently finished work, for the "Done today" rung.
async function fetchRecentDone() {
  const since = new Date(Date.now() - 2 * 864e5).toISOString();
  try {
    return itemsOf(await base44.entities.Task.filter({ status: "done", completed_at: { $gte: since } }, { sort: "-completed_at", limit: 200 }));
  } catch (error) {
    return [];
  }
}

async function fetchOpenTasks() {
  const out = [];
  const query = { status: { $ne: "done" } };
  let page = await base44.entities.Task.filter(query, { sort: "priority", limit: 500 });
  out.push(...itemsOf(page));
  for (let i = 0; i < 4 && page && page.has_more && page.next_cursor; i += 1) {
    page = await base44.entities.Task.filter(query, { cursor: page.next_cursor, limit: 500 });
    out.push(...itemsOf(page));
  }
  return out;
}

function TaskBoardInner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => ({
    search: "",
    status: ALL,
    category: ALL,
    priority: ALL,
    client: fromToken(searchParams.get("client") || readStored())
  }));
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openTasks, setOpenTasks] = useState([]);
  const [doneTasks, setDoneTasks] = useState([]);
  const [railsLoaded, setRailsLoaded] = useState(false);
  const [laneBy, setLaneBy] = useState("client");
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const selected = filters.client;
  const setSelected = (value) => setFilters((prev) => ({ ...prev, client: value }));

  // Keep URL (?client=) and localStorage in step with the selection.
  useEffect(() => {
    const token = toToken(selected);
    writeStored(token);
    if (searchParams.get("client") !== token) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("client", token);
      setSearchParams(nextParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Back/forward or a pasted link changes the URL: follow it.
  useEffect(() => {
    const fromUrl = searchParams.get("client");
    if (fromUrl && fromToken(fromUrl) !== selected) setSelected(fromToken(fromUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const clientQuery = useCallback((value) => {
    if (value === NONE) return { client_id: null, client_name: null };
    if (value.startsWith(NAME)) return { client_name: value.slice(NAME.length) };
    if (value !== ALL) return { client_id: value };
    return {};
  }, []);

  const buildQuery = useCallback(() => {
    const query = { ...clientQuery(filters.client) };
    // Everything is the working view: finished work lives only in the Complete tab.
    if (filters.status !== ALL) query.status = filters.status;
    else query.status = { $ne: "done" };
    if (filters.category !== ALL) query.category = filters.category;
    if (filters.priority !== ALL) query.priority = Number(filters.priority);
    if (filters.search.trim()) query.title = { $regex: filters.search.trim(), $options: "i" };
    return query;
  }, [filters, clientQuery]);

  const load = useCallback(
    async (nextCursor) => {
      setLoading(true);
      try {
        const query = buildQuery();
        // A cursor carries the original sort/query; later pages send only cursor + limit.
        const options = nextCursor ? { cursor: nextCursor, limit: PAGE } : { sort: "priority", limit: PAGE };
        const [page, count] = await Promise.all([base44.entities.Task.filter(query, options), base44.entities.Task.count(query)]);
        const items = itemsOf(page);
        setTasks((prev) => (nextCursor ? [...prev, ...items] : items));
        setCursor((page && page.next_cursor) || null);
        setHasMore(Boolean(page && page.has_more));
        setTotal(Number(count) || 0);
      } finally {
        setLoading(false);
      }
    },
    [buildQuery]
  );

  // All open tasks drive the rails and the switcher counts.
  const loadRails = useCallback(async () => {
    const [open, done] = await Promise.all([fetchOpenTasks(), fetchRecentDone()]);
    setOpenTasks(open);
    setDoneTasks(done);
    setRailsLoaded(true);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => load(null), 220);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    loadRails().catch(() => {});
    fetchClients().then(setClients);
    base44.entities.Project.filter({ status: { $ne: "done" } }, { sort: "-updated_date", limit: 150 })
      .then((res) => setProjects(itemsOf(res)))
      .catch(() => {});
  }, [loadRails]);

  // Voice commands (and anything else) can announce changes.
  useEffect(() => {
    const onChanged = () => {
      load(null);
      loadRails().catch(() => {});
    };
    window.addEventListener(TASKS_CHANGED, onChanged);
    return () => window.removeEventListener(TASKS_CHANGED, onChanged);
  }, [load, loadRails]);

  // ---- client scoping -------------------------------------------------------
  const clientIds = useMemo(() => new Set(clients.map((c) => c.id)), [clients]);

  const keyOf = useCallback(
    (t) => {
      if (t.client_id && clientIds.has(t.client_id)) return t.client_id;
      if (t.client_name) return NAME + t.client_name;
      if (t.client_id) return t.client_id;
      return NONE;
    },
    [clientIds]
  );

  const inScope = useCallback((t) => selected === ALL || keyOf(t) === selected, [selected, keyOf]);

  const switcherOptions = useMemo(() => {
    const stats = new Map();
    openTasks.forEach((t) => {
      const k = keyOf(t);
      const s = stats.get(k) || { open: 0, hot: false };
      s.open += 1;
      if (isOverdue(t) || Number(t.priority) <= 2 || t.status === "blocked") s.hot = true;
      stats.set(k, s);
    });
    const statOf = (k) => stats.get(k) || { open: 0, hot: false };
    const named = clients
      // Inactive clients only appear while they still have open work.
      .filter((c) => c.name && (String(c.status || "").toLowerCase() !== "inactive" || statOf(c.id).open > 0))
      .map((c) => ({ key: c.id, label: c.name, ...statOf(c.id) }));
    const seen = new Set(named.map((o) => o.key));
    stats.forEach((s, k) => {
      if (k === NONE || seen.has(k)) return;
      const sample = openTasks.find((t) => keyOf(t) === k);
      named.push({ key: k, label: (sample && sample.client_name) || "Unknown client", ...s });
    });
    if (selected !== ALL && selected !== NONE && !named.some((o) => o.key === selected)) {
      named.push({ key: selected, label: selected.startsWith(NAME) ? selected.slice(NAME.length) : "Selected client", open: 0, hot: false });
    }
    named.sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" }));
    let allHot = false;
    stats.forEach((s) => {
      if (s.hot) allHot = true;
    });
    return [
      { key: ALL, label: "All", open: openTasks.length, hot: allHot, strong: true },
      { key: NONE, label: "Interstellar", ...statOf(NONE), strong: true },
      ...named
    ];
  }, [openTasks, clients, keyOf, selected]);

  const selectedLabel = (switcherOptions.find((o) => o.key === selected) || {}).label || "All";

  const matrix = useMemo(() => {
    const scoped = openTasks.filter(inScope);
    return {
      ladder: buildLadder(scoped, doneTasks.filter(inScope)),
      board: buildBoard(scoped),
      lanes: buildLanes(scoped, selected === ALL || selected === NONE ? laneBy : "department"),
    };
  }, [openTasks, doneTasks, inScope, laneBy, selected]);

  // A remembered client with no open work (or one that does not exist here) falls back: in Presentation mode to the
  // busiest sample client, otherwise to everything.
  useEffect(() => {
    if (!railsLoaded || !clients.length || selected === ALL || selected === NONE) return;
    const opt = switcherOptions.find((o) => o.key === selected);
    if (opt && opt.open > 0) return;
    if (IS_PRESENTING) {
      const busiest = switcherOptions.filter((o) => o.key !== ALL && o.key !== NONE).sort((x, y) => y.open - x.open)[0];
      if (busiest && busiest.open > 0) setSelected(busiest.key);
    } else if (!opt || !clients.some((c) => c.id === selected)) setSelected(ALL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [railsLoaded, clients.length]);

  const scopedOpen = useMemo(() => openTasks.filter(inScope).length, [openTasks, inScope]);

  const newTaskDefaults = useMemo(() => {
    if (selected === ALL || selected === NONE) return null;
    if (selected.startsWith(NAME)) return { client_name: selected.slice(NAME.length) };
    const client = clients.find((c) => c.id === selected);
    return { client_id: selected, client_name: client ? client.name : undefined };
  }, [selected, clients]);

  // ---- mutations -------------------------------------------------------------
  const patchLocal = (id, patch) => {
    setTasks((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setOpenTasks((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const updateTask = async (task, patch) => {
    patchLocal(task.id, patch);
    if (patch.status === "done") await settleTimer(task);
    try {
      await base44.entities.Task.update(task.id, patch);
    } catch (error) {
      patchLocal(task.id, task);
    }
    if ("is_focus" in patch || "status" in patch) loadRails().catch(() => {});
    // A status change can move the task out of the tab being viewed (e.g. into Complete).
    if ("status" in patch) load(null).catch(() => {});
  };

  const removeTask = async (task) => {
    setTasks((prev) => prev.filter((row) => row.id !== task.id));
    setOpenTasks((prev) => prev.filter((row) => row.id !== task.id));
    setTotal((prev) => Math.max(0, prev - 1));
    await settleTimer(task);
    await base44.entities.Task.delete(task.id);
  };

  const complete = async (task) => {
    const patch = statusPatch("done");
    setOpenTasks((prev) => prev.filter((row) => row.id !== task.id));
    setDoneTasks((prev) => [{ ...task, ...patch, completed_at: patch.completed_at || new Date().toISOString() }, ...prev]);
    if (filters.status === "done") {
      setTasks((prev) => prev.map((row) => (row.id === task.id ? { ...row, ...patch } : row)));
    } else {
      setTasks((prev) => prev.filter((row) => row.id !== task.id));
      setTotal((prev) => Math.max(0, prev - 1));
    }
    await settleTimer(task);
    await base44.entities.Task.update(task.id, patch);
  };

  const openEditor = (task) => {
    setEditing(task);
    setDialogOpen(true);
  };

  // ?task=<id> (from Command): open that task's editor and highlight its row.
  const linkedTask = searchParams.get("task") || "";
  useEffect(() => {
    if (!linkedTask) return;
    let live = true;
    base44.entities.Task.get(linkedTask).then((t) => { if (live && t) openEditor(t); }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedTask]);
  useDeepLinkFocus(linkedTask, [tasks.length]);

  const scopeText = selected === ALL ? "everything" : selectedLabel;

  return (
    <div className="min-h-screen pb-32">
      <PageHeader breadcrumb="Command / Tasks" title="Task Matrix" rightText={total + " tasks" + (selected === ALL ? " in the system" : " for " + selectedLabel)}>
        <button type="button" className={btnGhost} onClick={() => { load(null); loadRails().catch(() => {}); }}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
        {/* The old voice dock is replaced by the Command Ask bar (on every page). */}
        <RollButton label="Say a task" icon={Mic} onClick={() => window.dispatchEvent(new CustomEvent("command:ask", { detail: { text: "Add task: " } }))} />
      </PageHeader>

      <div className="space-y-6 px-5 py-6 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1 sm:flex-none">
            <p className="label-cross mb-2">(Working on)</p>
            <ClientPicker options={switcherOptions} value={selected} onChange={setSelected} />
          </div>
          <div className="mono-label flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-ink/50" data-testid="task-scope-counts">
            <span><b className="text-ink">{scopedOpen}</b> open · {scopeText}</span>
            <span><b className="text-ink">{matrix.board.doing.length}</b> in flight</span>
            <span><b className={matrix.ladder.counts.blocked ? "text-red-700" : "text-ink"}>{matrix.ladder.counts.blocked}</b> blocked</span>
            <span><b className="text-green-700">{matrix.ladder.doneToday.length}</b> done today</span>
          </div>
        </div>

        <div>
          <p className="label-cross mb-3">(Priority ladder{selected === ALL ? " · across everything" : " · " + selectedLabel})</p>
          <PriorityLadder ladder={matrix.ladder} scope={scopeText} onOpen={openEditor} onComplete={complete} />
        </div>

        <BoardAndLanes board={matrix.board} lanes={matrix.lanes} laneBy={selected === ALL || selected === NONE ? laneBy : "department"} setLaneBy={setLaneBy} onOpen={openEditor}
          onPickClient={(key) => { if (key === "interstellar") setSelected(NONE); else setSelected(key); }} />

        <div className="space-y-4">
          <p className="label-cross">({selected === ALL ? "All tasks" : selectedLabel + " tasks"})</p>
          <TaskFilters
            filters={filters}
            setFilters={setFilters}
            clients={clients}
            onNew={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          />

          {loading && !tasks.length ? (
            <p className="py-16 text-center text-[12.5px] text-ink/45">Reading the task field...</p>
          ) : (
            <TaskTable
              tasks={tasks}
              onEdit={openEditor}
              onStatus={(task, status) => updateTask(task, statusPatch(status))}
              onFocus={(task) => updateTask(task, { is_focus: !task.is_focus })}
              onDelete={removeTask}
              onPatch={(task, patch) => patchLocal(task.id, patch)}
            />
          )}

          {hasMore ? (
            <div className="flex justify-center">
              <button type="button" onClick={() => load(cursor)} disabled={loading} className={btnGhost}>
                <MousePointerClick className="h-3.5 w-3.5" />
                {loading ? "Loading..." : "Load more"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projects={projects}
        clients={clients}
        initial={editing}
        defaults={newTaskDefaults}
        onSaved={() => {
          load(null);
          loadRails().catch(() => {});
        }}
      />

    </div>
  );
}

export default function TaskBoard() {
  return <TaskBoardInner />;
}

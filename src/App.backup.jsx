import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { CheckSquare, CalendarDays, Compass, LineChart as LineChartIcon, Circle, CheckCircle2, Menu, X, Settings } from "lucide-react";

/* ============================================================================
   EXECUTION HUB — daily to-do list, v3
   Browser-safe local persistence, full task CRUD, backend-ready quick add, and
   real analytics computed from stored tasks. Visual identity: charcoal, warm brass,
   and an editorial command-center rhythm.
============================================================================ */

/* ------------------------------- DATE HELPERS ------------------------------- */

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function formatShortDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function formatDue(iso, time) {
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  let label;
  if (iso === today) label = "Today";
  else if (iso === tomorrow) label = "Tomorrow";
  else if (iso < today) label = "Overdue \u00b7 " + formatShortDate(iso);
  else label = formatShortDate(iso);
  return time ? label + " \u00b7 " + time : label;
}
function formatMinutes(m) {
  if (!m) return "";
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? h + "h " + r + "m" : h + "h";
}
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function getWeekDates() {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}
function lastNDays(n) {
  const today = todayISO();
  const arr = [];
  for (let i = n - 1; i >= 0; i--) arr.push(addDays(today, -i));
  return arr;
}

/* Catmull-Rom -> cubic bezier, for an organic chart curve. */
function smoothPath(points) {
  if (points.length < 2) return "";
  let d = "M " + points[0].x.toFixed(2) + " " + points[0].y.toFixed(2);
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += " C " + c1x.toFixed(2) + " " + c1y.toFixed(2) + ", " + c2x.toFixed(2) + " " + c2y.toFixed(2) + ", " + p2.x.toFixed(2) + " " + p2.y.toFixed(2);
  }
  return d;
}

/* ------------------------------- SEED DATA ---------------------------------- */
/* Only used the very first time the app runs (storage empty). */

const SEED_PROJECTS = [
  { id: "proj1", name: "30 Day Python Roadmap", description: "Daily practice roadmap toward AI engineering fundamentals.", hasRoadmap: true },
  { id: "proj2", name: "AI WhatsApp Bot", description: "Personal automation project." },
  { id: "proj3", name: "Freelance Project", description: "Client work in progress." },
  { id: "proj4", name: "School / STS", description: "Coursework and exam prep." },
];

function buildSeedTasks() {
  const today = todayISO();
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  const now = new Date().toISOString();
  return [
    { id: "seed1", title: "Belajar Python selama 1 jam", description: "", priority: "Medium", category: "30 Day Python Roadmap", dueDate: today, dueTime: "", estimatedMinutes: 60, status: "pending", createdAt: now, completedAt: null },
    { id: "seed2", title: "Mengerjakan tugas sekolah", description: "", priority: "High", category: "School / STS", dueDate: today, dueTime: "", estimatedMinutes: 90, status: "pending", createdAt: now, completedAt: null },
    { id: "seed3", title: "Review materi STS", description: "", priority: "Medium", category: "School / STS", dueDate: today, dueTime: "", estimatedMinutes: 45, status: "in_progress", createdAt: now, completedAt: null },
    { id: "seed4", title: "Melanjutkan project AI", description: "Lanjutkan integrasi WhatsApp bot.", priority: "High", category: "AI WhatsApp Bot", dueDate: today, dueTime: "19:00", estimatedMinutes: 120, status: "pending", createdAt: now, completedAt: null },
    { id: "seed5", title: "Membaca dan merapikan catatan", description: "", priority: "Low", category: "", dueDate: today, dueTime: "", estimatedMinutes: 30, status: "completed", createdAt: now, completedAt: today + "T09:00:00.000Z" },
    { id: "seed6", title: "Workout", description: "", priority: "Low", category: "", dueDate: today, dueTime: "", estimatedMinutes: 45, status: "pending", createdAt: now, completedAt: null },
    { id: "seed7", title: "Menyelesaikan satu bagian project", description: "", priority: "High", category: "Freelance Project", dueDate: tomorrow, dueTime: "", estimatedMinutes: 90, status: "pending", createdAt: now, completedAt: null },
    { id: "seed8", title: "Setup testing environment", description: "", priority: "Medium", category: "AI WhatsApp Bot", dueDate: yesterday, dueTime: "", estimatedMinutes: 40, status: "pending", createdAt: now, completedAt: null },
    { id: "seed9", title: "Variables & data types practice", description: "", priority: "Medium", category: "30 Day Python Roadmap", dueDate: addDays(today, -2), dueTime: "", estimatedMinutes: 50, status: "completed", createdAt: now, completedAt: addDays(today, -2) + "T10:00:00.000Z" },
    { id: "seed10", title: "Control flow practice", description: "", priority: "Medium", category: "30 Day Python Roadmap", dueDate: addDays(today, -3), dueTime: "", estimatedMinutes: 40, status: "completed", createdAt: now, completedAt: addDays(today, -3) + "T10:00:00.000Z" },
    { id: "seed11", title: "Client call prep", description: "", priority: "High", category: "Freelance Project", dueDate: addDays(today, -4), dueTime: "", estimatedMinutes: 30, status: "completed", createdAt: now, completedAt: addDays(today, -4) + "T10:00:00.000Z" },
  ];
}

const ROADMAP_TOPICS = [
  "Environment setup", "Variables & data types", "Control flow", "Functions & scope",
  "Data structures", "File & error handling", "OOP basics", "Modules & pip",
  "CLI practice project", "Automate a daily task", "Working with APIs", "NumPy fundamentals",
  "Pandas fundamentals", "Data cleaning practice", "Data visualization", "SQL basics",
  "Git & version control", "Intro to ML concepts", "Linear regression from scratch", "Classification models",
  "Model evaluation", "Scikit-learn practice", "Intro to neural networks", "Build a simple NN",
  "Intro to PyTorch / TensorFlow", "Train a small model", "Intro to LLM APIs", "Build an AI-powered script",
  "Capstone — build", "Capstone — ship",
].map((topic, i) => ({ day: i + 1, topic, done: i + 1 <= 6, current: i + 1 === 7 }));

/* -------------------------------- AI QUICK ADD ------------------------------- */

const taskParserService = {
  async parse(instruction, todayIso) {
    const response = await fetch("/api/tasks/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction, today: todayIso }),
    });
    if (!response.ok) throw new Error("Task parser unavailable");
    const parsed = await response.json();
    if (!parsed.title) throw new Error("No task title returned");
    return parsed;
  },
};

async function parseTaskWithAI(text, todayIso) {
  return taskParserService.parse(text, todayIso);
}

function QuickAdd({ onAdd, projects }) {
  const [mode, setMode] = useState("ai");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleAISubmit() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const parsed = await parseTaskWithAI(text.trim(), todayISO());
      onAdd({
        title: parsed.title,
        description: parsed.description || "",
        priority: ["Low", "Medium", "High"].includes(parsed.priority) ? parsed.priority : "Medium",
        category: parsed.category || "",
        dueDate: parsed.dueDate || todayISO(),
        dueTime: parsed.dueTime || "",
        estimatedMinutes: parsed.estimatedMinutes || null,
      });
      setText("");
    } catch (e) {
      setError("Couldn't parse that automatically. Try rephrasing, or switch to manual.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="aeh-quickadd">
      <div className="aeh-chart-toggle" style={{ marginBottom: 10 }}>
        <button className={mode === "ai" ? "aeh-chart-toggle-active" : ""} onClick={() => setMode("ai")} type="button">Quick add</button>
        <button className={mode === "manual" ? "aeh-chart-toggle-active" : ""} onClick={() => setMode("manual")} type="button">Manual</button>
      </div>

      {mode === "ai" ? (
        <div>
          <div className="aeh-form-row">
            <input
              className="aeh-input"
              placeholder='e.g. "Continue AI WhatsApp bot, high priority, tomorrow 7pm"'
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !busy) handleAISubmit(); }}
            />
            <Button onClick={handleAISubmit} disabled={busy || !text.trim()}>{busy ? "Reading\u2026" : "Add"}</Button>
          </div>
          {error && (
            <div className="aeh-field-error">
              {error} <TextButton onClick={() => setMode("manual")}>Add manually</TextButton>
            </div>
          )}
          <p className="aeh-muted-faint" style={{ marginTop: 6 }}>Uses the task parser service when your backend is connected.</p>
        </div>
      ) : (
        <TaskForm projects={projects} submitLabel="Add task" onSubmit={(data) => onAdd(data)} onCancel={() => setMode("ai")} />
      )}
    </div>
  );
}

/* --------------------------------- TASK FORM --------------------------------- */

function TaskForm({ initial, projects, onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState(
    initial || { title: "", description: "", priority: "Medium", category: "", dueDate: todayISO(), dueTime: "", estimatedMinutes: "" }
  );
  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function submit() {
    if (!form.title.trim()) return;
    onSubmit({
      title: form.title.trim(),
      description: (form.description || "").trim(),
      priority: form.priority,
      category: (form.category || "").trim(),
      dueDate: form.dueDate || todayISO(),
      dueTime: form.dueTime || "",
      estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : null,
    });
  }
  return (
    <div className="aeh-manual-form">
      <input className="aeh-input" placeholder="Task title" value={form.title} onChange={(e) => set("title", e.target.value)} />
      <input className="aeh-input" placeholder="Description (optional)" value={form.description} onChange={(e) => set("description", e.target.value)} style={{ marginTop: 8 }} />
      <div className="aeh-form-row" style={{ marginTop: 8 }}>
        <select className="aeh-select" value={form.priority} onChange={(e) => set("priority", e.target.value)}>
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </select>
        <select className="aeh-select" value={form.category} onChange={(e) => set("category", e.target.value)}>
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </select>
      </div>
      <div className="aeh-form-row" style={{ marginTop: 8 }}>
        <input type="date" className="aeh-input" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
        <input type="time" className="aeh-input" value={form.dueTime} onChange={(e) => set("dueTime", e.target.value)} />
        <input type="number" min="0" className="aeh-input aeh-input-narrow" placeholder="Minutes" value={form.estimatedMinutes} onChange={(e) => set("estimatedMinutes", e.target.value)} />
      </div>
      <div className="aeh-inline-actions" style={{ marginTop: 12 }}>
        <Button onClick={submit} disabled={!form.title.trim()}>{submitLabel}</Button>
        <TextButton muted onClick={onCancel}>Cancel</TextButton>
      </div>
    </div>
  );
}

/* -------------------------------- PRIMITIVES -------------------------------- */

function Section({ label, action, children, first = false }) {
  return (
    <section className={`aeh-section ${first ? "aeh-section-first" : ""}`}>
      <div className="aeh-section-head">
        <span className="aeh-section-label">{label}</span>
        {action}
      </div>
      {children}
    </section>
  );
}
function TextButton({ children, onClick, disabled, muted = false }) {
  return (
    <button className={`aeh-textbtn ${muted ? "aeh-textbtn-muted" : ""}`} onClick={onClick} disabled={disabled} type="button">
      {children}
    </button>
  );
}
function Button({ children, variant = "primary", onClick, disabled, full = false }) {
  return (
    <button className={`aeh-btn aeh-btn-${variant} ${full ? "aeh-btn-full" : ""}`} onClick={onClick} disabled={disabled} type="button">
      {children}
    </button>
  );
}

/* ----------------------------------- NAV ------------------------------------- */

const NAV_ITEMS = [
  { key: "today", label: "Today", icon: CheckSquare },
  { key: "week", label: "This Week", icon: CalendarDays },
  { key: "projects", label: "Projects", icon: Compass },
  { key: "analytics", label: "Analytics", icon: LineChartIcon },
];
const NAV_ITEM_H = 44;

function Atmosphere() {
  return (
    <div className="aeh-atmosphere" aria-hidden="true">
      <div className="aeh-atmosphere-glow aeh-atmosphere-glow-one" />
      <div className="aeh-atmosphere-glow aeh-atmosphere-glow-two" />
      <div className="aeh-stars aeh-stars-one" />
      <div className="aeh-stars aeh-stars-two" />
      <div className="aeh-constellation">
        <span className="aeh-constellation-dot dot-a" />
        <span className="aeh-constellation-dot dot-b" />
        <span className="aeh-constellation-dot dot-c" />
        <span className="aeh-constellation-dot dot-d" />
        <span className="aeh-constellation-line line-a" />
        <span className="aeh-constellation-line line-b" />
        <span className="aeh-constellation-line line-c" />
      </div>
    </div>
  );
}

function Sidebar({ page, setPage, mobileOpen, setMobileOpen }) {
  const activeIndex = NAV_ITEMS.findIndex((n) => n.key === page);
  return (
    <>
      {mobileOpen && <div className="aeh-scrim" onClick={() => setMobileOpen(false)} />}
      <aside className={`aeh-sidebar ${mobileOpen ? "aeh-sidebar-open" : ""}`}>
        <div className="aeh-brand">
          <span className="aeh-brand-name">APEX</span>
          <button className="aeh-icon-btn aeh-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={17} />
          </button>
        </div>
        <nav className="aeh-nav">
          <span className="aeh-nav-indicator" style={{ transform: `translateY(${activeIndex * NAV_ITEM_H}px)` }} />
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`aeh-nav-item ${page === item.key ? "aeh-nav-item-active" : ""}`}
              onClick={() => { setPage(item.key); setMobileOpen(false); }}
              type="button"
            >
              <item.icon size={16} strokeWidth={1.8} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="aeh-sidebar-footer">
          <span className="aeh-mono aeh-streak-text">Synced</span>
          <button className="aeh-icon-btn" aria-label="Settings">
            <Settings size={16} strokeWidth={1.8} />
          </button>
        </div>
      </aside>
    </>
  );
}
function TopBar({ title, onMenu }) {
  return (
    <header className="aeh-topbar">
      <button className="aeh-icon-btn aeh-mobile-menu" onClick={onMenu} aria-label="Open menu">
        <Menu size={19} />
      </button>
      <h1 className="aeh-page-title">{title}</h1>
      <div className="aeh-avatar">K</div>
    </header>
  );
}
function BottomNav({ page, setPage }) {
  return (
    <nav className="aeh-bottom-nav">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          className={`aeh-bottom-nav-item ${page === item.key ? "aeh-bottom-nav-item-active" : ""}`}
          onClick={() => setPage(item.key)}
          type="button"
        >
          <item.icon size={18} strokeWidth={1.8} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* -------------------------------- TASK CARD ----------------------------------- */

function TaskCard({ task, projects, onToggle, onCycleStatus, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [clicking, setClicking] = useState(false);

  if (editing) {
    return (
      <motion.div layout="position" transition={{ layout: { duration: 0.56, ease: [0.22, 1, 0.36, 1] } }} className="aeh-task-row aeh-task-row-editing">
        <TaskForm
          initial={{
            title: task.title, description: task.description, priority: task.priority,
            category: task.category, dueDate: task.dueDate, dueTime: task.dueTime,
            estimatedMinutes: task.estimatedMinutes || "",
          }}
          projects={projects}
          submitLabel="Save"
          onSubmit={(patch) => { onUpdate(task.id, patch); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      </motion.div>
    );
  }

  const overdue = task.status !== "completed" && task.dueDate < todayISO();
  function handleToggle() {
    setClicking(true);
    onToggle(task.id);
    window.setTimeout(() => setClicking(false), 520);
  }

  return (
    <motion.div layout="position" layoutId={`task-${task.id}`} initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.985, transition: { duration: 0.2, ease: "easeIn" } }} transition={{ layout: { duration: 0.56, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.28 }, scale: { duration: 0.28 } }} className={`aeh-task-row ${task.status === "completed" ? "aeh-task-row-done" : ""} ${overdue ? "aeh-task-row-overdue" : ""} ${clicking ? "aeh-task-row-clicked" : ""}`}>
      <button className="aeh-check" onClick={handleToggle} aria-label={task.status === "completed" ? "Mark not done" : "Mark done"} type="button">
        {task.status === "completed" ? <CheckCircle2 size={18} strokeWidth={1.8} /> : <Circle size={18} strokeWidth={1.8} />}
      </button>
      <div className="aeh-task-body">
        <div className="aeh-task-title-row">
          <span className={`aeh-task-title ${task.status === "completed" ? "aeh-strike" : ""}`}>{task.title}</span>
          <span className="aeh-task-priority">{task.priority}</span>
        </div>
        {task.description ? <p className="aeh-task-desc">{task.description}</p> : null}
        <div className="aeh-task-meta">
          {task.category ? <span>{task.category}</span> : null}
          <span className={overdue ? "aeh-overdue-text" : ""}>{formatDue(task.dueDate, task.dueTime)}</span>
          {task.estimatedMinutes ? <span>{formatMinutes(task.estimatedMinutes)}</span> : null}
          {task.status === "in_progress" ? <span className="aeh-status-tag">In progress</span> : null}
        </div>
        <div className="aeh-inline-actions" style={{ marginTop: 8 }}>
          {task.status === "pending" && (
            <TextButton muted onClick={() => onCycleStatus(task.id, "in_progress")}>Start</TextButton>
          )}
          <TextButton muted onClick={() => setEditing(true)}>Edit</TextButton>
          {confirmDelete ? (
            <>
              <TextButton onClick={() => onDelete(task.id)}>Confirm delete</TextButton>
              <TextButton muted onClick={() => setConfirmDelete(false)}>Cancel</TextButton>
            </>
          ) : (
            <TextButton muted onClick={() => setConfirmDelete(true)}>Delete</TextButton>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function TaskList({ tasks, projects, onToggle, onCycleStatus, onUpdate, onDelete, empty }) {
  if (!tasks.length) return <p className="aeh-muted-faint">{empty}</p>;
  return (
    <motion.div layout className="aeh-task-list">
      <AnimatePresence initial={false} mode="popLayout">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} projects={projects} onToggle={onToggle} onCycleStatus={onCycleStatus} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

/* --------------------------- COMPLETED TASK ARCHIVE --------------------------- */

function completedTime(task) {
  if (!task.completedAt) return "—";
  return new Date(task.completedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function completedDateLabel(iso) {
  if (!iso) return "Unscheduled";
  const today = todayISO();
  const yesterday = addDays(today, -1);
  if (iso === today) return "Today";
  if (iso === yesterday) return "Yesterday";
  return formatShortDate(iso);
}

function CompletedTaskRow({ task, projects, onToggle, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (editing) {
    return (
      <motion.div layout="position" layoutId={`task-${task.id}`} className="aeh-completed-edit-row">
        <TaskForm
          initial={{
            title: task.title, description: task.description, priority: task.priority,
            category: task.category, dueDate: task.dueDate, dueTime: task.dueTime,
            estimatedMinutes: task.estimatedMinutes || "",
          }}
          projects={projects}
          submitLabel="Save"
          onSubmit={(patch) => { onUpdate(task.id, patch); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      layout="position"
      layoutId={`task-${task.id}`}
      className="aeh-completed-row"
      initial={{ opacity: 0, scale: .985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: .985, transition: { duration: .18 } }}
      transition={{ layout: { duration: .56, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: .26 }, scale: { duration: .26 } }}
    >
      <button className="aeh-completed-check" onClick={() => onToggle(task.id)} aria-label={`Reopen ${task.title}`} type="button">
        <CheckCircle2 size={16} strokeWidth={2} />
      </button>
      <span className="aeh-completed-title">{task.title}</span>
      <span className="aeh-completed-date">{completedDateLabel(task.dueDate)}{task.dueTime ? ` · ${task.dueTime}` : ""}</span>
      <span className="aeh-completed-project">{task.category || "General"}</span>
      <span className="aeh-completed-time">{completedTime(task)}</span>
      <span className="aeh-completed-actions">
        <TextButton muted onClick={() => setEditing(true)}>Edit</TextButton>
        {confirmDelete ? (
          <TextButton onClick={() => onDelete(task.id)}>Delete</TextButton>
        ) : (
          <TextButton muted onClick={() => setConfirmDelete(true)}>Delete</TextButton>
        )}
      </span>
    </motion.div>
  );
}

function CompletedArchive({ tasks, projects, onToggle, onUpdate, onDelete }) {
  const [sort, setSort] = useState("latest");
  const completed = tasks.filter((t) => t.status === "completed");
  const sorted = [...completed].sort((a, b) => {
    if (sort === "oldest") return (a.completedAt || "").localeCompare(b.completedAt || "");
    if (sort === "project") return (a.category || "General").localeCompare(b.category || "General") || (b.completedAt || "").localeCompare(a.completedAt || "");
    return (b.completedAt || "").localeCompare(a.completedAt || "");
  });
  const groups = sorted.reduce((acc, task) => {
    const key = task.completedAt ? task.completedAt.slice(0, 10) : task.dueDate;
    (acc[key || "unknown"] ||= []).push(task);
    return acc;
  }, {});

  return (
    <section className="aeh-completed-archive" aria-label="Completed tasks">
      <div className="aeh-completed-head">
        <div>
          <h2>Completed <span>{completed.length}</span></h2>
          <p>Finished work, kept easy to review.</p>
        </div>
        {completed.length > 1 && (
          <label className="aeh-completed-sort">
            <span>Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort completed tasks">
              <option value="latest">Latest</option>
              <option value="oldest">Oldest</option>
              <option value="project">Project</option>
            </select>
          </label>
        )}
      </div>

      {completed.length === 0 ? (
        <div className="aeh-completed-empty">Completed tasks will appear here after you finish them.</div>
      ) : (
        <div className="aeh-completed-groups">
          {Object.entries(groups).map(([date, group]) => (
            <div className="aeh-completed-group" key={date}>
              <div className="aeh-completed-group-label">{completedDateLabel(date)} <span>· {group.length} {group.length === 1 ? "task" : "tasks"}</span></div>
              <div className="aeh-completed-table-head" aria-hidden="true">
                <span /> <span>Task</span><span>Due</span><span>Project</span><span>Done</span><span />
              </div>
              <AnimatePresence initial={false} mode="popLayout">
                {group.map((task) => (
                  <CompletedTaskRow key={task.id} task={task} projects={projects} onToggle={onToggle} onUpdate={onUpdate} onDelete={onDelete} />
                ))}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* --------------------------------- TODAY PAGE --------------------------------- */

function TodayPage({ tasks, projects, onAdd, onToggle, onCycleStatus, onUpdate, onDelete }) {
  const today = todayISO();
  const overdue = tasks.filter((t) => t.status !== "completed" && t.dueDate < today);
  const todays = tasks.filter((t) => t.dueDate === today);
  const pending = todays.filter((t) => t.status === "pending");
  const inProgress = todays.filter((t) => t.status === "in_progress");
  const completed = todays.filter((t) => t.status === "completed");
  const pct = todays.length ? Math.round((completed.length / todays.length) * 100) : 0;
  const hour = new Date().getHours();
  const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <LayoutGroup id="today-task-layout">
    <div className="aeh-page">
      <div className="aeh-home-header">
        <div>
          <div className="aeh-mono">{dateLabel}</div>
          <div className="aeh-muted">{todays.length ? `${completed.length} of ${todays.length} tasks complete.` : "Nothing scheduled for today yet."}</div>
        </div>
        {todays.length > 0 && (
          <div className="aeh-focus-progress" style={{ minWidth: 120 }} aria-label={`${pct}% of today's tasks complete`}>
            <div className="aeh-line-track"><div className="aeh-line-fill" style={{ width: "100%", transform: `scaleX(${pct / 100})` }} /></div>
            <span className="aeh-mono">{pct}%</span>
          </div>
        )}
      </div>

      {(() => {
        const focusTask = inProgress[0] || [...pending].sort((a, b) => ({ High: 0, Medium: 1, Low: 2 }[a.priority] - ({ High: 0, Medium: 1, Low: 2 }[b.priority])))[0];
        return (
          <section className="aeh-focus-block" aria-label="Today's focus">
            <div className="aeh-focus-kicker"><span className="aeh-focus-rule" />Today's focus</div>
            {focusTask ? (
              <div className="aeh-focus-content">
                <div>
                  <h2>{focusTask.title}</h2>
                  <p>{focusTask.status === "in_progress" ? "In progress now" : "Next up"}{focusTask.category ? ` · ${focusTask.category}` : ""}{focusTask.estimatedMinutes ? ` · ${formatMinutes(focusTask.estimatedMinutes)}` : ""}</p>
                </div>
                <button className="aeh-focus-action" type="button" onClick={() => onToggle(focusTask.id)} aria-label={focusTask.status === "completed" ? "Mark focus task not done" : "Complete focus task"}>
                  {focusTask.status === "completed" ? "Reopen" : "Complete"}
                </button>
              </div>
            ) : (
              <p className="aeh-focus-empty">Choose a task to make the next step concrete.</p>
            )}
          </section>
        );
      })()}

      <Section first label="Capture the next action">
        <QuickAdd onAdd={onAdd} projects={projects} />
      </Section>

      {overdue.length > 0 && (
        <Section label={`Overdue (${overdue.length})`}>
          <TaskList tasks={overdue} projects={projects} onToggle={onToggle} onCycleStatus={onCycleStatus} onUpdate={onUpdate} onDelete={onDelete} empty="" />
        </Section>
      )}

      <Section label="In progress">
        <TaskList tasks={inProgress} projects={projects} onToggle={onToggle} onCycleStatus={onCycleStatus} onUpdate={onUpdate} onDelete={onDelete} empty="Nothing in progress." />
      </Section>

      <Section label="Pending">
        <TaskList tasks={pending} projects={projects} onToggle={onToggle} onCycleStatus={onCycleStatus} onUpdate={onUpdate} onDelete={onDelete} empty={todays.length ? "All caught up." : "No tasks yet \u2014 add one above."} />
      </Section>

      <CompletedArchive tasks={tasks} projects={projects} onToggle={onToggle} onUpdate={onUpdate} onDelete={onDelete} />
    </div>
    </LayoutGroup>
  );
}

/* --------------------------------- WEEK PAGE ----------------------------------- */

function WeekPage({ tasks, onToggle }) {
  const days = getWeekDates();
  const today = todayISO();
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="aeh-page">
      <div className="aeh-home-header">
        <div>
          <div className="aeh-mono">This week</div>
          <div className="aeh-muted">{tasks.filter((t) => t.dueDate >= days[0] && t.dueDate <= days[6]).length} scheduled tasks across the week.</div>
        </div>
      </div>
      <div className="aeh-week-grid">
        {days.map((iso, i) => {
          const dayTasks = tasks.filter((t) => t.dueDate === iso);
          const d = new Date(iso + "T00:00:00");
          return (
            <div className={`aeh-week-col ${iso === today ? "aeh-week-col-today" : ""}`} key={iso}>
              <div className="aeh-week-col-head">
                <span>{labels[i]}</span>
                <span className="aeh-mono aeh-muted-faint">{d.getDate()}</span>
              </div>
              {dayTasks.length ? (
                <div className="aeh-week-tasks">
                  {dayTasks.map((t) => (
                    <button
                      key={t.id}
                      className={`aeh-week-task ${t.status === "completed" ? "aeh-week-task-done" : ""}`}
                      onClick={() => onToggle(t.id)}
                      type="button"
                    >
                      <span>{t.title}</span>
                      <span className="aeh-mono aeh-muted-faint">
                        {t.priority || "Medium"}
                        {t.category ? ` · ${t.category}` : ""}
                        {t.dueDate
                          ? ` · ${new Date(t.dueDate + "T00:00:00").toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                            })}`
                          : ""}
                        {t.dueTime ? ` · ${t.dueTime}` : ""}
                        {t.estimatedMinutes ? ` · ${t.estimatedMinutes} menit` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="aeh-muted-faint aeh-week-empty">No tasks</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------- ROADMAP (sample) ----------------------------- */

function RoadmapSample() {
  const [hoverDay, setHoverDay] = useState(null);
  const currentDay = ROADMAP_TOPICS.find((d) => d.current);
  const shown = hoverDay != null ? ROADMAP_TOPICS[hoverDay - 1] : currentDay;
  return (
    <div>
      <div className="aeh-roadmap-info">
        <span className="aeh-mono">Day {currentDay.day} of {ROADMAP_TOPICS.length}</span>
        <span className="aeh-muted">{shown.topic}</span>
      </div>
      <div className="aeh-roadmap-grid">
        {ROADMAP_TOPICS.map((d) => (
          <div
            key={d.day}
            className={`aeh-roadmap-cell ${d.done ? "aeh-roadmap-done" : ""} ${d.current ? "aeh-roadmap-current" : ""}`}
            style={{ animationDelay: `${d.day * 8}ms` }}
            onMouseEnter={() => setHoverDay(d.day)}
            onMouseLeave={() => setHoverDay(null)}
            title={`Day ${d.day} \u2014 ${d.topic}`}
          />
        ))}
      </div>
      <span className="aeh-mono aeh-muted-faint">Sample roadmap \u2014 illustrative, not tied to your task list</span>
    </div>
  );
}

/* ------------------------------- PROJECTS PAGE -------------------------------- */

function ProjectsPage({ projects, tasks, onAddProject, onToggle, onCycleStatus, onUpdate, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [roadmapOpen, setRoadmapOpen] = useState(false);

  function submitProject() {
    if (!name.trim()) return;
    onAddProject({ id: "p" + Date.now(), name: name.trim(), description: desc.trim() });
    setName("");
    setDesc("");
    setAdding(false);
  }

  return (
    <div className="aeh-page">
      <div className="aeh-home-header">
        <div className="aeh-mono">Projects</div>
        <TextButton onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : "+ New project"}</TextButton>
      </div>

      {adding && (
        <Section first label="New project">
          <input className="aeh-input" placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="aeh-input" placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} style={{ marginTop: 8 }} />
          <div style={{ marginTop: 10 }}>
            <Button onClick={submitProject} disabled={!name.trim()}>Add project</Button>
          </div>
        </Section>
      )}

      {projects.length === 0 ? (
        <Section first={!adding} label="Projects">
          <p className="aeh-muted-faint">No projects yet. Add one to start grouping tasks.</p>
        </Section>
      ) : (
        projects.map((p, i) => {
          const projTasks = tasks.filter((t) => t.category === p.name);
          const done = projTasks.filter((t) => t.status === "completed").length;
          const pct = projTasks.length ? Math.round((done / projTasks.length) * 100) : 0;
          const isOpen = expanded === p.id;
          return (
            <Section key={p.id} first={i === 0 && !adding} label={p.name}>
              {p.description ? <p className="aeh-muted">{p.description}</p> : null}
              <div className="aeh-project-progress-row">
                <div className="aeh-focus-progress">
                  <div className="aeh-line-track"><div className="aeh-line-fill" style={{ width: "100%", transform: `scaleX(${pct / 100})` }} /></div>
                  <span className="aeh-mono">{done}/{projTasks.length}</span>
                </div>
                <span className="aeh-project-status">{projTasks.length === 0 ? "No tasks yet" : done === projTasks.length ? "Complete" : `${projTasks.length - done} open`}</span>
              </div>
              <div className="aeh-inline-actions" style={{ marginTop: 10 }}>
                <TextButton muted onClick={() => setExpanded(isOpen ? null : p.id)}>{isOpen ? "Hide tasks" : "Show tasks"}</TextButton>
                {p.hasRoadmap && (
                  <TextButton muted onClick={() => setRoadmapOpen((o) => !o)}>{roadmapOpen ? "Hide roadmap" : "Show roadmap"}</TextButton>
                )}
              </div>
              {isOpen && (
                <div style={{ marginTop: 14 }}>
                  <TaskList tasks={projTasks} projects={projects} onToggle={onToggle} onCycleStatus={onCycleStatus} onUpdate={onUpdate} onDelete={onDelete} empty="No tasks linked to this project yet." />
                </div>
              )}
              {p.hasRoadmap && roadmapOpen && (
                <div style={{ marginTop: 14 }}>
                  <RoadmapSample />
                </div>
              )}
            </Section>
          );
        })
      )}
    </div>
  );
}

/* ------------------------------ REAL CONSISTENCY CHART ------------------------- */

function buildRealSeries(tasks, days) {
  const today = todayISO();
  return days.map((iso) => {
    const value = tasks.filter((t) => t.status === "completed" && t.completedAt && t.completedAt.slice(0, 10) === iso).length;
    const d = new Date(iso + "T00:00:00");
    return {
      value,
      weekday: WEEKDAY_SHORT[d.getDay()],
      dayNum: d.getDate(),
      dateLabel: WEEKDAY_SHORT[d.getDay()] + " " + d.getDate(),
      isToday: iso === today,
    };
  });
}

function RealConsistencyChart({ tasks, days }) {
  const [hover, setHover] = useState(null);
  const [pinned, setPinned] = useState(null);
  const [ripple, setRipple] = useState(null); // { index, key }
  const [drawn, setDrawn] = useState(false);
  const wrapRef = useRef(null);
  const series = buildRealSeries(tasks, days);
  const values = series.map((s) => s.value);

  const width = 640;
  const height = 148;
  const pad = { top: 14, right: 6, bottom: 22, left: 22 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxVal = Math.max.apply(null, values.concat([1]));
  const stepX = innerW / (series.length - 1 || 1);
  const yFor = (v) => pad.top + innerH - (v / maxVal) * innerH;
  const points = series.map((d, i) => ({ ...d, x: pad.left + i * stepX, y: yFor(d.value) }));
  const linePath = smoothPath(points);
  const areaPath = linePath + ` L ${points[points.length - 1].x.toFixed(2)} ${(pad.top + innerH).toFixed(2)}` +
    ` L ${points[0].x.toFixed(2)} ${(pad.top + innerH).toFixed(2)} Z`;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const best = Math.max.apply(null, values);
  const bestPoint = series.slice().reverse().find((d) => d.value === best) || series[0];
  let streak = 0;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].value > 0) streak++;
    else break;
  }

  useEffect(() => {
    setDrawn(false);
    const t = setTimeout(() => setDrawn(true), 60);
    return () => clearTimeout(t);
  }, [days.length, tasks.length]);

  function indexFromEvent(e) {
    const rect = wrapRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    let idx = Math.round((x - pad.left) / stepX);
    return Math.max(0, Math.min(series.length - 1, idx));
  }
  function handleMove(e) {
    setHover(indexFromEvent(e));
  }
  function handleClick(e) {
    const idx = indexFromEvent(e);
    setPinned((prev) => (prev === idx ? null : idx));
    setRipple({ index: idx, key: Date.now() });
  }

  const labelEvery = series.length <= 14 ? 2 : 5;
  const activeIndex = hover != null ? hover : pinned;
  const hp = activeIndex != null ? points[activeIndex] : null;
  const tooltipPct = hp ? (hp.x / width) * 100 : 0;
  const tooltipAlign = tooltipPct < 15 ? "left" : tooltipPct > 85 ? "right" : "center";
  const prevVal = activeIndex != null && activeIndex > 0 ? values[activeIndex - 1] : null;
  const delta = activeIndex != null && prevVal != null ? values[activeIndex] - prevVal : null;

  return (
    <div>
      <div className="aeh-chart-stats">
        <div className="aeh-chart-stat"><span className="aeh-mono aeh-stat-num">{avg.toFixed(1)}</span><span className="aeh-muted-faint">avg / day</span></div>
        <div className="aeh-chart-stat"><span className="aeh-mono aeh-stat-num">{best}</span><span className="aeh-muted-faint">best day \u00b7 {bestPoint.dateLabel}</span></div>
        <div className="aeh-chart-stat"><span className="aeh-mono aeh-stat-num">{streak}</span><span className="aeh-muted-faint">day streak</span></div>
      </div>

      <div className="aeh-chart-wrap" ref={wrapRef}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          preserveAspectRatio="none"
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
          onClick={handleClick}
          style={{ cursor: "pointer" }}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line x1={pad.left} x2={width - pad.right} y1={pad.top + innerH * f} y2={pad.top + innerH * f} className="aeh-chart-grid" />
              <text x={2} y={pad.top + innerH * f + 3} className="aeh-chart-axis-label">{Math.round(maxVal * (1 - f))}</text>
            </g>
          ))}
          <line x1={pad.left} x2={width - pad.right} y1={yFor(avg)} y2={yFor(avg)} className="aeh-chart-avg-line" />
          <text x={width - pad.right} y={yFor(avg) - 5} textAnchor="end" className="aeh-chart-average-label">avg</text>
          <path d={areaPath} className={`aeh-chart-area ${drawn ? "aeh-chart-area-drawn" : ""}`} fill="var(--accent)" fillOpacity="0.09" />
          <path d={linePath} className={`aeh-chart-line ${drawn ? "aeh-chart-line-drawn" : ""}`} />
          {points.map((p, i) => (
            <g key={i} className={`aeh-chart-point-group ${activeIndex === i ? "aeh-chart-point-group-active" : ""}`}>
              <circle cx={p.x} cy={p.y} r={activeIndex === i ? 5 : 2.5} className="aeh-chart-point" />
              {activeIndex === i && <circle cx={p.x} cy={p.y} r="9" className="aeh-chart-point-halo" />}
            </g>
          ))}
          {hp && <line x1={hp.x} x2={hp.x} y1={pad.top} y2={pad.top + innerH} className="aeh-chart-hoverline" />}
          {ripple && (
            <circle
              key={ripple.key}
              cx={points[ripple.index].x}
              cy={points[ripple.index].y}
              r="7"
              className="aeh-chart-ripple"
              onAnimationEnd={() => setRipple(null)}
            />
          )}
          {series.map((d, i) =>
            i % labelEvery === 0 || d.isToday ? (
              <text key={i} x={pad.left + i * stepX} y={height - 4} textAnchor="middle" className="aeh-chart-axis-label">
                {series.length <= 14 ? d.weekday : d.dayNum}
              </text>
            ) : null
          )}
        </svg>
        {hp && (
          <div className={`aeh-chart-tooltip aeh-chart-tooltip-${tooltipAlign}`} style={{ left: `${tooltipPct}%`, top: `${(hp.y / height) * 100}%` }}>
            <div className="aeh-mono aeh-chart-tooltip-date">{hp.isToday ? "Today" : hp.dateLabel}</div>
            <div className="aeh-chart-tooltip-value">
              {hp.value} task{hp.value === 1 ? "" : "s"}
              {delta != null && delta !== 0 && <span className={delta > 0 ? "aeh-delta-up" : "aeh-delta-down"}> {delta > 0 ? "+" : ""}{delta}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- ANALYTICS PAGE -------------------------------- */

function AnalyticsPage({ tasks }) {
  const [range, setRange] = useState("week");
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const pending = tasks.filter((t) => t.status !== "completed").length;
  const rate = total ? Math.round((completed / total) * 100) : 0;
  const todayCount = tasks.filter((t) => t.dueDate === todayISO());
  const todayDone = todayCount.filter((t) => t.status === "completed").length;
  const hasAnyCompleted = tasks.some((t) => t.status === "completed" && t.completedAt);

  return (
    <div className="aeh-page">
      <div className="aeh-home-header"><div className="aeh-mono">Analytics</div></div>

      {total === 0 ? (
        <Section first label="Overview">
          <p className="aeh-muted-faint">No tasks yet. Add tasks on the Today page to see statistics here.</p>
        </Section>
      ) : (
        <>
          <Section first label="Overview">
            <div className="aeh-chart-stats" style={{ marginBottom: 0 }}>
              <div className="aeh-chart-stat"><span className="aeh-mono aeh-stat-num">{completed}</span><span className="aeh-muted-faint">completed</span></div>
              <div className="aeh-chart-stat"><span className="aeh-mono aeh-stat-num">{pending}</span><span className="aeh-muted-faint">pending</span></div>
              <div className="aeh-chart-stat"><span className="aeh-mono aeh-stat-num">{rate}%</span><span className="aeh-muted-faint">completion rate</span></div>
              <div className="aeh-chart-stat"><span className="aeh-mono aeh-stat-num">{todayDone}/{todayCount.length}</span><span className="aeh-muted-faint">today</span></div>
            </div>
          </Section>

          <Section label="Consistency">
            <p className="aeh-chart-context">Completed tasks by day, based on saved task history.</p>
            <div className="aeh-chart-toggle" style={{ marginBottom: 16 }}>
              <button className={range === "today" ? "aeh-chart-toggle-active" : ""} onClick={() => setRange("today")} type="button">Today</button>
              <button className={range === "week" ? "aeh-chart-toggle-active" : ""} onClick={() => setRange("week")} type="button">Week</button>
              <button className={range === "month" ? "aeh-chart-toggle-active" : ""} onClick={() => setRange("month")} type="button">Month</button>
            </div>
            {range === "today" ? (
              <p className="aeh-muted">{todayDone} of {todayCount.length} tasks completed today.</p>
            ) : !hasAnyCompleted ? (
              <p className="aeh-muted-faint">No completed tasks yet. Finish a task to start the trend.</p>
            ) : (
              <RealConsistencyChart tasks={tasks} days={lastNDays(range === "week" ? 7 : 30)} />
            )}
          </Section>
        </>
      )}
    </div>
  );
}

/* --------------------------------- TOAST ------------------------------------- */

function useToast() {
  const [msg, setMsg] = useState(null);
  const ref = useRef(null);
  function show(text) {
    setMsg(text);
    clearTimeout(ref.current);
    ref.current = setTimeout(() => setMsg(null), 2200);
  }
  return [msg, show];
}

/* ----------------------------------- APP -------------------------------------- */

const PAGE_TITLES = { today: "Today", week: "This Week", projects: "Projects", analytics: "Analytics" };
const TASKS_KEY = "aeh_tasks_v1";
const PROJECTS_KEY = "aeh_projects_v1";

const browserStorage = {
  async get(key) {
    const value = window.localStorage.getItem(key);
    return value == null ? null : { value };
  },
  async set(key, value) {
    window.localStorage.setItem(key, value);
  },
};

export default function App() {
  const [page, setPage] = useState("today");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tasks, setTasksState] = useState([]);
  const [projects, setProjectsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState("");
  const [toast, showToast] = useToast();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let loadedTasks = null;
      let loadedProjects = null;
      try {
        const r = await browserStorage.get(TASKS_KEY);
        loadedTasks = r ? JSON.parse(r.value) : null;
      } catch (e) { /* key not found yet, or storage unavailable */ }
      try {
        const r = await browserStorage.get(PROJECTS_KEY);
        loadedProjects = r ? JSON.parse(r.value) : null;
      } catch (e) { /* key not found yet */ }
      if (cancelled) return;

      if (loadedProjects && loadedProjects.length) {
        setProjectsState(loadedProjects);
      } else {
        setProjectsState(SEED_PROJECTS);
        browserStorage.set(PROJECTS_KEY, JSON.stringify(SEED_PROJECTS)).catch(() => {});
      }
      if (loadedTasks && loadedTasks.length) {
        setTasksState(loadedTasks);
      } else {
        const seed = buildSeedTasks();
        setTasksState(seed);
        browserStorage.set(TASKS_KEY, JSON.stringify(seed)).catch(() => {});
      }
      setLoading(false);
    }
    load().catch(() => {
      if (!cancelled) {
        setStorageError("Couldn't load saved data \u2014 starting with sample tasks instead. Changes this session may not be saved.");
        setTasksState(buildSeedTasks());
        setProjectsState(SEED_PROJECTS);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  function persistTasks(next) {
    setTasksState(next);
    Promise.resolve()
      .then(() => browserStorage.set(TASKS_KEY, JSON.stringify(next)))
      .catch(() => showToast("Saved locally in this session \u2014 storage sync failed"));
  }
  function persistProjects(next) {
    setProjectsState(next);
    Promise.resolve()
      .then(() => browserStorage.set(PROJECTS_KEY, JSON.stringify(next)))
      .catch(() => showToast("Saved locally in this session \u2014 storage sync failed"));
  }

  function addTask(data) {
    const now = new Date().toISOString();
    const task = { id: "t" + Date.now() + Math.random().toString(36).slice(2, 7), status: "pending", createdAt: now, completedAt: null, ...data };
    persistTasks([...tasks, task]);
    showToast("Task added");
  }
  function updateTask(id, patch) {
    persistTasks(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    showToast("Task updated");
  }
  function deleteTask(id) {
    persistTasks(tasks.filter((t) => t.id !== id));
    showToast("Task deleted");
  }
  function toggleComplete(id) {
    const now = new Date().toISOString();
    persistTasks(
      tasks.map((t) => {
        if (t.id !== id) return t;
        const wasCompleted = t.status === "completed";
        return {
          ...t,
          status: wasCompleted ? (t.previousStatus || "pending") : "completed",
          previousStatus: wasCompleted ? undefined : t.status,
          completedAt: wasCompleted ? null : now,
        };
      })
    );
    showToast("Task updated");
  }
  function cycleStatus(id, status) {
    persistTasks(tasks.map((t) => (t.id === id ? { ...t, status } : t)));
  }
  function addProject(p) {
    persistProjects([...projects, p]);
    showToast("Project added");
  }

  if (loading) {
    return (
      <div className="aeh-app">
        <style>{STYLES}</style>
        <div className="aeh-loading-screen"><span className="aeh-mono">Loading your tasks\u2026</span></div>
      </div>
    );
  }

  return (
    <div className="aeh-app">
      <style>{STYLES}</style>
      <Atmosphere />
      <Sidebar page={page} setPage={setPage} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="aeh-main">
        <TopBar title={PAGE_TITLES[page]} onMenu={() => setMobileOpen(true)} />
        {storageError && <div className="aeh-error-banner">{storageError}</div>}
        <div className="aeh-content" key={page}>
          {page === "today" && (
            <TodayPage tasks={tasks} projects={projects} onAdd={addTask} onToggle={toggleComplete} onCycleStatus={cycleStatus} onUpdate={updateTask} onDelete={deleteTask} />
          )}
          {page === "week" && <WeekPage tasks={tasks} onToggle={toggleComplete} />}
          {page === "projects" && (
            <ProjectsPage projects={projects} tasks={tasks} onAddProject={addProject} onToggle={toggleComplete} onCycleStatus={cycleStatus} onUpdate={updateTask} onDelete={deleteTask} />
          )}
          {page === "analytics" && <AnalyticsPage tasks={tasks} />}
        </div>
      </div>
      <BottomNav page={page} setPage={setPage} />
      {toast && <div className="aeh-toast">{toast}</div>}
    </div>
  );
}

/* ----------------------------------- STYLES ------------------------------------ */

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Manrope:wght@400;500;600;700;800&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap');

.aeh-app {
  --paper: #f3f1eb;
  --paper-deep: #e9e6de;
  --surface: #fbfaf7;
  --surface-soft: #f6f4ef;
  --ink: #202724;
  --ink-soft: #59635d;
  --ink-faint: #879087;
  --rule: #d5d2c9;
  --rule-strong: #b9b8af;
  --accent: #ad6045;
  --accent-soft: #ead8d0;
  --sage: #53705d;
  --sage-soft: #dce6dd;
  --warning: #9b6d37;
  font-family: 'Manrope', system-ui, sans-serif;
  color: var(--ink);
  background: rgba(243,241,235,.94);
  min-height: 100vh;
  display: flex;
  letter-spacing: -0.012em;
}

/* ambient background */
.aeh-atmosphere {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  opacity: .92;
}
.aeh-atmosphere-glow {
  position: absolute;
  width: 520px;
  height: 520px;
  border-radius: 50%;
  filter: blur(30px);
  opacity: .20;
  background: radial-gradient(circle, rgba(173,96,69,.34) 0%, rgba(173,96,69,.10) 32%, transparent 70%);
}
.aeh-atmosphere-glow-one {
  top: 4%;
  right: 2%;
}
.aeh-atmosphere-glow-two {
  bottom: -12%;
  left: 28%;
  opacity: .13;
  transform: scale(1.25);
}
.aeh-stars {
  position: absolute;
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: rgba(32,39,36,.42);
  box-shadow:
    90px 70px rgba(32,39,36,.26),
    170px 190px rgba(32,39,36,.20),
    250px 110px rgba(32,39,36,.30),
    330px 260px rgba(32,39,36,.18),
    410px 80px rgba(32,39,36,.25),
    500px 180px rgba(32,39,36,.20),
    590px 40px rgba(32,39,36,.28),
    680px 230px rgba(32,39,36,.18),
    760px 120px rgba(32,39,36,.25),
    850px 310px rgba(32,39,36,.20),
    940px 70px rgba(32,39,36,.25),
    1030px 210px rgba(32,39,36,.18),
    1120px 100px rgba(32,39,36,.26),
    1210px 290px rgba(32,39,36,.18),
    1300px 150px rgba(32,39,36,.24),
    1390px 350px rgba(32,39,36,.18),
    1480px 90px rgba(32,39,36,.25),
    1570px 250px rgba(32,39,36,.18),
    1650px 130px rgba(32,39,36,.22),
    180px 520px rgba(32,39,36,.18),
    310px 640px rgba(32,39,36,.24),
    450px 560px rgba(32,39,36,.16),
    610px 720px rgba(32,39,36,.22),
    760px 590px rgba(32,39,36,.17),
    920px 700px rgba(32,39,36,.23),
    1080px 540px rgba(32,39,36,.18),
    1240px 660px rgba(32,39,36,.22),
    1410px 560px rgba(32,39,36,.16),
    1530px 720px rgba(32,39,36,.22),
    1600px 480px rgba(32,39,36,.17);
  animation: aeh-twinkle 5s ease-in-out infinite alternate;
}
.aeh-stars-one {
  top: 0;
  left: 230px;
}
.aeh-stars-two {
  top: 80px;
  left: 0;
  opacity: .55;
  transform: scale(.7);
  animation-delay: -2s;
}
@keyframes aeh-twinkle {
  from { opacity: .45; transform: scale(.92); }
  to { opacity: .82; transform: scale(1.06); }
}
.aeh-constellation {
  position: absolute;
  top: 170px;
  right: 9%;
  width: 260px;
  height: 210px;
  opacity: .28;
}
.aeh-constellation-dot {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 14px rgba(173,96,69,.28);
}
.aeh-constellation .dot-a { left: 18px; top: 90px; }
.aeh-constellation .dot-b { left: 104px; top: 38px; }
.aeh-constellation .dot-c { left: 184px; top: 92px; }
.aeh-constellation .dot-d { left: 132px; top: 166px; }
.aeh-constellation-line {
  position: absolute;
  height: 1px;
  transform-origin: left center;
  background: linear-gradient(90deg, rgba(173,96,69,.6), rgba(173,96,69,.05));
}
.aeh-constellation .line-a {
  width: 100px;
  left: 23px;
  top: 93px;
  transform: rotate(-31deg);
}
.aeh-constellation .line-b {
  width: 96px;
  left: 109px;
  top: 41px;
  transform: rotate(34deg);
}
.aeh-constellation .line-c {
  width: 91px;
  left: 136px;
  top: 169px;
  transform: rotate(-48deg);
}
.aeh-sidebar,
.aeh-main,
.aeh-bottom-nav,
.aeh-toast {
  position: relative;
  z-index: 1;
}
.aeh-app * { box-sizing: border-box; }
.aeh-app ::selection { background: var(--ink); color: var(--paper); }
.aeh-app ::-webkit-scrollbar { width: 10px; height: 10px; }
.aeh-app ::-webkit-scrollbar-track { background: var(--paper-deep); }
.aeh-app ::-webkit-scrollbar-thumb { background: var(--rule-strong); border: 3px solid var(--paper-deep); border-radius: 9px; }
.aeh-mono { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: .025em; }
.aeh-muted { color: var(--ink-soft); font-size: 14px; line-height: 1.55; }
.aeh-muted-faint { color: var(--ink-faint); font-size: 12px; }
.aeh-loading-screen { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--ink-soft); }
.aeh-error-banner { max-width: 1040px; margin: 0 auto; padding: 14px 48px 0; color: var(--accent); font-size: 12.5px; }

/* shell */
.aeh-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.aeh-content { padding: 46px 48px 120px; max-width: 1240px; width: 100%; margin: 0 auto; animation: aeh-page-in .42s cubic-bezier(.2,.8,.2,1); }
.aeh-content::after {
  content: "EXECUTE  •  BUILD  •  REPEAT";
  position: fixed;
  right: 42px;
  bottom: 54px;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font: 500 9px 'IBM Plex Mono', monospace;
  letter-spacing: .18em;
  color: rgba(89,99,93,.26);
  pointer-events: none;
}

@keyframes aeh-page-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

/* navigation */
.aeh-sidebar { width: 250px; flex-shrink: 0; background: var(--paper-deep); border-right: 1px solid var(--rule); display: flex; flex-direction: column; padding: 31px 22px 24px; position: sticky; top: 0; height: 100vh; z-index: 30; }
.aeh-brand { display: flex; align-items: center; padding: 4px 9px 54px; }
.aeh-brand-name { font-family: 'Newsreader', Georgia, serif; font-size: 25px; line-height: 1; font-weight: 500; letter-spacing: -.04em; color: var(--ink); }
.aeh-brand-name::after { content: ''; display: inline-block; width: 6px; height: 6px; margin: 0 0 3px 5px; background: var(--accent); border-radius: 50%; }
.aeh-mobile-close { display: none; margin-left: auto; }
.aeh-nav { position: relative; display: flex; flex-direction: column; flex: 1; gap: 2px; }
.aeh-nav-indicator { position: absolute; left: -22px; top: 0; width: 3px; height: 40px; margin-top: 0; background: var(--accent); transition: transform .32s cubic-bezier(.2,.8,.2,1); }
.aeh-nav-item { display: flex; align-items: center; gap: 12px; height: 40px; padding: 0 10px; border: 0; border-radius: 3px; background: transparent; color: var(--ink-soft); font-size: 13px; font-weight: 600; cursor: pointer; text-align: left; font-family: inherit; transition: color .18s ease, background .18s ease, transform .18s ease; width: 100%; }
.aeh-nav-item:hover { color: var(--ink); background: rgba(255,255,255,.42); transform: translateX(2px); }
.aeh-nav-item-active { color: var(--ink); background: rgba(255,255,255,.55); }
.aeh-sidebar-footer { display: flex; align-items: center; justify-content: space-between; padding: 16px 9px 0; border-top: 1px solid var(--rule); }
.aeh-streak-text { color: var(--sage); }
.aeh-streak-text::before { content: ''; display: inline-block; width: 6px; height: 6px; margin: 0 7px 1px 0; border-radius: 50%; background: var(--sage); }
.aeh-icon-btn { min-width: 32px; min-height: 32px; justify-content: center; background: transparent; border: 0; color: var(--ink-faint); cursor: pointer; padding: 6px; display: flex; border-radius: 3px; transition: color .15s ease, background .15s ease; }
.aeh-icon-btn:hover { color: var(--ink); background: rgba(255,255,255,.48); }
.aeh-scrim { display: none; }

/* header */
.aeh-topbar { display: flex; align-items: center; gap: 14px; padding: 27px 48px 0; max-width: 1040px; width: 100%; margin: 0 auto; }
.aeh-mobile-menu { display: none; }
.aeh-page-title { font-family: 'Newsreader', Georgia, serif; font-size: 29px; line-height: 1; letter-spacing: -.045em; font-weight: 500; margin: 0; }
.aeh-avatar { margin-left: auto; width: 32px; height: 32px; border: 1px solid var(--rule-strong); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--ink-soft); }

/* focus */
.aeh-focus-block { padding: 0 0 34px; border-bottom: 1px solid var(--rule); margin-bottom: 34px; }
.aeh-focus-kicker { color: var(--accent); font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 13px; }
.aeh-focus-content { display: flex; justify-content: space-between; align-items: end; gap: 24px; }
.aeh-focus-content h2 { font-family: 'Newsreader', Georgia, serif; font-size: clamp(30px, 4vw, 48px); font-weight: 500; letter-spacing: -.05em; line-height: 1.03; max-width: 690px; margin: 0; }
.aeh-focus-content p { color: var(--ink-soft); font-size: 13px; margin: 13px 0 0; }
.aeh-focus-action { min-height: 42px; color: var(--surface); background: var(--ink); border: 0; border-radius: 3px; padding: 11px 16px; font: 700 12px 'Manrope', sans-serif; cursor: pointer; white-space: nowrap; transition: background .2s ease, transform .2s ease; }
.aeh-focus-action:hover { background: var(--accent); transform: translateY(-1px); }
.aeh-focus-empty { color: var(--ink-soft); margin: 0; font-size: 14px; }

/* sections */
.aeh-section { padding: 35px 0; border-top: 1px solid var(--rule); animation: aeh-section-in .45s cubic-bezier(.2,.8,.2,1) both; }
.aeh-section:nth-child(2) { animation-delay: .04s; }
.aeh-section:nth-child(3) { animation-delay: .08s; }
.aeh-section:nth-child(4) { animation-delay: .12s; }
.aeh-section:nth-child(5) { animation-delay: .16s; }
@keyframes aeh-section-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.aeh-section-first { border-top: 0; padding-top: 0; }
.aeh-section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 17px; }
.aeh-section-label { font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 500; letter-spacing: .07em; text-transform: uppercase; color: var(--ink-soft); }

/* hierarchy refinements */
.aeh-focus-kicker { display: flex; align-items: center; gap: 9px; }
.aeh-focus-rule { display: inline-block; width: 25px; height: 1px; background: var(--accent); }
.aeh-project-progress-row { display: flex; align-items: center; gap: 18px; }
.aeh-project-progress-row .aeh-focus-progress { flex: 1; }
.aeh-project-status { min-width: 75px; color: var(--ink-soft); font-size: 12px; text-align: right; }
.aeh-chart-context { color: var(--ink-soft); font-size: 12px; margin: -5px 0 18px; }

/* controls */
.aeh-textbtn { min-height: 32px; background: transparent; border: 0; color: var(--ink); font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; padding: 4px 0; font-family: inherit; transition: color .15s ease; }
.aeh-textbtn:hover { color: var(--accent); }
.aeh-textbtn-muted { color: var(--ink-faint); font-weight: 600; }
.aeh-textbtn-muted:hover { color: var(--ink); }
.aeh-textbtn:disabled { opacity: .5; cursor: not-allowed; }
.aeh-btn { min-height: 42px; border-radius: 3px; border: 1px solid transparent; font-size: 12.5px; font-weight: 800; padding: 10px 17px; cursor: pointer; font-family: inherit; transition: background .18s ease, color .18s ease, transform .18s ease, border-color .18s ease; white-space: nowrap; }
.aeh-btn-full { width: 100%; }
.aeh-btn-primary { background: var(--ink); color: var(--surface); }
.aeh-btn-primary:hover:not(:disabled) { background: var(--accent); transform: translateY(-1px); }
.aeh-btn-ghost { background: transparent; border-color: var(--rule-strong); color: var(--ink-soft); }
.aeh-btn-ghost:hover:not(:disabled) { border-color: var(--ink); color: var(--ink); }
.aeh-btn:disabled { opacity: .5; cursor: not-allowed; }
.aeh-btn:active:not(:disabled) { transform: scale(.98); }
.aeh-btn:focus-visible, .aeh-textbtn:focus-visible, .aeh-nav-item:focus-visible, .aeh-icon-btn:focus-visible, .aeh-focus-action:focus-visible, .aeh-check:focus-visible, .aeh-input:focus-visible, .aeh-select:focus-visible, .aeh-week-task:focus-visible, .aeh-chart-toggle button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.aeh-inline-actions { display: flex; align-items: center; gap: 15px; flex-wrap: wrap; }

/* forms */
.aeh-input, .aeh-select { background: var(--surface); border: 1px solid var(--rule-strong); border-radius: 3px; color: var(--ink); padding: 12px 13px; font-family: inherit; font-size: 13.5px; color-scheme: light; flex: 1; min-width: 0; transition: border-color .18s ease, background .18s ease, box-shadow .18s ease; }
.aeh-input::placeholder { color: var(--ink-faint); }
.aeh-input:focus, .aeh-select:focus { outline: none; border-color: var(--ink); background: var(--surface); box-shadow: 0 0 0 3px rgba(32,39,36,.08); }
.aeh-input-narrow { flex: 0 0 100px; }
.aeh-form-row { display: flex; gap: 9px; }
.aeh-manual-form { display: flex; flex-direction: column; }
.aeh-field-error { color: var(--accent); font-size: 12.5px; margin-top: 9px; }

/* quick add */
.aeh-quickadd { padding: 16px 0 0; border-top: 2px solid var(--ink); }

/* completed archive */
.aeh-completed-archive { padding: 38px 0 0; margin-top: 18px; border-top: 1px solid var(--rule); }
.aeh-completed-head { display: flex; justify-content: space-between; align-items: end; gap: 18px; margin-bottom: 27px; }
.aeh-completed-head h2 { font-family: 'Newsreader', Georgia, serif; font-weight: 500; font-size: 28px; letter-spacing: -.04em; margin: 0; }
.aeh-completed-head h2 span { color: var(--ink-soft); font-family: 'IBM Plex Mono', monospace; font-size: 13px; vertical-align: middle; margin-left: 5px; }
.aeh-completed-head p { color: var(--ink-soft); font-size: 12px; margin: 6px 0 0; }
.aeh-completed-sort { display: flex; align-items: center; gap: 8px; color: var(--ink-faint); font: 11px 'IBM Plex Mono', monospace; }
.aeh-completed-sort select { appearance: none; background: transparent; border: 0; color: var(--ink); font: 600 11px 'IBM Plex Mono', monospace; padding: 7px 18px 7px 0; cursor: pointer; }
.aeh-completed-sort select:focus { outline: 2px solid var(--accent); outline-offset: 3px; }
.aeh-completed-group { margin-bottom: 27px; }
.aeh-completed-group-label { color: var(--ink-soft); font: 11px 'IBM Plex Mono', monospace; margin-bottom: 8px; }
.aeh-completed-group-label span { color: var(--ink-faint); }
.aeh-completed-table-head, .aeh-completed-row { display: grid; grid-template-columns: 32px minmax(200px, 1.6fr) minmax(120px, .85fr) minmax(120px, 1fr) 58px minmax(72px, auto); column-gap: 14px; align-items: center; }
.aeh-completed-table-head { color: var(--ink-faint); font: 10px 'IBM Plex Mono', monospace; text-transform: uppercase; letter-spacing: .05em; padding: 0 5px 8px; border-bottom: 1px solid var(--rule); }
.aeh-completed-row { min-height: 51px; padding: 8px 5px; border-bottom: 1px solid rgba(213,210,201,.58); transition: background .18s ease; }
.aeh-completed-row:hover { background: rgba(255,255,255,.45); }
.aeh-completed-check { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--sage); border-radius: 50%; color: var(--surface); background: var(--sage); cursor: pointer; transition: transform .18s ease, background .18s ease; }
.aeh-completed-check:hover { transform: scale(1.08); background: var(--ink); }
.aeh-completed-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-soft); font-size: 12.5px; text-decoration: line-through; text-decoration-color: var(--ink-faint); text-decoration-thickness: 1px; }
.aeh-completed-date, .aeh-completed-project, .aeh-completed-time { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-soft); font-size: 11.5px; }
.aeh-completed-project::before { content: ''; display: inline-block; width: 6px; height: 6px; margin: 0 7px 1px 0; border-radius: 50%; background: var(--rule-strong); }
.aeh-completed-time { font-family: 'IBM Plex Mono', monospace; color: var(--ink-faint); text-align: right; }
.aeh-completed-actions { display: flex; gap: 11px; justify-content: flex-end; opacity: 0; transition: opacity .18s ease; }
.aeh-completed-row:hover .aeh-completed-actions, .aeh-completed-row:focus-within .aeh-completed-actions { opacity: 1; }
.aeh-completed-empty { padding: 18px 0; color: var(--ink-faint); font-size: 13px; }
.aeh-completed-edit-row { padding: 16px; border: 1px solid var(--rule-strong); background: var(--surface); }

/* tasks */
.aeh-task-list { display: flex; flex-direction: column; gap: 0; }
.aeh-task-row { position: relative; overflow: hidden; display: flex; gap: 14px; padding: 15px 3px; margin: 0; background: transparent; border-bottom: 1px solid var(--rule); transition: background .18s ease, border-color .18s ease, transform .18s ease; }
.aeh-task-row:hover { background: rgba(255,255,255,.42); border-color: var(--rule-strong); }
.aeh-task-row-editing { background: var(--surface); padding: 17px; border: 1px solid var(--rule-strong); }
.aeh-task-row-clicked { animation: aeh-task-click .52s cubic-bezier(.2,.8,.2,1) both !important; border-color: var(--accent) !important; }
@keyframes aeh-task-click { 0% { transform: scale(1); } 28% { transform: scale(.992); } 58% { transform: scale(1.006); } 100% { transform: scale(1); } }
.aeh-task-row-clicked::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; animation: aeh-task-sweep .52s ease-out both; }
@keyframes aeh-task-sweep { 0% { background: rgba(173,96,69,0); opacity: 0; } 35% { background: rgba(173,96,69,.09); opacity: 1; } 100% { background: rgba(173,96,69,0); opacity: 0; } }
.aeh-task-row:nth-child(2) { animation-delay: .04s; }
.aeh-task-row:nth-child(3) { animation-delay: .08s; }
.aeh-task-row:nth-child(4) { animation-delay: .12s; }
.aeh-task-row:nth-child(5) { animation-delay: .16s; }
.aeh-check { width: 28px; height: 28px; min-width: 28px; min-height: 28px; flex: 0 0 28px; aspect-ratio: 1 / 1; align-items: center; justify-content: center; background: transparent; border: 1px solid var(--rule-strong); color: var(--ink-faint); padding: 0; margin-top: 1px; cursor: pointer; display: flex; border-radius: 50%; transition: color .15s ease, border-color .15s ease, transform .15s ease, background .15s ease; }
.aeh-check:hover { color: var(--ink); border-color: var(--ink); transform: scale(1.05); }
.aeh-task-row-done .aeh-check { color: var(--surface); background: var(--sage); border-color: var(--sage); animation: aeh-check-pop .3s ease; }
@keyframes aeh-check-pop { 0% { transform: scale(.78); opacity: .55; } 55% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
.aeh-task-body { flex: 1; min-width: 0; }
.aeh-task-title-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.aeh-task-title { font-size: 14px; font-weight: 700; letter-spacing: -.015em; text-decoration-color: transparent; text-decoration-thickness: 1px; transition: color .42s ease, text-decoration-color .42s ease; }
.aeh-strike { text-decoration-line: line-through; text-decoration-color: var(--ink-faint); color: var(--ink-faint); font-weight: 500; }
.aeh-task-priority { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--accent); flex-shrink: 0; text-transform: uppercase; letter-spacing: .04em; }
.aeh-task-desc { font-size: 13px; color: var(--ink-soft); margin: 5px 0 0; line-height: 1.5; }
.aeh-task-meta { display: flex; flex-wrap: wrap; gap: 9px 14px; font-size: 11px; color: var(--ink-faint); margin-top: 8px; }
.aeh-overdue-text { color: var(--accent); }
.aeh-status-tag { color: var(--sage); }
.aeh-task-row-overdue { border-color: var(--accent-soft); }

/* daily rhythm */
.aeh-home-header { display: flex; align-items: end; justify-content: space-between; margin-bottom: 38px; gap: 20px; color: var(--ink-soft); }
.aeh-home-header > div:first-child { display: grid; gap: 7px; }
.aeh-home-header .aeh-mono { color: var(--ink-soft); text-transform: uppercase; letter-spacing: .08em; }
.aeh-focus-progress { display: flex; align-items: center; gap: 10px; min-width: 180px; }
.aeh-line-track { flex: 1; height: 5px; border-radius: 3px; background: var(--rule); overflow: hidden; }
.aeh-line-fill { height: 100%; border-radius: inherit; background: var(--sage); transform-origin: left center; transition: transform .55s cubic-bezier(.2,.8,.2,1); }

/* roadmap */
.aeh-roadmap-info { display: flex; align-items: baseline; gap: 12px; margin-bottom: 13px; }
.aeh-roadmap-grid { display: grid; grid-template-columns: repeat(15, 1fr); gap: 5px; margin-bottom: 12px; }
.aeh-roadmap-cell { aspect-ratio: 1; border-radius: 2px; border: 1px solid var(--rule); background: transparent; cursor: default; opacity: 0; transform: scale(.5); animation: aeh-cell-in .3s ease forwards; transition: border-color .15s ease, background .15s ease, transform .15s ease; }
.aeh-roadmap-cell:hover { transform: scale(1.12); }
@keyframes aeh-cell-in { to { opacity: 1; transform: scale(1); } }
.aeh-roadmap-done { background: var(--sage-soft); border-color: var(--sage-soft); }
.aeh-roadmap-current { border-color: var(--accent); position: relative; background: var(--accent-soft); }
.aeh-roadmap-current::after { content: ''; position: absolute; inset: -3px; border: 1px solid var(--accent); border-radius: 2px; opacity: .55; animation: aeh-pulse-ring 2s ease-in-out infinite; }
@keyframes aeh-pulse-ring { 0%, 100% { opacity: .25; } 50% { opacity: .65; } }

/* week */
.aeh-week-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 14px; }
.aeh-week-col { min-width: 0; border-top: 1px solid var(--rule); padding: 13px 4px 0; }
.aeh-week-col-today { border-top: 2px solid var(--accent); }
.aeh-week-col-head { display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 800; margin-bottom: 12px; }
.aeh-week-col-today .aeh-week-col-head span:first-child { color: var(--accent); }
.aeh-week-tasks { display: flex; flex-direction: column; gap: 6px; }
.aeh-week-task { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; background: transparent; border: 0; border-left: 2px solid var(--rule); padding: 4px 0 4px 8px; font-size: 11px; line-height: 1.35; text-align: left; color: var(--ink); cursor: pointer; font-family: inherit; width: 100%; transition: border-color .15s ease, color .15s ease; }
.aeh-week-task:hover { border-color: var(--accent); color: var(--accent); }
.aeh-week-task-done { color: var(--ink-faint); text-decoration: line-through; }
.aeh-week-empty { margin: 0; }

/* analytics */
.aeh-chart-stats { display: flex; align-items: flex-end; gap: 30px; margin-bottom: 23px; flex-wrap: wrap; }
.aeh-chart-stat { display: flex; flex-direction: column; gap: 5px; padding-left: 18px; border-left: 1px solid var(--rule); }
.aeh-chart-stat:first-child { padding-left: 0; border-left: 0; }
.aeh-stat-num { font-size: 22px; font-weight: 700; line-height: 1; color: var(--ink); }
.aeh-chart-toggle { display: flex; gap: 3px; background: var(--paper-deep); border: 1px solid var(--rule); border-radius: 3px; padding: 3px; width: fit-content; }
.aeh-chart-toggle button { min-height: 30px; background: transparent; border: 0; color: var(--ink-soft); font-size: 11px; font-weight: 700; font-family: 'IBM Plex Mono', monospace; padding: 5px 11px; border-radius: 2px; cursor: pointer; transition: background .15s ease, color .15s ease; }
.aeh-chart-toggle-active { background: var(--surface); color: var(--ink) !important; box-shadow: 0 1px 2px rgba(32,39,36,.08); }
.aeh-chart-wrap { width: 100%; position: relative; padding: 16px 0 8px; background: var(--surface); border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); }
.aeh-chart-wrap svg { display: block; overflow: visible; }
.aeh-chart-grid { stroke: var(--rule); stroke-width: 1; }
.aeh-chart-axis-label { fill: var(--ink-faint); font-size: 9.5px; font-family: 'IBM Plex Mono', monospace; }
.aeh-chart-average-label { fill: var(--ink-faint); font-size: 9px; font-family: 'IBM Plex Mono', monospace; letter-spacing: .06em; text-transform: uppercase; }
.aeh-chart-avg-line { stroke: var(--rule-strong); stroke-width: 1; stroke-dasharray: 3 4; }
.aeh-chart-area { opacity: 0; transition: opacity .8s ease .25s; }
.aeh-chart-area-drawn { opacity: 1; }
.aeh-chart-line { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linecap: round; stroke-dasharray: 1400; stroke-dashoffset: 1400; transition: stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1); }
.aeh-chart-line-drawn { stroke-dashoffset: 0; }
.aeh-chart-hoverline { stroke: var(--accent); stroke-width: 1; stroke-dasharray: 2 5; opacity: .6; }
.aeh-chart-point { fill: var(--surface); stroke: var(--accent); stroke-width: 1.4; opacity: .75; transition: r .15s ease, opacity .15s ease; }
.aeh-chart-point-active { opacity: 1; fill: var(--accent); }
.aeh-chart-point-group { transition: transform .22s ease; transform-origin: center; }
.aeh-chart-point-group-active { transform: scale(1.16); }
.aeh-chart-point-halo { fill: none; stroke: var(--accent); stroke-width: 1; opacity: .3; animation: aeh-point-breathe 1.8s ease-in-out infinite; }
@keyframes aeh-point-breathe { 0%, 100% { opacity: .15; } 50% { opacity: .5; } }
.aeh-chart-ripple { fill: none; stroke: var(--accent); stroke-width: 1.5; opacity: .5; pointer-events: none; transform-box: fill-box; transform-origin: center; animation: aeh-ripple .5s ease-out forwards; }
@keyframes aeh-ripple { from { transform: scale(.3); opacity: .5; } to { transform: scale(2.6); opacity: 0; } }
.aeh-chart-tooltip { position: absolute; transform: translate(-50%, -130%); background: var(--ink); color: var(--surface); border-radius: 3px; padding: 8px 11px; box-shadow: 0 8px 18px rgba(32,39,36,.18); pointer-events: none; white-space: nowrap; }
.aeh-chart-tooltip-left { transform: translate(0, -130%); }
.aeh-chart-tooltip-right { transform: translate(-100%, -130%); }
.aeh-chart-tooltip-date { color: var(--paper-deep); font-size: 10.5px; margin-bottom: 3px; }
.aeh-chart-tooltip-value { font-size: 12.5px; font-weight: 700; }
.aeh-delta-up { color: #b9d0bb; font-weight: 700; }
.aeh-delta-down { color: #e4b0a1; font-weight: 700; }

/* feedback */
.aeh-toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); background: var(--ink); color: var(--surface); font-size: 12px; font-weight: 700; padding: 10px 15px; border-radius: 3px; z-index: 50; box-shadow: 0 8px 18px rgba(32,39,36,.18); animation: aeh-toast-in .2s ease; }
@keyframes aeh-toast-in { from { opacity: 0; transform: translate(-50%, 6px); } to { opacity: 1; transform: translate(-50%, 0); } }
.aeh-bottom-nav { display: none; }

/* mobile */
@media (max-width: 980px) {
  .aeh-sidebar { width: 220px; }
  .aeh-content, .aeh-topbar { padding-left: 30px; padding-right: 30px; }
}
@media (max-width: 860px) {
  .aeh-sidebar { position: fixed; left: 0; top: 0; transform: translateX(-100%); transition: transform .28s ease; }
  .aeh-sidebar-open { transform: translateX(0); box-shadow: 12px 0 28px rgba(32,39,36,.16); }
  .aeh-scrim { display: block; position: fixed; inset: 0; background: rgba(32,39,36,.24); z-index: 25; }
  .aeh-mobile-close, .aeh-mobile-menu { display: flex; }
  .aeh-content { padding: 29px 20px 112px; }
  .aeh-topbar { padding: 20px 20px 0; }
  .aeh-error-banner { padding: 10px 20px 0; }
  .aeh-bottom-nav { display: flex; position: fixed; bottom: 0; left: 0; right: 0; background: var(--paper-deep); border-top: 1px solid var(--rule); padding: 8px 4px calc(env(safe-area-inset-bottom, 0px) + 6px); z-index: 20; }
  .aeh-bottom-nav-item { min-height: 44px; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; background: transparent; border: 0; color: var(--ink-faint); font-size: 10px; font-weight: 700; padding: 6px 2px; cursor: pointer; font-family: inherit; }
  .aeh-bottom-nav-item-active { color: var(--accent); }
  .aeh-roadmap-grid { grid-template-columns: repeat(10, 1fr); }
  .aeh-week-grid { grid-template-columns: repeat(4, 1fr); row-gap: 24px; }
}
.aeh-completed-table-head { display: none; }
  .aeh-completed-row { grid-template-columns: 30px minmax(0, 1fr) auto; column-gap: 10px; padding: 11px 2px; }
  .aeh-completed-date, .aeh-completed-project { grid-column: 2; font-size: 10.5px; }
  .aeh-completed-date { margin-top: -2px; }
  .aeh-completed-project { grid-column: 2; }
  .aeh-completed-time { grid-column: 3; grid-row: 1 / span 2; }
  .aeh-completed-actions { grid-column: 2 / span 2; justify-content: flex-start; opacity: 1; }
  .aeh-completed-head { align-items: flex-start; flex-direction: column; }
  .aeh-completed-sort { align-self: flex-start; }
@media (max-width: 560px) {
  .aeh-home-header { align-items: flex-start; flex-direction: column; margin-bottom: 30px; }
  .aeh-focus-progress { width: 100%; }
  .aeh-focus-content { align-items: flex-start; flex-direction: column; gap: 18px; }
  .aeh-focus-content h2 { font-size: 34px; }
  .aeh-focus-action { width: 100%; }
  .aeh-task-title-row { flex-direction: column; align-items: flex-start; gap: 4px; }
  .aeh-form-row { flex-direction: column; }
  .aeh-input-narrow { flex: 1; }
  .aeh-week-grid { grid-template-columns: repeat(2, 1fr); }
  .aeh-chart-stats { gap: 18px; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; }
}
`;

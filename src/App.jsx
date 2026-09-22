import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { CheckSquare, CalendarDays, Compass, LineChart as LineChartIcon, Circle, CheckCircle2, Menu, PanelLeftClose, Settings } from "lucide-react";

/* ============================================================================
   EXECUTION HUB — daily to-do list, v4 (editorial redesign)
   Same state, CRUD, persistence, parser integration and pages as v3.
   Presentation layer rebuilt as a paper-toned personal execution journal:
   one reading column, serif headings, hairline rules instead of cards.
============================================================================ */

/* ------------------------------- DATE HELPERS ------------------------------- */
/* All dates are LOCAL calendar dates. (toISOString() is UTC and shifts the day
   for anyone east/west of Greenwich, e.g. Batam UTC+7.) */

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}
function todayISO() {
  return toISO(new Date());
}
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toISO(d);
}
/* Local calendar day of a stored timestamp. */
function dayOf(stamp) {
  if (!stamp) return "";
  const d = new Date(stamp);
  return isNaN(d.getTime()) ? String(stamp).slice(0, 10) : toISO(d);
}
function stampAt(iso, hhmm) {
  return new Date(iso + "T" + hhmm + ":00").toISOString();
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
  const days = [];
  for (let i = 0; i < 7; i++) {
    days.push(toISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset + i)));
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
    { id: "seed5", title: "Membaca dan merapikan catatan", description: "", priority: "Low", category: "", dueDate: today, dueTime: "", estimatedMinutes: 30, status: "completed", createdAt: now, completedAt: stampAt(today, "09:00") },
    { id: "seed6", title: "Workout", description: "", priority: "Low", category: "", dueDate: today, dueTime: "", estimatedMinutes: 45, status: "pending", createdAt: now, completedAt: null },
    { id: "seed7", title: "Menyelesaikan satu bagian project", description: "", priority: "High", category: "Freelance Project", dueDate: tomorrow, dueTime: "", estimatedMinutes: 90, status: "pending", createdAt: now, completedAt: null },
    { id: "seed8", title: "Setup testing environment", description: "", priority: "Medium", category: "AI WhatsApp Bot", dueDate: yesterday, dueTime: "", estimatedMinutes: 40, status: "pending", createdAt: now, completedAt: null },
    { id: "seed9", title: "Variables & data types practice", description: "", priority: "Medium", category: "30 Day Python Roadmap", dueDate: addDays(today, -2), dueTime: "", estimatedMinutes: 50, status: "completed", createdAt: now, completedAt: stampAt(addDays(today, -2), "10:00") },
    { id: "seed10", title: "Control flow practice", description: "", priority: "Medium", category: "30 Day Python Roadmap", dueDate: addDays(today, -3), dueTime: "", estimatedMinutes: 40, status: "completed", createdAt: now, completedAt: stampAt(addDays(today, -3), "10:00") },
    { id: "seed11", title: "Client call prep", description: "", priority: "High", category: "Freelance Project", dueDate: addDays(today, -4), dueTime: "", estimatedMinutes: 30, status: "completed", createdAt: now, completedAt: stampAt(addDays(today, -4), "10:00") },
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

const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };

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

/* -------------------------------- PRIMITIVES -------------------------------- */

function Section({ label, action, children, first = false }) {
  return (
    <section className={`aeh-section ${first ? "aeh-section-first" : ""}`}>
      <div className="aeh-section-head">
        <h2 className="aeh-section-label">{label}</h2>
        <span className="aeh-section-rule" aria-hidden="true" />
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
function Segmented({ options, value, onChange, label }) {
  return (
    <div className="aeh-segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={value === o.value ? "aeh-segmented-active" : ""}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
function Progress({ pct, text, label }) {
  return (
    <div className="aeh-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className="aeh-line-track"><div className="aeh-line-fill" style={{ transform: `scaleX(${pct / 100})` }} /></div>
      <span className="aeh-mono">{text}</span>
    </div>
  );
}
function Figure({ value, label, small = false }) {
  return (
    <div className={`aeh-figure ${small ? "aeh-figure-sm" : ""}`}>
      <span className="aeh-figure-num">{value}</span>
      <span className="aeh-figure-label">{label}</span>
    </div>
  );
}

/* --------------------------------- QUICK ADD --------------------------------- */

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
      <Segmented
        label="Add mode"
        value={mode}
        onChange={setMode}
        options={[{ value: "ai", label: "Quick add" }, { value: "manual", label: "Manual" }]}
      />

      {mode === "ai" ? (
        <div>
          <div className="aeh-form-row">
            <input
              className="aeh-input"
              aria-label="Describe the task"
              placeholder='e.g. "Continue AI WhatsApp bot, high priority, tomorrow 7pm"'
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !busy) handleAISubmit(); }}
            />
            <Button onClick={handleAISubmit} disabled={busy || !text.trim()}>{busy ? "Reading…" : "Add"}</Button>
          </div>
          {error && (
            <div className="aeh-field-error" role="alert">
              {error} <TextButton onClick={() => setMode("manual")}>Add manually</TextButton>
            </div>
          )}
          <p className="aeh-helper">Uses the task parser service when your backend is connected.</p>
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
      <input
        className="aeh-input"
        aria-label="Task title"
        placeholder="Task title"
        value={form.title}
        onChange={(e) => set("title", e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
      />
      <input className="aeh-input" aria-label="Description" placeholder="Description (optional)" value={form.description} onChange={(e) => set("description", e.target.value)} />
      <div className="aeh-form-row">
        <select className="aeh-select" aria-label="Priority" value={form.priority} onChange={(e) => set("priority", e.target.value)}>
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </select>
        <select className="aeh-select" aria-label="Project" value={form.category} onChange={(e) => set("category", e.target.value)}>
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </select>
      </div>
      <div className="aeh-form-row">
        <input type="date" className="aeh-input" aria-label="Due date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
        <input type="time" className="aeh-input" aria-label="Due time" value={form.dueTime} onChange={(e) => set("dueTime", e.target.value)} />
        <input type="number" min="0" className="aeh-input aeh-input-narrow" aria-label="Estimated minutes" placeholder="Minutes" value={form.estimatedMinutes} onChange={(e) => set("estimatedMinutes", e.target.value)} />
      </div>
      <div className="aeh-inline-actions aeh-form-actions">
        <Button onClick={submit} disabled={!form.title.trim()}>{submitLabel}</Button>
        <TextButton muted onClick={onCancel}>Cancel</TextButton>
      </div>
    </div>
  );
}

/* ----------------------------------- NAV ------------------------------------- */

const NAV_ITEMS = [
  { key: "today", label: "Today", icon: CheckSquare },
  { key: "week", label: "This Week", icon: CalendarDays },
  { key: "projects", label: "Projects", icon: Compass },
  { key: "analytics", label: "Analytics", icon: LineChartIcon },
];
const NAV_ITEM_H = 42; /* 40px item + 2px gap — keep in sync with CSS */

function Sidebar({ page, setPage, mobileOpen, setMobileOpen, onCollapse }) {
  const activeIndex = NAV_ITEMS.findIndex((n) => n.key === page);
  return (
    <>
      {mobileOpen && <div className="aeh-scrim" onClick={() => setMobileOpen(false)} />}
      <aside className={`aeh-sidebar ${mobileOpen ? "aeh-sidebar-open" : ""}`} aria-label="Primary">
        <div className="aeh-brand">
          <span className="aeh-brand-name">APEX</span>
          <button className="aeh-icon-btn aeh-sidebar-close" onClick={() => { setMobileOpen(false); onCollapse(); }} aria-label="Close sidebar">
            <PanelLeftClose size={17} strokeWidth={1.6} />
          </button>
        </div>
        <nav className="aeh-nav">
          <span className="aeh-nav-indicator" aria-hidden="true" style={{ transform: `translateY(${activeIndex * NAV_ITEM_H}px)` }} />
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`aeh-nav-item ${page === item.key ? "aeh-nav-item-active" : ""}`}
              onClick={() => { setPage(item.key); setMobileOpen(false); }}
              aria-current={page === item.key ? "page" : undefined}
              type="button"
            >
              <item.icon size={16} strokeWidth={1.6} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="aeh-sidebar-footer">
          <span className="aeh-mono aeh-streak-text">Synced</span>
          <button className="aeh-icon-btn" aria-label="Settings">
            <Settings size={16} strokeWidth={1.6} />
          </button>
        </div>
      </aside>
    </>
  );
}
function TopBar({ title, onMenu }) {
  return (
    <header className="aeh-topbar">
      <button className="aeh-icon-btn aeh-menu-btn" onClick={onMenu} aria-label="Open menu">
        <Menu size={19} strokeWidth={1.6} />
      </button>
      <h1 className="aeh-page-title">{title}</h1>
      <div className="aeh-avatar" aria-hidden="true">K</div>
    </header>
  );
}
function BottomNav({ page, setPage }) {
  return (
    <nav className="aeh-bottom-nav" aria-label="Primary">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          className={`aeh-bottom-nav-item ${page === item.key ? "aeh-bottom-nav-item-active" : ""}`}
          onClick={() => setPage(item.key)}
          aria-current={page === item.key ? "page" : undefined}
          type="button"
        >
          <item.icon size={18} strokeWidth={1.6} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* -------------------------------- TASK CARD ----------------------------------- */

const ROW_TRANSITION = { layout: { duration: 0.36, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.24 } };

function TaskCard({ task, projects, onToggle, onCycleStatus, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [clicking, setClicking] = useState(false);

  if (editing) {
    return (
      <motion.div layout="position" transition={ROW_TRANSITION} className="aeh-task-row aeh-task-row-editing">
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

  const done = task.status === "completed";
  const overdue = !done && task.dueDate < todayISO();
  function handleToggle() {
    setClicking(true);
    onToggle(task.id);
    window.setTimeout(() => setClicking(false), 520);
  }

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.16, ease: "easeIn" } }}
      transition={ROW_TRANSITION}
      className={`aeh-task-row ${done ? "aeh-task-row-done" : ""} ${overdue ? "aeh-task-row-overdue" : ""} ${clicking ? "aeh-task-row-clicked" : ""}`}
    >
      <button className="aeh-check" onClick={handleToggle} aria-label={done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`} type="button">
        {done ? <CheckCircle2 size={22} strokeWidth={1.6} /> : <Circle size={22} strokeWidth={1.4} />}
      </button>
      <div className="aeh-task-body">
        <div className="aeh-task-title-row">
          <span className={`aeh-task-title ${done ? "aeh-strike" : ""}`}>{task.title}</span>
          <span className="aeh-task-priority">{task.priority}</span>
        </div>
        {task.description ? <p className="aeh-task-desc">{task.description}</p> : null}
        <div className="aeh-task-meta">
          {task.category ? <span>{task.category}</span> : null}
          <span className={overdue ? "aeh-overdue-text" : ""}>{formatDue(task.dueDate, task.dueTime)}</span>
          {task.estimatedMinutes ? <span>{formatMinutes(task.estimatedMinutes)}</span> : null}
          {task.status === "in_progress" ? <span className="aeh-status-tag">In progress</span> : null}
        </div>
        <div className="aeh-inline-actions aeh-task-actions">
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
  if (!tasks.length) return <p className="aeh-empty">{empty}</p>;
  return (
    <div className="aeh-task-list">
      <AnimatePresence initial={false}>
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} projects={projects} onToggle={onToggle} onCycleStatus={onCycleStatus} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
      </AnimatePresence>
    </div>
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
      <motion.div layout="position" transition={ROW_TRANSITION} className="aeh-completed-edit-row">
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
      className="aeh-completed-row"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.16 } }}
      transition={ROW_TRANSITION}
    >
      <button className="aeh-completed-check" onClick={() => onToggle(task.id)} aria-label={`Reopen ${task.title}`} type="button">
        <CheckCircle2 size={22} strokeWidth={1.6} />
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
    const key = dayOf(task.completedAt) || task.dueDate;
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
        <p className="aeh-empty">Completed tasks will appear here after you finish them.</p>
      ) : (
        <div className="aeh-completed-groups">
          {Object.entries(groups).map(([date, group]) => (
            <div className="aeh-completed-group" key={date}>
              <div className="aeh-completed-group-label">{completedDateLabel(date)} <span>· {group.length} {group.length === 1 ? "task" : "tasks"}</span></div>
              <div className="aeh-completed-table-head" aria-hidden="true">
                <span /> <span>Task</span><span>Due</span><span>Project</span><span>Done</span><span />
              </div>
              <AnimatePresence initial={false}>
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

function FocusBlock({ focusTask, onToggle }) {
  return (
    <section className="aeh-focus" aria-label="Today's focus">
      <h2 className="aeh-section-label aeh-focus-label">Today's focus</h2>
      {focusTask ? (
        <div className="aeh-focus-content">
          <div>
            <p className="aeh-focus-title">{focusTask.title}</p>
            <p className="aeh-focus-meta">
              {focusTask.status === "in_progress" ? "In progress now" : "Next up"}
              {focusTask.category ? ` · ${focusTask.category}` : ""}
              {focusTask.estimatedMinutes ? ` · ${formatMinutes(focusTask.estimatedMinutes)}` : ""}
            </p>
          </div>
          <button className="aeh-focus-action" type="button" onClick={() => onToggle(focusTask.id)} aria-label={`Complete "${focusTask.title}"`}>
            Complete
          </button>
        </div>
      ) : (
        <p className="aeh-empty aeh-focus-empty">Choose a task to make the next step concrete.</p>
      )}
    </section>
  );
}

function TodayPage({ tasks, projects, onAdd, onToggle, onCycleStatus, onUpdate, onDelete }) {
  const today = todayISO();
  const overdue = tasks.filter((t) => t.status !== "completed" && t.dueDate < today);
  const todays = tasks.filter((t) => t.dueDate === today);
  const pending = todays.filter((t) => t.status === "pending");
  const inProgress = todays.filter((t) => t.status === "in_progress");
  const completed = todays.filter((t) => t.status === "completed");
  const pct = todays.length ? Math.round((completed.length / todays.length) * 100) : 0;
  const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const focusTask = inProgress[0] || [...pending].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])[0];
  const listProps = { projects, onToggle, onCycleStatus, onUpdate, onDelete };

  return (
    <LayoutGroup id="today-task-layout">
      <div className="aeh-page">
        <div className="aeh-home-header">
          <div>
            <div className="aeh-mono">{dateLabel}</div>
            <div className="aeh-muted">{todays.length ? `${completed.length} of ${todays.length} tasks complete.` : "Nothing scheduled for today yet."}</div>
          </div>
          {todays.length > 0 && <Progress pct={pct} text={`${pct}%`} label="Today's completion" />}
        </div>

        <FocusBlock focusTask={focusTask} onToggle={onToggle} />

        <Section first label="Capture the next action">
          <QuickAdd onAdd={onAdd} projects={projects} />
        </Section>

        {overdue.length > 0 && (
          <Section label={`Overdue (${overdue.length})`}>
            <TaskList tasks={overdue} {...listProps} empty="" />
          </Section>
        )}

        <Section label="In progress">
          <TaskList tasks={inProgress} {...listProps} empty="Nothing in progress." />
        </Section>

        <Section label="Pending">
          <TaskList tasks={pending} {...listProps} empty={todays.length ? "All caught up." : "No tasks yet — add one above."} />
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
  const weekCount = tasks.filter((t) => t.dueDate >= days[0] && t.dueDate <= days[6]).length;

  return (
    <div className="aeh-page">
      <div className="aeh-home-header">
        <div>
          <div className="aeh-mono">{formatShortDate(days[0])} – {formatShortDate(days[6])}</div>
          <div className="aeh-muted">{weekCount} scheduled {weekCount === 1 ? "task" : "tasks"} across the week.</div>
        </div>
      </div>
      <div className="aeh-week">
        {days.map((iso, i) => {
          const dayTasks = tasks.filter((t) => t.dueDate === iso);
          const d = new Date(iso + "T00:00:00");
          return (
            <section className={`aeh-week-day ${iso === today ? "aeh-week-day-today" : ""}`} key={iso} aria-label={`${labels[i]} ${d.getDate()}`}>
              <div className="aeh-week-day-head">
                <span className="aeh-week-day-name">{labels[i]}</span>
                <span className="aeh-week-day-num">{d.getDate()}</span>
              </div>
              <div className="aeh-week-day-body">
                {dayTasks.length ? (
                  dayTasks.map((t) => {
                    const done = t.status === "completed";
                    return (
                      <button
                        key={t.id}
                        className={`aeh-week-task ${done ? "aeh-week-task-done" : ""}`}
                        onClick={() => onToggle(t.id)}
                        aria-pressed={done}
                        type="button"
                      >
                        <span className="aeh-week-check">
                          {done ? <CheckCircle2 size={20} strokeWidth={1.6} /> : <Circle size={20} strokeWidth={1.4} />}
                        </span>
                        <span className="aeh-week-task-text">
                          <span className="aeh-week-task-title">{t.title}</span>
                          <span className="aeh-week-task-meta">
                            <span>{t.priority || "Medium"}</span>
                            {t.category ? <span>{t.category}</span> : null}
                            {t.dueDate ? <span>{new Date(t.dueDate + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span> : null}
                            {t.dueTime ? <span>{t.dueTime}</span> : null}
                            {t.estimatedMinutes ? <span>{t.estimatedMinutes} menit</span> : null}
                          </span>
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p className="aeh-empty aeh-week-empty">No tasks</p>
                )}
              </div>
            </section>
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
            title={`Day ${d.day} — ${d.topic}`}
          />
        ))}
      </div>
      <span className="aeh-helper">Sample roadmap — illustrative, not tied to your task list</span>
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
        <div>
          <div className="aeh-mono">{projects.length} {projects.length === 1 ? "project" : "projects"}</div>
          <div className="aeh-muted">Tasks are grouped by the project they belong to.</div>
        </div>
        <TextButton onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : "+ New project"}</TextButton>
      </div>

      {adding && (
        <Section first label="New project">
          <div className="aeh-manual-form">
            <input className="aeh-input" aria-label="Project name" placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="aeh-input" aria-label="Project description" placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <div className="aeh-inline-actions aeh-form-actions">
              <Button onClick={submitProject} disabled={!name.trim()}>Add project</Button>
            </div>
          </div>
        </Section>
      )}

      {projects.length === 0 ? (
        <Section first={!adding} label="Projects">
          <p className="aeh-empty">No projects yet. Add one to start grouping tasks.</p>
        </Section>
      ) : (
        <div className="aeh-projects">
          {projects.map((p) => {
            const projTasks = tasks.filter((t) => t.category === p.name);
            const done = projTasks.filter((t) => t.status === "completed").length;
            const pct = projTasks.length ? Math.round((done / projTasks.length) * 100) : 0;
            const isOpen = expanded === p.id;
            return (
              <article className="aeh-project" key={p.id}>
                <div className="aeh-project-main">
                  <h2 className="aeh-project-name">{p.name}</h2>
                  {p.description ? <p className="aeh-muted">{p.description}</p> : null}
                </div>
                <div className="aeh-project-stats">
                  <Progress pct={pct} text={`${done}/${projTasks.length}`} label={`${p.name} progress`} />
                  <span className="aeh-project-status">{projTasks.length === 0 ? "No tasks yet" : done === projTasks.length ? "Complete" : `${projTasks.length - done} open`}</span>
                </div>
                <div className="aeh-inline-actions aeh-project-actions">
                  <TextButton muted onClick={() => setExpanded(isOpen ? null : p.id)}>{isOpen ? "Hide tasks" : "Show tasks"}</TextButton>
                  {p.hasRoadmap && (
                    <TextButton muted onClick={() => setRoadmapOpen((o) => !o)}>{roadmapOpen ? "Hide roadmap" : "Show roadmap"}</TextButton>
                  )}
                </div>
                {isOpen && (
                  <div className="aeh-project-panel">
                    <TaskList tasks={projTasks} projects={projects} onToggle={onToggle} onCycleStatus={onCycleStatus} onUpdate={onUpdate} onDelete={onDelete} empty="No tasks linked to this project yet." />
                  </div>
                )}
                {p.hasRoadmap && roadmapOpen && (
                  <div className="aeh-project-panel">
                    <RoadmapSample />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ REAL CONSISTENCY CHART ------------------------- */

function buildRealSeries(tasks, days) {
  const today = todayISO();
  return days.map((iso) => {
    const value = tasks.filter((t) => t.status === "completed" && t.completedAt && dayOf(t.completedAt) === iso).length;
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

/* Measures an element so the chart can draw 1 SVG unit = 1 CSS px (no stretched text). */
function useElementWidth(ref, fallback = 640) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setW(Math.max(260, Math.round(el.getBoundingClientRect().width)));
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function RealConsistencyChart({ tasks, days }) {
  const [hover, setHover] = useState(null);
  const [pinned, setPinned] = useState(null);
  const [drawn, setDrawn] = useState(false);
  const wrapRef = useRef(null);
  const width = useElementWidth(wrapRef);
  const series = buildRealSeries(tasks, days);
  const values = series.map((s) => s.value);

  const height = 200;
  const pad = { top: 18, right: 8, bottom: 28, left: 26 };
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
  const ticks = Array.from(new Set([0, Math.round(maxVal / 2), maxVal])).sort((a, b) => a - b);

  useEffect(() => {
    setDrawn(false);
    const t = setTimeout(() => setDrawn(true), 60);
    return () => clearTimeout(t);
  }, [days.length, tasks.length]);

  function indexFromEvent(e) {
    const rect = wrapRef.current.getBoundingClientRect();
    const idx = Math.round((e.clientX - rect.left - pad.left) / stepX);
    return Math.max(0, Math.min(series.length - 1, idx));
  }
  function handleMove(e) {
    setHover(indexFromEvent(e));
  }
  function handleClick(e) {
    const idx = indexFromEvent(e);
    setPinned((prev) => (prev === idx ? null : idx));
  }

  const labelEvery = series.length <= 7 ? 1 : series.length <= 14 ? 2 : 5;
  const activeIndex = hover != null ? hover : pinned;
  const hp = activeIndex != null ? points[activeIndex] : null;
  const tooltipAlign = hp ? (hp.x < 80 ? "left" : hp.x > width - 80 ? "right" : "center") : "center";
  const prevVal = activeIndex != null && activeIndex > 0 ? values[activeIndex - 1] : null;
  const delta = activeIndex != null && prevVal != null ? values[activeIndex] - prevVal : null;

  return (
    <div>
      <div className="aeh-chart-stats">
        <Figure small value={avg.toFixed(1)} label="avg / day" />
        <Figure small value={best} label={`best day · ${bestPoint.dateLabel}`} />
        <Figure small value={streak} label="day streak" />
      </div>

      <div className="aeh-chart-wrap" ref={wrapRef}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-label={`Completed tasks per day over the last ${series.length} days. Average ${avg.toFixed(1)} per day, best day ${best}, current streak ${streak}.`}
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
          onClick={handleClick}
          style={{ cursor: "crosshair" }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={yFor(t)} y2={yFor(t)} className="aeh-chart-grid" />
              <text x={0} y={yFor(t) + 3} className="aeh-chart-axis-label">{t}</text>
            </g>
          ))}
          <line x1={pad.left} x2={width - pad.right} y1={yFor(avg)} y2={yFor(avg)} className="aeh-chart-avg-line" />
          <text x={width - pad.right} y={yFor(avg) - 6} textAnchor="end" className="aeh-chart-average-label">avg</text>
          <path d={areaPath} className={`aeh-chart-area ${drawn ? "aeh-chart-area-drawn" : ""}`} />
          <path d={linePath} pathLength="1" className={`aeh-chart-line ${drawn ? "aeh-chart-line-drawn" : ""}`} />
          {hp && <line x1={hp.x} x2={hp.x} y1={pad.top} y2={pad.top + innerH} className="aeh-chart-hoverline" />}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={activeIndex === i ? 4.5 : 2.5} className={`aeh-chart-point ${activeIndex === i ? "aeh-chart-point-active" : ""}`} />
          ))}
          {series.map((d, i) =>
            i % labelEvery === 0 || d.isToday ? (
              <text key={i} x={pad.left + i * stepX} y={height - 6} textAnchor="middle" className="aeh-chart-axis-label">
                {series.length <= 14 ? d.weekday : d.dayNum}
              </text>
            ) : null
          )}
        </svg>
        {hp && (
          <div className={`aeh-chart-tooltip aeh-chart-tooltip-${tooltipAlign}`} style={{ left: hp.x, top: hp.y }}>
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
  const asOf = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });

  return (
    <div className="aeh-page">
      <div className="aeh-home-header">
        <div>
          <div className="aeh-mono">As of {asOf}</div>
          <div className="aeh-muted">{total} {total === 1 ? "task" : "tasks"} tracked.</div>
        </div>
      </div>

      {total === 0 ? (
        <Section first label="Overview">
          <p className="aeh-empty">No tasks yet. Add tasks on the Today page to see statistics here.</p>
        </Section>
      ) : (
        <>
          <Section first label="Overview">
            <div className="aeh-figures">
              <Figure value={completed} label="completed" />
              <Figure value={pending} label="pending" />
              <Figure value={`${rate}%`} label="completion rate" />
              <Figure value={`${todayDone}/${todayCount.length}`} label="today" />
            </div>
          </Section>

          <Section label="Consistency">
            <p className="aeh-chart-context">Completed tasks by day, based on saved task history.</p>
            <Segmented
              label="Chart range"
              value={range}
              onChange={setRange}
              options={[{ value: "today", label: "Today" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]}
            />
            {range === "today" ? (
              <p className="aeh-muted">{todayDone} of {todayCount.length} tasks completed today.</p>
            ) : !hasAnyCompleted ? (
              <p className="aeh-empty">No completed tasks yet. Finish a task to start the trend.</p>
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
  const [collapsed, setCollapsed] = useState(false);
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
        setStorageError("Couldn't load saved data — starting with sample tasks instead. Changes this session may not be saved.");
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
      .catch(() => showToast("Saved locally in this session — storage sync failed"));
  }
  function persistProjects(next) {
    setProjectsState(next);
    Promise.resolve()
      .then(() => browserStorage.set(PROJECTS_KEY, JSON.stringify(next)))
      .catch(() => showToast("Saved locally in this session — storage sync failed"));
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
        <div className="aeh-loading-screen"><span className="aeh-mono">Loading your tasks…</span></div>
      </div>
    );
  }

  return (
    <div className={`aeh-app ${collapsed ? "aeh-app-collapsed" : ""}`}>
      <style>{STYLES}</style>
      <Sidebar page={page} setPage={setPage} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} onCollapse={() => setCollapsed(true)} />
      <div className="aeh-main">
        <TopBar title={PAGE_TITLES[page]} onMenu={() => { setMobileOpen(true); setCollapsed(false); }} />
        {storageError && <div className="aeh-error-banner" role="alert">{storageError}</div>}
        <main className="aeh-content" key={page}>
          {page === "today" && (
            <TodayPage tasks={tasks} projects={projects} onAdd={addTask} onToggle={toggleComplete} onCycleStatus={cycleStatus} onUpdate={updateTask} onDelete={deleteTask} />
          )}
          {page === "week" && <WeekPage tasks={tasks} onToggle={toggleComplete} />}
          {page === "projects" && (
            <ProjectsPage projects={projects} tasks={tasks} onAddProject={addProject} onToggle={toggleComplete} onCycleStatus={cycleStatus} onUpdate={updateTask} onDelete={deleteTask} />
          )}
          {page === "analytics" && <AnalyticsPage tasks={tasks} />}
        </main>
      </div>
      <BottomNav page={page} setPage={setPage} />
      {toast && <div className="aeh-toast" role="status" aria-live="polite">{toast}</div>}
    </div>
  );
}

/* ----------------------------------- STYLES ------------------------------------ */

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Manrope:wght@400;500;600;700;800&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap');

/* Neutralise Vite starter styles (dark body, centred flex root, purple button hover). */
html, body { margin: 0; padding: 0; }
body { display: block; place-items: initial; min-width: 0; min-height: 0; background: #f3f1ea; text-align: left; }
#root { width: 100%; max-width: none; margin: 0; padding: 0; text-align: left; }

/* ---------------------------------- tokens ---------------------------------- */
.aeh-app {
  --paper: #f3f1ea;
  --paper-deep: #eae7de;
  --surface: #faf9f5;
  --ink: #20211f;
  --ink-soft: #4d4b44;
  --ink-faint: #68665e;
  --rule: #d8d5cc;
  --rule-strong: #b5b1a6;
  --accent: #9a4f36;
  --accent-soft: #ecdcd3;
  --sage: #4f6b59;
  --sage-soft: #dbe4da;

  --serif: 'Newsreader', Georgia, 'Times New Roman', serif;
  --sans: 'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;

  --sidebar-w: 232px;
  --column: 860px;
  --gutter: clamp(20px, 5vw, 64px);
  --ease: cubic-bezier(.22, 1, .36, 1);

  font-family: var(--sans);
  font-size: 14px;
  line-height: 1.5;
  letter-spacing: -0.005em;
  color: var(--ink);
  background: var(--paper);
  color-scheme: light;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  text-align: left;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.aeh-app *, .aeh-app *::before, .aeh-app *::after { box-sizing: border-box; }
:where(.aeh-app) button { font: inherit; color: inherit; background: none; border: 0; border-radius: 0; padding: 0; margin: 0; cursor: pointer; }
:where(.aeh-app) :is(h1, h2, h3, p) { margin: 0; font-size: inherit; font-weight: inherit; line-height: inherit; }
.aeh-app ::selection { background: var(--ink); color: var(--paper); }
.aeh-app ::-webkit-scrollbar { width: 10px; height: 10px; }
.aeh-app ::-webkit-scrollbar-track { background: var(--paper-deep); }
.aeh-app ::-webkit-scrollbar-thumb { background: var(--rule-strong); border: 3px solid var(--paper-deep); border-radius: 9px; }
.aeh-app :focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

.aeh-mono { font-family: var(--mono); font-size: 11px; letter-spacing: .04em; font-variant-numeric: tabular-nums; }
.aeh-muted { color: var(--ink-soft); font-size: 14px; line-height: 1.55; }
.aeh-helper { color: var(--ink-faint); font-size: 12px; margin-top: 10px; }
.aeh-empty { font-family: var(--serif); font-style: italic; font-size: 16px; color: var(--ink-faint); }
.aeh-loading-screen { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--ink-soft); }
.aeh-error-banner { color: var(--accent); font-size: 13px; padding-top: 14px; }

/* ----------------------------------- shell ---------------------------------- */
.aeh-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.aeh-topbar, .aeh-content, .aeh-error-banner {
  width: 100%;
  max-width: calc(var(--column) + var(--gutter) * 2);
  margin-inline: auto;
  padding-inline: var(--gutter);
}
.aeh-topbar { display: flex; align-items: center; gap: 14px; padding-top: clamp(28px, 6vw, 68px); }
.aeh-content { padding-top: 34px; padding-bottom: 140px; animation: aeh-page-in .4s var(--ease); }
@keyframes aeh-page-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

.aeh-page-title { font-family: var(--serif); font-size: clamp(38px, 5.2vw, 54px); line-height: 1; letter-spacing: -0.03em; font-weight: 500; text-wrap: balance; }
.aeh-avatar { margin-left: auto; width: 32px; height: 32px; flex: none; border: 1px solid var(--rule-strong); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: var(--mono); font-size: 11px; color: var(--ink-soft); }

/* --------------------------------- sidebar ---------------------------------- */
.aeh-sidebar {
  width: var(--sidebar-w); flex-shrink: 0; position: sticky; top: 0; align-self: flex-start;
  height: 100vh; height: 100dvh; z-index: 30;
  display: flex; flex-direction: column; padding: 30px 20px 22px;
  background: var(--paper-deep); border-right: 1px solid var(--rule);
}
.aeh-brand { display: flex; align-items: center; padding: 4px 10px 48px; }
.aeh-brand-name { font-family: var(--serif); font-size: 26px; line-height: 1; font-weight: 500; letter-spacing: -.03em; color: var(--ink); }
.aeh-brand-name::after { content: ''; display: inline-block; width: 6px; height: 6px; margin: 0 0 3px 5px; background: var(--accent); border-radius: 50%; }
.aeh-sidebar-close { margin-left: auto; }
.aeh-nav { position: relative; display: flex; flex-direction: column; flex: 1; gap: 2px; align-content: flex-start; }
.aeh-nav-indicator { position: absolute; top: 0; left: 0; right: 0; height: 40px; background: var(--surface); border: 1px solid var(--rule); border-radius: 3px; pointer-events: none; transition: transform .32s var(--ease); }
.aeh-nav-item { position: relative; display: flex; align-items: center; gap: 12px; height: 40px; width: 100%; padding: 0 12px; border-radius: 3px; color: var(--ink-soft); font-size: 13px; font-weight: 600; text-align: left; transition: color .18s ease; }
.aeh-nav-item:hover, .aeh-nav-item-active { color: var(--ink); }
.aeh-sidebar-footer { display: flex; align-items: center; justify-content: space-between; padding: 14px 10px 0; border-top: 1px solid var(--rule); }
.aeh-streak-text { color: var(--sage); }
.aeh-streak-text::before { content: ''; display: inline-block; width: 6px; height: 6px; margin: 0 8px 1px 0; border-radius: 50%; background: var(--sage); }
.aeh-icon-btn { min-width: 34px; min-height: 34px; display: inline-flex; align-items: center; justify-content: center; border-radius: 3px; color: var(--ink-faint); transition: color .15s ease, background .15s ease; }
.aeh-icon-btn:hover { color: var(--ink); background: rgba(255,255,255,.55); }
.aeh-menu-btn { display: none; margin-left: -8px; }
.aeh-scrim { display: none; }
.aeh-bottom-nav { display: none; }

/* -------------------------------- page header ------------------------------- */
.aeh-home-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 52px; }
.aeh-home-header > div:first-child { display: grid; gap: 6px; }
.aeh-home-header .aeh-mono { color: var(--ink-soft); text-transform: uppercase; letter-spacing: .1em; }
.aeh-progress { display: flex; align-items: center; gap: 12px; min-width: 150px; }
.aeh-progress .aeh-mono { color: var(--ink-soft); min-width: 3ch; text-align: right; }
.aeh-line-track { flex: 1; height: 2px; background: var(--rule); overflow: hidden; }
.aeh-line-fill { width: 100%; height: 100%; background: var(--sage); transform-origin: left center; transition: transform .55s var(--ease); }

/* -------------------------------- sections ---------------------------------- */
.aeh-section { margin-bottom: 60px; }
.aeh-section-head { display: flex; align-items: center; gap: 16px; margin-bottom: 22px; }
.aeh-section-label { font-family: var(--mono); font-size: 11px; font-weight: 500; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-soft); white-space: nowrap; }
.aeh-section-rule { flex: 1; height: 1px; background: var(--rule); }

/* focus */
.aeh-focus { margin-bottom: 64px; }
.aeh-focus-label { display: flex; align-items: center; gap: 12px; color: var(--accent); }
.aeh-focus-label::before { content: ''; width: 28px; height: 1px; background: currentColor; }
.aeh-focus-content { display: flex; align-items: flex-end; justify-content: space-between; gap: 32px; margin-top: 20px; }
.aeh-focus-title { font-family: var(--serif); font-size: clamp(30px, 4vw, 44px); font-weight: 500; letter-spacing: -.03em; line-height: 1.08; max-width: 22ch; text-wrap: balance; }
.aeh-focus-meta { color: var(--ink-soft); font-size: 13px; margin-top: 12px; }
.aeh-focus-empty { margin-top: 18px; }
.aeh-focus-action { min-height: 42px; padding: 0 18px; color: var(--surface); background: var(--ink); border-radius: 3px; font-size: 12.5px; font-weight: 700; white-space: nowrap; transition: background .2s ease; }
.aeh-focus-action:hover { background: var(--accent); }
.aeh-focus-action:active { transform: scale(.98); }

/* ---------------------------------- controls -------------------------------- */
.aeh-textbtn { min-height: 32px; display: inline-flex; align-items: center; gap: 4px; padding: 4px 0; color: var(--ink); font-size: 13px; font-weight: 700; transition: color .15s ease; }
.aeh-textbtn:hover { color: var(--accent); }
.aeh-textbtn-muted { color: var(--ink-faint); font-weight: 600; }
.aeh-textbtn-muted:hover { color: var(--ink); }
.aeh-textbtn:disabled { opacity: .5; cursor: not-allowed; }

.aeh-btn { min-height: 44px; padding: 0 20px; border: 1px solid transparent; border-radius: 3px; font-size: 13px; font-weight: 700; white-space: nowrap; transition: background .18s ease, border-color .18s ease, color .18s ease; }
.aeh-btn-full { width: 100%; }
.aeh-btn-primary, .aeh-btn-primary:hover { background: var(--ink); color: var(--surface); border-color: transparent; }
.aeh-btn-primary:hover:not(:disabled) { background: var(--accent); }
.aeh-btn-ghost { border-color: var(--rule-strong); color: var(--ink-soft); }
.aeh-btn-ghost:hover:not(:disabled) { border-color: var(--ink); color: var(--ink); }
.aeh-btn:disabled { opacity: .45; cursor: not-allowed; }
.aeh-btn:active:not(:disabled) { transform: scale(.98); }
.aeh-inline-actions { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }

.aeh-segmented { display: inline-flex; gap: 2px; padding: 2px; margin-bottom: 16px; background: var(--paper-deep); border: 1px solid var(--rule); border-radius: 3px; }
.aeh-segmented button, .aeh-segmented button:hover { min-height: 30px; padding: 0 14px; border: 0; border-radius: 2px; font: 500 11.5px var(--mono); color: var(--ink-soft); transition: background .15s ease, color .15s ease; }
.aeh-segmented button:hover { color: var(--ink); }
.aeh-segmented .aeh-segmented-active { background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(32,33,31,.10); }

.aeh-input, .aeh-select { flex: 1; min-width: 0; min-height: 44px; padding: 0 14px; font-family: inherit; font-size: 14px; letter-spacing: inherit; color: var(--ink); background: var(--surface); border: 1px solid var(--rule-strong); border-radius: 3px; transition: border-color .18s ease, box-shadow .18s ease; }
.aeh-input::placeholder { color: var(--ink-faint); }
.aeh-input:focus, .aeh-select:focus { outline: none; border-color: var(--ink); box-shadow: 0 0 0 3px rgba(32,33,31,.08); }
.aeh-input-narrow { flex: 0 0 110px; }
.aeh-form-row { display: flex; gap: 10px; }
.aeh-manual-form { display: flex; flex-direction: column; gap: 10px; }
.aeh-form-actions { margin-top: 6px; }
.aeh-field-error { color: var(--accent); font-size: 13px; margin-top: 10px; }

/* ---------------------------------- tasks ----------------------------------- */
.aeh-task-list { display: flex; flex-direction: column; }
.aeh-task-row { display: grid; grid-template-columns: 32px minmax(0, 1fr); column-gap: 14px; padding: 20px 0; border-bottom: 1px solid var(--rule); transition: background .2s ease; }
.aeh-task-row-editing { display: block; padding: 20px; margin: 8px 0; background: var(--surface); border: 1px solid var(--rule-strong); }
.aeh-task-row-clicked { animation: aeh-task-flash .5s ease-out; }
@keyframes aeh-task-flash { 0% { background: rgba(154,79,54,.08); } 100% { background: transparent; } }

.aeh-check { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; margin-top: -3px; border-radius: 50%; color: var(--ink-faint); transition: color .15s ease, transform .15s ease; }
.aeh-check:hover { color: var(--ink); }
.aeh-check:active { transform: scale(.94); }
.aeh-task-row-done .aeh-check, .aeh-completed-check { color: var(--sage); }
.aeh-task-row-done .aeh-check svg, .aeh-completed-check svg { fill: var(--sage); stroke: var(--paper); }

.aeh-task-body { min-width: 0; }
.aeh-task-title-row { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
.aeh-task-title { font-size: 15px; font-weight: 700; letter-spacing: -.012em; line-height: 1.35; transition: color .4s ease; }
.aeh-strike { text-decoration: line-through; text-decoration-color: var(--ink-faint); text-decoration-thickness: 1px; color: var(--ink-faint); font-weight: 500; }
.aeh-task-priority { flex-shrink: 0; font-family: var(--mono); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
.aeh-task-row-done .aeh-task-priority { color: var(--ink-faint); }
.aeh-task-desc { color: var(--ink-soft); font-size: 14px; line-height: 1.5; margin-top: 4px; max-width: 65ch; }
.aeh-task-meta { display: flex; flex-wrap: wrap; font-size: 12px; color: var(--ink-faint); margin-top: 8px; }
.aeh-task-meta > span + span::before { content: '·'; margin: 0 8px; color: var(--rule-strong); }
.aeh-overdue-text { color: var(--accent); }
.aeh-status-tag { color: var(--sage); }
.aeh-task-actions { gap: 16px; margin-top: 6px; opacity: 0; transition: opacity .18s ease; }
.aeh-task-row:hover .aeh-task-actions, .aeh-task-row:focus-within .aeh-task-actions { opacity: 1; }

/* ---------------------------- completed archive ----------------------------- */
.aeh-completed-archive { margin-top: 24px; padding-top: 44px; border-top: 1px solid var(--rule); }
.aeh-completed-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 18px; margin-bottom: 30px; }
.aeh-completed-head h2 { font-family: var(--serif); font-weight: 500; font-size: 28px; letter-spacing: -.02em; line-height: 1.1; }
.aeh-completed-head h2 span { color: var(--ink-faint); font-family: var(--mono); font-size: 12px; letter-spacing: 0; vertical-align: middle; margin-left: 6px; }
.aeh-completed-head p { color: var(--ink-soft); font-size: 13px; margin-top: 6px; }
.aeh-completed-sort { display: flex; align-items: center; gap: 8px; color: var(--ink-faint); font: 11px var(--mono); }
.aeh-completed-sort select { appearance: none; background: transparent; border: 0; color: var(--ink); font: 600 11px var(--mono); padding: 8px 0; cursor: pointer; }
.aeh-completed-group { margin-bottom: 30px; }
.aeh-completed-group-label { color: var(--ink-soft); font: 11px var(--mono); letter-spacing: .04em; margin-bottom: 8px; }
.aeh-completed-group-label span { color: var(--ink-faint); }
.aeh-completed-table-head, .aeh-completed-row { display: grid; grid-template-columns: 32px minmax(0, 1.7fr) minmax(0, .9fr) minmax(0, 1fr) 50px 92px; column-gap: 16px; align-items: center; }
.aeh-completed-table-head { padding-bottom: 8px; border-bottom: 1px solid var(--rule); color: var(--ink-faint); font: 10.5px var(--mono); text-transform: uppercase; letter-spacing: .08em; }
.aeh-completed-row { min-height: 52px; padding: 8px 0; border-bottom: 1px solid var(--rule); transition: background .18s ease; }
.aeh-completed-row:hover { background: rgba(255,255,255,.5); }
.aeh-completed-check { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; transition: color .15s ease; }
.aeh-completed-check:hover { color: var(--ink); }
.aeh-completed-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-soft); font-size: 13.5px; font-weight: 500; text-decoration: line-through; text-decoration-color: var(--rule-strong); text-decoration-thickness: 1px; }
.aeh-completed-date, .aeh-completed-project { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-soft); font-size: 12.5px; }
.aeh-completed-time { font-family: var(--mono); font-size: 11.5px; color: var(--ink-faint); text-align: right; }
.aeh-completed-actions { display: flex; gap: 14px; justify-content: flex-end; opacity: 0; transition: opacity .18s ease; }
.aeh-completed-row:hover .aeh-completed-actions, .aeh-completed-row:focus-within .aeh-completed-actions { opacity: 1; }
.aeh-completed-edit-row { padding: 20px; margin: 8px 0; border: 1px solid var(--rule-strong); background: var(--surface); }

/* ----------------------------------- week ----------------------------------- */
.aeh-week { display: flex; flex-direction: column; }
.aeh-week-day { display: grid; grid-template-columns: 104px minmax(0, 1fr); column-gap: 28px; padding: 26px 0 28px; border-top: 1px solid var(--rule); }
.aeh-week-day:last-child { border-bottom: 1px solid var(--rule); }
.aeh-week-day-today { border-top-color: var(--ink); }
.aeh-week-day-head { display: flex; flex-direction: column; gap: 4px; }
.aeh-week-day-name { font: 500 11px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-soft); }
.aeh-week-day-num { font-family: var(--serif); font-size: 40px; line-height: 1; letter-spacing: -.03em; font-variant-numeric: lining-nums; }
.aeh-week-day-today .aeh-week-day-name { color: var(--accent); }
.aeh-week-day-body { min-width: 0; padding-top: 2px; }
.aeh-week-empty { font-size: 15px; }
.aeh-week-task { display: grid; grid-template-columns: 28px minmax(0, 1fr); column-gap: 10px; width: 100%; padding: 12px 0; text-align: left; color: var(--ink); }
.aeh-week-task:first-child { padding-top: 0; }
.aeh-week-task + .aeh-week-task { border-top: 1px solid var(--rule); }
.aeh-week-check { color: var(--ink-faint); padding-top: 1px; transition: color .15s ease; }
.aeh-week-task:hover .aeh-week-check { color: var(--ink); }
.aeh-week-task-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.aeh-week-task-title { font-size: 15px; font-weight: 700; letter-spacing: -.012em; line-height: 1.35; transition: color .15s ease; }
.aeh-week-task:hover .aeh-week-task-title { color: var(--accent); }
.aeh-week-task-meta { display: flex; flex-wrap: wrap; font-size: 12px; color: var(--ink-faint); }
.aeh-week-task-meta > span + span::before { content: '·'; margin: 0 8px; color: var(--rule-strong); }
.aeh-week-task-done .aeh-week-check { color: var(--sage); }
.aeh-week-task-done .aeh-week-check svg { fill: var(--sage); stroke: var(--paper); }
.aeh-week-task-done .aeh-week-task-title { color: var(--ink-faint); font-weight: 500; text-decoration: line-through; text-decoration-color: var(--rule-strong); text-decoration-thickness: 1px; }

/* --------------------------------- projects --------------------------------- */
.aeh-projects { display: flex; flex-direction: column; }
.aeh-project { display: grid; grid-template-columns: minmax(0, 1fr) minmax(220px, 300px); column-gap: 48px; row-gap: 14px; padding: 34px 0; border-top: 1px solid var(--rule); }
.aeh-project:last-child { border-bottom: 1px solid var(--rule); }
.aeh-project-name { font-family: var(--serif); font-size: 26px; font-weight: 500; letter-spacing: -.02em; line-height: 1.15; margin-bottom: 6px; }
.aeh-project-stats { display: flex; flex-direction: column; gap: 8px; align-self: center; }
.aeh-project-stats .aeh-progress { min-width: 0; }
.aeh-project-status { color: var(--ink-soft); font-size: 12.5px; text-align: right; }
.aeh-project-actions { grid-column: 1 / -1; gap: 20px; }
.aeh-project-panel { grid-column: 1 / -1; margin-top: 8px; }
.aeh-roadmap-info { display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px; }
.aeh-roadmap-info .aeh-mono { color: var(--ink-soft); }
.aeh-roadmap-grid { display: grid; grid-template-columns: repeat(15, 1fr); gap: 5px; margin-bottom: 12px; }
.aeh-roadmap-cell { aspect-ratio: 1; border-radius: 2px; border: 1px solid var(--rule); opacity: 0; animation: aeh-cell-in .3s ease forwards; transition: background .15s ease; }
.aeh-roadmap-cell:hover { border-color: var(--rule-strong); }
@keyframes aeh-cell-in { to { opacity: 1; } }
.aeh-roadmap-done { background: var(--sage-soft); border-color: var(--sage-soft); }
.aeh-roadmap-current { border-color: var(--accent); background: var(--accent-soft); }

/* -------------------------------- analytics --------------------------------- */
.aeh-figures { display: grid; grid-template-columns: repeat(4, 1fr); }
.aeh-figure { display: flex; flex-direction: column; gap: 10px; padding: 4px 0 4px 24px; border-left: 1px solid var(--rule); }
.aeh-figure:first-child { padding-left: 0; border-left: 0; }
.aeh-figure-num { font-family: var(--serif); font-size: clamp(38px, 5vw, 56px); font-weight: 500; line-height: 1; letter-spacing: -.03em; font-variant-numeric: lining-nums tabular-nums; }
.aeh-figure-label { font: 500 11px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-soft); }
.aeh-figure-sm .aeh-figure-num { font-size: 30px; }
.aeh-chart-context { color: var(--ink-soft); font-size: 13px; margin: -6px 0 18px; }
.aeh-chart-stats { display: flex; align-items: flex-end; gap: 28px; margin-bottom: 20px; flex-wrap: wrap; }
.aeh-chart-stats .aeh-figure { padding-left: 28px; }
.aeh-chart-stats .aeh-figure:first-child { padding-left: 0; }
.aeh-chart-wrap { position: relative; width: 100%; padding-top: 8px; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); }
.aeh-chart-wrap svg { display: block; max-width: 100%; overflow: visible; }
.aeh-chart-grid { stroke: var(--rule); stroke-width: 1; }
.aeh-chart-axis-label { fill: var(--ink-faint); font: 10.5px var(--mono); }
.aeh-chart-average-label { fill: var(--ink-faint); font: 10px var(--mono); letter-spacing: .08em; text-transform: uppercase; }
.aeh-chart-avg-line { stroke: var(--rule-strong); stroke-width: 1; stroke-dasharray: 3 4; }
.aeh-chart-area { fill: var(--accent); fill-opacity: .07; opacity: 0; transition: opacity .8s ease .25s; }
.aeh-chart-area-drawn { opacity: 1; }
.aeh-chart-line { fill: none; stroke: var(--accent); stroke-width: 1.75; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset 1s cubic-bezier(.4,0,.2,1); }
.aeh-chart-line-drawn { stroke-dashoffset: 0; }
.aeh-chart-hoverline { stroke: var(--ink-faint); stroke-width: 1; stroke-dasharray: 2 4; opacity: .6; }
.aeh-chart-point { fill: var(--surface); stroke: var(--accent); stroke-width: 1.4; }
.aeh-chart-point-active { fill: var(--accent); }
.aeh-chart-tooltip { position: absolute; transform: translate(-50%, -135%); background: var(--ink); color: var(--surface); border-radius: 3px; padding: 8px 12px; box-shadow: 0 6px 16px rgba(32,33,31,.18); pointer-events: none; white-space: nowrap; }
.aeh-chart-tooltip-left { transform: translate(-12px, -135%); }
.aeh-chart-tooltip-right { transform: translate(calc(-100% + 12px), -135%); }
.aeh-chart-tooltip-date { color: var(--rule); font-size: 10.5px; margin-bottom: 3px; }
.aeh-chart-tooltip-value { font-size: 13px; font-weight: 700; }
.aeh-delta-up { color: #b9d0bb; }
.aeh-delta-down { color: #e8b8a8; }

/* ---------------------------------- feedback -------------------------------- */
.aeh-toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); z-index: 50; background: var(--ink); color: var(--surface); font-size: 12.5px; font-weight: 700; padding: 10px 16px; border-radius: 3px; box-shadow: 0 6px 16px rgba(32,33,31,.18); animation: aeh-toast-in .2s ease; }
@keyframes aeh-toast-in { from { opacity: 0; transform: translate(-50%, 6px); } to { opacity: 1; transform: translate(-50%, 0); } }

/* ----------------------------- desktop: collapsed --------------------------- */
@media (min-width: 861px) {
  .aeh-sidebar { transition: margin-left .3s var(--ease), visibility 0s; }
  .aeh-app-collapsed .aeh-sidebar { margin-left: calc(var(--sidebar-w) * -1); visibility: hidden; transition: margin-left .3s var(--ease), visibility 0s .3s; }
  .aeh-app-collapsed .aeh-menu-btn { display: inline-flex; }
}
@media (hover: none) {
  .aeh-task-actions, .aeh-completed-actions { opacity: 1; }
  .aeh-textbtn { min-height: 40px; }
}

/* ---------------------------------- tablet ---------------------------------- */
@media (max-width: 980px) {
  .aeh-app { --sidebar-w: 208px; }
  .aeh-project { column-gap: 32px; }
}

/* ------------------------- mobile: drawer + bottom nav ---------------------- */
@media (max-width: 860px) {
  .aeh-sidebar { position: fixed; left: 0; top: 0; transform: translateX(-100%); visibility: hidden; transition: transform .28s var(--ease), visibility 0s .28s; }
  .aeh-sidebar-open { transform: translateX(0); visibility: visible; transition: transform .28s var(--ease), visibility 0s; box-shadow: 12px 0 28px rgba(32,33,31,.14); }
  .aeh-scrim { display: block; position: fixed; inset: 0; z-index: 25; background: rgba(32,33,31,.28); }
  .aeh-menu-btn { display: inline-flex; }
  .aeh-content { padding-bottom: 120px; }
  .aeh-bottom-nav { display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; background: var(--paper-deep); border-top: 1px solid var(--rule); padding: 6px 4px calc(env(safe-area-inset-bottom, 0px) + 6px); }
  .aeh-bottom-nav-item { min-height: 48px; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: var(--ink-faint); font-size: 11px; font-weight: 700; }
  .aeh-bottom-nav-item-active { color: var(--accent); }
  .aeh-roadmap-grid { grid-template-columns: repeat(10, 1fr); }
  .aeh-toast { bottom: 84px; }
}

/* ---------------------------------- phone ----------------------------------- */
@media (max-width: 640px) {
  .aeh-home-header { flex-direction: column; align-items: stretch; gap: 18px; margin-bottom: 40px; }
  .aeh-progress { width: 100%; }
  .aeh-focus-content { flex-direction: column; align-items: stretch; gap: 20px; }
  .aeh-focus-action { width: 100%; }
  .aeh-form-row { flex-direction: column; }
  .aeh-input-narrow { flex: 1 1 auto; }
  .aeh-task-title-row { flex-direction: column; align-items: flex-start; gap: 4px; }
  .aeh-week-day { grid-template-columns: 64px minmax(0, 1fr); column-gap: 16px; }
  .aeh-week-day-num { font-size: 32px; }
  .aeh-project { grid-template-columns: 1fr; }
  .aeh-project-status { text-align: left; }
  .aeh-figures { grid-template-columns: repeat(2, 1fr); row-gap: 32px; }
  .aeh-figure:nth-child(odd) { padding-left: 0; border-left: 0; }
  .aeh-chart-stats { gap: 20px; }
  .aeh-completed-head { flex-direction: column; align-items: flex-start; }
  .aeh-completed-table-head { display: none; }
  .aeh-completed-row { grid-template-columns: 32px minmax(0, 1fr) auto; column-gap: 10px; row-gap: 2px; padding: 12px 0; }
  .aeh-completed-check { grid-row: 1 / span 3; align-self: start; }
  .aeh-completed-title { grid-column: 2; }
  .aeh-completed-time { grid-column: 3; grid-row: 1; }
  .aeh-completed-date { grid-column: 2 / span 2; grid-row: 2; font-size: 12px; }
  .aeh-completed-project { grid-column: 2 / span 2; grid-row: 3; font-size: 12px; }
  .aeh-completed-actions { grid-column: 2 / span 2; opacity: 1; justify-content: flex-start; }
}

@media (prefers-reduced-motion: reduce) {
  .aeh-app *, .aeh-app *::before, .aeh-app *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; }
}
`;
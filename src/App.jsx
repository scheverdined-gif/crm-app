import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from "react";
import {
  Zap, Users, Calendar, TrendingUp, Search, Plus, ChevronRight,
  ChevronLeft, Clock, MapPin, Star, AlertCircle, CheckCircle2,
  X, Filter, BarChart3, UserCircle2, Footprints, Bike,
  Settings, LogOut, Menu, ArrowUpRight, Award, Target, Sun, Moon
} from "lucide-react";

import { directionsOf, presentIds, attendancePercent, finalizeSession, promoStats, matchesStudent, weekStats, canEditSession, needsAttention, reconcilePromoStudent, formatAttendance, isArchived, archiveStudent, attendanceSelection, removeSessionFromState, repairMissingPromoSources, canSelectStudentForSession, averageSessionAttendance, childKey, uniqueChildren, migrateSchoolData, validateEnrollment, validateSessionRoster, coachStudents, updateEnrollment, patchEnrollment, uniqueBranchChildren, directionAttendanceStats, updateSessionInState, studentFilterCoaches, SALARY_RATES, sessionEarning, calcCoachSalary } from "./crmLogic.js";

import { storageConfig, createSupabaseStorage } from "./storage/supabase.js";
import { useRemoteSchool } from "./storage/useRemoteSchool.js";
import { coachDirections } from "./storage/model.js";
import { suggestedSessionName, groupNameSuggestions } from "./sessionUi.js";
import {localIsoDate as todayIso,useLocalToday,useCalendarSelection} from "./calendar.js";
import {THEME_KEY,THEME_CSS,readTheme,storeTheme,themedCss} from "./theme.js";
import {seriesSelection,hasSessionHistory} from "./series.js";
const SERVER_MODE = import.meta.env.VITE_CRM_STORAGE === "supabase";
let STORAGE = null, CONFIG_ERROR = "";
try { const config = storageConfig(import.meta.env); if(config.mode === "supabase") STORAGE = createSupabaseStorage(config); }
catch(error) { CONFIG_ERROR = error.message; }

/* ============================================================
   ДИСЦИПЛИНЫ — каждая со своим неоновым акцентом, как цвет деки
   ============================================================ */
// Сегодня — локальная дата браузера. Исходные демонстрационные занятия остаются в июне 2026.


// Статус ученика: активен / в отпуске / ушёл. В "живые" счётчики попадают все, кроме ушедших.
const STUDENT_STATUS = {
  active:   { label: "Активен",   color: "var(--crm-green)" },
  vacation: { label: "В отпуске", color: "var(--crm-amber)" },
  left:     { label: "Неактивен",      color: "var(--crm-danger)" },
};
// Типы тренировок: групповая, индивидуальная, спортивная группа и промо — у каждого фиксированная длительность
const SESSION_TYPES = {
  group:       { label: "Групповая",         short: "ГРУППА",        segLabel: "Группа",       fixedDuration: 60 },
  individual:  { label: "Индивидуальная",    short: "ИНДИВИДУАЛ",    segLabel: "Инд.",         fixedDuration: 60 },
  sport_group: { label: "Спортивная группа", short: "СПОРТ. ГРУППА", segLabel: "Спорт. группа", fixedDuration: 120 },
  promo:       { label: "Промо-тренировка",  short: "ПРОМО",         segLabel: "Промо",        fixedDuration: 45 },
};
function isEnrolled(s) { return !isArchived(s) && s.status !== "left"; }
// Одна рабочая запись — одно направление и один наставник. childId связывает ребёнка.
function coachesOfStudent(s) { return [s.coachId]; }
function disciplinesOfStudent(s) { return directionsOf(s); }
function monthKey(iso) { return typeof iso === "string" ? iso.slice(0, 7) : null; } // "YYYY-MM"
function monthLabelShort(key) {
  return new Date(key + "-01T00:00:00").toLocaleDateString("ru-RU", { month: "short" }).replace(".", "");
}
// последние N календарных месяцев по todayIso(), для графика притока/оттока
function lastMonthKeys(n, endMonth = todayIso().slice(0, 7)) {
  const [y, m] = endMonth.split("-").map(Number);
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}
// приток/отток по месяцам для заданного набора учеников
function buildFlowStats(studentList, months = 6, endMonth) {
  const keys = lastMonthKeys(months, endMonth);
  return keys.map(key => ({
    key,
    label: monthLabelShort(key),
    in: studentList.filter(s => monthKey(s.joinDate) === key).length,
    out: studentList.filter(s => s.status === "left" && s.leftDate && monthKey(s.leftDate) === key).length,
  }));
}

const DISCIPLINES = {
  balance: { label: "Беговел", short: "БЕГ", color: "var(--crm-orange)", icon: "bike" },
  rollers: { label: "Ролики", short: "РОЛ", color: "var(--crm-rollers)", icon: "skate" },
  skate:   { label: "Скейт",  short: "СКТ", color: "var(--crm-skate)", icon: "board" },
  bike:    { label: "Велик",  short: "ВЕЛ", color: "var(--crm-green)", icon: "bike" },
  bmx:     { label: "BMX",    short: "BMX", color: "var(--crm-blue)", icon: "bmx" },
  scooter: { label: "Самокат",short: "САМ", color: "var(--crm-purple)", icon: "scooter" },
};

/* ============================================================
   ТАРИФЫ ЗАРПЛАТЫ
   ============================================================ */
// Единый расчёт зарплаты используется в дневнике и помесячном отчёте владельца.
function monthLabelFull(m) {
  const [y, mo] = m.split("-");
  const names = ["","Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
  return `${names[Number(mo)]} ${y}`;
}

/* ============================================================
   ТЕСТОВЫЕ ДАННЫЕ
   ============================================================ */
/* ============================================================
   ФИЛИАЛЫ
   ============================================================ */
const BRANCHES = {
  roza:    { label: "Роза",      short: "РОЗ", color: "var(--crm-orange)" },
  irkutsk: { label: "Иркутский", short: "ИРК", color: "var(--crm-cyan)" },
};

/* ============================================================
   УПРАВЛЯЮЩИЕ — доступ к админ-панели
   role: "owner" видит оба филиала, "branch_manager" — только свой
   ============================================================ */
const MANAGERS = [];

/* ============================================================
   ТЕСТОВЫЕ ДАННЫЕ
   ============================================================ */
const COACHES = [];

const STUDENTS = [];

const SESSIONS = [];

/* ============================================================
   ИКОНКИ ДИСЦИПЛИН (мини SVG-значки в духе деки/наклейки)
   ============================================================ */
function DisciplineGlyph({ d, size = 16 }) {
  const c = DISCIPLINES[d]?.color || "var(--crm-grey)";
  const icons = {
    bmx: <Bike size={size} color={c} strokeWidth={2.5} />,
    bike: <Bike size={size} color={c} strokeWidth={2.5} />,
    balance: <Bike size={size} color={c} strokeWidth={2.5} />,
    skate: <Footprints size={size} color={c} strokeWidth={2.5} />,
    rollers: <Zap size={size} color={c} strokeWidth={2.5} />,
    scooter: <ArrowUpRight size={size} color={c} strokeWidth={2.5} />,
  };
  return icons[d] || <Star size={size} color={c} />;
}

/* ============================================================
   ПЕРФОРАЦИЯ — визуальная подпись карточек "страница дневника"
   ============================================================ */
function PerfEdge() {
  return (
    <div className="perf-edge">
      {Array.from({ length: 14 }).map((_, i) => <span key={i} />)}
    </div>
  );
}

let _idCounter = 100;
function nextId(prefix) { return STORAGE ? crypto.randomUUID() : `${prefix}-${crypto.randomUUID()}`; }
function initialsOf(name) { return name.trim().split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2); }

/* ============================================================
   ЭКРАН ВХОДА — почта + пароль, разделение по ролям
   ============================================================ */
function LoginScreen({ coaches, managers, onLogin, remoteLogin, remoteError, onRefresh }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [showDemo, setShowDemo] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  async function handleSubmit(e) {
    e.preventDefault();
    // trim убирает случайные пробелы/переносы при копировании из подсказки
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = remoteLogin ? password : password.trim();
    if (!normalizedEmail || !normalizedPassword) {
      setError("Введите почту и пароль");
      return;
    }
    if (remoteLogin) {
      setSubmitting(true);setError("");
      try {await remoteLogin(normalizedEmail, normalizedPassword);} catch(error) {setError(error.message);}
      finally {setSubmitting(false);}
      return;
    }
    const coach = coaches.find(c => (c.email || "").toLowerCase().trim() === normalizedEmail);
    if (coach) {
      if (coach.password.trim() !== normalizedPassword) { setError(`Неверный пароль для ${coach.email}`); return; }
      onLogin({ kind: "coach", record: coach });
      return;
    }
    const manager = managers.find(m => m.email.toLowerCase().trim() === normalizedEmail);
    if (manager) {
      if (manager.password.trim() !== normalizedPassword) { setError(`Неверный пароль для ${manager.email}`); return; }
      onLogin({ kind: "manager", record: manager });
      return;
    }
    setError(`Почта «${normalizedEmail}» не найдена в системе`);
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-logo">
          <span className="admin-logo-mark">RX</span>
          <span className="admin-logo-text">RIDE<br/>SCHOOL</span>
        </div>
        <div className="login-title">Вход в дневник</div>
        <div className="login-subtitle">Для наставников и администраторов</div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span>Почта</span>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(""); }}
              placeholder="c1@extremekids.ru"
              autoComplete="username"
            />
          </label>
          <label className="login-field">
            <span>Пароль</span>
            <div className="login-password-row">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button type="button" className="login-eye" onClick={() => setShowPassword(v => !v)}>
                {showPassword ? "Скрыть" : "Показать"}
              </button>
            </div>
          </label>

          {(error || remoteError) && <div className="login-error" role="alert"><AlertCircle size={13} /> {error || remoteError}</div>}
          {remoteError && <button type="button" className="modal-btn-secondary" onClick={onRefresh}>Обновить данные</button>}

          <button type="submit" className="login-submit" disabled={submitting}>{submitting ? "Вход…" : "Войти"}</button>
        </form>

        {!remoteLogin && <button type="button" className="login-demo-toggle" onClick={() => setShowDemo(v => !v)}>
          {showDemo ? "Скрыть тестовые доступы" : "Показать тестовые доступы (демо)"}
        </button>}
      </div>
    </div>
  );
}

function useStoredState(key, initial, disabled = false) {
  const [value, setValue] = useState(() => {
    if(disabled) return typeof initial === "function" ? initial() : initial;
    try { const saved = localStorage.getItem(`extreme-kids-v2.1:${key}`); return saved ? JSON.parse(saved) : typeof initial === "function" ? initial() : initial; }
    catch { return typeof initial === "function" ? initial() : initial; }
  });
  useEffect(() => {
    if(disabled) return;
    try { localStorage.setItem(`extreme-kids-v2.1:${key}`, JSON.stringify(value)); }
    catch { window.dispatchEvent(new Event("crm-storage-error")); }
  }, [key, value, disabled]);
  return [value, setValue];
}

export default function App() {
  const [theme,setTheme]=useState(()=>readTheme());
  const [themeError,setThemeError]=useState(false);
  useLayoutEffect(()=>{document.documentElement.dataset.crmTheme=theme;setThemeError(!storeTheme(theme));},[theme]);
  useEffect(()=>{const sync=e=>{if(e.key===THEME_KEY)setTheme(e.newValue==='light'?'light':'dark');};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
  return <><style>{THEME_CSS}</style><button className="theme-toggle" aria-label={theme==='dark'?'Включить светлую тему':'Включить тёмную тему'} onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>
    {theme==='dark'?<Sun size={16}/>:<Moon size={16}/>} <span>{theme==='dark'?'Светлая тема':'Тёмная тема'}</span>
  </button>{themeError&&<div className="theme-notice" role="status">Браузер не разрешил сохранить тему</div>}<SchoolApp/></>;
}

function SchoolApp() {
  const remote = useRemoteSchool(STORAGE);
  const pendingSeries = useRef(new Map());
  const [localUser, setCurrentUser] = useState(null);
  const currentUser = STORAGE ? remote.user : localUser; // { kind: 'coach'|'manager', record }
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [adminTab, setAdminTab] = useState("overview");
  const [searchQ, setSearchQ] = useState("");

  // Данные теперь живут в state верхнего уровня, чтобы формы могли их менять
  // Students and sessions migrate/persist together. Original 2.1 keys remain as a rollback copy.
  const [school, setSchool] = useStoredState("school-v2", () => {
    if(SERVER_MODE || CONFIG_ERROR) return {schemaVersion:2,students:[],sessions:[],migrationIssues:[]};
    const read = (key, fallback) => {try {return JSON.parse(localStorage.getItem(`extreme-kids-v2.1:${key}`)) || fallback;} catch {return fallback;}};
    return migrateSchoolData(read("students", STUDENTS), read("sessions", SESSIONS), read("coaches", COACHES));
  }, SERVER_MODE || !!CONFIG_ERROR);
  const {students, sessions} = STORAGE ? remote.school : school;
  const setStudents = update => setSchool(prev => ({...prev, students:typeof update === "function" ? update(prev.students) : update}));
  const setSessions = update => setSchool(prev => ({...prev, sessions:typeof update === "function" ? update(prev.sessions) : update}));
  const [localCoaches, setCoaches] = useStoredState("coaches", SERVER_MODE || CONFIG_ERROR ? [] : COACHES, SERVER_MODE || !!CONFIG_ERROR);
  const coaches = STORAGE ? remote.coaches : localCoaches;
  const [localManagers, setManagers] = useStoredState("managers", SERVER_MODE || CONFIG_ERROR ? [] : MANAGERS, SERVER_MODE || !!CONFIG_ERROR);
  const managers = STORAGE ? remote.managers : localManagers;
  useEffect(() => {
    if(!SERVER_MODE && !CONFIG_ERROR) setStudents(prev => repairMissingPromoSources(prev, sessions));
  }, [sessions]);

  const [showNewSession, setShowNewSession] = useState(false);
  const [showNewStudent, setShowNewStudent] = useState(false);
  const [showNewCoach, setShowNewCoach] = useState(false);
  const [showNewManager, setShowNewManager] = useState(false);
  const [editingSession, setEditingSession] = useState(null); // тренировка, которую сейчас редактируем
  const [editingStudent, setEditingStudent] = useState(null); // ученик, которого сейчас редактируем
  const [editingCoach, setEditingCoach] = useState(null); // тренер, которого сейчас редактируем
  const [editingManager, setEditingManager] = useState(null); // управляющий, которого сейчас редактируем
  const [confirmDelete, setConfirmDelete] = useState(null); // { kind: 'session'|'student'|'coach'|'manager', id, label }
  const [blockedDeleteMsg, setBlockedDeleteMsg] = useState(null); // если удаление тренера/управляющего запрещено
  const [toast, setToast] = useState(null);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    const fail = () => setStorageError(true);
    window.addEventListener("crm-storage-error", fail);
    return () => window.removeEventListener("crm-storage-error", fail);
  }, []);
  useEffect(() => {
    if(!STORAGE) return;
    setSelectedSession(null);setSelectedStudent(null);setEditingSession(null);setEditingStudent(null);
    setEditingCoach(null);setEditingManager(null);setShowNewSession(false);setShowNewStudent(false);
    setShowNewCoach(false);setShowNewManager(false);setConfirmDelete(null);setAdminTab("overview");
  }, [currentUser?.record.id, currentUser?.kind, currentUser?.record.role, JSON.stringify(currentUser?.record.branches)]);
  const displayStudents = students.map(s => ({...s, attendance: attendancePercent(s.id, sessions.filter(session => session.coachId === s.coachId), !s.attendanceCoachId || s.attendanceCoachId === s.coachId ? s.attendance : null)}));
  const permissionRecord = currentUser && (currentUser.kind === "manager" ? managers : coaches).find(r => r.id === currentUser.record.id);
  const permittedUser = permissionRecord ? {...currentUser, record: permissionRecord} : null;
  const canManage = permittedUser?.kind === "manager" && permittedUser.record.role === "owner";
  const canWrite = permittedUser?.kind === "coach" || canManage;

  function flashToast(text) {
    setToast(text);
    setTimeout(() => setToast(null), 2400);
  }

  async function addSession(payload) {
    if (!canWrite || (permittedUser.kind === "coach" && (payload.coachId !== permittedUser.record.id || !permittedUser.record.branches.includes(payload.branchId)))) return;
    const s = { id: payload.id || nextId("sn"), status: "upcoming", ...payload };
    validateSessionRoster(s, students, sessions);
    if(STORAGE) {await remote.mutate("session_create",s);flashToast("Тренировка сохранена");return;}
    setSessions(prev => [s, ...prev]);
    flashToast("Тренировка добавлена в дневник");
  }

  // Создаёт серию тренировок по расписанию (день недели + время) на N недель вперёд —
  // дальше остаётся только отмечать посещаемость, не создавая каждую тренировку заново
  async function addRecurringSessions({ slots, startDate, weeksAhead, ...base }) {
    if (!canWrite || (permittedUser.kind === "coach" && (base.coachId !== permittedUser.record.id || !permittedUser.record.branches.includes(base.branchId)))) return;
    if (base.type === "promo") throw new Error("Промо создаётся только разово, без серии тренировок");
    validateSessionRoster(base, students, sessions);
    const templateId = base.id || nextId("tpl");
    const newSessions = [];
    slots.forEach(slot => {
      const first = nextWeekdayOnOrAfter(startDate, slot.weekday);
      for (let w = 0; w < weeksAhead; w++) {
        const d = new Date(first);
        d.setDate(d.getDate() + 7 * w);
        newSessions.push({
          id: nextId("sn"),
          status: "upcoming",
          templateId,
          ...Object.fromEntries(Object.entries(base).filter(([key]) => key !== "id")),
          date: isoDate(d),
          time: slot.time,
        });
      }
    });
    if(STORAGE) {
      const key = JSON.stringify({templateId,slots,startDate,weeksAhead,base});
      if(!pendingSeries.current.has(key)) pendingSeries.current.set(key,newSessions);
      await remote.mutate("sessions_create",{sessions:pendingSeries.current.get(key),__expected:base.__expected});
      pendingSeries.current.delete(key);flashToast(`Создано тренировок: ${newSessions.length}`);return;
    }
    setSessions(prev => [...newSessions, ...prev]);
    flashToast(`Создано тренировок: ${newSessions.length}`);
  }

  async function saveSession(id, payload) {
    if (!canEditSession(permittedUser, sessions.find(s => s.id === id))) return;
    const existing = sessions.find(s => s.id === id);
    if (existing.status !== "upcoming" && ["type", "discipline", "coachId", "branchId"].some(key => payload[key] !== existing[key])) throw new Error("У закрытой тренировки наставник, направление, филиал и тип зафиксированы");
    if (existing.status !== "upcoming" && !payload.note?.trim()) throw new Error("Заметка обязательна — опишите, как прошла тренировка");
    if (existing.status === "upcoming") validateSessionRoster({...existing,...payload}, students, sessions);
    if(STORAGE) {await remote.mutate("session_update",{...payload,id});flashToast("Изменения сохранены");return;}
    setSchool(prev => updateSessionInState(prev, id, payload));
    flashToast("Изменения сохранены");
  }

  async function saveAttendance(sessionId, payload) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session || !canEditSession(permittedUser, session)) return false;
    let updated;
    try { updated = finalizeSession(session, payload); }
    catch (error) { flashToast(error.message); return false; }
    if(STORAGE) {
      try {await remote.mutate("session_close",{id:sessionId,...payload});flashToast("Запись сохранена");return true;}
      catch(error) {flashToast(error.message);throw error;}
    }
    setSchool(prev => ({...prev, sessions:prev.sessions.map(s => s.id === sessionId ? updated : s),
      students:updated.type === "promo" ? prev.students.map(s => session.status === "upcoming" || session.promoResults?.[s.id] !== updated.promoResults?.[s.id] ? reconcilePromoStudent(s, updated, prev.sessions) : s) : prev.students}));
    flashToast("Запись сохранена в дневник");
    return true;
  }


  async function deleteSession(id) {
    if (!canEditSession(permittedUser, sessions.find(s => s.id === id))) return;
    if(STORAGE) {await remote.mutate("session_delete",{id});if(selectedSession?.id===id)setSelectedSession(null);flashToast("Тренировка удалена");return;}
    const next = removeSessionFromState({students, sessions}, id);
    setSchool(prev => ({...prev, ...next}));
    if (selectedSession?.id === id) setSelectedSession(null);
    flashToast("Тренировка удалена");
  }

  async function addStudent(payload) {
    if (!canWrite) return;
    const s = { id: nextId("s"), attendance: null, lastNote: "", joinDate: todayIso(), status: "active", origin: "promo", ...payload, childId:payload.childId || nextId("child") };
    validateEnrollment(students, s);
    if(STORAGE) {await remote.mutate("student_create",s);flashToast("Ученик сохранён");return;}
    setStudents(prev => [s, ...prev]);
    flashToast("Ученик добавлен");
  }

  async function quickUpdateStudent(id, patch) {
    if (!canWrite) return;
    if(STORAGE) {try {await remote.mutate("student_patch",{...patch,id});return true;} catch(error) {flashToast(error.message);return false;}}
    setStudents(prev => prev.map(s => s.id === id ? patchEnrollment(s, patch) : s));
    flashToast("Статус ученика обновлён");
    return true;
  }

  async function saveStudent(id, payload) {
    if (!canWrite) return;
    if(STORAGE) {await remote.mutate("student_update",{...payload,id});flashToast("Изменения сохранены");return;}
    const next = updateEnrollment(students, id, payload);
    setStudents(next);
    flashToast("Изменения сохранены");
  }

  async function deleteStudent(id) {
    if (!canWrite) return;
    if(STORAGE) {await remote.mutate("student_archive",{id,archivedAt:todayIso()});if(selectedStudent?.id===id)setSelectedStudent(null);flashToast("Ученик перенесён в архив");return;}
    setStudents(prev => prev.map(s => s.id === id ? archiveStudent(s, todayIso()) : s));
    // Сохраняем все составы, посещения и результаты для истории и начислений.
    if (selectedStudent?.id === id) setSelectedStudent(null);
    flashToast("Ученик перенесён в архив; история сохранена");
  }

  async function addCoach(payload) {
    if (!canManage) return;
    if(STORAGE) {await remote.mutate("coach_create",payload);flashToast("Карточка сохранена. Доступ назначается через Supabase Auth");return;}
    const c = { id: nextId("c"), avatar: initialsOf(payload.name), ...payload };
    setCoaches(prev => [c, ...prev]);
    flashToast("Тренер добавлен");
  }

  async function saveCoach(id, payload) {
    if (!canManage) return;
    if(STORAGE) {await remote.mutate("coach_update",{...payload,id});flashToast("Изменения сохранены");return;}
    setCoaches(prev => prev.map(c => c.id === id ? { ...c, ...payload, avatar: initialsOf(payload.name) } : c));
    flashToast("Изменения сохранены");
  }

  async function deleteCoach(id) {
    if (!canManage) return;
    if(STORAGE) {await remote.mutate("coach_delete",{id});flashToast("Карточка удалена");return;}
    setCoaches(prev => prev.filter(c => c.id !== id));
    flashToast("Тренер удалён");
  }

  async function addManager(payload) {
    if (!canManage) return;
    if(STORAGE) {await remote.mutate("manager_create",payload);flashToast("Карточка сохранена. Доступ назначается через Supabase Auth");return;}
    const m = { id: nextId("m"), avatar: initialsOf(payload.name), ...payload };
    setManagers(prev => [m, ...prev]);
    flashToast("Администратор добавлен");
  }

  async function saveManager(id, payload) {
    if (!canManage) return;
    if (managers.find(m => m.id === id)?.role === "owner" && payload.role !== "owner" && managers.filter(m => m.role === "owner").length === 1) { flashToast("В системе должен остаться владелец с полным доступом"); return; }
    if(STORAGE) {await remote.mutate("manager_update",{...payload,id});flashToast("Изменения сохранены");return;}
    setManagers(prev => prev.map(m => m.id === id ? { ...m, ...payload, avatar: initialsOf(payload.name) } : m));
    flashToast("Изменения сохранены");
  }

  async function deleteManager(id) {
    if (!canManage) return;
    if(STORAGE) {await remote.mutate("manager_delete",{id});flashToast("Карточка удалена");return;}
    setManagers(prev => prev.filter(m => m.id !== id));
    flashToast("Администратор удалён");
  }

  function requestDelete(kind, id, label) {
    if(kind==='session' && !canEditSession(permittedUser,sessions.find(s=>s.id===id)))return;
    if (kind === "coach") {
      const hasStudents = students.some(s => coachesOfStudent(s).includes(id));
      const hasSessions = sessions.some(s => s.coachId === id);
      if (hasStudents || hasSessions) {
        setBlockedDeleteMsg(
          `Нельзя удалить ${label} — за ним закреплены ${hasStudents ? "ученики" : ""}${hasStudents && hasSessions ? " и " : ""}${hasSessions ? "тренировки" : ""}. Сначала переназначь их другому тренеру.`
        );
        return;
      }
    }
    if (kind === "manager") {
      const target = managers.find(m => m.id === id);
      if (target?.role === "owner") {
        setBlockedDeleteMsg("Нельзя удалить владельца — в системе должен остаться хотя бы один аккаунт с полным доступом.");
        return;
      }
      if (currentUser?.kind === "manager" && currentUser.record.id === id) {
        setBlockedDeleteMsg("Нельзя удалить аккаунт, под которым вы сейчас авторизованы.");
        return;
      }
    }
    setConfirmDelete({ kind, id, label });
  }

  async function handleConfirmedDelete() {
    try {
    if (!confirmDelete) return;
    if (confirmDelete.kind === "session") await deleteSession(confirmDelete.id);
    if (confirmDelete.kind === "student") await deleteStudent(confirmDelete.id);
    if (confirmDelete.kind === "coach") await deleteCoach(confirmDelete.id);
    if (confirmDelete.kind === "manager") await deleteManager(confirmDelete.id);
    setConfirmDelete(null);
    } catch(error) {flashToast(error.message);}
  }

  function handleLogout() {
    if(STORAGE) remote.logout().catch(error => flashToast(error.message));
    setCurrentUser(null);
    setSelectedSession(null);
    setSelectedStudent(null);
    setAdminTab("overview");
  }

  if(CONFIG_ERROR) return <div className="root"><style>{THEMED_CSS}</style><div className="login-error" role="alert">{CONFIG_ERROR}</div></div>;
  if(STORAGE && remote.loading && !currentUser) return <div className="root"><style>{THEMED_CSS}</style><div className="login-shell" role="status">Загрузка CRM…</div></div>;
  // Не авторизован — только экран входа
  if (!currentUser) {
    return (
      <div className="root">
        <style>{THEMED_CSS}</style>
        <LoginScreen coaches={coaches} managers={managers} onLogin={setCurrentUser} remoteLogin={STORAGE ? remote.login : null} remoteError={remote.error} onRefresh={() => remote.refresh().catch(()=>{})} />
      </div>
    );
  }

  const view = currentUser.kind === "coach" ? "coach" : "admin";
  // Берём тренера/управляющего свежими из state — на случай если данные отредактировали
  const activeCoach = view === "coach"
    ? (coaches.find(c => c.id === currentUser.record.id) || currentUser.record)
    : null;
  const activeManager = view === "admin"
    ? (managers.find(m => m.id === currentUser.record.id) || currentUser.record)
    : null;

  return (
    <div className="root">
      <style>{THEMED_CSS}</style>

      {STORAGE && <div className="server-status" role="status" style={{padding:"8px 16px",fontSize:12,color:"var(--crm-grey-extra)"}}>Общая база · {remote.busy ? "Сохранение…" : "Supabase"}<button className="modal-btn-secondary" disabled={remote.busy} onClick={() => remote.refresh().catch(()=>{})}>Обновить данные</button></div>}
      {STORAGE && remote.error && <div className="storage-error" role="alert">{remote.error}</div>}
      {storageError && <div className="storage-error" role="alert">Не удалось сохранить изменения в браузере. Не закрывайте страницу, пока не освободите место.</div>}
      {toast && <div className="toast"><CheckCircle2 size={14} />{toast}</div>}

      {view === "coach" ? (
        <CoachView
          versions={remote.versions}
          coach={activeCoach}
          coaches={coaches}
          students={displayStudents}
          sessions={sessions}
          session={sessions.find(s => s.id === selectedSession?.id) || null}
          setSession={setSelectedSession}
          student={displayStudents.find(s => s.id === selectedStudent?.id) || null}
          setStudent={setSelectedStudent}
          onNewSession={() => coaches.length ? setShowNewSession(true) : flashToast("Сначала добавьте наставника")}
          onNewStudent={() => coaches.length ? setShowNewStudent(true) : flashToast("Сначала добавьте наставника")}
          onEditSession={(s) => setEditingSession(s)}
          onDeleteSession={(s) => requestDelete("session", s.id, `тренировку ${formatDate(s.date)} в ${s.time}`)}
          onEditStudent={(s) => setEditingStudent(s)}
          onDeleteStudent={(s) => requestDelete("student", s.id, s.name)}
          onSaveAttendance={saveAttendance}
          onQuickUpdateStudent={quickUpdateStudent}
          onLogout={handleLogout}
        />
      ) : (
        <AdminView
          versions={STORAGE ? remote.versions : null}
          tab={adminTab}
          setTab={setAdminTab}
          searchQ={searchQ}
          setSearchQ={setSearchQ}
          students={displayStudents}
          sessions={sessions}
          coaches={coaches}
          managers={managers}
          manager={activeManager}
          onNewSession={() => coaches.length ? setShowNewSession(true) : flashToast("Сначала добавьте наставника")}
          onNewStudent={() => coaches.length ? setShowNewStudent(true) : flashToast("Сначала добавьте наставника")}
          onEditStudent={(s) => setEditingStudent(s)}
          onDeleteStudent={(s) => requestDelete("student", s.id, s.name)}
          onQuickUpdateStudent={quickUpdateStudent}
          onEditSession={(s) => setEditingSession(s)}
          onDeleteSession={(s) => requestDelete("session", s.id, `тренировку ${formatDate(s.date)} в ${s.time}`)}
          onSaveAttendance={saveAttendance}
          onNewCoach={() => setShowNewCoach(true)}
          onEditCoach={(c) => setEditingCoach(c)}
          onDeleteCoach={(c) => requestDelete("coach", c.id, c.name)}
          onNewManager={() => setShowNewManager(true)}
          onEditManager={(m) => setEditingManager(m)}
          onDeleteManager={(m) => requestDelete("manager", m.id, m.name)}
          onLogout={handleLogout}
        />
      )}

      {showNewSession && (
        <SessionModal
          expectedVersions={STORAGE ? remote.versions : null}
          sessions={sessions.filter(s => canEditSession(permittedUser,s))}
          coaches={coaches}
          students={displayStudents}
          defaultCoachId={view === "coach" ? activeCoach.id : null}
          onClose={() => setShowNewSession(false)}
          onSave={async (payload) => { await addSession(payload); setShowNewSession(false); }}
          onSaveRecurring={async (payload) => { await addRecurringSessions(payload); setShowNewSession(false); }}
        />
      )}
      {editingSession && (
        <SessionModal
          expectedVersions={STORAGE ? remote.versions : null}
          sessions={sessions.filter(s => canEditSession(permittedUser,s))}
          coaches={coaches}
          students={displayStudents}
          initialSession={editingSession}
          defaultCoachId={view === "coach" ? activeCoach.id : null}
          onClose={() => setEditingSession(null)}
          onSave={async (payload) => { await saveSession(editingSession.id, payload); setEditingSession(null); }}
        />
      )}
      {showNewStudent && (
        <StudentModal
          expectedVersions={STORAGE ? remote.versions : null}
          coaches={coaches}
          students={students}
          defaultCoachId={view === "coach" ? activeCoach.id : null}
          lockedCoachId={view === "coach" ? activeCoach.id : null}
          onClose={() => setShowNewStudent(false)}
          onSave={async (payload) => { await addStudent(payload); setShowNewStudent(false); }}
        />
      )}
      {editingStudent && (
        <StudentModal
          expectedVersions={STORAGE ? remote.versions : null}
          coaches={coaches}
          initialStudent={editingStudent}
          students={students}
          lockedCoachId={view === "coach" ? activeCoach.id : null}
          onClose={() => setEditingStudent(null)}
          onSave={async (payload) => { await saveStudent(editingStudent.id, payload); setEditingStudent(null); }}
        />
      )}
      {showNewCoach && (
        <CoachModal
          expectedVersions={STORAGE ? remote.versions : null}
          existingCoaches={coaches}
          managers={managers}
          onClose={() => setShowNewCoach(false)}
          onSave={async (payload) => { await addCoach(payload); setShowNewCoach(false); }}
        />
      )}
      {editingCoach && (
        <CoachModal
          expectedVersions={STORAGE ? remote.versions : null}
          initialCoach={editingCoach}
          existingCoaches={coaches}
          managers={managers}
          onClose={() => setEditingCoach(null)}
          onSave={async (payload) => { await saveCoach(editingCoach.id, payload); setEditingCoach(null); }}
        />
      )}
      {showNewManager && (
        <ManagerModal
          expectedVersions={STORAGE ? remote.versions : null}
          existingManagers={managers}
          coaches={coaches}
          onClose={() => setShowNewManager(false)}
          onSave={async (payload) => { await addManager(payload); setShowNewManager(false); }}
        />
      )}
      {editingManager && (
        <ManagerModal
          expectedVersions={STORAGE ? remote.versions : null}
          initialManager={editingManager}
          existingManagers={managers}
          coaches={coaches}
          onClose={() => setEditingManager(null)}
          onSave={async (payload) => { await saveManager(editingManager.id, payload); setEditingManager(null); }}
        />
      )}
      {confirmDelete?.kind === "session" && <SessionDeleteDialog
        anchor={sessions.find(s=>s.id===confirmDelete.id)} sessions={sessions}
        versions={STORAGE ? remote.versions : null} onCancel={()=>setConfirmDelete(null)}
        onConfirm={async payload=>{
          if(STORAGE)await remote.mutate('sessions_delete',payload);
          else setSchool(prev=>({...prev,sessions:prev.sessions.filter(s=>!payload.sessionIds.includes(s.id))}));
          setSelectedSession(null);setConfirmDelete(null);flashToast(`Удалено тренировок: ${payload.sessionIds.length}`);
        }}/>}
      {confirmDelete && confirmDelete.kind !== "session" && (
        <ConfirmDialog
          label={confirmDelete.label}
          archive={confirmDelete.kind === "student"}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleConfirmedDelete}
        />
      )}
      {blockedDeleteMsg && (
        <AlertDialog
          text={blockedDeleteMsg}
          onClose={() => setBlockedDeleteMsg(null)}
        />
      )}
    </div>
  );
}

/* ============================================================
   ВИД ТРЕНЕРА — мобильный дневник
   ============================================================ */
function CoachView({ versions, coach, coaches, students, sessions, session, setSession, student, setStudent, onNewSession, onNewStudent, onEditSession, onDeleteSession, onEditStudent, onDeleteStudent, onSaveAttendance, onQuickUpdateStudent, onLogout }) {
  const [tab, setTab] = useState("today");
  const disc = DISCIPLINES[coach.discipline];

  // тренер может смотреть свой дневник в любом филиале, даже если сам ведёт занятия только в одном —
  // пригодится, если нужно подменить коллегу или сверить расписание другого зала
  const [activeBranch, setActiveBranch] = useState(coach.branches[0]);
  const effectiveBranch = activeBranch;

  const mySessions = sessions.filter(s => s.coachId === coach.id && s.branchId === effectiveBranch);
  const [selectedDate, setSelectedDate] = useCalendarSelection();
  const myStudents = coachStudents(students, sessions, coach.id).filter(s => s.branchId === effectiveBranch);

  if (session) return (
    <SessionDetail
      expectedVersions={versions}
      session={session}
      onBack={() => setSession(null)}
      students={students}
      onEdit={() => { onEditSession(session); setSession(null); }}
      onDelete={() => onDeleteSession(session)}
      onSaveAttendance={(payload) => onSaveAttendance(session.id, payload)}
    />
  );
  if (student) return (
    <StudentDetail
      student={student}
      onBack={() => setStudent(null)}
      sessions={mySessions}
      coaches={coaches}
      onEdit={() => { onEditStudent(student); setStudent(null); }}
      onDelete={() => onDeleteStudent(student)}
      onQuickUpdate={(patch) => onQuickUpdateStudent(student.id, patch)}
    />
  );

  return (
    <div className="phone-frame">
      <div className="phone-screen" style={{ "--accent": disc.color }}>
        {/* Header дневника */}
        <header className="diary-header">
          <div className="diary-header-top">
            <div className="coach-id">
              <div className="coach-avatar" style={{ background: disc.color }}>{coach.avatar}</div>
              <div>
                <div className="coach-name">{coach.name}</div>
                <div className="coach-disc">
                  <DisciplineGlyph d={coach.discipline} size={12} /> {disc.label} · {myStudents.filter(isEnrolled).length} учеников в {BRANCHES[effectiveBranch].label}
                </div>
              </div>
            </div>
            <button className="logout-btn" onClick={onLogout} title="Выйти">
              <LogOut size={16} />
            </button>
          </div>

          <div className="branch-switch">
            {Object.entries(BRANCHES).map(([bId, b]) => (
              <button
                key={bId}
                className={effectiveBranch === bId ? "branch-pill active" : "branch-pill"}
                style={effectiveBranch === bId ? { borderColor: b.color, color: b.color } : {}}
                onClick={() => setActiveBranch(bId)}
              >
                <MapPin size={11} /> {b.label}{!coach.branches.includes(bId) ? " (не мой)" : ""}
              </button>
            ))}
          </div>

          <div className="diary-title-stamp">
            <span>ДНЕВНИК ТРЕНИРОВОК</span>
            <span className="diary-date">{BRANCHES[effectiveBranch].label} · {new Date(todayIso() + "T00:00:00").toLocaleDateString("ru-RU")}</span>
          </div>
        </header>

        {/* Табы */}
        <nav className="coach-tabs">
          {[
            { id: "today", label: "Сегодня", icon: <Calendar size={15} /> },
            { id: "students", label: "Ученики", icon: <Users size={15} /> },
            { id: "stats", label: "Статистика", icon: <TrendingUp size={15} /> },
            { id: "help", label: "Памятка", icon: <AlertCircle size={15} /> },
          ].map(t => (
            <button key={t.id} className={tab === t.id ? "tab active" : "tab"} onClick={() => setTab(t.id)}>
              {t.icon}{t.label}
            </button>
          ))}
        </nav>

        <main className="coach-main">
          {tab === "today" && (
            <TodayTab coachSessions={mySessions} selectedDate={selectedDate} setSelectedDate={setSelectedDate} onOpen={setSession} disc={disc} />
          )}
          {tab === "students" && (
            <StudentsTab coaches={coaches} filterCoaches={studentFilterCoaches(coaches, {kind:"coach", record:coach}, effectiveBranch)} students={myStudents} onOpen={setStudent} disc={disc} onNewStudent={onNewStudent} />
          )}
          {tab === "stats" && (
            <CoachStatsTab coach={coach} students={myStudents} sessions={mySessions} disc={disc} />
          )}
          {tab === "help" && <CoachHelpTab disc={disc} />}
        </main>

        <button className="fab" style={{ background: disc.color }} onClick={onNewSession} aria-label="Новая тренировка">
          <Plus size={24} color="var(--crm-surface)" strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}

function TodayTab({ coachSessions, selectedDate, setSelectedDate, onOpen, disc }) {
  const isToday = selectedDate === todayIso();
  const markedDates = useMemo(() => new Set(coachSessions.map(s => s.date)), [coachSessions]);
  const daySessions = coachSessions
    .filter(s => s.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));

  const past = coachSessions
    .filter(s => s.date < todayIso())
    .sort((a, b) => (a.date === b.date ? b.time.localeCompare(a.time) : b.date.localeCompare(a.date)));

  return (
    <div className="tab-content">
      <DateCalendarNav selectedDate={selectedDate} onSelect={setSelectedDate} markedDates={markedDates} />

      {isToday ? (
        <>
          <Section title="Сегодня" count={daySessions.length}>
            {daySessions.length === 0 ? <Empty text="На сегодня тренировок нет" /> :
              daySessions.map(s => <SessionCard key={s.id} s={s} onOpen={onOpen} />)}
          </Section>
          <Section title="Прошедшие" count={past.length}>
            {past.length === 0 ? <Empty text="История пуста" /> :
              past.map(s => <SessionCard key={s.id} s={s} onOpen={onOpen} />)}
          </Section>
        </>
      ) : (
        <Section title={formatDate(selectedDate)} count={daySessions.length}>
          {daySessions.length === 0 ? <Empty text="В этот день тренировок не было" /> :
            daySessions.map(s => <SessionCard key={s.id} s={s} onOpen={onOpen} />)}
        </Section>
      )}
    </div>
  );
}

/* ============================================================
   КАЛЕНДАРЬ ВЫБОРА ДАТЫ — стрелки дня + разворачиваемая сетка месяца
   Используется в дневнике тренера и в расписании управляющего
   ============================================================ */
const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function shiftIsoDate(iso, deltaDays) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + deltaDays);
  return isoDate(d);
}
// ближайшая дата (включая саму startIso), выпадающая на заданный день недели: 0=Пн..6=Вс
function nextWeekdayOnOrAfter(startIso, targetWeekday) {
  const d = new Date(startIso + "T00:00:00");
  const cur = (d.getDay() + 6) % 7;
  const diff = (targetWeekday - cur + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}
function buildMonthCells(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  const startWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7; // понедельник = 0
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function DateCalendarNav({ selectedDate, onSelect, markedDates }) {
  const today=useLocalToday();
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(selectedDate.slice(0, 7));

  const dateObj = new Date(selectedDate + "T00:00:00");
  const label = dateObj.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const weekdayLabel = dateObj.toLocaleDateString("ru-RU", { weekday: "long" });
  const monthLabel = new Date(viewMonth + "-01T00:00:00").toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

  function pick(iso) {
    onSelect(iso);
    setOpen(false);
  }
  function shiftMonth(delta) {
    const [y, m] = viewMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  function toggleOpen() {
    setViewMonth(selectedDate.slice(0, 7));
    setOpen(o => !o);
  }

  const cells = buildMonthCells(viewMonth);

  return (
    <div className="date-nav-wrap">
      <div className="date-nav">
        <button className="date-nav-arrow" onClick={() => onSelect(shiftIsoDate(selectedDate, -1))} aria-label="Предыдущий день">
          <ChevronLeft size={16} />
        </button>
        <button className="date-nav-label" aria-label="Открыть календарь" aria-expanded={open} onClick={toggleOpen}>
          <Calendar size={13} />
          <span>{label}</span>
          <span className="date-nav-weekday">{weekdayLabel}</span>
        </button>
        <button className="date-nav-arrow" onClick={() => onSelect(shiftIsoDate(selectedDate, 1))} aria-label="Следующий день">
          <ChevronRight size={16} />
        </button>
        {selectedDate !== today && (
          <button className="date-nav-today" onClick={() => pick(today)}>Сегодня</button>
        )}
      </div>

      {open && (
        <div className="date-calendar">
          <div className="date-calendar-head">
            <button onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц"><ChevronLeft size={14} /></button>
            <span>{monthLabel}</span>
            <button onClick={() => shiftMonth(1)} aria-label="Следующий месяц"><ChevronRight size={14} /></button>
          </div>
          <div className="date-calendar-weekdays">
            {WEEKDAYS_RU.map(w => <span key={w}>{w}</span>)}
          </div>
          <div className="date-calendar-grid">
            {cells.map((d, i) => {
              if (!d) return <span key={i} className="date-calendar-cell empty" />;
              const iso = `${viewMonth}-${String(d).padStart(2, "0")}`;
              const cls = ["date-calendar-cell"];
              if (iso === selectedDate) cls.push("selected");
              if (iso === today) cls.push("is-today");
              if (markedDates?.has(iso)) cls.push("has-sessions");
              return (
                <button key={i} className={cls.join(" ")} aria-label={`Выбрать дату ${iso}`} aria-current={iso === today ? "date" : undefined} aria-pressed={iso === selectedDate} onClick={() => pick(iso)}>
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, count, children }) {
  return (
    <div className="section">
      <div className="section-head">
        <span className="section-title">{title}</span>
        <span className="section-count">{count}</span>
      </div>
      <div className="section-body">{children}</div>
    </div>
  );
}

function Empty({ text }) {
  return <div className="empty-state">{text}</div>;
}

function SessionCard({ s, onOpen }) {
  const disc = DISCIPLINES[s.discipline];
  const statusMap = {
    upcoming: { label: "Запланирована", cls: "status-upcoming" },
    done: { label: "Проведена", cls: "status-done" },
    missed: { label: "Пропущена", cls: "status-missed" },
  };
  const st = statusMap[s.status];
  return (
    <button className="session-card" style={{ "--card-accent": disc.color }} onClick={() => onOpen(s)}>
      <PerfEdge />
      <div className="session-card-row">
        <div className="session-time">
          <Clock size={13} /> {s.time}
          <span className="session-dur">· {s.duration} мин</span>
        </div>
        <span className={`status-pill ${st.cls}`}>{st.label}</span>
      </div>
      <div className="session-mid">
        <span className="session-type-tag">{SESSION_TYPES[s.type].short}</span>
        <span className="session-loc"><MapPin size={12} /> {s.groupName}</span>
      </div>
      <div className="session-foot">
        <span className="session-count-students">{s.studentIds.length} {s.studentIds.length === 1 ? "ученик" : "ученика"}</span>
        <ChevronRight size={16} className="chev" />
      </div>
    </button>
  );
}

function DirectionBadges({student}) {
  return <div className="direction-badges">{directionsOf(student).map(key => <span key={key} className="table-disc-tag" style={{color: DISCIPLINES[key].color, borderColor: DISCIPLINES[key].color}}>{DISCIPLINES[key].label}</span>)}</div>;
}
function CoachBadges({student, coaches}) {
  const identityReview = student.legacyAssignments?.identity_review;
  return <div className="coach-badges"><span className="coach-badge">Основной: {coaches.find(c => c.id === student.coachId)?.name || "Не назначен — требуется проверка"}</span>{student.legacyReview && <span className="form-hint">Проверьте перенесённое направление</span>}{identityReview?.status === "pending" && <span className="form-hint">Возможный дубль {identityReview.group_id} — проверить личность</span>}</div>;
}
function StudentFilters({students, direction, setDirection, age, setAge, level, setLevel, filterCoaches, coachFilter, setCoachFilter}) {
  return <div className="crm-filters">
    <label>Направление<select aria-label="Направление" className="form-select" value={direction} onChange={e => setDirection(e.target.value)}><option value="all">Все направления</option>{Object.entries(DISCIPLINES).map(([key,d]) => <option key={key} value={key}>{d.label}</option>)}</select></label>
    <label>Возраст<select aria-label="Возраст" className="form-select" value={age} onChange={e => setAge(e.target.value)}><option value="all">Любой возраст</option>{[...new Set(students.map(s => s.age))].sort((a,b) => a-b).map(age => <option key={age} value={age}>{age} лет</option>)}</select></label>
    <label>Навык катания<select aria-label="Навык катания" className="form-select" value={level} onChange={e => setLevel(e.target.value)}><option value="all">Любой уровень</option>{["Начальный","Средний","Продвинутый"].map(l => <option key={l}>{l}</option>)}</select></label>
    <label>Наставник<select aria-label="Наставник" className="form-select" value={coachFilter} onChange={e => setCoachFilter(e.target.value)}><option value="all">Все наставники</option>{filterCoaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
  </div>;
}
function StatusFilters({students, value, onChange}) {
  return <div className="status-filter-row">{[["all","Все"],["active","Активные"],["left","Неактивные"],["vacation","В отпуске"],["promo","С пробного"],["archived","Архив"]].map(([key,label]) => <button key={key} className={value === key ? "status-chip active" : "status-chip"} onClick={() => onChange(key)}>{label} ({students.filter(s => matchesStudent(s,{status:key})).length})</button>)}</div>;
}
function MonthPicker({value, onChange}) {
  const [year, month] = value.split("-");
  const maxYear = Math.max(new Date().getFullYear() + 5, Number(year));
  const years = Array.from({length:maxYear - 2000 + 1}, (_,i) => 2000+i);
  return <div className="period-picker"><label>Месяц статистики<select aria-label="Месяц статистики" className="form-select" value={month} onChange={e => onChange(`${year}-${e.target.value}`)}>{Array.from({length:12},(_,i)=>String(i+1).padStart(2,"0")).map(m => <option key={m} value={m}>{monthLabelFull(`2000-${m}`).split(" ")[0]}</option>)}</select></label><label>Год<select aria-label="Год статистики" className="form-select" value={year} onChange={e => onChange(`${e.target.value}-${month}`)}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></label></div>;
}
function PromoPanel({sessions}) {
  const stats = promoStats(sessions);
  return <div className="panel"><div className="panel-title">Промо за выбранный месяц</div><div className="stat-grid">
    <StatBlock label="Закрыто промо-занятий" value={stats.sessions} accent="var(--crm-amber)" />
    <StatBlock label="Пришли на промо" value={stats.attended} accent="var(--crm-amber)" />
    <StatBlock label="Купили" value={stats.bought} accent="var(--crm-green)" />
    <StatBlock label="Не купили" value={stats.notBought} accent="var(--crm-danger)" />
  </div><div className="form-hint">Конверсия (Б без результата не учитывается): {stats.conversion === null ? "—" : stats.conversion + "%"} · Не пришли: {stats.absent} · Результат покупки не указан: {stats.unknown}</div></div>;
}

function StudentsTab({ students, coaches, filterCoaches, onOpen, disc, onNewStudent }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [direction, setDirection] = useState("all");
  const [age, setAge] = useState("all");
  const [level, setLevel] = useState("all");
  const [coachFilter, setCoachFilter] = useState("all");
  const effectiveCoachFilter = filterCoaches.some(c => c.id === coachFilter) ? coachFilter : "all";
  useEffect(() => { if (coachFilter !== effectiveCoachFilter) setCoachFilter(effectiveCoachFilter); }, [coachFilter, effectiveCoachFilter]);
  const scoped = students.filter(s => matchesStudent(s, {query: q, direction, age, level, coachId: effectiveCoachFilter, archived: "include"}));
  const filtered = scoped.filter(s => matchesStudent(s, {status: statusFilter}));
  return (
    <div className="tab-content">
      <div className="search-row">
        <div className="search-bar">
          <Search size={15} />
          <input placeholder="Найти ученика..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <button className="add-icon-btn" style={{ borderColor: disc.color, color: disc.color }} onClick={onNewStudent} aria-label="Добавить ученика">
          <Plus size={16} />
        </button>
      </div>
      <StudentFilters students={students} direction={direction} setDirection={setDirection} age={age} setAge={setAge} level={level} setLevel={setLevel} filterCoaches={filterCoaches} coachFilter={effectiveCoachFilter} setCoachFilter={setCoachFilter} />
      <StatusFilters students={scoped} value={statusFilter} onChange={setStatusFilter} />
      <div className="form-hint">Детей: {uniqueChildren(filtered)} · записей по направлениям: {filtered.length}</div>

      <div className="student-list">
        {filtered.length === 0 && <Empty text="Никого не нашлось" />}
        {filtered.map(s => {
          const st = STUDENT_STATUS[s.status || "active"];
          return (
            <button key={s.id} className="student-row" onClick={() => onOpen(s)}>
              <div className="student-row-avatar" style={{ borderColor: disc.color }}>
                {s.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div className="student-row-info">
                <div className="student-row-name">
                  {s.name}
                  {s.flag === "injury" && <AlertCircle size={13} color="var(--crm-danger)" />}
                  {(s.origin || "regular") === "promo" && <Star size={12} color="var(--crm-amber)" />}
                </div>
                <div className="student-row-meta">
                  {s.age} лет · {s.level}
                  <DirectionBadges student={s} />
                  <CoachBadges student={s} coaches={coaches} />
                  {isArchived(s) && <span className="status-dot-label"> · Архив</span>}
                  {(s.status || "active") !== "active" && (
                    <span className="status-dot-label" style={{ color: st.color }}> · {st.label}</span>
                  )}
                </div>
              </div>
              <div className="student-row-attendance">
                <div className="attendance-ring" style={{ "--pct": s.attendance, "--c": disc.color }}>
                  {formatAttendance(s.attendance)}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   ГРАФИК ПРИТОКА / ОТТОКА УЧЕНИКОВ — по месяцам
   Используется в статистике тренера, у управляющего и в карточке тренера в админке
   ============================================================ */
// Компактная зарплата тренера — сумма за текущий месяц, по клику разворачивается в разбивку по тренировкам
const salaryMoney = amount => Number.isFinite(amount) ? `${amount.toLocaleString("ru-RU")} ₽` : "Не рассчитано";
function SalaryPanel({ coach, sessions, selectedMonth }) {
  const [open, setOpen] = useState(false);
  const monthKey = selectedMonth || todayIso().slice(0, 7);
  const monthSessions = sessions
    .filter(s => s.status === "done" && s.date.startsWith(monthKey))
    .sort((a, b) => (a.date === b.date ? b.time.localeCompare(a.time) : b.date.localeCompare(a.date)));
  const salary = calcCoachSalary(coach, monthSessions);

  return (
    <div className="panel salary-panel">
      <button className="salary-panel-toggle" onClick={() => setOpen(v => !v)}>
        <div>
          <div className="panel-title">Зарплата за {monthLabelFull(monthKey)}</div>
          <div className="salary-panel-sub">{salary.totalSessions} тренировок проведено{salary.requiresGradeConfirmation && " · категория не подтверждена, расчёт приостановлен"}</div>
        </div>
        <div className="salary-panel-total">
          {salaryMoney(salary.total)}
          <ChevronRight size={16} className={open ? "salary-chevron open" : "salary-chevron"} />
        </div>
      </button>
      {open && (
        <div className="salary-breakdown-list">
          {monthSessions.length === 0 ? (
            <Empty text="В этом месяце ещё не было проведённых тренировок" />
          ) : (
            monthSessions.map(s => (
              <div className="salary-breakdown-row" key={s.id}>
                <div className="salary-breakdown-info">
                  <div className="salary-breakdown-title">{formatDate(s.date)} · {s.time} · {SESSION_TYPES[s.type].label}</div>
                  <div className="salary-breakdown-meta">{s.groupName}{s.type !== "individual" ? ` · ${presentIds(s).length} пришли` : ""}</div>
                </div>
                <div className="salary-breakdown-amount">{salaryMoney(sessionEarning(coach, s))}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function FlowChart({ students, endMonth }) {
  const rows = buildFlowStats(students, 6, endMonth);
  const maxVal = Math.max(...rows.map(r => Math.max(r.in, r.out)), 1);
  const totalIn = rows.reduce((a, r) => a + r.in, 0);
  const totalOut = rows.reduce((a, r) => a + r.out, 0);
  return (
    <div className="panel">
      <div className="panel-title-row">
        <div className="panel-title">Приток / отток учеников</div>
        <div className="flow-legend">
          <span><i style={{ background: "var(--crm-green)" }} /> Пришли ({totalIn})</span>
          <span><i style={{ background: "var(--crm-danger)" }} /> Ушли ({totalOut})</span>
        </div>
      </div>
      <div className="flow-chart">
        {rows.map(r => (
          <div className="flow-col" key={r.key}>
            <div className="flow-bars">
              <div className="flow-bar in" style={{ height: `${(r.in / maxVal) * 100}%` }} title={`Пришло: ${r.in}`} />
              <div className="flow-bar out" style={{ height: `${(r.out / maxVal) * 100}%` }} title={`Ушло: ${r.out}`} />
            </div>
            <div className="flow-col-vals">{r.in}/{r.out}</div>
            <div className="flow-col-label">{r.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoachStatsTab({ coach, students:allStudents, sessions:allSessions, disc }) {
  const students = coachStudents(allStudents, allSessions, coach.id);
  const sessions = allSessions.filter(s => s.coachId === coach.id);
  const [selectedMonth, setSelectedMonth] = useState(todayIso().slice(0,7));
  const monthSessions = sessions.filter(s => s.date.startsWith(selectedMonth));
  const enrolled = students.filter(isEnrolled);
  const avgAttendance = averageSessionAttendance(monthSessions);
  const done = monthSessions.filter(s => s.status === "done").length;
  const missed = monthSessions.filter(s => s.status === "missed").length;
  const levels = ["Начальный", "Средний", "Продвинутый"].map(lv => ({
    level: lv, count: enrolled.filter(s => s.level === lv).length
  }));
  const maxLevel = Math.max(...levels.map(l => l.count), 1);
  const promoCount = enrolled.filter(s => (s.origin || "regular") === "promo").length;
  const leftCount = students.filter(s => s.status === "left").length;

  return (
    <div className="tab-content">
      <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
      <div className="stat-grid">
        <StatBlock label="Средняя посещаемость" value={avgAttendance === null ? "—" : `${avgAttendance}%`} icon={<Target size={16} />} accent={disc.color} />
        <StatBlock label="Учеников сейчас" value={enrolled.length} icon={<Users size={16} />} accent={disc.color} />
        <StatBlock label="Проведено" value={done} icon={<CheckCircle2 size={16} />} accent="var(--crm-green)" />
        <StatBlock label="Пропущено" value={missed} icon={<AlertCircle size={16} />} accent="var(--crm-danger)" />
      </div>

      <SalaryPanel coach={coach} sessions={sessions} selectedMonth={selectedMonth} />
      <PromoPanel sessions={monthSessions} />
      <div className="panel"><div className="panel-title">Ученики сейчас по направлениям</div>{Object.entries(DISCIPLINES).map(([key,d]) => <div key={key} className="direction-count-row"><span>{d.label}</span><strong>{enrolled.filter(s => directionsOf(s).includes(key)).length}</strong></div>)}</div>

      <FlowChart students={students} endMonth={selectedMonth} />

      {(promoCount > 0 || leftCount > 0) && (
        <div className="stat-grid">
          <StatBlock label="С пробного, не переведены" value={promoCount} icon={<Star size={16} />} accent="var(--crm-amber)" />
          <StatBlock label="Ушли всего" value={leftCount} icon={<AlertCircle size={16} />} accent="var(--crm-danger)" />
        </div>
      )}

      <Section title="Уровни группы" count={enrolled.length}>
        <div className="level-bars">
          {levels.map(l => (
            <div className="level-bar-row" key={l.level}>
              <span className="level-bar-label">{l.level}</span>
              <div className="level-bar-track">
                <div className="level-bar-fill" style={{ width: `${(l.count / maxLevel) * 100}%`, background: disc.color }} />
              </div>
              <span className="level-bar-count">{l.count}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function averageAttendance(list) {
  const values = list.map(s => s.attendance).filter(v => Number.isFinite(v));
  return values.length ? Math.round(values.reduce((a,v)=>a+v,0)/values.length) : null;
}

function StatBlock({ label, value, icon, accent }) {
  return (
    <div className="stat-block">
      <div className="stat-block-icon" style={{ color: accent }}>{icon}</div>
      <div className="stat-block-value">{value}</div>
      <div className="stat-block-label">{label}</div>
    </div>
  );
}

/* ============================================================
   ПАМЯТКА ДЛЯ ТРЕНЕРА — краткая инструкция по работе с дневником
   ============================================================ */
function CoachHelpTab({ disc }) {
  const steps = [
    {
      title: "Отметь тренировку",
      text: "Открой карточку в «Сегодня» сразу как закончили — отметь, кто был, кто отсутствовал.",
    },
    {
      title: "Запиши главное",
      text: "В заметке — не пересказ, а суть: что отработали, чей прогресс, на что обратить внимание в следующий раз.",
    },
    {
      title: "Отмечай травмы и ограничения",
      text: "Если ученик травмирован или есть ограничение по нагрузке — указывай это в карточке ученика, чтобы видели другие тренеры.",
    },
    {
      title: "Заводи тренировку заранее",
      text: "Кнопка «+» создаёт запись на любую дату — удобно сразу планировать на неделю вперёд.",
    },
    {
      title: "Два филиала — переключайся сверху",
      text: "Если работаешь в Розе и Иркутском, переключатель филиала в шапке показывает только тех учеников и тренировки, что относятся к выбранному месту.",
    },
  ];

  return (
    <div className="tab-content">
      <div className="help-intro">
        <span className="help-intro-tag" style={{ color: disc.color, borderColor: disc.color }}>ПАМЯТКА</span>
        <p>Дневник заменяет бумажный журнал. Главное правило: запись делается в день тренировки, по горячим следам — так заметки остаются точными и полезными для других тренеров и управляющих.</p>
      </div>

      <div className="help-steps">
        {steps.map((s, i) => (
          <div className="help-step" key={i} style={{ "--accent": disc.color }}>
            <div className="help-step-num">{i + 1}</div>
            <div className="help-step-body">
              <div className="help-step-title">{s.title}</div>
              <div className="help-step-text">{s.text}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="help-footer-note">
        Вопросы по работе системы — пиши управляющему филиала.
      </div>
    </div>
  );
}

/* ============================================================
   ДЕТАЛЬ ТРЕНИРОВКИ — заполнение "страницы дневника"
   ============================================================ */
function SessionDetail({ expectedVersions, session, onBack, students, onEdit, onDelete, onSaveAttendance, readOnly = false, attendanceOnly = false }) {
  const [draftExpected] = useState(expectedVersions);
  const [note, setNote] = useState(session.note || "");
  const [noteError, setNoteError] = useState(false);
  const disc = DISCIPLINES[session.discipline];
  const roster = students.filter(s => session.studentIds.includes(s.id));
  const [present, setPresent] = useState(Object.fromEntries(roster.map(s => [s.id, attendanceSelection(session, s.id, readOnly)])));

  const [promoResults, setPromoResults] = useState(session.promoResults || {});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  async function handleSave() {
    if (saving || readOnly || !onSaveAttendance) return;
    if (!note.trim()) { setNoteError(true); return; }
    const payload = { __expected:draftExpected, note: note.trim(), attendance: Object.fromEntries(roster.map(s => [s.id, present[s.id] === true ? "present" : present[s.id] === false ? "absent" : null])), promoResults };
    try { finalizeSession(session, payload); } catch (error) { setSaveError(error.message); return; }
    setSaveError("");setSaving(true);
    try {if (await onSaveAttendance(payload) !== false) onBack();}
    catch(error) {setSaveError(error.message);}
    finally {setSaving(false);}
  }

  return (
    <div className="phone-frame">
      <div className="phone-screen" style={{ "--accent": disc.color }}>
        <header className="detail-header">
          <button className="back-btn" aria-label="Назад" onClick={onBack}><ChevronLeft size={20} /></button>
          <div className="detail-header-title">
            <DisciplineGlyph d={session.discipline} size={14} />
            {session.type === "promo" ? SESSION_TYPES[session.type].label : `${SESSION_TYPES[session.type].label} тренировка`}
          </div>
          {!readOnly && <div className="detail-header-actions">
            <button className="icon-action-btn" onClick={onEdit} aria-label="Редактировать"><Settings size={16} /></button>
            <button className="icon-action-btn danger" onClick={onDelete} aria-label="Удалить"><X size={16} /></button>
          </div>}
        </header>

        <main className="detail-main">
          <div className="detail-page">
            <PerfEdge />
            <div className="detail-meta-row">
              <MetaChip icon={<Calendar size={13} />} text={formatDate(session.date)} />
              <MetaChip icon={<Clock size={13} />} text={`${session.time} · ${session.duration} мин`} />
              <MetaChip icon={<MapPin size={13} />} text={session.groupName} />
              {session.branchId && (
                <span className="branch-chip" style={{ color: BRANCHES[session.branchId].color, borderColor: BRANCHES[session.branchId].color }}>
                  {BRANCHES[session.branchId].label}
                </span>
              )}
            </div>

            <div className="detail-divider" />

            <div className="detail-label">Присутствие</div>
            <div className="roster-list">
              {roster.map(s => (
                <div key={s.id} className="roster-row">
                  <input
                    type="checkbox"
                    aria-label={`Посещение: ${s.name}`}
                    aria-checked={present[s.id] === null ? "mixed" : !!present[s.id]}
                    ref={el => { if (el) el.indeterminate = present[s.id] === null; }}
                    checked={!!present[s.id]}
                    disabled={readOnly}
                    onChange={() => setPresent(p => ({ ...p, [s.id]: !p[s.id] }))}
                  />
                  <span className="roster-check" style={{ background: present[s.id] ? disc.color : "transparent" }}>
                    {present[s.id] === null ? "—" : present[s.id] ? <CheckCircle2 size={13} color="var(--crm-surface)" /> : "Б"}
                  </span>
                  <span className="roster-name">{s.name}{isArchived(s) && <span className="form-hint"> · архив</span>}</span>
                  <span className="roster-level">{present[s.id] === null ? "Не отмечено" : present[s.id] ? "✓ Был" : "Б Не был"}</span>
                  {!readOnly && <div className="segmented attendance-actions">
                    <button type="button" aria-label={`Пришёл: ${s.name}`} aria-pressed={present[s.id] === true} className={present[s.id] === true ? "seg active" : "seg"} onClick={() => setPresent(p => ({...p, [s.id]: true}))}>Пришёл</button>
                    <button type="button" aria-label={`Не был: ${s.name}`} aria-pressed={present[s.id] === false} className={present[s.id] === false ? "seg active" : "seg"} onClick={() => setPresent(p => ({...p, [s.id]: false}))}>Б</button>
                  </div>}
                </div>
              ))}
            </div>

            <div className="detail-divider" />

            {!attendanceOnly && session.type === "promo" && <div className="promo-outcomes">
              <div className="detail-label">Результат промо</div>
              {roster.map(s => <div className="promo-result" key={s.id}>
                <span>{s.name}{present[s.id] === false && <span className="form-hint"> · при Б результат необязателен</span>}</span>
                {readOnly ? <span>{promoResults[s.id] === "bought" ? "Купил" : promoResults[s.id] === "not_bought" ? "Не купил" : "Не указан"}</span> : <div className="segmented">
                  {[["bought","Купил"],["not_bought","Не купил"], ...(present[s.id] === false ? [[null,"Не указан"]] : [])].map(([key,label]) => <button key={key || "unknown"} aria-pressed={key ? promoResults[s.id] === key : !promoResults[s.id]} className={(key ? promoResults[s.id] === key : !promoResults[s.id]) ? "seg active" : "seg"} onClick={() => {setPromoResults(p => {const next = {...p}; if (key) next[s.id] = key; else delete next[s.id]; return next;}); setSaveError("");}}>{label}</button>)}
                </div>}
              </div>)}
            </div>}
            {saveError && <div className="form-error" role="alert">{saveError}</div>}
            {!attendanceOnly && <>
            <div className="detail-label">Заметка тренера <span className="required-mark">*</span></div>
            <textarea
              className={noteError ? "note-textarea note-textarea-error" : "note-textarea"}
              placeholder="Что отработали, чей прогресс, на что обратить внимание в следующий раз..."
              value={note}
              onChange={e => { setNote(e.target.value); if (noteError) setNoteError(false); }}
              rows={5}
              readOnly={readOnly}
            />
            {noteError && <div className="form-error"><AlertCircle size={13} /> Заметка обязательна — опишите, как прошла тренировка</div>}
            </>}
          </div>
        </main>

        {!readOnly && <div className="detail-footer">
          <button className="save-btn" style={{ background: disc.color }} onClick={handleSave} disabled={saving}>
            {saving ? "Сохранение…" : session.status === "upcoming" ? "Завершить тренировку" : "Сохранить запись"}
          </button>
        </div>}
      </div>
    </div>
  );
}

function MetaChip({ icon, text }) {
  return <span className="meta-chip">{icon}{text}</span>;
}

function formatDate(d) {
  if (!d) return "Дата не указана";
  const date = new Date(d);
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/* ============================================================
   ДЕТАЛЬ УЧЕНИКА — личная карточка / история
   ============================================================ */
function StudentDetail({ student, onBack, sessions, coaches, onEdit, onDelete, onQuickUpdate }) {
  const disc = DISCIPLINES[student.discipline];
  const coach = coaches.find(c => c.id === student.coachId);
  const history = sessions.filter(s => s.studentIds.includes(student.id)).sort((a,b) => b.date.localeCompare(a.date));
  const status = student.status || "active";
  const origin = student.origin || "regular";

  function setStatus(next) {
    if (!onQuickUpdate) return;
    if (next === "left") onQuickUpdate({ status: "left", leftDate: todayIso() });
    else onQuickUpdate({ status: next });
  }
  function convertToRegular() {
    if (onQuickUpdate) onQuickUpdate({ origin: "regular" });
  }

  const [commentDraft, setCommentDraft] = useState("");
  async function addComment() {
    if (!commentDraft.trim() || !onQuickUpdate) return;
    const entry = { id: STORAGE ? crypto.randomUUID() : `cm${Date.now()}`, date: todayIso(), text: commentDraft.trim() };
    if(await onQuickUpdate({ comments: [entry, ...(student.comments || [])] }) === false) return;
    setCommentDraft("");
  }
  function removeComment(id) {
    if (!onQuickUpdate) return;
    onQuickUpdate({ comments: (student.comments || []).filter(c => c.id !== id) });
  }

  return (
    <div className="phone-frame">
      <div className="phone-screen" style={{ "--accent": disc.color }}>
        <header className="detail-header">
          <button className="back-btn" aria-label="Назад" onClick={onBack}><ChevronLeft size={20} /></button>
          <div className="detail-header-title">Карточка ученика</div>
          <div className="detail-header-actions">
            {!isArchived(student) && <><button className="icon-action-btn" onClick={onEdit} aria-label="Редактировать"><Settings size={16} /></button>
            <button className="icon-action-btn danger" onClick={onDelete} aria-label="Архивировать"><X size={16} /></button></>}
          </div>
        </header>
        <main className="detail-main">
          <div className="student-profile-card">
            <div className="student-profile-avatar" style={{ background: disc.color }}>
              {student.name.split(" ").map(n => n[0]).join("")}
            </div>
            <div className="student-profile-name">
              {student.name}
              {student.flag === "injury" && <span className="flag-badge"><AlertCircle size={12} /> Травма</span>}
            </div>
            <div className="student-profile-meta">{student.age} лет · {disc.label}</div>
            <CoachBadges student={student} coaches={coaches} /><div className="form-hint">Ребёнок: {childKey(student)} · запись по направлению: {student.id}</div>
            <DirectionBadges student={student} />
            <div className="student-profile-stats">
              <div className="profile-stat"><div className="profile-stat-val">{formatAttendance(student.attendance)}</div><div className="profile-stat-lbl">Посещение</div></div>
              <div className="profile-stat"><div className="profile-stat-val">{student.level}</div><div className="profile-stat-lbl">Уровень</div></div>
              <div className="profile-stat"><div className="profile-stat-val">{history.length}</div><div className="profile-stat-lbl">Записей</div></div>
            </div>
          </div>

          {isArchived(student) && <div className="promo-banner"><span>Ученик в архиве. История сохранена.</span>{onQuickUpdate && <button onClick={() => onQuickUpdate({archivedAt: null})}>Восстановить</button>}</div>}
          {onQuickUpdate && !isArchived(student) && (
            <>
              <div className="detail-label" style={{ marginTop: 20 }}>Статус ученика</div>
              <div className="status-switch">
                {Object.entries(STUDENT_STATUS).map(([k, s]) => (
                  <button
                    key={k}
                    className={status === k ? "status-pill active" : "status-pill"}
                    style={status === k ? { borderColor: s.color, color: s.color } : {}}
                    onClick={() => setStatus(k)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {status === "left" && student.leftDate && (
                <div className="status-hint">Отметили как ушедшего {formatDate(student.leftDate)}</div>
              )}

              {origin === "promo" && (
                <div className="promo-banner">
                  <span><Star size={13} /> Промо-ученик · добавлен {formatDate(student.joinDate)}</span>
                  <button onClick={convertToRegular}>Перевести в основные</button>
                </div>
              )}
            </>
          )}


          {onQuickUpdate && !isArchived(student) && (
            <>
              <div className="detail-label" style={{ marginTop: 20 }}>Комментарии</div>
              <div className="comment-add-row">
                <input
                  className="form-input" placeholder="Заметка о ученике..."
                  value={commentDraft} onChange={e => setCommentDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addComment(); }}
                />
                <button type="button" className="modal-btn-secondary" onClick={addComment}>Добавить</button>
              </div>
              {(student.comments || []).length > 0 && (
                <div className="comment-list">
                  {student.comments.map(c => (
                    <div className="comment-row" key={c.id}>
                      <div className="comment-row-body">
                        <div className="comment-row-date">{formatDate(c.date)}</div>
                        <div className="comment-row-text">{c.text}</div>
                      </div>
                      <button type="button" className="comment-remove-btn" onClick={() => removeComment(c.id)} aria-label="Удалить комментарий"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="panel" style={{marginTop:20}}><div className="detail-label">Промо ученика</div>
            {history.filter(s => s.type === "promo").length === 0 ? <div className="form-hint">{origin === "promo" ? "Промо: ожидает пробного занятия" : "Промо-занятий нет"}</div> : history.filter(s => s.type === "promo").map(s => <div className="history-row" key={s.id}><div><div className="history-row-date">{formatDate(s.date)} · {coaches.find(c => c.id === s.coachId)?.name}</div><div className="history-row-note">{s.status === "upcoming" ? "Запланировано" : (s.attendance?.[student.id] === "absent" ? "Б — не был · " : "") + (s.promoResults?.[student.id] === "bought" ? "Купил" : s.promoResults?.[student.id] === "not_bought" ? "Не купил" : "Результат не указан")}</div></div></div>)}
          </div>
          <div className="detail-label" style={{ marginTop: 20 }}>История тренировок</div>
          <div className="history-list">
            {history.map(s => (
              <div className="history-row" key={s.id}>
                <div className="history-dot" style={{ background: disc.color }} />
                <div className="history-row-body">
                  <div className="history-row-date">{formatDate(s.date)} · {s.time}</div>
                  <div className="history-row-note">{s.note || "Без заметки"}</div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ============================================================
   ВИД УПРАВЛЯЮЩЕГО — десктопная панель
   ============================================================ */
function AdminView({ versions, tab, setTab, searchQ, setSearchQ, students, sessions, coaches, managers, manager, onNewSession, onNewStudent, onEditStudent, onDeleteStudent, onQuickUpdateStudent, onEditSession, onDeleteSession, onSaveAttendance, onNewCoach, onEditCoach, onDeleteCoach, onNewManager, onEditManager, onDeleteManager, onLogout }) {
  const isOwner = manager.role === "owner";
  // Администратор филиала заперт на свой филиал; владелец может смотреть "все филиалы"
  const [branchFilter, setBranchFilter] = useState(isOwner ? "all" : manager.branches[0]);

  const fStudents = branchFilter === "all" ? students : students.filter(s => s.branchId === branchFilter);
  const fSessions = branchFilter === "all" ? sessions : sessions.filter(s => s.branchId === branchFilter);
  const fCoaches = branchFilter === "all" ? coaches : coaches.filter(c => c.branches.includes(branchFilter));
  if (!isOwner) return <div className="admin-shell"><AdminSidebar tab="schedule" setTab={() => {}} manager={manager} onLogout={onLogout} /><div className="admin-content"><div className="admin-topbar"><span>Расписание · {BRANCHES[manager.branches[0]].label} · только просмотр</span></div><AdminSchedule sessions={sessions.filter(s => manager.branches.includes(s.branchId))} coaches={coaches.filter(c => c.branches.some(id => manager.branches.includes(id)))} students={students.filter(s => manager.branches.includes(s.branchId) || sessions.some(t => manager.branches.includes(t.branchId) && t.studentIds.includes(s.id)))} readOnly attendanceOnly /></div></div>;

  return (
    <div className="admin-shell">
      <AdminSidebar tab={tab} setTab={setTab} manager={manager} onLogout={onLogout} />
      <div className="admin-content">
        <AdminTopbar
          searchQ={searchQ} setSearchQ={setSearchQ}
          onNewSession={onNewSession} onNewStudent={onNewStudent}
          branchFilter={branchFilter} setBranchFilter={setBranchFilter}
          allowedBranches={manager.branches}
        />
        {tab === "overview" && <AdminOverview students={fStudents} sessions={fSessions} coaches={fCoaches} branchFilter={branchFilter} />}
        {tab === "coaches" && (
          <AdminCoaches
            students={fStudents} rosterStudents={students} sessions={fSessions} coaches={fCoaches}
            onNewCoach={onNewCoach} onEditCoach={onEditCoach} onDeleteCoach={onDeleteCoach}
            onQuickUpdateStudent={onQuickUpdateStudent}
          />
        )}
        {tab === "students" && (
          <AdminStudents
            searchQ={searchQ} students={fStudents} coaches={coaches} filterCoaches={studentFilterCoaches(coaches, {kind:"manager", record:manager}, branchFilter)}
            onEdit={onEditStudent} onDelete={onDeleteStudent}
            onQuickUpdateStudent={onQuickUpdateStudent}
          />
        )}
        {tab === "schedule" && (
          <AdminSchedule
            sessions={fSessions} coaches={coaches} students={students}
            versions={versions} onSaveAttendance={onSaveAttendance}
            onEdit={onEditSession} onDelete={onDeleteSession}
          />
        )}
        {tab === "loads" && <AdminLoads branchFilter={branchFilter} students={students} sessions={sessions} />}
        {tab === "salary" && <AdminSalary coaches={fCoaches} sessions={sessions} branchFilter={branchFilter} />}
        {tab === "managers" && isOwner && (
          <AdminManagers
            managers={managers} currentManagerId={manager.id}
            onNewManager={onNewManager} onEditManager={onEditManager} onDeleteManager={onDeleteManager}
          />
        )}
        {tab === "help" && <AdminHelpTab />}
      </div>
    </div>
  );
}

function AdminSidebar({ tab, setTab, manager, onLogout }) {
  const items = manager.role !== "owner" ? [{ id: "schedule", label: "Расписание", icon: <Calendar size={17} /> }] : [
    { id: "overview",  label: "Обзор",         icon: <BarChart3 size={17} /> },
    { id: "loads",     label: "Загруженность",  icon: <TrendingUp size={17} /> },
    { id: "salary",    label: "Зарплата",       icon: <Award size={17} /> },
    { id: "coaches",   label: "Тренеры",        icon: <UserCircle2 size={17} /> },
    { id: "students",  label: "Ученики",        icon: <Users size={17} /> },
    { id: "schedule",  label: "Расписание",     icon: <Calendar size={17} /> },
    ...(manager.role === "owner" ? [{ id: "managers", label: "Администраторы", icon: <Settings size={17} /> }] : []),
    { id: "help",      label: "Памятка",        icon: <AlertCircle size={17} /> },
  ];
  return (
    <aside className="admin-sidebar">
      <div className="admin-logo">
        <span className="admin-logo-mark">RX</span>
        <span className="admin-logo-text">RIDE<br/>SCHOOL</span>
      </div>
      <div className="admin-user-card">
        <div className="admin-user-avatar">{manager.avatar}</div>
        <div className="admin-user-info">
          <div className="admin-user-name">{manager.name}</div>
          <div className="admin-user-role">{manager.role === "owner" ? "Владелец · оба филиала" : `Администратор · ${BRANCHES[manager.branches[0]].label}`}</div>
        </div>
        <button className="logout-btn" onClick={onLogout} title="Выйти"><LogOut size={15} /></button>
      </div>
      <nav className="admin-nav">
        {items.map(it => (
          <button key={it.id} className={tab === it.id ? "admin-nav-item active" : "admin-nav-item"} onClick={() => setTab(it.id)}>
            {it.icon}{it.label}
          </button>
        ))}
      </nav>
      <div className="admin-disciplines-key">
        <div className="admin-disciplines-title">Направления</div>
        {Object.entries(DISCIPLINES).map(([k, d]) => (
          <div key={k} className="discipline-key-row">
            <span className="discipline-key-dot" style={{ background: d.color }} />
            {d.label}
          </div>
        ))}
      </div>
      <div className="admin-disciplines-key">
        <div className="admin-disciplines-title">Филиалы</div>
        {Object.entries(BRANCHES).map(([k, b]) => (
          <div key={k} className="discipline-key-row">
            <span className="discipline-key-dot" style={{ background: b.color }} />
            {b.label}
          </div>
        ))}
      </div>
    </aside>
  );
}

function AdminTopbar({ searchQ, setSearchQ, onNewSession, onNewStudent, branchFilter, setBranchFilter, allowedBranches }) {
  const showAllOption = allowedBranches.length > 1;
  const visibleBranches = Object.entries(BRANCHES).filter(([k]) => allowedBranches.includes(k));
  return (
    <div className="admin-topbar">
      <div className="admin-search">
        <Search size={15} />
        <input placeholder="Поиск ученика, тренера..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
      </div>
      <div className="admin-topbar-right">
        <div className="branch-filter">
          {showAllOption && (
            <button className={branchFilter === "all" ? "branch-filter-btn active" : "branch-filter-btn"} onClick={() => setBranchFilter("all")}>Все филиалы</button>
          )}
          {visibleBranches.map(([k, b]) => (
            <button
              key={k}
              className={branchFilter === k ? "branch-filter-btn active" : "branch-filter-btn"}
              style={branchFilter === k ? { color: b.color, borderColor: b.color } : {}}
              onClick={() => setBranchFilter(k)}
            >
              {b.label}
            </button>
          ))}
        </div>
        <button className="topbar-btn" onClick={onNewStudent}><Plus size={14} /> Ученик</button>
        <button className="topbar-btn primary" onClick={onNewSession}><Plus size={14} /> Тренировка</button>
      </div>
    </div>
  );
}

function AdminOverview({ students, sessions, coaches, branchFilter }) {
  const [selectedMonth, setSelectedMonth] = useState(todayIso().slice(0,7));
  const monthSessions = sessions.filter(s => s.date.startsWith(selectedMonth));
  const enrolled = students.filter(isEnrolled);
  const totalStudents = uniqueChildren(students.filter(s => !isArchived(s)));
  const activeToday = monthSessions.filter(s => s.status === "done").length;
  const missedThisWeek = monthSessions.filter(s => s.status === "missed").length;
  const avgAttendance = averageSessionAttendance(monthSessions);

  const branchIds = branchFilter === "all" ? Object.keys(BRANCHES) : [branchFilter];
  const weekStats = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, i) => ({
    day,
    count: monthSessions.filter(s => (new Date(s.date + "T00:00:00").getDay() + 6) % 7 === i).length,
  }));
  const maxWeek = Math.max(...weekStats.map(w => w.count), 1);

  const byDiscipline = Object.entries(DISCIPLINES).map(([key, d]) => ({
    ...d,
    key,
    count: uniqueChildren(enrolled.filter(s => s.discipline === key)),
  }));
  const maxDisc = Math.max(...byDiscipline.map(d => d.count), 1);

  const attentionAll = students.filter(needsAttention);
  const [attentionExpanded, setAttentionExpanded] = useState(false);
  const ATTENTION_PAGE = 10;
  const attentionShown = attentionExpanded ? attentionAll : attentionAll.slice(0, ATTENTION_PAGE);

  return (
    <div className="admin-page">
      <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
      <div className="kpi-row">
        <KpiCard label="Уникальных детей школы" value={totalStudents} delta="все статусы, без архива; по идентификатору ребёнка" icon={<Users size={18} />} />
        <KpiCard label="Активных направлений" value={students.filter(s => !isArchived(s) && s.status === "active").length} delta="рабочие записи со статусом Активен" icon={<Users size={18} />} />
        <KpiCard label="Проведено за месяц" value={activeToday} delta="по расписанию" icon={<Calendar size={18} />} />
        <KpiCard label="Средняя посещаемость" value={avgAttendance === null ? "—" : `${avgAttendance}%`} delta="по сохранённым отметкам за месяц" icon={<Target size={18} />} />
        <KpiCard label="Пропущено за месяц" value={missedThisWeek} delta="требует внимания" icon={<AlertCircle size={18} />} warn />
      </div>

      <div className="admin-grid-2">
        <div className="panel">
          <div className="panel-title">Тренировки по дням недели за месяц</div>
          <div className="week-chart">
            {weekStats.map(w => (
              <div className="week-bar-col" key={w.day}>
                <div className="week-bar" style={{ height: `${(w.count / maxWeek) * 100}%` }} />
                <div className="week-bar-val">{w.count}</div>
                <div className="week-bar-day">{w.day}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Ученики сейчас по направлениям</div>
          <div className="disc-distribution">
            {byDiscipline.map(d => (
              <div className="disc-dist-row" key={d.key}>
                <div className="disc-dist-label"><DisciplineGlyph d={d.key} size={14} />{d.label}</div>
                <div className="disc-dist-track">
                  <div className="disc-dist-fill" style={{ width: `${(d.count / maxDisc) * 100}%`, background: d.color }} />
                </div>
                <div className="disc-dist-count">{d.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <PromoPanel sessions={monthSessions} />
      <FlowChart students={students} endMonth={selectedMonth} />

      <div className="panel">
        <div className="panel-title">Требует внимания</div>
        <div className="attention-list">
          {attentionShown.map(s => {
            const coach = coaches.find(c => c.id === s.coachId);
            const d = DISCIPLINES[s.discipline];
            return (
              <div className="attention-row" key={s.id}>
                <span className="attention-dot" style={{ background: d.color }} />
                <div className="attention-name">{s.name}</div>
                <div className="attention-reason">
                  {s.flag === "injury" ? "Травма — ограничение нагрузки" : `Низкая посещаемость · ${formatAttendance(s.attendance)}`}
                </div>
                <div className="attention-coach">{coach?.name}</div>
              </div>
            );
          })}
        </div>
        {attentionAll.length > ATTENTION_PAGE && (
          <button className="attention-more-btn" onClick={() => setAttentionExpanded(v => !v)}>
            {attentionExpanded ? "Свернуть" : `Ещё ${attentionAll.length - ATTENTION_PAGE}`}
          </button>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, delta, icon, warn }) {
  return (
    <div className={`kpi-card ${warn ? "warn" : ""}`}>
      <div className="kpi-card-top">
        <span className="kpi-icon">{icon}</span>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-delta">{delta}</div>
    </div>
  );
}

function AdminCoaches({ students, rosterStudents = students, sessions, coaches, onEditCoach, onDeleteCoach, onNewCoach, onQuickUpdateStudent }) {
  const [openCoachId, setOpenCoachId] = useState(null);
  const openCoach = coaches.find(c => c.id === openCoachId);

  if (openCoach) {
    return (
      <AdminCoachDetail
        coach={openCoach}
        students={students}
        rosterStudents={rosterStudents}
        sessions={sessions.filter(s => s.coachId === openCoach.id)}
        onBack={() => setOpenCoachId(null)}
        onEdit={() => onEditCoach(openCoach)}
        onDelete={() => onDeleteCoach(openCoach)}
        onQuickUpdateStudent={onQuickUpdateStudent}
      />
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div className="admin-page-head-title">Тренеры</div>
        <button className="topbar-btn primary" onClick={onNewCoach}><Plus size={14} /> Тренер</button>
      </div>
      <div className="coach-grid">
        {coaches.map(c => {
          const d = DISCIPLINES[c.discipline];
          const myStudents = coachStudents(students, sessions, c.id);
          const enrolled = myStudents.filter(isEnrolled);
          const avgAtt = averageAttendance(enrolled);
          return (
            <button className="coach-admin-card coach-admin-card-clickable" key={c.id} style={{ "--accent": d.color }} onClick={() => setOpenCoachId(c.id)}>
              <div className="coach-admin-top">
                <div className="coach-admin-avatar" style={{ background: d.color }}>{c.avatar}</div>
                <div className="coach-admin-top-right">
                  <span className="coach-admin-disc-tag">{d.short}</span>
                  <div className="table-actions">
                    <span className="table-action-btn" onClick={(e) => { e.stopPropagation(); onEditCoach(c); }} role="button" aria-label="Редактировать"><Settings size={13} /></span>
                    <span className="table-action-btn danger" onClick={(e) => { e.stopPropagation(); onDeleteCoach(c); }} role="button" aria-label="Удалить"><X size={13} /></span>
                  </div>
                </div>
              </div>
              <div className="coach-admin-name">{c.name}</div>
              <div className="coach-admin-meta"><DisciplineGlyph d={c.discipline} size={13} /> {d.label} · стаж {c.exp}</div>
              <div className="coach-admin-branches">
                {(c.grade || "regular") === "pro" && <span className="grade-badge pro">Про</span>}{c.grade === "pending" && <span className="grade-badge regular">Категория не подтверждена</span>}
                {c.branches.map(bId => (
                  <span key={bId} className="branch-chip-sm" style={{ color: BRANCHES[bId].color, borderColor: BRANCHES[bId].color }}>{BRANCHES[bId].label}</span>
                ))}
              </div>
              <div className="coach-admin-stats">
                <div><span className="cas-val">{enrolled.length}</span><span className="cas-lbl">учеников</span></div>
                <div><span className="cas-val">{avgAtt === null ? "—" : `${avgAtt}%`}</span><span className="cas-lbl">посещение</span></div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   КАРТОЧКА ТРЕНЕРА В АДМИНКЕ — та же статистика, что видит сам тренер:
   тренировки с комментариями, приток/отток, уровни группы
   ============================================================ */
function AdminCoachDetail({ coach, students:allStudents, rosterStudents = allStudents, sessions, onBack, onEdit, onDelete, onQuickUpdateStudent }) {
  const students = coachStudents(allStudents, sessions, coach.id);
  const d = DISCIPLINES[coach.discipline];
  const enrolled = students.filter(isEnrolled);
  const avgAttendance = averageAttendance(enrolled);
  const done = sessions.filter(s => s.status === "done").sort((a, b) => b.date.localeCompare(a.date));
  const missedCount = sessions.filter(s => s.status === "missed").length;
  const promoCount = enrolled.filter(s => (s.origin || "regular") === "promo").length;
  const leftCount = students.filter(s => s.status === "left").length;

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <button className="back-btn-desktop" onClick={onBack}><ChevronLeft size={16} /> Все тренеры</button>
        <div className="table-actions">
          <button className="topbar-btn" onClick={onEdit}><Settings size={14} /> Редактировать</button>
          <button className="table-action-btn danger" onClick={onDelete} aria-label="Удалить"><X size={16} /></button>
        </div>
      </div>

      <div className="coach-detail-head">
        <div className="coach-admin-avatar" style={{ background: d.color, width: 52, height: 52, fontSize: 18 }}>{coach.avatar}</div>
        <div>
          <div className="coach-detail-name">
            {coach.name}
            {(coach.grade || "regular") === "pro" && <span className="grade-badge pro">Про</span>}{coach.grade === "pending" && <span className="grade-badge regular">Категория не подтверждена</span>}
          </div>
          <div className="coach-admin-meta"><DisciplineGlyph d={coach.discipline} size={13} /> {d.label} · стаж {coach.exp} · {coach.email}</div>
          <div className="coach-admin-branches" style={{ marginTop: 6 }}>
            {coach.branches.map(bId => (
              <span key={bId} className="branch-chip-sm" style={{ color: BRANCHES[bId].color, borderColor: BRANCHES[bId].color }}>{BRANCHES[bId].label}</span>
            ))}
          </div>
        </div>
      </div>

      <CoachStatsTab coach={coach} students={students} sessions={sessions} disc={d} />
      <div className="panel"><div className="panel-title">Расписание и тренировки наставника</div><AdminSchedule sessions={sessions} students={rosterStudents} coaches={[coach]} readOnly /></div>
      <div className="panel">
        <div className="panel-title">Ученики</div>
        <div className="admin-student-mini-list">
          {students.filter(s => !isArchived(s)).map(s => {
            const st = STUDENT_STATUS[s.status || "active"];
            return (
              <div className="admin-student-mini-row" key={s.id}>
                <span className="attention-dot" style={{ background: st.color }} />
                <div className="admin-student-mini-name">
                  {s.name}
                  {(s.origin || "regular") === "promo" && <Star size={11} color="var(--crm-amber)" />}
                </div>
                <div className="admin-student-mini-meta">{formatAttendance(s.attendance)} посещение · {st.label}</div>
                {onQuickUpdateStudent && (s.origin || "regular") === "promo" && s.status !== "left" && (
                  <button className="mini-convert-btn" onClick={() => onQuickUpdateStudent(s.id, { origin: "regular" })}>В основные</button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Тренировки с комментариями за всё время</div>
        <div className="history-list">
          {done.length === 0 && <Empty text="Проведённых тренировок пока нет" />}
          {done.map(s => (
            <div className="history-row" key={s.id}>
              <div className="history-dot" style={{ background: d.color }} />
              <div className="history-row-body">
                <div className="history-row-date">
                  {formatDate(s.date)} · {s.time} · {SESSION_TYPES[s.type].label} · {s.studentIds.length} чел.
                </div>
                <div className="history-row-note">{s.note || "Без заметки"}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   УПРАВЛЯЮЩИЕ — доступна только владельцу
   ============================================================ */
function AdminManagers({ managers, currentManagerId, onNewManager, onEditManager, onDeleteManager }) {
  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div className="admin-page-head-title">Администраторы</div>
        <button className="topbar-btn primary" onClick={onNewManager}><Plus size={14} /> Администратор</button>
      </div>
      <div className="coach-grid">
        {managers.map(m => {
          const isOwner = m.role === "owner";
          const isSelf = m.id === currentManagerId;
          return (
            <div className="coach-admin-card" key={m.id} style={{ "--accent": "var(--crm-blue)" }}>
              <div className="coach-admin-top">
                <div className="coach-admin-avatar" style={{ background: "var(--crm-blue)" }}>{m.avatar}</div>
                <div className="coach-admin-top-right">
                  {isSelf && <span className="coach-admin-disc-tag">ВЫ</span>}
                  <div className="table-actions">
                    <button className="table-action-btn" onClick={() => onEditManager(m)} aria-label="Редактировать"><Settings size={13} /></button>
                    <button
                      className="table-action-btn danger"
                      onClick={() => onDeleteManager(m)}
                      disabled={isOwner || isSelf}
                      title={isOwner ? "Нельзя удалить владельца" : isSelf ? "Нельзя удалить свой аккаунт" : "Удалить"}
                      aria-label="Удалить"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="coach-admin-name">{m.name}</div>
              <div className="coach-admin-meta">{m.email}</div>
              <div className="coach-admin-branches">
                <span className="grade-badge" style={{ background: "rgba(61,165,255,.15)", color: "var(--crm-blue)" }}>
                  {isOwner ? "Владелец" : "Администратор филиала"}
                </span>
                {m.branches.map(bId => (
                  <span key={bId} className="branch-chip-sm" style={{ color: BRANCHES[bId].color, borderColor: BRANCHES[bId].color }}>{BRANCHES[bId].label}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminStudents({ searchQ, students, coaches, filterCoaches, onEdit, onDelete, onQuickUpdateStudent }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [direction, setDirection] = useState("all");
  const [age, setAge] = useState("all");
  const [level, setLevel] = useState("all");
  const [coachFilter, setCoachFilter] = useState("all");
  const effectiveCoachFilter = filterCoaches.some(c => c.id === coachFilter) ? coachFilter : "all";
  useEffect(() => { if (coachFilter !== effectiveCoachFilter) setCoachFilter(effectiveCoachFilter); }, [coachFilter, effectiveCoachFilter]);
  const scoped = students.filter(s => matchesStudent(s, {query: searchQ, direction, age, level, coachId: effectiveCoachFilter, archived: "include"}));
  const filtered = scoped.filter(s => matchesStudent(s, {status: statusFilter}));

  return (
    <div className="admin-page">
      <StudentFilters students={students} direction={direction} setDirection={setDirection} age={age} setAge={setAge} level={level} setLevel={setLevel} filterCoaches={filterCoaches} coachFilter={effectiveCoachFilter} setCoachFilter={setCoachFilter} />
      <StatusFilters students={scoped} value={statusFilter} onChange={setStatusFilter} />
      <div className="form-hint">Детей: {uniqueChildren(filtered)} · записей по направлениям: {filtered.length}</div>

      <div className="panel">
        <div className="table-scroll" tabIndex={0} aria-label="Таблица: прокрутка по горизонтали">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Ученик</th><th>Возраст</th><th>Филиал</th><th>Направление</th><th>Тренер</th><th>Статус</th><th>Посещение</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const d = DISCIPLINES[s.discipline];
              const b = BRANCHES[s.branchId];
              const coach = coaches.find(c => c.id === s.coachId);
              const st = STUDENT_STATUS[s.status || "active"];
              return (
                <tr key={s.id}>
                  <td className="table-name-cell"><div className="table-name-content">
                    <span>{s.name}</span>
                    {s.flag === "injury" && <AlertCircle size={13} color="var(--crm-danger)" />}
                    {(s.origin || "regular") === "promo" && <Star size={12} color="var(--crm-amber)" />}
                  </div></td>
                  <td>{s.age ?? "Не указан"}</td>
                  <td><span className="table-branch-tag" style={{ color: b.color, borderColor: b.color }}>{b.label}</span></td>
                  <td><DirectionBadges student={s} /></td>
                  <td><CoachBadges student={s} coaches={coaches} /></td>
                  <td>
                    {isArchived(s) ? <span>Архив</span> : onQuickUpdateStudent ? (
                      <select
                        className="status-select"
                        style={{ color: st.color, borderColor: st.color }}
                        value={s.status || "active"}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (next === "left") onQuickUpdateStudent(s.id, { status: "left", leftDate: todayIso() });
                          else onQuickUpdateStudent(s.id, { status: next });
                        }}
                      >
                        {Object.entries(STUDENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    ) : (
                      <span style={{ color: st.color }}>{st.label}</span>
                    )}
                  </td>
                  <td>
                    <div className="table-attendance">
                      <div className="table-attendance-track"><div className="table-attendance-fill" style={{ width: `${Number.isFinite(s.attendance) ? s.attendance : 0}%`, background: d.color }} /></div>
                      {formatAttendance(s.attendance)}
                    </div>
                  </td>
                  <td>
                    <div className="table-actions">
                      {isArchived(s) ? <button className="topbar-btn" onClick={() => onQuickUpdateStudent(s.id, {archivedAt: null})}>Восстановить</button> : <><button className="table-action-btn" onClick={() => onEdit(s)} aria-label="Редактировать"><Settings size={14} /></button>
                      <button className="table-action-btn danger" onClick={() => onDelete(s)} aria-label="Архивировать"><X size={14} /></button></>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function AdminSchedule({ versions, sessions, coaches, students, onEdit, onDelete, onSaveAttendance, readOnly = false, attendanceOnly = false }) {
  const [coachFilter, setCoachFilter] = useState("all");
  const [openedId, setOpenedId] = useState(null);
  const [conducting, setConducting] = useState(false);
  const canConduct = !readOnly && Boolean(onSaveAttendance);
  function openSession(id, conduct = false) {setOpenedId(id);setConducting(conduct);}
  const visibleSessions = sessions.filter(s => coachFilter === "all" || s.coachId === coachFilter);
  const [selectedDate, setSelectedDate] = useCalendarSelection();
  const [showAll, setShowAll] = useState(false);
  const markedDates = useMemo(() => new Set(visibleSessions.map(s => s.date)), [sessions, coachFilter]);

  const byDay = visibleSessions.reduce((acc, s) => {
    (acc[s.date] = acc[s.date] || []).push(s);
    return acc;
  }, {});
  const days = showAll ? Object.keys(byDay).sort() : (byDay[selectedDate] ? [selectedDate] : []);

  const opened = sessions.find(s => s.id === openedId);
  return (
    <div className="admin-page">
      {opened && <ModalShell onClose={() => setOpenedId(null)} accent={DISCIPLINES[opened.discipline].color}>
        <SessionDetail key={`${opened.id}:${conducting}`} expectedVersions={versions} session={opened} students={students}
          readOnly={!canConduct || !conducting} attendanceOnly={attendanceOnly} onBack={() => setOpenedId(null)}
          onSaveAttendance={payload => onSaveAttendance(opened.id,payload)}
          onEdit={() => {setOpenedId(null);onEdit(opened);}} onDelete={() => {setOpenedId(null);onDelete(opened);}} />
        {canConduct && !conducting && <div className="modal-footer"><button className="modal-btn-primary" onClick={() => setConducting(true)}>
          {opened.status === "upcoming" ? "Провести тренировку" : "Изменить отметки"}
        </button></div>}
      </ModalShell>}
      <div className="crm-filters"><label>Наставник<select aria-label="Наставник" className="form-select" value={coachFilter} onChange={e => setCoachFilter(e.target.value)}><option value="all">Все наставники</option>{coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
      <div className="schedule-controls">
        <DateCalendarNav
          selectedDate={selectedDate}
          onSelect={(d) => { setSelectedDate(d); setShowAll(false); }}
          markedDates={markedDates}
        />
        <button className={showAll ? "schedule-showall active" : "schedule-showall"} onClick={() => setShowAll(v => !v)}>
          {showAll ? "Только выбранный день" : "Показать все дни"}
        </button>
      </div>

      {!showAll && days.length === 0 && (
        <div className="panel"><Empty text="В этот день тренировок не было" /></div>
      )}

      {days.map(day => (
        <div className="panel schedule-day-panel" key={day}>
          <div className="panel-title">{formatDate(day)}</div>
          <div className="schedule-rows">
            {byDay[day].sort((a,b) => a.time.localeCompare(b.time)).map(s => {
              const d = DISCIPLINES[s.discipline];
              const b = BRANCHES[s.branchId];
              const coach = coaches.find(c => c.id === s.coachId);
              const statusMap = { upcoming: "Запланирована", done: "Проведена", missed: "Пропущена" };
              return (
                <div className="schedule-row" key={s.id} style={{ "--accent": d.color }}>
                  <div className="schedule-row-time">{s.time}</div>
                  <div className="schedule-row-bar" />
                  <div className="schedule-row-disc"><DisciplineGlyph d={s.discipline} size={14}/></div>
                  <div className="schedule-row-info">
                    <div className="schedule-row-title">{SESSION_TYPES[s.type].label} · {d.label}</div>
                    <div className="schedule-row-sub">{coach?.name} · {s.groupName} · {s.studentIds.length} чел.</div>
                  </div>
                  <span className="branch-chip-sm" style={{ color: b.color, borderColor: b.color }}>{b.label}</span>
                  <div className={`schedule-row-status st-${s.status}`}>{statusMap[s.status]}</div>
                  <div className="table-actions"><button className="topbar-btn" onClick={() => openSession(s.id)}>Участники</button>
                    {canConduct && s.status === "upcoming" && <button className="topbar-btn" onClick={() => openSession(s.id,true)}>Провести тренировку</button>}{!readOnly && <>
                    <button className="table-action-btn" onClick={() => onEdit(s)} aria-label="Редактировать"><Settings size={13} /></button>
                    <button className="table-action-btn danger" onClick={() => onDelete(s)} aria-label="Удалить"><X size={13} /></button>
                  </>} </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   ПАМЯТКА ДЛЯ УПРАВЛЯЮЩЕГО — краткая инструкция по работе с CRM
   ============================================================ */
function AdminHelpTab() {
  const sections = [
    {
      title: "Обзор",
      text: "Главная сводка: сколько учеников всего, сколько тренировок сегодня, средняя посещаемость и сколько пропусков за неделю. Внизу — список учеников, которым нужно внимание: травмы и низкая посещаемость.",
    },
    {
      title: "Загруженность",
      text: "Здесь сравниваются филиалы между собой: загрузка по дням недели и посещаемость по каждому направлению. Удобно смотреть, где не хватает тренеров или групп, а где, наоборот, простой.",
    },
    {
      title: "Тренеры",
      text: "Карточки всех тренеров с числом учеников, средней посещаемостью и филиалами, в которых они работают. Один тренер может вести группы в обоих филиалах — это видно по цветным меткам.",
    },
    {
      title: "Ученики",
      text: "Полная таблица по всем филиалам и направлениям с поиском по имени. Фильтр филиала сверху сужает список до конкретного зала.",
    },
    {
      title: "Расписание",
      text: "Все тренировки по дням, отсортированы по времени, с привязкой к филиалу, тренеру и месту. Здесь же видно статус — запланирована, проведена или пропущена.",
    },
  ];

  const actions = [
    { label: "Фильтр филиала", text: "Переключатель «Все филиалы / Роза / Иркутский» в шапке работает на всех вкладках сразу — выбери один, чтобы видеть только его данные." },
    { label: "Кнопки «+ Ученик» и «+ Тренировка»", text: "Создают новую запись от имени любого тренера и в любом филиале — пригодится, если нужно завести данные за тренера." },
    { label: "Раздел «Требует внимания»", text: "На обзоре — это сигнал к действию: травма ученика или просевшая посещаемость. Стоит проверять его каждый день." },
  ];

  return (
    <div className="admin-page">
      <div className="panel help-admin-intro">
        <span className="help-intro-tag" style={{ color: "var(--crm-blue)", borderColor: "var(--crm-blue)" }}>ПАМЯТКА ВЛАДЕЛЬЦА</span>
        <p>Эта панель даёт полную картину по обоим филиалам: кто тренирует, кто занимается, насколько загружены залы и где есть проблемы с посещаемостью. Ниже — что находится в каждом разделе и как быстрее найти нужное.</p>
      </div>

      <div className="panel">
        <div className="panel-title">Разделы панели</div>
        <div className="help-admin-list">
          {sections.map((s, i) => (
            <div className="help-admin-row" key={i}>
              <div className="help-admin-row-num">{i + 1}</div>
              <div>
                <div className="help-admin-row-title">{s.title}</div>
                <div className="help-admin-row-text">{s.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Полезные действия</div>
        <div className="help-admin-list">
          {actions.map((a, i) => (
            <div className="help-admin-row" key={i}>
              <div className="help-admin-row-num action">★</div>
              <div>
                <div className="help-admin-row-title">{a.label}</div>
                <div className="help-admin-row-text">{a.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="help-footer-note">Технические вопросы и доступы — к администратору системы.</div>
    </div>
  );
}

/* ============================================================
   ЗАГРУЖЕННОСТЬ — сравнение филиалов по дням и направлениям
   ============================================================ */
function AdminLoads({ branchFilter, students, sessions }) {
  const branchIds = branchFilter === "all" ? Object.keys(BRANCHES) : [branchFilter];
  const statsByBranch = Object.fromEntries(branchIds.map(b => [b, weekStats(sessions.filter(s => s.branchId === b), todayIso())]));
  const maxWeek = Math.max(1, ...branchIds.flatMap(b => statsByBranch[b].map(w => w.count)));

  const totalWeek = (bId) => statsByBranch[bId].reduce((a, w) => a + w.count, 0);
  const busiestDay = (bId) => statsByBranch[bId].reduce((a, w) => w.count > a.count ? w : a, statsByBranch[bId][0]);

  return (
    <div className="admin-page">
      <div className={branchIds.length > 1 ? "admin-grid-2" : ""}>
        {branchIds.map(bId => {
          const b = BRANCHES[bId];
          return (
            <div className="panel" key={bId}>
              <div className="panel-title-row">
                <span className="panel-title">{b.label} · загрузка по дням</span>
                <span className="panel-title-stat" style={{ color: b.color }}>{totalWeek(bId)} тренировок / нед.</span>
              </div>
              <div className="week-chart">
                {statsByBranch[bId].map(w => (
                  <div className="week-bar-col" key={w.day}>
                    <div className="week-bar" style={{ height: `${(w.count / maxWeek) * 100}%`, background: b.color }} />
                    <div className="week-bar-val">{w.count}</div>
                    <div className="week-bar-day">{w.day}</div>
                  </div>
                ))}
              </div>
              <div className="loads-busiest">
                Самый загруженный день — <strong>{busiestDay(bId).day}</strong> ({busiestDay(bId).count} тренировок)
              </div>
            </div>
          );
        })}
      </div>

      <div className={branchIds.length > 1 ? "admin-grid-2" : ""}>
        {branchIds.map(bId => {
          const b = BRANCHES[bId];
          const rows = Object.keys(DISCIPLINES).map(key => {
            return [key, directionAttendanceStats(students, sessions, bId, key)];
          }).filter(([,stats]) => stats.percent !== null);
          return (
            <div className="panel" key={bId}>
              <div className="panel-title">{b.label} · посещаемость по направлениям</div>
              <div className="disc-distribution">
                {rows.map(([discKey, stats]) => {
                  const pct = stats.percent;
                  const d = DISCIPLINES[discKey];
                  return (
                    <div className="disc-dist-row" key={discKey}>
                      <div className="disc-dist-label"><DisciplineGlyph d={discKey} size={14} />{d.label}</div>
                      <div className="disc-dist-track">
                        <div className="disc-dist-fill" style={{ width: `${pct}%`, background: stats.requiresAttention ? "var(--crm-danger)" : d.color }} />
                      </div>
                      <div className="disc-dist-count">{formatAttendance(pct)}</div>
                    </div>
                  );
                })}
                {rows.length === 0 && <div className="empty-state">В этом филиале пока нет данных по направлениям</div>}
              </div>
            </div>
          );
        })}
      </div>

      {branchFilter === "all" && (
        <div className="panel">
          <div className="panel-title">Сравнение филиалов</div>
          <div className="branch-compare-row head">
            <span>Филиал</span><span>Учеников</span><span>Тренировок / нед.</span><span>Ср. посещаемость</span>
          </div>
          {Object.entries(BRANCHES).map(([bId, b]) => {
            const bStudents = students.filter(s => s.branchId === bId);
            const avgAtt = averageAttendance(bStudents);
            return (
              <div className="branch-compare-row" key={bId}>
                <span className="branch-compare-name"><span className="discipline-key-dot" style={{ background: b.color }} />{b.label}</span>
                <span>{uniqueBranchChildren(students, bId)}</span>
                <span>{totalWeek(bId)}</span>
                <span>{avgAtt === null ? "—" : `${avgAtt}%`}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ЗАРПЛАТА ТРЕНЕРОВ
   ============================================================ */
function AdminSalary({ coaches, sessions, branchFilter }) {
  // Доступные месяцы из данных сессий
  const months = [...new Set(sessions.map(s => s.date.slice(0, 7)))].sort().reverse();
  const [selectedMonth, setSelectedMonth] = useState(todayIso().slice(0,7));

  const monthLabel = monthLabelFull;

  // Все done-тренировки за выбранный месяц
  const doneSessions = sessions.filter(s =>
    s.status === "done" &&
    s.date.startsWith(selectedMonth) &&
    (branchFilter === "all" || s.branchId === branchFilter)
  );

  // Данные по каждому тренеру
  const rows = coaches.map(coach => {
    const coachSessions = doneSessions.filter(s => s.coachId === coach.id);
    const salary = calcCoachSalary(coach, coachSessions);
    return { coach, salary };
  }).sort((a, b) => b.salary.total - a.salary.total);

  const pendingGrades = rows.filter(r => r.salary.requiresGradeConfirmation).length;
  const totalEarned = key => pendingGrades ? null : rows.reduce((sum,r) => sum + r.salary[key],0);
  const grandTotal = totalEarned("total");
  const totalSessions = rows.reduce((sum, r) => sum + r.salary.totalSessions, 0);

  return (
    <div className="admin-page">
      {/* Шапка с выбором месяца */}
      <div className="salary-header">
        <div className="admin-page-head-title">Зарплата тренеров</div>
        <div className="salary-month-picker">
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          {months.map(m => (
            <button
              key={m}
              className={selectedMonth === m ? "month-btn active" : "month-btn"}
              onClick={() => setSelectedMonth(m)}
            >
              {monthLabel(m)}
            </button>
          ))}
        </div>
      </div>

      {/* KPI по выбранному месяцу */}
      <div className="salary-kpi-row">
        <div className="salary-kpi">
          <div className="salary-kpi-val">{salaryMoney(grandTotal)}</div>
          <div className="salary-kpi-lbl">Общий ФОТ за месяц</div>
        </div>
        <div className="salary-kpi">
          <div className="salary-kpi-val">{totalSessions}</div>
          <div className="salary-kpi-lbl">Проведённых тренировок</div>
        </div>
        <div className="salary-kpi">
          <div className="salary-kpi-val">
            {rows.filter(r => (r.coach.grade || "regular") === "pro").length}
            <span className="salary-kpi-sub"> / {rows.length}</span>
          </div>
          <div className="salary-kpi-lbl">Про-тренеров</div>
        </div>
        <div className="salary-kpi">
          <div className="salary-kpi-val">
            {grandTotal === null ? "Не рассчитано" : salaryMoney(rows.length ? Math.round(grandTotal / rows.length) : 0)}
          </div>
          <div className="salary-kpi-lbl">Средняя зарплата</div>
        </div>
      </div>

      {pendingGrades > 0 && <div className="form-hint">Категория не подтверждена у {pendingGrades} наставников. Их зарплата и общий итог не рассчитаны. Подтвердите обычный/PRO в карточке наставника; посещения сохраняются.</div>}
      {/* Таблица по тренерам */}
      <div className="panel">
        <div className="table-scroll" tabIndex={0} aria-label="Таблица: прокрутка по горизонтали">
        <table className="admin-table salary-table">
          <thead>
            <tr>
              <th>Тренер</th>
              <th>Грейд</th>
              <th>Группа / спорт / промо</th>
              <th>Заработок за них</th>
              <th>Индивид.</th>
              <th>Заработок инд.</th>
              <th>Итого</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ coach, salary }) => {
              const disc = DISCIPLINES[coach.discipline];
              const isPro = (coach.grade || "regular") === "pro";
              return (
                <tr key={coach.id} className={salary.total === 0 ? "salary-row-zero" : ""}>
                  <td>
                    <div className="salary-coach-cell">
                      <div className="salary-avatar" style={{ background: disc.color }}>{coach.avatar}</div>
                      <div>
                        <div className="salary-name">{coach.name}</div>
                        <div className="salary-disc"><DisciplineGlyph d={coach.discipline} size={11} /> {disc.label}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={isPro ? "grade-badge pro" : "grade-badge regular"}>
                      {coach.grade === "pending" ? "Не подтверждена" : isPro ? "Про" : "Обычный"}
                    </span>
                  </td>
                  <td className="salary-num">{salary.groupSessions}</td>
                  <td className="salary-num">{salaryMoney(salary.groupEarned)}</td>
                  <td className="salary-num">{salary.indSessions}</td>
                  <td className="salary-num">{salaryMoney(salary.indEarned)}</td>
                  <td>
                    <span className="salary-total">{salaryMoney(salary.total)}</span>
                  </td>
                  <td>
                    <SalaryBar value={salary.total ?? 0} max={rows[0]?.salary.total || 1} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="salary-tfoot">
              <td colSpan={2}>ИТОГО</td>
              <td className="salary-num">{rows.reduce((s,r) => s + r.salary.groupSessions, 0)}</td>
              <td className="salary-num">{salaryMoney(totalEarned("groupEarned"))}</td>
              <td className="salary-num">{rows.reduce((s,r) => s + r.salary.indSessions, 0)}</td>
              <td className="salary-num">{salaryMoney(totalEarned("indEarned"))}</td>
              <td><span className="salary-total">{salaryMoney(grandTotal)}</span></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        </div>
      </div>

      {/* Тарифная сетка */}
      <div className="panel">
        <div className="panel-title">Тарифная сетка</div>
        <div className="form-hint">За Б начислений нет. Промо рассчитывается отдельно по каждому пришедшему ученику. Базовая ставка старого промо без результата не означает «Не купил» и не меняет конверсию.</div>
        <div className="rate-grid">
          {Object.entries(SALARY_RATES).map(([grade, rates]) => (
            <div className="rate-card" key={grade}>
              <div className={`rate-card-badge ${grade}`}>{grade === "pro" ? "Про" : "Обычный"}</div>
              <div className="rate-row">
                <span>Групповая тренировка</span>
                <span className="rate-val">{rates.group} ₽ × кол-во учеников</span>
              </div>
              <div className="rate-row">
                <span>Индивидуальная тренировка</span>
                <span className="rate-val">{rates.individual} ₽</span>
              </div>
              <div className="rate-row">
                <span>Промо · Купил</span>
                <span className="rate-val">500 ₽ за пришедшего</span>
              </div>
              <div className="rate-row">
                <span>Промо · Не купил / старое без результата</span>
                <span className="rate-val">{rates.individual} ₽ за пришедшего</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SalaryBar({ value, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="salary-bar-wrap">
      <div className="salary-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ============================================================
   МОДАЛКА: НОВАЯ ТРЕНИРОВКА
   ============================================================ */
const WEEKDAY_OPTIONS = [
  { value: 0, label: "Пн" }, { value: 1, label: "Вт" }, { value: 2, label: "Ср" },
  { value: 3, label: "Чт" }, { value: 4, label: "Пт" }, { value: 5, label: "Сб" }, { value: 6, label: "Вс" },
];

function SessionModal({ coaches, students, sessions = [], defaultCoachId, defaultBranchId, initialSession, onClose, onSave, onSaveRecurring, expectedVersions }) {
  const [draftExpected] = useState(expectedVersions);
  const isEditing = Boolean(initialSession);
  const [draftId] = useState(() => initialSession?.id || nextId("sn"));
  const [mode, setMode] = useState("single"); // "single" | "recurring" — режим доступен только при создании
  const [coachId, setCoachId] = useState(initialSession?.coachId || defaultCoachId || coaches[0].id);
  const coach = coaches.find(c => c.id === coachId);
  const [discipline, setDiscipline] = useState(initialSession?.discipline || coach.discipline);
  const [branchId, setBranchId] = useState(
    initialSession?.branchId ||
    (defaultBranchId && coach.branches.includes(defaultBranchId) ? defaultBranchId : coach.branches[0])
  );
  const [type, setType] = useState(initialSession?.type || "group");
  const [date, setDate] = useState(initialSession?.date || todayIso());
  const [time, setTime] = useState(initialSession?.time || "16:00");
  const [groupName, setGroupName] = useState(initialSession?.groupName || "");
  const [nameEdited, setNameEdited] = useState(Boolean(initialSession));
  const proposedName = suggestedSessionName(type,DISCIPLINES[discipline]?.label);
  const displayedName = nameEdited ? groupName : proposedName;
  const groupNames = groupNameSuggestions(sessions,{branchId,discipline});
  const groupListId = `group-names-${draftId}`;
  const [note, setNote] = useState(initialSession?.note || "");
  const [studentIds, setStudentIds] = useState(initialSession?.studentIds || []);
  const [studentQuery, setStudentQuery] = useState("");
  const [error, setError] = useState("");

  // Режим "Регулярная" — расписание из нескольких слотов (день недели + время), повторяется по неделям
  const [slots, setSlots] = useState([{ weekday: 0, time: "16:00" }]);
  const [startDate, setStartDate] = useState(()=>todayIso());
  const [weeksAhead, setWeeksAhead] = useState(8);

  const pool = students
    .filter(s => canSelectStudentForSession(s, {coachId, branchId, discipline, studentIds: initialSession?.studentIds || []}))
    .filter(s => s.name.toLowerCase().includes(studentQuery.trim().toLowerCase()));

  function handleCoachChange(id) {
    setCoachId(id);
    const c = coaches.find(x => x.id === id);
    setDiscipline(c.discipline);
    setBranchId(c.branches[0]);
    setStudentIds([]);
  }

  function handleBranchChange(id) {
    setBranchId(id);
    setStudentIds([]);
  }

  function toggleStudent(id) {
    setStudentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    if (!studentIds.includes(id) && students.find(s => s.id === id)?.origin === "promo") { setType("promo"); setMode("single"); }
  }

  function addSlot() {
    setSlots(prev => [...prev, { weekday: 0, time: "16:00" }]);
  }
  function removeSlot(i) {
    setSlots(prev => prev.filter((_, idx) => idx !== i));
  }
  function updateSlot(i, patch) {
    setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }

  async function handleSave() {
    try {
    if (!displayedName.trim()) { setError("Укажи название тренировки или группы"); return; }
    if (studentIds.length === 0) { setError("Выбери хотя бы одного ученика"); return; }
    if (type === "individual" && studentIds.length > 1) { setError("В индивидуальной тренировке только один ученик"); return; }
    if (!date || !time || (mode === "recurring" && (!startDate || !Number.isInteger(Number(weeksAhead)) || Number(weeksAhead) < 1 || Number(weeksAhead) > 26 || slots.some(s => !s.time)))) { setError("Проверь дату, время и число недель (1–26)"); return; }
    if (initialSession?.status !== "upcoming" && initialSession && (type !== initialSession.type || studentIds.join() !== initialSession.studentIds.join())) { setError("У закрытой тренировки тип и состав зафиксированы; посещение меняйте в карточке тренировки"); return; }
    const duration = SESSION_TYPES[type].fixedDuration;

    if (mode === "recurring") {
      if (slots.length === 0) { setError("Добавь хотя бы одно время в расписании"); return; }
      await onSaveRecurring({
        id: draftId, __expected:draftExpected,
        type, discipline, coachId, branchId, groupName: displayedName.trim(), studentIds, note: note.trim(),
        duration, slots, startDate, weeksAhead: Number(weeksAhead),
      });
      return;
    }
    await onSave({ id:draftId,__expected:draftExpected, type, discipline, coachId, branchId, date, time, duration, groupName: displayedName.trim(), studentIds, note: note.trim() });
    } catch (error) { setError(error.message); }
  }

  const disc = DISCIPLINES[discipline];

  return (
    <ModalShell onClose={onClose} accent={disc.color}>
      <div className="modal-header">
        <div className="modal-title"><DisciplineGlyph d={discipline} size={16} /> {isEditing ? "Редактирование тренировки" : "Новая тренировка"}</div>
        <button className="modal-close" aria-label="Закрыть" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="modal-body">
        {!isEditing && (
          <FormField label="Формат создания">
            <div className="segmented">
              <button className={mode === "single" ? "seg active" : "seg"} onClick={() => setMode("single")}>Разовая</button>
              <button className={mode === "recurring" ? "seg active" : "seg"} onClick={() => setMode("recurring")}>По расписанию, на несколько недель</button>
            </div>
          </FormField>
        )}

        <div className="form-row-2">
          <FormField label={`Тип · ${SESSION_TYPES[type].fixedDuration} мин`}>
            <div className="segmented segmented-4">
              {Object.entries(SESSION_TYPES).map(([k, t]) => (
                <button key={k} className={type === k ? "seg active" : "seg"} onClick={() => setType(k)}>{t.segLabel}</button>
              ))}
            </div>
          </FormField>
          <FormField label="Тренер">
            {defaultCoachId ? <div className="form-static-value">{coach.name}</div> : <select className="form-select" value={coachId} onChange={e => handleCoachChange(e.target.value)}>
              {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>}
          </FormField>
        </div>

        {STORAGE && coachDirections(coach).length>1 && <FormField label="Направление тренировки"><select className="form-select" aria-label="Направление тренировки" disabled={isEditing && initialSession.status!=="upcoming"} value={discipline} onChange={e=>{setDiscipline(e.target.value);setStudentIds([]);}}>{coachDirections(coach).map(d=><option key={d} value={d}>{DISCIPLINES[d].label}</option>)}</select></FormField>}
        <FormField label="Филиал">
          {coach.branches.length > 1 ? (
            <div className="segmented">
              {coach.branches.map(bId => (
                <button key={bId} className={branchId === bId ? "seg active" : "seg"} onClick={() => handleBranchChange(bId)}>
                  {BRANCHES[bId].label}
                </button>
              ))}
            </div>
          ) : (
            <div className="form-static-value" style={{ color: BRANCHES[branchId].color }}>{BRANCHES[branchId].label}</div>
          )}
        </FormField>

        {mode === "single" || isEditing ? (
          <div className="form-row-2">
            <FormField label="Дата">
              <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </FormField>
            <FormField label="Время">
              <input className="form-input" type="time" value={time} onChange={e => setTime(e.target.value)} />
            </FormField>
          </div>
        ) : (
          <FormField label="Расписание (день недели + время)">
            <div className="slot-list">
              {slots.map((slot, i) => (
                <div className="slot-row" key={i}>
                  <div className="weekday-picker">
                    {WEEKDAY_OPTIONS.map(w => (
                      <button
                        key={w.value}
                        className={slot.weekday === w.value ? "weekday-btn active" : "weekday-btn"}
                        onClick={() => updateSlot(i, { weekday: w.value })}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                  <input className="form-input slot-time-input" type="time" value={slot.time} onChange={e => updateSlot(i, { time: e.target.value })} />
                  {slots.length > 1 && (
                    <button className="slot-remove-btn" onClick={() => removeSlot(i)} aria-label="Убрать"><X size={14} /></button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" className="add-slot-btn" onClick={addSlot}><Plus size={13} /> Добавить время</button>

            <div className="form-row-2" style={{ marginTop: 12 }}>
              <FormField label="Начиная с">
                <input className="form-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </FormField>
              <FormField label="На сколько недель вперёд">
                <input className="form-input" type="number" min={1} max={26} value={weeksAhead} onChange={e => setWeeksAhead(e.target.value)} />
              </FormField>
            </div>
            <div className="form-hint">
              Создастся {slots.length} × {weeksAhead || 0} = {slots.length * (Number(weeksAhead) || 0)} тренировок — по одной на каждую неделю. Дальше нужно будет только отмечать посещаемость.
            </div>
          </FormField>
        )}

        <FormField label="Название тренировки / группы">
          <input className="form-input" aria-label="Название тренировки" placeholder="БМХ Начинающие, Группа А..."
            list={type === "group" || type === "sport_group" ? groupListId : undefined} value={displayedName}
            onChange={e => {setGroupName(e.target.value);setNameEdited(true);}} />
          {(type === "group" || type === "sport_group") ? <>
            <datalist id={groupListId}>{groupNames.map(name => <option key={name} value={name} />)}</datalist>
            <div className="form-hint">Начните вводить название группы из этого филиала и направления или укажите своё.</div>
          </> : <div className="form-hint">Название предложено по направлению. Его можно изменить.</div>}
        </FormField>

        <FormField label={`Состав ${type === "individual" ? "(выбери одного)" : ""}`}>
          <div className="student-search-row">
            <Search size={13} />
            <input placeholder="Найти ученика..." value={studentQuery} onChange={e => setStudentQuery(e.target.value)} />
          </div>
          {pool.length === 0 ? (
            <div className="empty-state">{studentQuery ? "Никого не нашлось" : "У этого тренера пока нет учеников в этом филиале и направлении"}</div>
          ) : (
            <div className="picker-list">
              {pool.map(s => (
                <label key={s.id} className="picker-row">
                  <input type="checkbox" checked={studentIds.includes(s.id)} onChange={() => toggleStudent(s.id)} />
                  <span className="picker-check" style={{ background: studentIds.includes(s.id) ? disc.color : "transparent" }}>
                    {studentIds.includes(s.id) && <CheckCircle2 size={12} color="var(--crm-surface)" />}
                  </span>
                  <span className="picker-name">{s.name}</span>
                  <span className="picker-meta">{s.level}</span>
                </label>
              ))}
            </div>
          )}
        </FormField>

        <FormField label={mode === "recurring" && !isEditing ? "Заметка для всех тренировок серии (необязательно)" : "Заметка (необязательно)"}>
          <textarea className="form-textarea" rows={3} placeholder="План тренировки, на что обратить внимание..." value={note} onChange={e => setNote(e.target.value)} />
        </FormField>

        {error && <div className="form-error"><AlertCircle size={13} /> {error}</div>}
      </div>

      <div className="modal-footer">
        <button className="modal-btn-secondary" onClick={onClose}>Отмена</button>
        <button className="modal-btn-primary" style={{ background: disc.color }} onClick={handleSave}>
          {isEditing ? "Сохранить изменения" : mode === "recurring" ? "Создать серию тренировок" : "Создать тренировку"}
        </button>
      </div>
    </ModalShell>
  );
}

/* ============================================================
   МОДАЛКА: НОВЫЙ УЧЕНИК
   ============================================================ */
function StudentModal({ coaches, students, defaultCoachId, defaultBranchId, initialStudent, lockedCoachId, onClose, onSave, expectedVersions }) {
  const [draftExpected] = useState(expectedVersions);
  const isEditing = Boolean(initialStudent);
  const [draftId] = useState(() => initialStudent?.id || nextId("s"));
  const [name, setName] = useState(initialStudent?.name || "");
  const [age, setAge] = useState(initialStudent?.age || 10);
  const initialCoach = coaches.find(c => c.id === (initialStudent?.coachId || defaultCoachId)) || coaches.find(c => !initialStudent || coachDirections(c).includes(initialStudent.discipline)) || coaches[0];
  const [coachId, setCoachId] = useState(initialStudent ? initialStudent.coachId || "" : initialCoach.id);
  const [discipline, setDiscipline] = useState(initialStudent?.discipline || initialCoach.discipline);
  const [branchId, setBranchId] = useState(
    initialStudent?.branchId ||
    (defaultBranchId && initialCoach.branches.includes(defaultBranchId) ? defaultBranchId : initialCoach.branches[0])
  );
  const [level, setLevel] = useState(initialStudent?.level || "Начальный");
  const [existingChildId, setExistingChildId] = useState(initialStudent ? childKey(initialStudent) : "");
  const [childQuery, setChildQuery] = useState("");
  const children = [...new Map(students.map(s => [childKey(s),s])).values()];
  const [comments, setComments] = useState(initialStudent?.comments || []);
  const [commentDraft, setCommentDraft] = useState("");
  const [error, setError] = useState("");

  function handleCoachChange(id) {
    const c = coaches.find(x => x.id === id);
    setCoachId(id);
    if(!isEditing) setDiscipline(c.discipline);
    setBranchId(c.branches[0]);

  }

  function addComment() {
    if (!commentDraft.trim()) return;
    setComments(prev => [{ id: STORAGE ? crypto.randomUUID() : `cm${Date.now()}`, date: todayIso(), text: commentDraft.trim() }, ...prev]);
    setCommentDraft("");
  }
  function removeComment(id) {
    setComments(prev => prev.filter(c => c.id !== id));
  }

  async function handleSave() {
    if (!name.trim()) { setError("Укажи имя ученика"); return; }
    if (!Number.isInteger(Number(age)) || Number(age) < 4 || Number(age) > 25) { setError("Укажи возраст от 4 до 25 лет"); return; }
    if (!coachId) {setError("Назначьте основного наставника"); return;}
    try { await onSave({
      id:draftId,__expected:draftExpected, name: name.trim(), age: Number(age), discipline, coachId, branchId, level, ...(initialStudent?.phone ? {phone:initialStudent.phone} : {}),
      childId:existingChildId || null, comments,
    }); } catch (error) {setError(error.message); }
  }

  const disc = DISCIPLINES[discipline];
  const coach = coaches.find(c => c.id === coachId) || initialCoach;

  return (
    <ModalShell onClose={onClose} accent={disc.color}>
      <div className="modal-header">
        <div className="modal-title"><Users size={16} /> {isEditing ? "Редактирование ученика" : "Новый ученик"}</div>
        <button className="modal-close" aria-label="Закрыть" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="modal-body">
        {(!isEditing || !lockedCoachId) && <FormField label="Ребёнок">
          <input className="form-input" aria-label="Поиск существующего ребёнка" placeholder="Поиск по имени или идентификатору" value={childQuery} onChange={e => setChildQuery(e.target.value)} />
          <select className="form-select" aria-label="Ребёнок" value={existingChildId} onChange={e => {
            setExistingChildId(e.target.value);
            const child = children.find(s => childKey(s) === e.target.value);
            if (child) {setName(child.name);setAge(child.age);} else {setName("");setAge(10);}
          }}>
            {!isEditing && <option value="">Новый ребёнок — отдельный идентификатор</option>}
            {children.filter(s => childKey(s) === existingChildId || `${s.name} ${childKey(s)}`.toLowerCase().includes(childQuery.trim().toLowerCase())).map(s => <option key={childKey(s)} value={childKey(s)}>{s.name} · {s.age} лет · ID {childKey(s)}</option>)}
          </select>
          <div className="form-hint">Выбирайте существующего ребёнка только после проверки личности. Все старые записи с одинаковыми именами остаются разными детьми.</div>
        </FormField>}
        {isEditing && <div className="form-hint">Идентификатор ребёнка: {existingChildId}. Владелец может явно связать эту запись с существующим ребёнком, проверив личность.</div>}
        <FormField label="Имя и фамилия">
          <input className="form-input" placeholder="Имя Фамилия" disabled={!isEditing && !!existingChildId} value={name} onChange={e => setName(e.target.value)} />
        </FormField>

        <div className="form-row-2">
          <FormField label="Возраст">
            <input className="form-input" type="number" min={4} max={25} disabled={!isEditing && !!existingChildId} value={age} onChange={e => setAge(e.target.value)} />
          </FormField>
          <FormField label="Уровень">
            <select className="form-select" value={level} onChange={e => setLevel(e.target.value)}>
              <option>Начальный</option>
              <option>Средний</option>
              <option>Продвинутый</option>
            </select>
          </FormField>
        </div>

        <FormField label="Основной тренер">
          {lockedCoachId ? <div className="form-static-value">{coach.name}</div> : <select className="form-select" value={coachId} onChange={e => handleCoachChange(e.target.value)}>
            {!coachId && <option value="">Выберите наставника</option>}{coaches.filter(c => !isEditing || coachDirections(c).includes(discipline)).map(c => <option key={c.id} value={c.id}>{c.name} — {DISCIPLINES[c.discipline].label}</option>)}
          </select>}
        </FormField>

        <FormField label="Филиал">
          {coach.branches.length > 1 ? (
            <div className="segmented">
              {coach.branches.map(bId => (
                <button key={bId} className={branchId === bId ? "seg active" : "seg"} onClick={() => setBranchId(bId)}>
                  {BRANCHES[bId].label}
                </button>
              ))}
            </div>
          ) : (
            <div className="form-static-value" style={{ color: BRANCHES[branchId].color }}>{BRANCHES[branchId].label}</div>
          )}
        </FormField>

        <FormField label="Основное направление">
          {STORAGE && !isEditing && coachDirections(coach).length>1 ? <select className="form-select" aria-label="Направление ученика" value={discipline} onChange={e=>setDiscipline(e.target.value)}>{coachDirections(coach).map(d=><option key={d} value={d}>{DISCIPLINES[d].label}</option>)}</select> : <div className="form-static-value" style={{color:disc.color}}><DisciplineGlyph d={discipline} size={12} /> {disc.label}</div>}
          <div className="form-hint">Из направлений основного наставника</div>
        </FormField>

        <div className="form-hint">Для другого направления добавьте запись и выберите существующего ребёнка. Имена сами по себе не объединяются.</div>

        {!isEditing && <div className="promo-banner"><span><Star size={13} /> Новый ученик будет отмечен как промо</span></div>}
        <FormField label="Комментарии">
          <div className="comment-add-row">
            <input className="form-input" placeholder="Например: обсудили с родителями переход на индивидуальные..." value={commentDraft} onChange={e => setCommentDraft(e.target.value)} />
            <button type="button" className="modal-btn-secondary" onClick={addComment}>Добавить</button>
          </div>
          {comments.length > 0 && (
            <div className="comment-list">
              {comments.map(c => (
                <div className="comment-row" key={c.id}>
                  <div className="comment-row-body">
                    <div className="comment-row-date">{formatDate(c.date)}</div>
                    <div className="comment-row-text">{c.text}</div>
                  </div>
                  <button type="button" className="comment-remove-btn" onClick={() => removeComment(c.id)} aria-label="Удалить комментарий"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </FormField>

        {error && <div className="form-error"><AlertCircle size={13} /> {error}</div>}
      </div>

      <div className="modal-footer">
        <button className="modal-btn-secondary" onClick={onClose}>Отмена</button>
        <button className="modal-btn-primary" style={{ background: disc.color }} onClick={handleSave}>{isEditing ? "Сохранить изменения" : "Добавить ученика"}</button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ children, onClose, accent }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="Карточка CRM" style={{ "--accent": accent }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div className="form-field">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

/* ============================================================
   ДИАЛОГ ПОДТВЕРЖДЕНИЯ УДАЛЕНИЯ
   ============================================================ */
function SessionDeleteDialog({anchor,sessions,versions,onCancel,onConfirm}) {
  const [draft]=useState(()=>({anchor,sessions,versions}));
  const [scope,setScope]=useState(draft.anchor?.templateId && hasSessionHistory(draft.anchor)?'series':'single');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  if(!draft.anchor)return <AlertDialog text="Занятие больше недоступно. Обновите расписание." onClose={onCancel}/>;
  const {deletable,preserved}=seriesSelection(draft.sessions,draft.anchor,scope);
  async function submit(){
    if(busy || !deletable.length)return;
    setBusy(true);setError('');
    try{await onConfirm({id:draft.anchor.id,scope,sessionIds:deletable.map(s=>s.id),__expected:draft.versions});}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <div className="modal-overlay" onClick={busy?undefined:onCancel}><div className="confirm-card" role="dialog" aria-modal="true" aria-label="Удаление тренировок" onClick={e=>e.stopPropagation()}>
    <div className="confirm-title">Удаление тренировок</div>
    <div className="confirm-text">{draft.anchor.groupName} · {formatDate(draft.anchor.date)} · {draft.anchor.time}</div>
    <div className="series-delete-options">
      {[["single","Только эта тренировка"],...(draft.anchor.templateId?[["series","Вся серия"],["following","Эта и следующие тренировки серии"]]:[])].map(([value,label])=><label key={value}>
        <input type="radio" name="delete-scope" value={value} checked={scope===value} disabled={busy} onChange={()=>setScope(value)}/>{label}
      </label>)}
    </div>
    <div className="confirm-text">Будет удалено: <strong>{deletable.length}</strong>. Сохранятся занятия с историей: <strong>{preserved.length}</strong>.</div>
    <div className="form-hint">Удаляются только непроведённые занятия без отметок и результатов. Проведённые, пропуски, посещаемость и начисления сохраняются. Удаление нельзя отменить.</div>
    {error&&<div className="form-error" role="alert">{error}</div>}
    <div className="confirm-actions"><button className="modal-btn-secondary" disabled={busy} onClick={onCancel}>Отмена</button>
      <button className="confirm-btn-danger" disabled={busy||!deletable.length} onClick={submit}>{busy?'Удаление…':`Удалить: ${deletable.length}`}</button></div>
  </div></div>;
}

function ConfirmDialog({ label, archive = false, onCancel, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-card" onClick={e => e.stopPropagation()}>
        <div className="confirm-icon"><AlertCircle size={22} color="var(--crm-danger)" /></div>
        <div className="confirm-title">{archive ? "Перенести ученика в архив?" : "Удалить запись?"}</div>
        <div className="confirm-text">{archive ? `${label} исчезнет из текущих списков и выбора новых тренировок. Составы уже созданных занятий, посещаемость и результаты сохранятся. Ученика можно восстановить из архива.` : `Ты собираешься удалить ${label}. Это действие нельзя отменить.`}</div>
        <div className="confirm-actions">
          <button className="modal-btn-secondary" onClick={onCancel}>Отмена</button>
          <button className="confirm-btn-danger" onClick={onConfirm}>{archive ? "В архив" : "Удалить"}</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   АЛЕРТ — для случаев, когда действие невозможно (напр. удаление тренера с учениками)
   ============================================================ */
function AlertDialog({ text, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="confirm-card" onClick={e => e.stopPropagation()}>
        <div className="confirm-icon"><AlertCircle size={22} color="var(--crm-skate)" /></div>
        <div className="confirm-title">Действие невозможно</div>
        <div className="confirm-text">{text}</div>
        <div className="confirm-actions">
          <button className="modal-btn-primary" style={{ background: "var(--crm-text)" }} onClick={onClose}>Понятно</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   МОДАЛКА: ТРЕНЕР (создание / редактирование)
   ============================================================ */
// Генератор временного пароля — без похожих символов (0/O, 1/l/I), чтобы не путать при передаче тренеру
function generateTempPassword() {
  const chars = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function CoachModal({ initialCoach, existingCoaches, managers, onClose, onSave, expectedVersions }) {
  const [draftExpected] = useState(expectedVersions);
  const isEditing = Boolean(initialCoach);
  const [draftId] = useState(() => initialCoach?.id || nextId("c"));
  const [disciplines,setDisciplines] = useState(coachDirections(initialCoach || {discipline:"rollers"}));
  const [name, setName] = useState(initialCoach?.name || "");
  const [discipline, setDiscipline] = useState(initialCoach?.discipline || "rollers");
  const [exp, setExp] = useState(initialCoach?.exp || "1 год");
  const [grade, setGrade] = useState(initialCoach?.grade || (STORAGE ? "pending" : "regular"));
  const [branches, setBranches] = useState(initialCoach?.branches || ["roza"]);
  const [email, setEmail] = useState(initialCoach?.email || "");
  const [password, setPassword] = useState(initialCoach?.password || "");
  const [passwordJustReset, setPasswordJustReset] = useState(false);
  const [error, setError] = useState("");

  // после создания нового тренера — экран «сохраните доступы», показывается один раз
  const [pendingPayload, setPendingPayload] = useState(null);
  const [copied, setCopied] = useState(false);

  function toggleBranch(bId) {
    setBranches(prev => prev.includes(bId) ? prev.filter(x => x !== bId) : [...prev, bId]);
  }

  function resetPassword() {
    setPassword(generateTempPassword());
    setPasswordJustReset(true);
  }

  function emailTakenByAnother(trimmedEmail) {
    const byCoach = (existingCoaches || []).some(c => c.id !== initialCoach?.id && (c.email || "").toLowerCase() === trimmedEmail);
    const byManager = (managers || []).some(m => m.email.toLowerCase() === trimmedEmail);
    return byCoach || byManager;
  }

  async function handleSave() {
    if (!name.trim()) { setError("Укажи имя тренера"); return; }
    if (branches.length === 0) { setError("Выбери хотя бы один филиал"); return; }
    const trimmedEmail = email.trim().toLowerCase();
    if ((!STORAGE && !trimmedEmail) || (trimmedEmail && !trimmedEmail.includes("@"))) { setError("Укажи корректную почту для входа"); return; }
    if (trimmedEmail && emailTakenByAnother(trimmedEmail)) { setError("Эта почта уже занята другим аккаунтом"); return; }

    if(STORAGE) {
      try {await onSave({id:draftId,__expected:draftExpected,name:name.trim(),discipline,disciplines:[...new Set([...disciplines,discipline])],exp:exp.trim(),grade,branches,email:trimmedEmail || null});} catch(error) {setError(error.message);}
      return;
    }
    if (isEditing) {
      await onSave({ name: name.trim(), discipline, exp: exp.trim(), grade, branches, email: trimmedEmail, password });
      return;
    }
    // новый тренер — сначала показываем сгенерированный пароль, сохраняем только после подтверждения
    const generated = generateTempPassword();
    setPassword(generated);
    setEmail(trimmedEmail);
    setPendingPayload({ name: name.trim(), discipline, exp: exp.trim(), grade, branches, email: trimmedEmail, password: generated });
  }

  function handleCopy(text) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const disc = DISCIPLINES[discipline];

  // Экран подтверждения доступов после создания нового тренера
  if (pendingPayload) {
    const loginText = `Почта: ${pendingPayload.email}\nПароль: ${pendingPayload.password}`;
    return (
      <ModalShell onClose={onClose} accent={disc.color}>
        <div className="modal-header">
          <div className="modal-title"><CheckCircle2 size={16} /> Тренер создан</div>
          <button className="modal-close" aria-label="Закрыть" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="credentials-hint">Передайте эти данные тренеру — пароль показывается один раз, повторно посмотреть его нельзя (только сбросить заново в карточке тренера).</p>
          <div className="credentials-box">
            <div className="credentials-row"><span>Почта</span><b>{pendingPayload.email}</b></div>
            <div className="credentials-row"><span>Пароль</span><b>{pendingPayload.password}</b></div>
          </div>
          <button className="modal-btn-secondary" onClick={() => handleCopy(loginText)} style={{ width: "100%" }}>
            {copied ? "Скопировано" : "Скопировать почту и пароль"}
          </button>
        </div>
        <div className="modal-footer">
          <button className="modal-btn-primary" style={{ background: disc.color }} onClick={() => onSave(pendingPayload)}>
            Готово
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose} accent={disc.color}>
      <div className="modal-header">
        <div className="modal-title"><UserCircle2 size={16} /> {isEditing ? "Редактирование тренера" : "Новый тренер"}</div>
        <button className="modal-close" aria-label="Закрыть" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="modal-body">
        <FormField label="Имя и фамилия">
          <input className="form-input" placeholder="Имя Фамилия" value={name} onChange={e => setName(e.target.value)} />
        </FormField>

        <FormField label="Почта для входа">
          <input className="form-input" placeholder="coach@extremekids.ru" value={email} onChange={e => { setEmail(e.target.value); setError(""); }} />
        </FormField>

        {STORAGE && <div className="form-hint">Почту можно оставить пустой до уточнения. Карточка без почты не даёт входа в CRM. Вход и пароль управляются через Supabase Auth и отдельную привязку Auth User ID.</div>}
        {isEditing && !STORAGE && (
          <FormField label="Пароль">
            <div className="password-reset-row">
              <div className={passwordJustReset ? "password-reset-value shown" : "password-reset-value"}>
                {passwordJustReset ? password : "••••••••"}
              </div>
              <button type="button" className="modal-btn-secondary" onClick={resetPassword}>Сбросить пароль</button>
            </div>
            {passwordJustReset && (
              <p className="credentials-hint">Новый пароль показан один раз — сохраните изменения и передайте его тренеру.</p>
            )}
          </FormField>
        )}

        <div className="form-row-2">
          <FormField label="Направление">
            <select className="form-select" value={discipline} onChange={e => setDiscipline(e.target.value)}>
              {Object.entries(DISCIPLINES).map(([k, d]) => <option key={k} value={k}>{d.label}</option>)}
            </select>
          </FormField>
          <FormField label="Стаж">
            <input className="form-input" placeholder="5 лет" value={exp} onChange={e => setExp(e.target.value)} />
          </FormField>
        </div>

        {STORAGE && <FormField label="Направления наставника"><div className="picker-list">{Object.entries(DISCIPLINES).map(([id,d])=><label className="picker-row" key={id}><input type="checkbox" checked={id===discipline || disciplines.includes(id)} disabled={id===discipline} onChange={()=>setDisciplines(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])} />{d.label}</label>)}</div></FormField>}
        <FormField label="Грейд">
          <div className="segmented">
            {STORAGE && <button className={grade === "pending" ? "seg active" : "seg"} onClick={() => setGrade("pending")}>Не подтверждена · расчёт приостановлен</button>}
            <button className={grade === "regular" ? "seg active" : "seg"} onClick={() => setGrade("regular")}>
              Обычный · инд. 300 ₽
            </button>
            <button className={grade === "pro" ? "seg active" : "seg"} onClick={() => setGrade("pro")}>
              Про · инд. 400 ₽
            </button>
          </div>
        </FormField>

        <FormField label="Филиалы (можно выбрать оба)">
          <div className="picker-list" style={{ maxHeight: "none" }}>
            {Object.entries(BRANCHES).map(([k, b]) => (
              <label key={k} className="picker-row">
                <input type="checkbox" checked={branches.includes(k)} onChange={() => toggleBranch(k)} />
                <span className="picker-check" style={{ background: branches.includes(k) ? b.color : "transparent" }}>
                  {branches.includes(k) && <CheckCircle2 size={12} color="var(--crm-surface)" />}
                </span>
                <span className="picker-name">{b.label}</span>
              </label>
            ))}
          </div>
        </FormField>

        {error && <div className="form-error"><AlertCircle size={13} /> {error}</div>}
      </div>

      <div className="modal-footer">
        <button className="modal-btn-secondary" onClick={onClose}>Отмена</button>
        <button className="modal-btn-primary" style={{ background: disc.color }} onClick={handleSave}>{isEditing ? "Сохранить изменения" : "Добавить тренера"}</button>
      </div>
    </ModalShell>
  );
}

/* ============================================================
   МОДАЛКА УПРАВЛЯЮЩЕГО — создание/редактирование, доступна владельцу
   ============================================================ */
function ManagerModal({ initialManager, existingManagers, coaches, onClose, onSave, expectedVersions }) {
  const [draftExpected] = useState(expectedVersions);
  const isEditing = Boolean(initialManager);
  const [draftId] = useState(() => initialManager?.id || nextId("m"));
  const [name, setName] = useState(initialManager?.name || "");
  const [email, setEmail] = useState(initialManager?.email || "");
  const [role, setRole] = useState(initialManager?.role || "branch_manager");
  const [singleBranch, setSingleBranch] = useState(initialManager?.branches?.[0] || "roza");
  const [password, setPassword] = useState(initialManager?.password || "");
  const [passwordJustReset, setPasswordJustReset] = useState(false);
  const [error, setError] = useState("");

  const [pendingPayload, setPendingPayload] = useState(null);
  const [copied, setCopied] = useState(false);

  function resetPassword() {
    setPassword(generateTempPassword());
    setPasswordJustReset(true);
  }

  function emailTakenByAnother(trimmedEmail) {
    const byManager = (existingManagers || []).some(m => m.id !== initialManager?.id && m.email.toLowerCase() === trimmedEmail);
    const byCoach = (coaches || []).some(c => (c.email || "").toLowerCase() === trimmedEmail);
    return byManager || byCoach;
  }

  async function handleSave() {
    if (!name.trim()) { setError("Укажи имя администратора"); return; }
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes("@")) { setError("Укажи корректную почту для входа"); return; }
    if (emailTakenByAnother(trimmedEmail)) { setError("Эта почта уже занята другим аккаунтом"); return; }

    const branches = role === "owner" ? ["roza", "irkutsk"] : [singleBranch];
    if(STORAGE) {
      try {await onSave({id:draftId,__expected:draftExpected,name:name.trim(),email:trimmedEmail,role,branches});} catch(error) {setError(error.message);}
      return;
    }
    if (isEditing) {
      await onSave({ name: name.trim(), email: trimmedEmail, role, branches, password });
      return;
    }
    const generated = generateTempPassword();
    setPassword(generated);
    setEmail(trimmedEmail);
    setPendingPayload({ name: name.trim(), email: trimmedEmail, role, branches, password: generated });
  }

  function handleCopy(text) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (pendingPayload) {
    const loginText = `Почта: ${pendingPayload.email}\nПароль: ${pendingPayload.password}`;
    return (
      <ModalShell onClose={onClose} accent="var(--crm-blue)">
        <div className="modal-header">
          <div className="modal-title"><CheckCircle2 size={16} /> Администратор добавлен</div>
          <button className="modal-close" aria-label="Закрыть" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="credentials-hint">Передайте эти данные администратору — пароль показывается один раз, повторно посмотреть его нельзя (только сбросить заново в карточке).</p>
          <div className="credentials-box">
            <div className="credentials-row"><span>Почта</span><b>{pendingPayload.email}</b></div>
            <div className="credentials-row"><span>Пароль</span><b>{pendingPayload.password}</b></div>
          </div>
          <button className="modal-btn-secondary" onClick={() => handleCopy(loginText)} style={{ width: "100%" }}>
            {copied ? "Скопировано" : "Скопировать почту и пароль"}
          </button>
        </div>
        <div className="modal-footer">
          <button className="modal-btn-primary" style={{ background: "var(--crm-blue)" }} onClick={() => onSave(pendingPayload)}>
            Готово
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose} accent="var(--crm-blue)">
      <div className="modal-header">
        <div className="modal-title"><Settings size={16} /> {isEditing ? "Редактирование администратора" : "Новый администратор"}</div>
        <button className="modal-close" aria-label="Закрыть" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="modal-body">
        <FormField label="Имя и фамилия">
          <input className="form-input" placeholder="Имя Фамилия" value={name} onChange={e => setName(e.target.value)} />
        </FormField>

        <FormField label="Почта для входа">
          <input className="form-input" placeholder="manager@extremekids.ru" value={email} onChange={e => { setEmail(e.target.value); setError(""); }} />
        </FormField>

        {STORAGE && <div className="form-hint">Вход и пароль управляются через Supabase Auth. После создания карточки назначьте ей Auth User ID по инструкции подключения.</div>}
        {isEditing && !STORAGE && (
          <FormField label="Пароль">
            <div className="password-reset-row">
              <div className={passwordJustReset ? "password-reset-value shown" : "password-reset-value"}>
                {passwordJustReset ? password : "••••••••"}
              </div>
              <button type="button" className="modal-btn-secondary" onClick={resetPassword}>Сбросить пароль</button>
            </div>
            {passwordJustReset && (
              <p className="credentials-hint">Новый пароль показан один раз — сохраните изменения и передайте его администратору.</p>
            )}
          </FormField>
        )}

        <FormField label="Уровень доступа">
          <div className="segmented">
            <button className={role === "branch_manager" ? "seg active" : "seg"} onClick={() => setRole("branch_manager")}>
              Администратор · расписание
            </button>
            <button className={role === "owner" ? "seg active" : "seg"} onClick={() => setRole("owner")}>
              Владелец · оба филиала
            </button>
          </div>
        </FormField>

        {role === "branch_manager" && (
          <FormField label="Филиал">
            <div className="picker-list" style={{ maxHeight: "none" }}>
              {Object.entries(BRANCHES).map(([k, b]) => (
                <label key={k} className="picker-row">
                  <input type="radio" name="manager-branch" checked={singleBranch === k} onChange={() => setSingleBranch(k)} />
                  <span className="picker-check" style={{ background: singleBranch === k ? b.color : "transparent" }}>
                    {singleBranch === k && <CheckCircle2 size={12} color="var(--crm-surface)" />}
                  </span>
                  <span className="picker-name">{b.label}</span>
                </label>
              ))}
            </div>
          </FormField>
        )}

        {error && <div className="form-error"><AlertCircle size={13} /> {error}</div>}
      </div>

      <div className="modal-footer">
        <button className="modal-btn-secondary" onClick={onClose}>Отмена</button>
        <button className="modal-btn-primary" style={{ background: "var(--crm-blue)" }} onClick={handleSave}>{isEditing ? "Сохранить изменения" : "Добавить администратора"}</button>
      </div>
    </ModalShell>
  );
}

/* ============================================================
   СТИЛИ
   ============================================================ */
const CSS = `
.coach-admin-card-clickable, .coach-admin-name, .student-row-name, .picker-name { color: #F4F5F7; }
.attendance-actions { flex-basis: 100%; margin-left: 28px; }
.roster-row { flex-wrap: wrap; }
.crm-filters { display:flex; gap:8px; flex-wrap:wrap; margin:12px 0; }
.crm-filters label { color:#A7ABB5; font-size:12px; flex:1; min-width:110px; }
.crm-filters select { margin-top:6px; width:100%; }
.coach-badges, .direction-badges { display:flex; flex-wrap:wrap; gap:6px; margin:6px 0; }
.coach-badge { font-size:11px; color:#F4F5F7; border:1px solid #454B56; border-radius:6px; padding:4px 6px; }
.direction-count-row { display:flex; justify-content:space-between; padding:5px 0; font-size:13px; color:#EDEFF2; }
.promo-result { margin:12px 0; color:#F4F5F7; display:grid; gap:8px; }
.storage-error { position:sticky; top:0; z-index:2000; background:#6b2020; padding:12px; color:white; }
.period-picker { display:flex; gap:10px; align-items:center; color:#A7ABB5; margin-bottom:16px; }
.period-picker label { display:grid; gap:6px; font-size:12px; }
.period-picker select { max-width:200px; }

@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }

.root {
  font-family: 'Space Grotesk', sans-serif;
  background: #0E1013;
  color: #EDEFF2;
  min-height: 100vh;
  width: 100%;
}

/* ===== LOGIN ===== */
.login-shell {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.login-card {
  width: 100%; max-width: 360px;
  background: #16181C; border: 1px solid #2A2E36; border-radius: 20px;
  padding: 28px 26px 24px;
}
.login-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 22px; }
.login-title { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
.login-subtitle { font-size: 12px; color: #8A8F99; margin-bottom: 22px; }
.login-form { display: flex; flex-direction: column; gap: 14px; }
.login-field { display: flex; flex-direction: column; gap: 6px; font-size: 11px; color: #8A8F99; font-weight: 600; }
.login-field input {
  background: #1C1F25; border: 1px solid #2A2E36; border-radius: 10px;
  padding: 11px 12px; color: #EDEFF2; font-family: inherit; font-size: 13px; outline: none;
}
.login-field input:focus { border-color: #3DA5FF; }
.login-password-row { display: flex; gap: 8px; }
.login-password-row input { flex: 1; }
.login-eye {
  background: #1C1F25; border: 1px solid #2A2E36; color: #8A8F99;
  border-radius: 10px; padding: 0 12px; font-family: inherit; font-size: 11px; cursor: pointer;
}
.login-error {
  display: flex; align-items: center; gap: 6px;
  color: #FF5C5C; font-size: 12px; font-weight: 600;
}
.login-submit {
  background: #EDEFF2; color: #0E1013; border: none; border-radius: 10px;
  padding: 12px; font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer;
  margin-top: 4px;
}
.login-demo-toggle {
  width: 100%; background: transparent; border: none; color: #565B66;
  font-family: inherit; font-size: 11px; cursor: pointer; margin-top: 16px; text-align: center;
  text-decoration: underline;
}
.login-demo-list {
  margin-top: 10px; padding: 12px; background: #1C1F25; border: 1px solid #2A2E36;
  border-radius: 10px; font-size: 11px; color: #8A8F99; display: flex; flex-direction: column; gap: 6px;
}

/* ===== LOGOUT / USER CARD ===== */
.logout-btn {
  background: #1C1F25; border: 1px solid #2A2E36; color: #8A8F99;
  border-radius: 10px; width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
}
.logout-btn:hover { color: #FF5C5C; border-color: #FF5C5C; }
.admin-user-card {
  display: flex; align-items: center; gap: 10px;
  background: #1C1F25; border: 1px solid #2A2E36; border-radius: 12px;
  padding: 10px; margin-bottom: 18px;
}
.admin-user-avatar {
  width: 32px; height: 32px; border-radius: 9px; background: #EDEFF2; color: #0E1013;
  display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; flex-shrink: 0;
}
.admin-user-info { flex: 1; min-width: 0; }
.admin-user-name { font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.admin-user-role { font-size: 10px; color: #8A8F99; margin-top: 1px; }

/* ===== PHONE FRAME (Coach view) ===== */
.phone-frame {
  display: flex; justify-content: center;
  padding: 64px 16px 32px;
  min-height: 100vh;
}
.phone-screen {
  width: 390px;
  min-height: 760px;
  background: #16181C;
  border-radius: 36px;
  border: 1px solid #2A2E36;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 0 8px #0A0B0D, 0 30px 60px -20px rgba(0,0,0,.6);
}

.diary-header { padding: 20px 20px 0; }
.diary-header-top { display: flex; justify-content: space-between; align-items: flex-start; }
.coach-id { display: flex; gap: 10px; align-items: center; }
.coach-avatar {
  width: 40px; height: 40px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 14px; color: #0E1013;
}
.coach-name { font-weight: 600; font-size: 14px; }
.coach-disc { font-size: 11px; color: #8A8F99; display: flex; align-items: center; gap: 4px; margin-top: 2px; }
.diary-title-stamp {
  margin-top: 18px;
  display: flex; justify-content: space-between; align-items: baseline;
  border-bottom: 2px dashed #2A2E36;
  padding-bottom: 12px;
}
.diary-title-stamp span:first-child {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px; letter-spacing: 2px; color: var(--accent);
  font-weight: 600;
}
.diary-date { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #8A8F99; }

.coach-tabs { display: flex; padding: 12px 16px 0; gap: 4px; }
.tab {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  background: transparent; border: none; color: #8A8F99;
  font-family: inherit; font-size: 12px; font-weight: 600;
  padding: 10px 4px; border-radius: 10px 10px 0 0; cursor: pointer;
  border-bottom: 2px solid transparent;
}
.tab.active { color: #EDEFF2; border-bottom: 2px solid var(--accent); }

.coach-main { flex: 1; overflow-y: auto; padding: 4px 16px 100px; }
.tab-content { display: flex; flex-direction: column; gap: 20px; padding-top: 12px; }

.section-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; padding: 0 2px; }
.section-title { font-size: 12px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: #8A8F99; }
.section-count {
  font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #565B66;
  background: #1C1F25; padding: 2px 7px; border-radius: 6px;
}
.section-body { display: flex; flex-direction: column; gap: 10px; }
.empty-state { font-size: 12px; color: #565B66; padding: 14px 0; text-align: center; border: 1px dashed #2A2E36; border-radius: 12px; }

/* ===== Карточка тренировки — страница дневника ===== */
.session-card {
  position: relative;
  background: #1C1F25;
  border: 1px solid #2A2E36;
  border-left: 3px solid var(--card-accent);
  border-radius: 14px;
  padding: 14px 14px 12px;
  text-align: left;
  font-family: inherit;
  color: #EDEFF2;
  cursor: pointer;
  display: flex; flex-direction: column; gap: 8px;
  transition: transform .15s, border-color .15s;
}
.session-card:hover { transform: translateY(-1px); border-color: #3A3F4A; }

.perf-edge {
  position: absolute; top: 0; left: 14px; right: 14px;
  display: flex; justify-content: space-between;
  transform: translateY(-50%);
  pointer-events: none;
}
.perf-edge span {
  width: 4px; height: 4px; border-radius: 50%;
  background: #0E1013;
}

.session-card-row { display: flex; justify-content: space-between; align-items: center; }
.session-time {
  font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600;
  display: flex; align-items: center; gap: 5px; color: #EDEFF2;
}
.session-dur { color: #8A8F99; font-weight: 400; }
.status-pill { font-size: 9px; font-weight: 700; letter-spacing: .3px; padding: 3px 8px; border-radius: 999px; text-transform: uppercase; }
.status-upcoming { background: rgba(61,165,255,.15); color: #3DA5FF; }
.status-done { background: rgba(61,220,151,.15); color: #3DDC97; }
.status-missed { background: rgba(255,84,84,.15); color: #FF5454; }

.session-mid { display: flex; justify-content: space-between; align-items: center; }
.session-type-tag { font-size: 10px; font-weight: 700; letter-spacing: .5px; color: #8A8F99; }
.session-loc { font-size: 11px; color: #8A8F99; display: flex; align-items: center; gap: 4px; }

.session-foot { display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #2A2E36; padding-top: 8px; }
.session-count-students { font-size: 11px; color: #565B66; }
.chev { color: #565B66; }

/* ===== Поиск ===== */
.search-bar {
  display: flex; align-items: center; gap: 8px;
  background: #1C1F25; border: 1px solid #2A2E36; border-radius: 12px;
  padding: 10px 12px; color: #565B66;
}
.search-bar input { background: transparent; border: none; outline: none; color: #EDEFF2; font-family: inherit; font-size: 13px; width: 100%; }

/* ===== Список учеников (тренер) ===== */
.student-list { display: flex; flex-direction: column; gap: 8px; }
.student-row {
  display: flex; align-items: center; gap: 12px;
  background: #1C1F25; border: 1px solid #2A2E36; border-radius: 12px;
  padding: 10px 12px; cursor: pointer; font-family: inherit; color: #EDEFF2; text-align: left;
}
.student-row-avatar {
  width: 36px; height: 36px; border-radius: 10px; border: 2px solid;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; flex-shrink: 0;
}
.student-row-info { flex: 1; min-width: 0; }
.student-row-name { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.student-row-meta { font-size: 11px; color: #8A8F99; margin-top: 2px; }
.attendance-ring {
  font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; color: var(--c);
}

/* ===== Stats ===== */
.stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.stat-block { background: #1C1F25; border: 1px solid #2A2E36; border-radius: 14px; padding: 14px; }
.stat-block-icon { margin-bottom: 8px; }
.stat-block-value { font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 600; }
.stat-block-label { font-size: 11px; color: #8A8F99; margin-top: 2px; }

.level-bars { display: flex; flex-direction: column; gap: 10px; background: #1C1F25; border: 1px solid #2A2E36; border-radius: 14px; padding: 14px; }
.level-bar-row { display: flex; align-items: center; gap: 10px; }
.level-bar-label { font-size: 11px; color: #8A8F99; width: 80px; flex-shrink: 0; }
.level-bar-track { flex: 1; height: 8px; background: #0E1013; border-radius: 4px; overflow: hidden; }
.level-bar-fill { height: 100%; border-radius: 4px; }
.level-bar-count { font-family: 'JetBrains Mono', monospace; font-size: 12px; width: 20px; text-align: right; }

.fab {
  position: absolute; bottom: 24px; right: 20px;
  width: 56px; height: 56px; border-radius: 18px; border: none;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; box-shadow: 0 8px 20px -4px rgba(0,0,0,.5);
}

/* ===== Detail (session / student) ===== */
.detail-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 16px; border-bottom: 1px solid #2A2E36;
}
.back-btn { background: #1C1F25; border: 1px solid #2A2E36; color: #EDEFF2; border-radius: 10px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.detail-header-title { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
 .detail-main { flex: 1; overflow-y: auto; padding: 16px; }
.modal-card .phone-frame { padding:0; min-height:0; overflow:auto; }
.modal-card .phone-screen { width:100%; min-height:0; border:0; border-radius:0; box-shadow:none; overflow:visible; }
.modal-card .detail-main { overflow:visible; }
.modal-card .detail-header { position:sticky; top:0; z-index:1; background:#16181C; }


.detail-page { position: relative; background: #1C1F25; border: 1px solid #2A2E36; border-radius: 16px; padding: 20px 16px 16px; }
.detail-meta-row { display: flex; flex-wrap: wrap; gap: 8px; }
.meta-chip { display: flex; align-items: center; gap: 5px; background: #0E1013; border-radius: 8px; padding: 6px 10px; font-size: 11px; color: #8A8F99; }
.detail-divider { height: 1px; background: repeating-linear-gradient(90deg, #2A2E36 0, #2A2E36 6px, transparent 6px, transparent 12px); margin: 16px 0; }
.detail-label { font-size: 11px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: #8A8F99; margin-bottom: 10px; }

.roster-list { display: flex; flex-direction: column; gap: 8px; }
.roster-row { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.roster-row input { display: none; }
.roster-check { width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid #3A3F4A; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.roster-name { font-size: 13px; flex: 1; }
.roster-level { font-size: 10px; color: #565B66; }

.note-textarea {
  width: 100%; background: #0E1013; border: 1px solid #2A2E36; border-radius: 10px;
  padding: 12px; color: #EDEFF2; font-family: inherit; font-size: 13px; resize: none; outline: none;
  line-height: 1.5;
}
.note-textarea:focus { border-color: var(--accent); }
.note-textarea-error { border-color: #FF5454; }
.required-mark { color: #FF5454; }

.detail-footer { padding: 14px 16px 20px; }
.save-btn { width: 100%; border: none; border-radius: 12px; padding: 14px; font-family: inherit; font-weight: 700; font-size: 13px; color: #16181C; cursor: pointer; }

.student-profile-card { background: #1C1F25; border: 1px solid #2A2E36; border-radius: 16px; padding: 24px 16px; text-align: center; }
.student-profile-avatar { width: 60px; height: 60px; border-radius: 16px; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; color: #16181C; }
.student-profile-name { font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; }
.flag-badge { display: flex; align-items: center; gap: 3px; background: rgba(255,84,84,.15); color: #FF5454; font-size: 10px; padding: 2px 7px; border-radius: 999px; font-weight: 600; }
.student-profile-meta { font-size: 12px; color: #8A8F99; margin-top: 4px; }
.student-profile-stats { display: flex; justify-content: center; gap: 24px; margin-top: 18px; padding-top: 18px; border-top: 1px dashed #2A2E36; }
.profile-stat-val { font-family: 'JetBrains Mono', monospace; font-size: 16px; font-weight: 600; }
.profile-stat-lbl { font-size: 10px; color: #8A8F99; margin-top: 2px; }

.history-list { display: flex; flex-direction: column; gap: 0; }
.history-row { display: flex; gap: 12px; padding: 10px 0; position: relative; }
.history-row:not(:last-child)::before { content: ''; position: absolute; left: 4px; top: 22px; bottom: -4px; width: 1px; background: #2A2E36; }
.history-dot { width: 9px; height: 9px; border-radius: 50%; margin-top: 4px; flex-shrink: 0; }
.history-row-date { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #8A8F99; }
.history-row-note { font-size: 13px; margin-top: 3px; line-height: 1.4; }

/* ===== ADMIN SHELL ===== */
.admin-shell { display: flex; min-height: 100vh; }
.admin-sidebar {
  width: 230px; background: #16181C; border-right: 1px solid #2A2E36;
  padding: 24px 16px; display: flex; flex-direction: column; flex-shrink: 0;
}
.admin-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 32px; padding: 0 4px; }
.admin-logo-mark { font-family: 'JetBrains Mono', monospace; font-weight: 700; background: #EDEFF2; color: #16181C; padding: 6px 9px; border-radius: 8px; font-size: 14px; }
.admin-logo-text { font-size: 11px; font-weight: 700; line-height: 1.2; letter-spacing: .5px; }

.admin-nav { display: flex; flex-direction: column; gap: 2px; }
.admin-nav-item {
  display: flex; align-items: center; gap: 10px;
  background: transparent; border: none; color: #8A8F99;
  font-family: inherit; font-size: 13px; font-weight: 500;
  padding: 11px 12px; border-radius: 10px; cursor: pointer; text-align: left;
}
.admin-nav-item.active { background: #1C1F25; color: #EDEFF2; }
.admin-nav-item:hover:not(.active) { color: #EDEFF2; }

.admin-disciplines-key { margin-top: auto; padding-top: 24px; border-top: 1px solid #2A2E36; }
.admin-disciplines-title { font-size: 10px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: #565B66; margin-bottom: 10px; padding: 0 4px;}
.discipline-key-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #8A8F99; padding: 5px 4px; }
.discipline-key-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

.admin-content { flex: 1; min-width: 0; }
.admin-topbar { display: flex; justify-content: space-between; align-items: center; padding: 20px 32px; border-bottom: 1px solid #2A2E36; }
.admin-search { display: flex; align-items: center; gap: 8px; background: #1C1F25; border: 1px solid #2A2E36; border-radius: 10px; padding: 9px 14px; width: 320px; color: #565B66; }
.admin-search input { background: transparent; border: none; outline: none; color: #EDEFF2; font-family: inherit; font-size: 13px; width: 100%; }
.topbar-stamp { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #565B66; letter-spacing: 1px; }

.admin-page { padding: 28px 32px 60px; display: flex; flex-direction: column; gap: 20px; max-width: 1200px; }

.kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.kpi-card { background: #16181C; border: 1px solid #2A2E36; border-radius: 16px; padding: 18px; }
.kpi-card.warn { border-color: rgba(255,84,84,.3); }
.kpi-card-top { display: flex; justify-content: space-between; color: #565B66; margin-bottom: 14px; }
.kpi-value { font-family: 'JetBrains Mono', monospace; font-size: 26px; font-weight: 600; }
.kpi-label { font-size: 12px; color: #8A8F99; margin-top: 4px; }
.kpi-delta { font-size: 11px; color: #3DDC97; margin-top: 8px; }
.kpi-card.warn .kpi-delta { color: #FF5454; }

.admin-grid-2 { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; }
.panel { background: #16181C; border: 1px solid #2A2E36; border-radius: 16px; padding: 20px; }
.panel-title { font-size: 12px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; color: #8A8F99; margin-bottom: 16px; }

.week-chart { display: flex; align-items: flex-end; gap: 12px; height: 160px; }
.week-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; height: 100%; justify-content: flex-end; }
.week-bar { width: 100%; background: linear-gradient(180deg, #3DA5FF, #2A6FB3); border-radius: 6px 6px 2px 2px; min-height: 4px; }
.week-bar-val { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #8A8F99; }
.week-bar-day { font-size: 11px; color: #565B66; }

.disc-distribution { display: flex; flex-direction: column; gap: 14px; }
.disc-dist-row { display: flex; align-items: center; gap: 10px; }
.disc-dist-label { width: 90px; font-size: 12px; display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.disc-dist-track { flex: 1; height: 8px; background: #1C1F25; border-radius: 4px; overflow: hidden; }
.disc-dist-fill { height: 100%; border-radius: 4px; }
.disc-dist-count { font-family: 'JetBrains Mono', monospace; font-size: 12px; width: 20px; text-align: right; }

.attention-list { display: flex; flex-direction: column; gap: 1px; }
.attention-row { display: grid; grid-template-columns: 10px 1.5fr 2fr 1.5fr; align-items: center; gap: 12px; padding: 10px 4px; border-bottom: 1px solid #1C1F25; }
.attention-dot { width: 8px; height: 8px; border-radius: 50%; }
.attention-name { font-size: 13px; font-weight: 600; }
.attention-reason { font-size: 12px; color: #8A8F99; }
.attention-coach { font-size: 12px; color: #565B66; text-align: right; }
.attention-more-btn {
  width: 100%; margin-top: 10px; background: #1C1F25; border: 1px solid #2A2E36; color: #8A8F99;
  font-family: inherit; font-size: 12px; font-weight: 600; padding: 9px; border-radius: 10px; cursor: pointer;
}
.attention-more-btn:hover { color: #EDEFF2; border-color: #3A3F4A; }

.coach-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.coach-admin-card { background: #16181C; border: 1px solid #2A2E36; border-left: 3px solid var(--accent); border-radius: 14px; padding: 18px; }
.coach-admin-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.coach-admin-avatar { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #16181C; }
.coach-admin-disc-tag { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #565B66; }
.coach-admin-name { font-size: 14px; font-weight: 700; }
.coach-admin-meta { font-size: 12px; color: #8A8F99; display: flex; align-items: center; gap: 5px; margin-top: 4px; }
.coach-admin-stats { display: flex; gap: 20px; margin-top: 16px; padding-top: 14px; border-top: 1px dashed #2A2E36; }
.cas-val { font-family: 'JetBrains Mono', monospace; font-size: 15px; font-weight: 600; display: block; }
.cas-lbl { font-size: 10px; color: #565B66; }

.admin-table { width: 100%; border-collapse: collapse; }
.admin-table th { text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; color: #565B66; padding: 8px 12px; border-bottom: 1px solid #2A2E36; }
.admin-table td { padding: 12px; font-size: 13px; border-bottom: 1px solid #1C1F25; vertical-align: middle; }
.table-name-cell { font-weight: 600; min-width: 180px; }
.table-name-content { display: flex; align-items: center; gap: 6px; }
.table-name-content svg { flex-shrink: 0; }
.table-disc-tag { display: inline-flex; align-items: center; gap: 5px; border: 1px solid; border-radius: 999px; padding: 3px 9px; font-size: 11px; }
.table-attendance { display: flex; align-items: center; gap: 8px; font-family: 'JetBrains Mono', monospace; font-size: 12px; }
.table-attendance-track { width: 60px; height: 5px; background: #1C1F25; border-radius: 3px; overflow: hidden; }
.table-attendance-fill { height: 100%; }
.table-chev { color: #565B66; cursor: pointer; }

.schedule-day-panel { padding: 18px 20px; }
.schedule-rows { display: flex; flex-direction: column; gap: 1px; }
.schedule-row { display: grid; grid-template-columns: 50px 2px 24px 1fr auto auto auto; align-items: center; gap: 14px; padding: 10px 4px; }
.schedule-row-time { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #8A8F99; }
.schedule-row-bar { width: 2px; height: 28px; background: var(--accent); border-radius: 2px; }
.schedule-row-title { font-size: 13px; font-weight: 600; }
.schedule-row-sub { font-size: 11px; color: #8A8F99; margin-top: 2px; }
.schedule-row-status { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 999px; }
.st-upcoming { background: rgba(61,165,255,.15); color: #3DA5FF; }
.st-done { background: rgba(61,220,151,.15); color: #3DDC97; }
.st-missed { background: rgba(255,84,84,.15); color: #FF5454; }

@media (max-width: 900px) {
  .admin-grid-2 { grid-template-columns: 1fr; }
  .kpi-row { grid-template-columns: 1fr 1fr; }
  .coach-grid { grid-template-columns: 1fr 1fr; }
}

/* ===== Toast ===== */
.toast {
  position: fixed; top: 60px; left: 50%; transform: translateX(-50%);
  z-index: 1100; background: #1C1F25; border: 1px solid #2A2E36;
  color: #3DDC97; font-size: 12px; font-weight: 600;
  display: flex; align-items: center; gap: 7px;
  padding: 10px 16px; border-radius: 999px;
  box-shadow: 0 10px 24px -8px rgba(0,0,0,.5);
  animation: toastIn .2s ease-out;
}
@keyframes toastIn { from { opacity: 0; transform: translate(-50%, -8px); } to { opacity: 1; transform: translate(-50%, 0); } }

/* ===== Topbar action buttons (admin) ===== */
.admin-topbar-right { display: flex; align-items: center; gap: 10px; }
.topbar-btn {
  display: flex; align-items: center; gap: 6px;
  background: #1C1F25; border: 1px solid #2A2E36; color: #EDEFF2;
  font-family: inherit; font-size: 12px; font-weight: 600;
  padding: 8px 14px; border-radius: 10px; cursor: pointer;
}
.topbar-btn.primary { background: #EDEFF2; color: #16181C; border-color: #EDEFF2; }

/* ===== Add icon button (coach students tab) ===== */
.search-row { display: flex; gap: 8px; }
.search-row .search-bar { flex: 1; }
.add-icon-btn {
  width: 38px; height: 38px; flex-shrink: 0;
  background: #1C1F25; border: 1.5px solid; border-radius: 12px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}

/* ===== Modal ===== */
.modal-overlay {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(8,9,11,.7);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
.modal-card {
  width: 100%; max-width: 460px; max-height: 88vh;
  background: #16181C; border: 1px solid #2A2E36; border-radius: 20px;
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow: 0 30px 70px -20px rgba(0,0,0,.7);
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 18px 16px; border-bottom: 1px solid #2A2E36; flex-shrink: 0;
}
.modal-title { font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.modal-close { background: transparent; border: none; color: #8A8F99; cursor: pointer; padding: 4px; }
.modal-body { padding: 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; flex: 1; }
.modal-footer { display: flex; gap: 10px; padding: 14px 18px 18px; border-top: 1px solid #2A2E36; flex-shrink: 0; }

.modal-btn-secondary, .modal-btn-primary {
  flex: 1; border-radius: 12px; padding: 12px; font-family: inherit; font-weight: 700; font-size: 13px; cursor: pointer;
}
.modal-btn-secondary { background: transparent; border: 1px solid #2A2E36; color: #8A8F99; }
.modal-btn-primary { border: none; color: #16181C; }

.form-field { display: flex; flex-direction: column; gap: 7px; }
.form-label { font-size: 11px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; color: #8A8F99; }
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-input, .form-select, .form-textarea {
  width: 100%; background: #1C1F25; border: 1px solid #2A2E36; border-radius: 10px;
  padding: 10px 12px; color: #EDEFF2; font-family: inherit; font-size: 13px; outline: none;
}
.form-input:focus, .form-select:focus, .form-textarea:focus { border-color: var(--accent); }
.form-textarea { resize: none; line-height: 1.5; }
.form-hint { font-size: 10px; color: #565B66; margin-top: 4px; }

.segmented { display: flex; background: #1C1F25; border: 1px solid #2A2E36; border-radius: 10px; padding: 3px; gap: 2px; }
.seg { flex: 1; background: transparent; border: none; color: #8A8F99; font-family: inherit; font-size: 12px; font-weight: 600; padding: 8px 4px; border-radius: 8px; cursor: pointer; }
.seg.active { background: #2A2E36; color: #EDEFF2; }

.picker-list { display: flex; flex-direction: column; gap: 6px; max-height: 180px; overflow-y: auto; background: #1C1F25; border: 1px solid #2A2E36; border-radius: 10px; padding: 8px; }
.picker-row { display: flex; align-items: center; gap: 9px; padding: 6px 4px; cursor: pointer; }
.picker-row input { display: none; }
.picker-check { width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid #3A3F4A; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.picker-name { font-size: 12px; flex: 1; }
.picker-meta { font-size: 10px; color: #565B66; }

.disc-picker { display: flex; flex-wrap: wrap; gap: 6px; }
.disc-pill { display: flex; align-items: center; gap: 5px; border: 1px solid #2A2E36; border-radius: 999px; padding: 5px 11px; font-size: 11px; color: #565B66; background: transparent; font-family: inherit; cursor: default; }
button.disc-pill { cursor: pointer; }
button.disc-pill:hover { border-color: #3A3F4A; color: #8A8F99; }
.disc-pill.active { font-weight: 600; }

.form-error { display: flex; align-items: center; gap: 6px; color: #FF5454; font-size: 12px; background: rgba(255,84,84,.1); padding: 9px 12px; border-radius: 10px; }

/* ===== Учётные данные (новый тренер / сброс пароля) ===== */
.credentials-hint { font-size: 12px; color: #8A8F99; line-height: 1.5; margin-bottom: 14px; }
.credentials-box {
  background: #1C1F25; border: 1px solid #2A2E36; border-radius: 12px;
  padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px;
}
.credentials-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: 12px; color: #8A8F99; }
.credentials-row b { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #EDEFF2; }
.password-reset-row { display: flex; align-items: center; gap: 8px; }
.password-reset-value {
  flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #565B66;
  background: #1C1F25; border: 1px solid #2A2E36; border-radius: 10px; padding: 10px 12px;
}
.password-reset-value.shown { color: #3DDC97; }

/* ===== Branch switch (coach header) ===== */
.branch-switch { display: flex; gap: 6px; margin-top: 14px; }
.branch-pill {
  display: flex; align-items: center; gap: 5px;
  background: #1C1F25; border: 1px solid #2A2E36; color: #8A8F99;
  font-family: inherit; font-size: 11px; font-weight: 600;
  padding: 6px 12px; border-radius: 999px; cursor: pointer;
}
.branch-pill.active { background: #16181C; }

.branch-chip {
  display: inline-flex; align-items: center; font-size: 11px; font-weight: 600;
  border: 1px solid; border-radius: 999px; padding: 5px 10px;
}
.branch-chip-sm {
  display: inline-flex; align-items: center; font-size: 10px; font-weight: 600;
  border: 1px solid; border-radius: 999px; padding: 3px 8px; white-space: nowrap;
}
.table-branch-tag {
  display: inline-flex; align-items: center; border: 1px solid; border-radius: 999px; padding: 3px 9px; font-size: 11px; font-weight: 600;
}

.form-static-value {
  font-size: 13px; font-weight: 600; padding: 10px 12px;
  background: #1C1F25; border: 1px solid #2A2E36; border-radius: 10px;
}

.coach-admin-branches { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }

/* ===== Branch filter (admin topbar) ===== */
.branch-filter { display: flex; gap: 4px; background: #1C1F25; border: 1px solid #2A2E36; border-radius: 10px; padding: 3px; }
.branch-filter-btn {
  background: transparent; border: none; color: #8A8F99;
  font-family: inherit; font-size: 11px; font-weight: 600;
  padding: 7px 11px; border-radius: 8px; cursor: pointer; white-space: nowrap;
}
.branch-filter-btn.active { background: #2A2E36; color: #EDEFF2; }

/* ===== Panel title with trailing stat ===== */
.panel-title-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 16px; }
.panel-title-row .panel-title { margin-bottom: 0; }
.panel-title-stat { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600; }
.loads-busiest { font-size: 12px; color: #8A8F99; margin-top: 14px; padding-top: 14px; border-top: 1px dashed #2A2E36; }
.loads-busiest strong { color: #EDEFF2; }

/* ===== Branch comparison table ===== */
.branch-compare-row { display: grid; grid-template-columns: 1.4fr 1fr 1.4fr 1fr; align-items: center; padding: 11px 4px; font-size: 13px; border-bottom: 1px solid #1C1F25; }
.branch-compare-row.head { font-size: 11px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; color: #565B66; border-bottom: 1px solid #2A2E36; }
.branch-compare-name { display: flex; align-items: center; gap: 8px; font-weight: 600; }

/* ===== Coach help / памятка ===== */
.help-intro { background: #1C1F25; border: 1px solid #2A2E36; border-radius: 14px; padding: 16px; }
.help-intro-tag { display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: .5px; border: 1px solid; border-radius: 999px; padding: 3px 10px; margin-bottom: 10px; }
.help-intro p { font-size: 13px; line-height: 1.6; color: #C5C8CD; }

.help-steps { display: flex; flex-direction: column; gap: 10px; }
.help-step { display: flex; gap: 12px; background: #1C1F25; border: 1px solid #2A2E36; border-left: 3px solid var(--accent); border-radius: 12px; padding: 13px 14px; }
.help-step-num {
  width: 22px; height: 22px; border-radius: 7px; background: #0E1013; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; color: var(--accent);
}
.help-step-title { font-size: 13px; font-weight: 700; margin-bottom: 3px; }
.help-step-text { font-size: 12px; color: #8A8F99; line-height: 1.5; }

.help-footer-note { text-align: center; font-size: 11px; color: #565B66; padding: 6px 0 4px; }

/* ===== Admin help / памятка управляющего ===== */
.help-admin-intro { display: flex; flex-direction: column; gap: 10px; }
.help-admin-intro p { font-size: 13px; line-height: 1.6; color: #C5C8CD; max-width: 720px; }

.help-admin-list { display: flex; flex-direction: column; gap: 4px; }
.help-admin-row { display: flex; gap: 14px; padding: 13px 4px; border-bottom: 1px solid #1C1F25; }
.help-admin-row:last-child { border-bottom: none; }
.help-admin-row-num {
  width: 26px; height: 26px; border-radius: 8px; background: #1C1F25; border: 1px solid #2A2E36; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600; color: #8A8F99;
}
.help-admin-row-num.action { color: #FFC83D; border-color: rgba(255,200,61,.3); }
.help-admin-row-title { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
.help-admin-row-text { font-size: 12px; color: #8A8F99; line-height: 1.55; max-width: 640px; }

/* ===== Edit/Delete action buttons ===== */
.detail-header-actions { display: flex; gap: 6px; }
.icon-action-btn {
  width: 32px; height: 32px; border-radius: 9px;
  background: #1C1F25; border: 1px solid #2A2E36; color: #8A8F99;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.icon-action-btn.danger { color: #FF5454; border-color: rgba(255,84,84,.3); }

.table-actions { display: flex; gap: 6px; justify-content: flex-end; }
.table-action-btn {
  width: 28px; height: 28px; border-radius: 8px;
  background: #1C1F25; border: 1px solid #2A2E36; color: #8A8F99;
  display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
}
.table-action-btn.danger { color: #FF5454; border-color: rgba(255,84,84,.3); }
.table-action-btn:hover { border-color: #3A3F4A; }
.table-action-btn.danger:hover { border-color: #FF5454; }
.table-action-btn:disabled { opacity: .35; cursor: not-allowed; }
.table-action-btn:disabled:hover { border-color: #2A2E36; }

/* ===== Confirm delete dialog ===== */
.confirm-card {
  width: 100%; max-width: 360px; background: #16181C; border: 1px solid #2A2E36;
  border-radius: 18px; padding: 24px 22px; text-align: center;
  box-shadow: 0 30px 70px -20px rgba(0,0,0,.7);
}
.confirm-icon {
  width: 44px; height: 44px; border-radius: 12px; background: rgba(255,84,84,.1);
  display: flex; align-items: center; justify-content: center; margin: 0 auto 14px;
}
.confirm-title { font-size: 15px; font-weight: 700; margin-bottom: 8px; }
.confirm-text { font-size: 13px; color: #8A8F99; line-height: 1.5; margin-bottom: 20px; }
.confirm-actions { display: flex; gap: 10px; }
.confirm-btn-danger {
  flex: 1; background: #FF5454; border: none; color: #16181C;
  border-radius: 12px; padding: 12px; font-family: inherit; font-weight: 700; font-size: 13px; cursor: pointer;
}

/* ===== Admin page header (e.g. "Тренеры" + кнопка создания) ===== */
.admin-page-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.admin-page-head-title { font-size: 18px; font-weight: 700; }

.coach-admin-top-right { display: flex; align-items: center; gap: 10px; }

/* ===== Salary page ===== */
.salary-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.salary-month-picker { display: flex; gap: 6px; flex-wrap: wrap; }
.month-btn {
  background: #1C1F25; border: 1px solid #2A2E36; color: #8A8F99;
  font-family: inherit; font-size: 12px; font-weight: 600;
  padding: 7px 13px; border-radius: 10px; cursor: pointer;
}
.month-btn.active { background: #EDEFF2; color: #16181C; border-color: #EDEFF2; }

.salary-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.salary-kpi { min-width: 0; overflow-wrap: anywhere; background: #16181C; border: 1px solid #2A2E36; border-radius: 14px; padding: 16px 18px; }
.salary-kpi-val { font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 600; }
.salary-kpi-sub { font-size: 14px; color: #8A8F99; }
.salary-kpi-lbl { font-size: 11px; color: #8A8F99; margin-top: 4px; }

.salary-table tfoot td { padding: 12px; border-top: 1px solid #2A2E36; font-weight: 700; font-size: 12px; letter-spacing: .3px; text-transform: uppercase; color: #8A8F99; }
.salary-row-zero td { opacity: 0.45; }
.salary-table { min-width: 900px; }
.salary-coach-cell { min-width: 200px; display: flex; align-items: center; gap: 10px; }
.salary-avatar { width: 32px; height: 32px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px; color: #16181C; flex-shrink: 0; }
.salary-name { font-size: 13px; font-weight: 600; }
.salary-disc { font-size: 11px; color: #8A8F99; display: flex; align-items: center; gap: 4px; margin-top: 2px; }
.salary-num { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #8A8F99; }
.salary-total { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 700; color: #EDEFF2; }
.salary-bar-wrap { width: 70px; height: 6px; background: #1C1F25; border-radius: 3px; overflow: hidden; }
.salary-bar-fill { height: 100%; background: linear-gradient(90deg, #3DA5FF, #B14DFF); border-radius: 3px; }

/* ===== Grade badge ===== */
.grade-badge { display: inline-block; white-space: nowrap; font-size: 10px; font-weight: 700; letter-spacing: .4px; padding: 3px 9px; border-radius: 999px; }
.grade-badge.pro { background: rgba(255,200,61,.15); color: #FFC83D; }
.grade-badge.regular { background: rgba(138,143,153,.12); color: #8A8F99; }

/* ===== Rate grid in salary tab ===== */
.rate-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.rate-card { background: #1C1F25; border: 1px solid #2A2E36; border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
.rate-card-badge { font-size: 11px; font-weight: 700; letter-spacing: .3px; width: fit-content; padding: 3px 10px; border-radius: 999px; margin-bottom: 2px; }
.rate-card-badge.pro { background: rgba(255,200,61,.15); color: #FFC83D; }
.rate-card-badge.regular { background: rgba(138,143,153,.12); color: #8A8F99; }
.rate-row { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 10px; font-size: 12px; color: #8A8F99; }
.rate-val { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600; color: #EDEFF2; white-space: nowrap; }

@media (max-width: 900px) {
  .salary-kpi-row { grid-template-columns: 1fr 1fr; }
  .rate-grid { grid-template-columns: 1fr; }
}

/* ===== DATE NAV / CALENDAR (дневник тренера + расписание управляющего) ===== */
.date-nav-wrap { position: relative; margin-bottom: 4px; }
.date-nav {
  display: flex; align-items: center; gap: 6px;
  background: #1C1F25; border: 1px solid #2A2E36; border-radius: 12px;
  padding: 6px; margin: 0 0 4px;
}
.date-nav-arrow {
  width: 30px; height: 30px; flex-shrink: 0;
  background: transparent; border: none; color: #8A8F99; cursor: pointer;
  display: flex; align-items: center; justify-content: center; border-radius: 8px;
}
.date-nav-arrow:hover { background: #16181C; color: #EDEFF2; }
.date-nav-label {
  flex: 1; display: flex; align-items: baseline; justify-content: center; gap: 6px;
  background: transparent; border: none; color: #EDEFF2; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 700; padding: 6px 4px;
  min-width: 0;
}
.date-nav-label svg { flex-shrink: 0; color: #8A8F99; }
.date-nav-label span:first-of-type { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: capitalize; }
.date-nav-weekday { font-size: 11px; font-weight: 500; color: #8A8F99; text-transform: capitalize; white-space: nowrap; }
.date-nav-today {
  flex-shrink: 0; background: #EDEFF2; color: #0E1013; border: none;
  font-family: inherit; font-size: 11px; font-weight: 700;
  padding: 7px 10px; border-radius: 8px; cursor: pointer;
}
.date-calendar {
  position: absolute; z-index: 50; top: calc(100% + 6px); left: 0; right: 0;
  background: #1C1F25; border: 1px solid #2A2E36; border-radius: 14px;
  padding: 12px; box-shadow: 0 20px 40px -12px rgba(0,0,0,.6);
}
.date-calendar-head {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 12px; font-weight: 700; color: #EDEFF2; margin-bottom: 10px; text-transform: capitalize;
}
.date-calendar-head button {
  background: transparent; border: none; color: #8A8F99; cursor: pointer;
  width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: 7px;
}
.date-calendar-head button:hover { background: #16181C; color: #EDEFF2; }
.date-calendar-weekdays {
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;
  font-size: 10px; color: #565B66; text-align: center; margin-bottom: 4px;
}
.date-calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
.date-calendar-cell {
  aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; border-radius: 8px; color: #EDEFF2;
  font-family: inherit; font-size: 12px; cursor: pointer; position: relative;
}
.date-calendar-cell.empty { cursor: default; }
.date-calendar-cell:not(.empty):hover { background: #16181C; }
.date-calendar-cell.is-today { color: #3DA5FF; font-weight: 700; }
.date-calendar-cell.selected { background: #EDEFF2; color: #0E1013; font-weight: 700; }
.date-calendar-cell.has-sessions::after {
  content: ""; position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%);
  width: 3px; height: 3px; border-radius: 50%; background: #3DDC97;
}
.date-calendar-cell.selected.has-sessions::after { background: #0E1013; }

/* ===== Расписание управляющего — переключатель дня/всех дней ===== */
.schedule-controls { display: flex; align-items: flex-start; gap: 10px; }
.schedule-controls .date-nav-wrap { flex: 1; margin-bottom: 0; }
.schedule-showall {
  flex-shrink: 0; background: #1C1F25; border: 1px solid #2A2E36; color: #8A8F99;
  font-family: inherit; font-size: 12px; font-weight: 600; white-space: nowrap;
  padding: 0 14px; height: 44px; border-radius: 12px; cursor: pointer;
}
.schedule-showall.active { background: #2A2E36; color: #EDEFF2; }

/* Keep intrinsic text widths inside cards; tables scroll within their panel. */
.admin-page > *, .admin-grid-2 > *, .coach-grid > *, .panel { min-width: 0; }
.admin-table .coach-badges { min-width: 165px; }
.admin-table .table-attendance { white-space: nowrap; }
.table-attendance-track { flex-shrink: 0; }
.table-name-content, .coach-admin-name, .coach-admin-meta, .schedule-row-info { overflow-wrap: anywhere; min-width: 0; }
.coach-admin-top, .coach-admin-meta, .coach-admin-stats, .panel-title-row { flex-wrap: wrap; gap: 8px; }
.schedule-row { grid-template-columns: 50px 2px 24px minmax(120px, 1fr) auto auto auto; }
.schedule-row .table-actions { flex-wrap: wrap; }
.branch-compare-row { gap: 8px; }
.branch-compare-row > * { min-width: 0; overflow-wrap: anywhere; }
.table-scroll { max-width: 100%; }
@media (max-width: 1100px) {
  .admin-topbar { flex-wrap: wrap; gap: 12px; }
  .admin-topbar-right { flex-wrap: wrap; }
  .coach-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .coach-grid { grid-template-columns: minmax(0, 1fr); }
  .branch-compare-row { font-size: 11px; grid-template-columns: 1.2fr .8fr 1fr .8fr; }
}

.table-scroll::after { content: ""; }
@media (max-width: 720px) {
  .panel:has(> .table-scroll)::before { content: "Прокрутите таблицу вправо, чтобы увидеть остальные столбцы →"; display: block; font-size: 11px; line-height: 1.5; color: #8A8F99; margin-bottom: 10px; }
}

/* ===== Таблицы — горизонтальный скролл на узких экранах ===== */
.table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }

/* ============================================================
   МОБИЛЬНАЯ АДАПТАЦИЯ (телефоны, ширина экрана до 720px)
   ============================================================ */
@media (max-width: 720px) {
  /* Дневник тренера — убираем декоративную рамку «телефона в телефоне» */
  .phone-frame { padding: 0; min-height: 100vh; }
  .phone-screen { width: 100%; min-height: 100vh; border-radius: 0; border: none; box-shadow: none; }

  /* Админ-панель — сайдбар сворачивается в горизontальную панель сверху */
  .admin-shell { flex-direction: column; }
  .admin-sidebar {
    width: 100%; flex-direction: row; align-items: center;
    padding: 10px 12px; gap: 10px; overflow-x: auto;
    border-right: none; border-bottom: 1px solid #2A2E36;
    -webkit-overflow-scrolling: touch;
  }
  .admin-logo { display: none; }
  .admin-disciplines-key { display: none; }
  .admin-user-card { margin-bottom: 0; flex-shrink: 0; padding: 6px 10px; }
  .admin-user-info { display: none; }
  .admin-nav { flex-direction: row; gap: 4px; flex-shrink: 0; }
  .admin-nav-item {
    flex-direction: column; gap: 3px; padding: 8px 10px;
    font-size: 9px; white-space: nowrap; text-align: center;
  }

  .admin-content { min-width: 0; }
  .admin-topbar { flex-direction: column; align-items: stretch; gap: 10px; padding: 14px 16px; }
  .admin-topbar-right { flex-wrap: wrap; gap: 8px; }
  .admin-search { width: 100%; }
  .branch-filter { flex-wrap: wrap; }
  .admin-page { padding: 16px 16px 50px; gap: 14px; }

  .kpi-row { grid-template-columns: 1fr 1fr; gap: 10px; }
  .coach-grid { grid-template-columns: 1fr; }
  .rate-grid { grid-template-columns: 1fr; }
  .attention-row {
    grid-template-columns: 1fr; row-gap: 3px; padding: 10px 4px;
  }
  .attention-coach { text-align: left; }

  /* Строка расписания — вместо жёсткой сетки свободно оборачиваемый флекс */
  .schedule-row { display: flex; flex-wrap: wrap; align-items: center; row-gap: 6px; column-gap: 10px; }
  .schedule-row-bar { display: none; }
  .schedule-row-time { order: 1; width: auto; }
  .schedule-row-disc { order: 2; }
  .schedule-row-info { order: 3; flex: 1 1 140px; min-width: 140px; }
  .branch-chip-sm { order: 4; }
  .schedule-row-status { order: 5; }
  .table-actions { order: 6; margin-left: auto; }

  .schedule-controls { flex-direction: column; }
  .schedule-showall { width: 100%; height: 38px; }
}

@media (max-width: 420px) {
  .salary-kpi-row { grid-template-columns: 1fr; }
  .kpi-row { grid-template-columns: 1fr; }
}

/* ===== Статус ученика (активен / отпуск / ушёл) ===== */
.status-switch { display: flex; gap: 6px; margin-bottom: 4px; }
.status-pill {
  flex: 1; background: #1C1F25; border: 1px solid #2A2E36; color: #8A8F99;
  font-family: inherit; font-size: 12px; font-weight: 600; padding: 9px 6px;
  border-radius: 10px; cursor: pointer; text-align: center;
}
.status-pill.active { background: #16181C; }
.status-hint { font-size: 11px; color: #565B66; margin: 6px 2px 0; }
.promo-banner {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  background: rgba(255,194,75,.1); border: 1px solid rgba(255,194,75,.3); color: #FFC24B;
  border-radius: 12px; padding: 10px 12px; margin-top: 12px; font-size: 12px; font-weight: 600;
}
.promo-banner span { display: flex; align-items: center; gap: 6px; }
.promo-banner button {
  flex-shrink: 0; background: #FFC24B; color: #16181C; border: none;
  font-family: inherit; font-size: 11px; font-weight: 700; padding: 7px 10px; border-radius: 8px; cursor: pointer;
}

/* ===== Фильтр по статусу (список учеников тренера и управляющего) ===== */
.status-filter-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.status-chip {
  display: flex; align-items: center; gap: 5px;
  background: #1C1F25; border: 1px solid #2A2E36; color: #8A8F99;
  font-family: inherit; font-size: 12px; font-weight: 600; padding: 7px 12px;
  border-radius: 999px; cursor: pointer; white-space: nowrap;
}
.status-chip.active { background: #EDEFF2; color: #0E1013; border-color: #EDEFF2; }
.status-dot-label { font-weight: 600; }
.status-select {
  background: transparent; border: 1px solid; border-radius: 8px;
  font-family: inherit; font-size: 12px; font-weight: 600; padding: 5px 8px; cursor: pointer;
}
.status-select option { background: #1C1F25; color: #EDEFF2; }

/* ===== График притока/оттока учеников ===== */
.flow-legend { display: flex; gap: 14px; font-size: 11px; color: #8A8F99; }
.flow-legend span { display: flex; align-items: center; gap: 5px; }
.flow-legend i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.flow-chart { display: flex; align-items: flex-end; gap: 10px; height: 150px; }
.flow-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; justify-content: flex-end; }
.flow-bars { flex: 1; display: flex; align-items: flex-end; gap: 3px; width: 100%; justify-content: center; }
.flow-bar { width: 40%; border-radius: 4px 4px 2px 2px; min-height: 3px; }
.flow-bar.in { background: linear-gradient(180deg, #3DDC97, #279A67); }
.flow-bar.out { background: linear-gradient(180deg, #FF5454, #B23A3A); }
.flow-col-vals { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #8A8F99; }
.flow-col-label { font-size: 11px; color: #565B66; text-transform: capitalize; }

/* ===== Карточка тренера в админке — клик открывает детальную статистику ===== */
.coach-admin-card-clickable { cursor: pointer; text-align: left; width: 100%; font-family: inherit; }
.back-btn-desktop {
  display: flex; align-items: center; gap: 6px;
  background: transparent; border: none; color: #8A8F99; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 600; padding: 4px 0;
}
.back-btn-desktop:hover { color: #EDEFF2; }
.coach-detail-head { display: flex; align-items: center; gap: 14px; margin: 6px 0 4px; }
.coach-detail-name { display: flex; align-items: center; gap: 8px; font-size: 19px; font-weight: 700; }
.admin-student-mini-list { display: flex; flex-direction: column; }
.admin-student-mini-row {
  display: flex; align-items: center; gap: 10px; padding: 9px 4px; border-bottom: 1px solid #1C1F25;
  font-size: 13px;
}
.admin-student-mini-row:last-child { border-bottom: none; }
.admin-student-mini-name { flex: 1; display: flex; align-items: center; gap: 6px; font-weight: 600; min-width: 0; }
.admin-student-mini-meta { color: #8A8F99; font-size: 12px; white-space: nowrap; }
.mini-convert-btn {
  flex-shrink: 0; background: #1C1F25; border: 1px solid #2A2E36; color: #FFC24B;
  font-family: inherit; font-size: 11px; font-weight: 700; padding: 6px 10px; border-radius: 8px; cursor: pointer;
}
.mini-convert-btn:hover { border-color: #FFC24B; }

/* ===== Тип тренировки — 3 варианта в одном сегменте ===== */
.segmented-4 .seg { font-size: 10px; padding: 8px 2px; }
.student-search-row {
  display: flex; align-items: center; gap: 8px;
  background: #1C1F25; border: 1px solid #2A2E36; border-radius: 10px;
  padding: 9px 12px; margin-bottom: 8px;
}
.student-search-row input { flex: 1; background: transparent; border: none; color: #EDEFF2; font-family: inherit; font-size: 12px; outline: none; }
.student-search-row svg { color: #565B66; flex-shrink: 0; }
.form-input:disabled { opacity: .5; cursor: not-allowed; }

/* ===== Регулярное расписание тренировки (несколько дней/времени, на N недель вперёд) ===== */
.slot-list { display: flex; flex-direction: column; gap: 8px; }
.slot-row { display: flex; align-items: center; gap: 8px; }
.weekday-picker { flex: 1; display: flex; gap: 3px; background: #1C1F25; border: 1px solid #2A2E36; border-radius: 10px; padding: 3px; }
.weekday-btn {
  flex: 1; background: transparent; border: none; color: #8A8F99;
  font-family: inherit; font-size: 11px; font-weight: 600; padding: 7px 2px; border-radius: 7px; cursor: pointer;
}
.weekday-btn.active { background: #2A2E36; color: #EDEFF2; }
.slot-time-input { width: 92px; flex-shrink: 0; }
.slot-remove-btn {
  flex-shrink: 0; width: 30px; height: 30px; background: #1C1F25; border: 1px solid #2A2E36; color: #8A8F99;
  border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.slot-remove-btn:hover { border-color: #FF5454; color: #FF5454; }
.add-slot-btn {
  display: flex; align-items: center; gap: 6px; margin-top: 8px;
  background: transparent; border: 1px dashed #2A2E36; color: #8A8F99;
  font-family: inherit; font-size: 12px; font-weight: 600; padding: 8px 12px; border-radius: 10px; cursor: pointer; width: 100%; justify-content: center;
}
.add-slot-btn:hover { border-color: #3A3F4A; color: #EDEFF2; }

/* ===== Комментарии к ученику ===== */
.comment-add-row { display: flex; gap: 8px; }
.comment-add-row .form-input { flex: 1; }
.comment-list { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.comment-row {
  display: flex; align-items: flex-start; gap: 8px;
  background: #1C1F25; border: 1px solid #2A2E36; border-radius: 10px; padding: 9px 11px;
}
.comment-row-body { flex: 1; min-width: 0; }
.comment-row-date { font-size: 10px; color: #565B66; margin-bottom: 3px; text-transform: capitalize; }
.comment-row-text { font-size: 12px; color: #EDEFF2; line-height: 1.4; word-break: break-word; }
.comment-remove-btn {
  flex-shrink: 0; background: transparent; border: none; color: #565B66; cursor: pointer;
  width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border-radius: 6px;
}
.comment-remove-btn:hover { color: #FF5454; background: rgba(255,84,84,.1); }

/* ===== Компактная зарплата тренера (Статистика) ===== */
.salary-panel { padding: 0; overflow: hidden; }
.salary-panel-toggle {
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px;
  background: transparent; border: none; color: inherit; font-family: inherit; text-align: left;
  cursor: pointer; padding: 16px;
}
.salary-panel-sub { font-size: 11px; color: #8A8F99; margin-top: 3px; }
.salary-panel-total { display: flex; align-items: center; gap: 6px; font-size: 17px; font-weight: 700; white-space: nowrap; }
.salary-chevron { transform: rotate(90deg); transition: transform .15s; color: #565B66; }
.salary-chevron.open { transform: rotate(-90deg); }
.salary-breakdown-list { border-top: 1px solid #2A2E36; padding: 8px 16px 14px; display: flex; flex-direction: column; gap: 2px; }
.salary-breakdown-row {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 9px 0; border-bottom: 1px solid #1C1F25;
}
.salary-breakdown-row:last-child { border-bottom: none; }
.salary-breakdown-info { min-width: 0; }
.salary-breakdown-title { font-size: 12px; font-weight: 600; }
.salary-breakdown-meta { font-size: 11px; color: #8A8F99; margin-top: 2px; }
.salary-breakdown-amount { flex-shrink: 0; font-size: 13px; font-weight: 700; color: #3DDC97; font-family: 'JetBrains Mono', monospace; }
`;

const THEMED_CSS = themedCss(CSS);

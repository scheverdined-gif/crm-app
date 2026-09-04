import React, { useState, useMemo } from "react";
import {
  Zap, Users, Calendar, TrendingUp, Search, Plus, ChevronRight,
  ChevronLeft, Clock, MapPin, Star, AlertCircle, CheckCircle2,
  X, Filter, BarChart3, UserCircle2, Footprints, Bike,
  Settings, LogOut, Menu, ArrowUpRight, Award, Target
} from "lucide-react";

/* ============================================================
   ДИСЦИПЛИНЫ — каждая со своим неоновым акцентом, как цвет деки
   ============================================================ */
// "Сегодня" в демо-данных зафиксировано на этой дате — вся навигация по календарю считается от неё
const TODAY_ISO = "2026-06-28";

// Статус ученика: активен / в отпуске / ушёл. В "живые" счётчики попадают все, кроме ушедших.
const STUDENT_STATUS = {
  active:   { label: "Активен",   color: "#3DDC97" },
  vacation: { label: "В отпуске", color: "#FFC24B" },
  left:     { label: "Ушёл",      color: "#FF5454" },
};
// Типы тренировок: групповая, индивидуальная, спортивная группа и промо — у каждого фиксированная длительность
const SESSION_TYPES = {
  group:       { label: "Групповая",         short: "ГРУППА",        segLabel: "Группа",       fixedDuration: 60 },
  individual:  { label: "Индивидуальная",    short: "ИНДИВИДУАЛ",    segLabel: "Инд.",         fixedDuration: 60 },
  sport_group: { label: "Спортивная группа", short: "СПОРТ. ГРУППА", segLabel: "Спорт. группа", fixedDuration: 120 },
  promo:       { label: "Промо-тренировка",  short: "ПРОМО",         segLabel: "Промо",        fixedDuration: 45 },
};
function isEnrolled(s) { return s.status !== "left"; }
// студент может тренироваться у нескольких тренеров/по нескольким направлениям одновременно —
// coachId/discipline остаются "основными", extraCoachIds/extraDisciplines — дополнительные
function coachesOfStudent(s) { return [s.coachId, ...(s.extraCoachIds || [])]; }
function disciplinesOfStudent(s) { return [s.discipline, ...(s.extraDisciplines || [])]; }
function monthKey(iso) { return iso.slice(0, 7); } // "YYYY-MM"
function monthLabelShort(key) {
  return new Date(key + "-01T00:00:00").toLocaleDateString("ru-RU", { month: "short" }).replace(".", "");
}
// последние N календарных месяцев по TODAY_ISO, для графика притока/оттока
function lastMonthKeys(n) {
  const [y, m] = TODAY_ISO.slice(0, 7).split("-").map(Number);
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}
// приток/отток по месяцам для заданного набора учеников
function buildFlowStats(studentList, months = 6) {
  const keys = lastMonthKeys(months);
  return keys.map(key => ({
    key,
    label: monthLabelShort(key),
    in: studentList.filter(s => monthKey(s.joinDate) === key).length,
    out: studentList.filter(s => s.status === "left" && s.leftDate && monthKey(s.leftDate) === key).length,
  }));
}

const DISCIPLINES = {
  rollers: { label: "Ролики", short: "РОЛ", color: "#FF3D8A", icon: "skate" },
  skate:   { label: "Скейт",  short: "СКТ", color: "#FFC83D", icon: "board" },
  bike:    { label: "Велик",  short: "ВЕЛ", color: "#3DDC97", icon: "bike" },
  bmx:     { label: "BMX",    short: "BMX", color: "#3DA5FF", icon: "bmx" },
  scooter: { label: "Самокат",short: "САМ", color: "#B14DFF", icon: "scooter" },
};

/* ============================================================
   ТАРИФЫ ЗАРПЛАТЫ
   ============================================================ */
const SALARY_RATES = {
  regular: { group: 150, individual: 300 },  // 150р × кол-во пришедших, 300р за индивидуалку
  pro:     { group: 150, individual: 400 },  // 150р × кол-во пришедших, 400р за индивидуалку
};

// Заработок за одну проведённую тренировку (группа/спорт.группа/промо — по числу пришедших, индивидуальная — фикс)
function sessionEarning(coach, session) {
  const rates = SALARY_RATES[coach.grade || "regular"];
  return session.type === "individual" ? rates.individual : rates.group * session.studentIds.length;
}
// Расчёт зарплаты тренера за набор проведённых тренировок (обычно — за месяц)
function calcCoachSalary(coach, monthSessions) {
  let groupSessions = 0, groupEarned = 0;
  let indSessions = 0, indEarned = 0;
  monthSessions.forEach(s => {
    const amount = sessionEarning(coach, s);
    if (s.type === "individual") { indSessions++; indEarned += amount; }
    else { groupSessions++; groupEarned += amount; }
  });
  return { groupSessions, groupEarned, indSessions, indEarned, total: groupEarned + indEarned, totalSessions: groupSessions + indSessions };
}
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
  roza:    { label: "Роза",      short: "РОЗ", color: "#FF8A3D" },
  irkutsk: { label: "Иркутский", short: "ИРК", color: "#3DCFFF" },
};

/* ============================================================
   УПРАВЛЯЮЩИЕ — доступ к админ-панели
   role: "owner" видит оба филиала, "branch_manager" — только свой
   ============================================================ */
const MANAGERS = [
  { id: "m1", email: "owner@extremekids.ru",   password: "owner2026",  name: "Артур Ким",        role: "owner",          branches: ["roza", "irkutsk"], avatar: "АК" },
  { id: "m2", email: "roza@extremekids.ru",    password: "roza2026",   name: "Светлана Дегтярёва", role: "branch_manager", branches: ["roza"],            avatar: "СД" },
  { id: "m3", email: "irkutsk@extremekids.ru", password: "irkutsk2026",name: "Павел Рожков",     role: "branch_manager", branches: ["irkutsk"],         avatar: "ПР" },
];

/* ============================================================
   ТЕСТОВЫЕ ДАННЫЕ
   ============================================================ */
const COACHES = [
  { id: "c1", email: "c1@extremekids.ru", password: "coach2026",  name: "Никита Краснов",   discipline: "bmx",     branches: ["roza"],     exp: "9 лет",  grade: "pro",     avatar: "НК" },
  { id: "c2", email: "c2@extremekids.ru", password: "coach2026",  name: "Тимур Беляев",     discipline: "bmx",     branches: ["roza"],     exp: "9 лет",  grade: "pro",     avatar: "ТБ" },
  { id: "c3", email: "c3@extremekids.ru", password: "coach2026",  name: "Мира Ким",         discipline: "rollers", branches: ["roza"],     exp: "3 года", grade: "regular", avatar: "МК" },
  { id: "c4", email: "c4@extremekids.ru", password: "coach2026",  name: "Роман Громов",     discipline: "skate",   branches: ["roza"],     exp: "8 лет",  grade: "pro",     avatar: "РГ" },
  { id: "c5", email: "c5@extremekids.ru", password: "coach2026",  name: "Klara Vogt",       discipline: "rollers", branches: ["roza"],     exp: "11 лет", grade: "pro",     avatar: "KV" },
  { id: "c6", email: "c6@extremekids.ru", password: "coach2026",  name: "Артём Волков",     discipline: "skate",   branches: ["roza"],     exp: "10 лет", grade: "pro",     avatar: "АВ" },
  { id: "c7", email: "c7@extremekids.ru", password: "coach2026",  name: "Игорь Шепель",     discipline: "bike",    branches: ["roza"],     exp: "2 года", grade: "regular", avatar: "ИШ" },
  { id: "c8", email: "c8@extremekids.ru", password: "coach2026",  name: "Кирилл Соколов",   discipline: "scooter", branches: ["roza"],     exp: "11 лет", grade: "pro",     avatar: "КС" },
  { id: "c9", email: "c9@extremekids.ru", password: "coach2026",  name: "Олеся Орехова",    discipline: "skate",   branches: ["irkutsk"],  exp: "2 года", grade: "regular", avatar: "ОО" },
  { id: "c10", email: "c10@extremekids.ru", password: "coach2026", name: "Михаил Сафронов",  discipline: "scooter", branches: ["irkutsk"],  exp: "12 лет", grade: "pro",     avatar: "МС" },
  { id: "c11", email: "c11@extremekids.ru", password: "coach2026", name: "Ксения Зайцева",   discipline: "bike",    branches: ["irkutsk"],  exp: "10 лет", grade: "pro",     avatar: "КЗ" },
  { id: "c12", email: "c12@extremekids.ru", password: "coach2026", name: "Lukas Weber",       discipline: "bmx",     branches: ["irkutsk"],  exp: "6 лет",  grade: "regular", avatar: "LW" },
  { id: "c13", email: "c13@extremekids.ru", password: "coach2026", name: "Anna Roth",         discipline: "skate",   branches: ["irkutsk"],  exp: "5 лет",  grade: "regular", avatar: "AR" },
  { id: "c14", email: "c14@extremekids.ru", password: "coach2026", name: "Дина Костина",     discipline: "rollers", branches: ["irkutsk"],  exp: "3 года", grade: "regular", avatar: "ДК" },
  { id: "c15", email: "c15@extremekids.ru", password: "coach2026", name: "Ярослав Комаров",  discipline: "rollers", branches: ["irkutsk"],  exp: "3 года", grade: "regular", avatar: "ЯК" },
  { id: "c16", email: "c16@extremekids.ru", password: "coach2026", name: "Маша Соколова",    discipline: "bike",    branches: ["irkutsk"],  exp: "3 года", grade: "regular", avatar: "МС" },
  { id: "c17", email: "c17@extremekids.ru", password: "coach2026", name: "Felix Brandt",      discipline: "bmx",     branches: ["irkutsk"],  exp: "2 года", grade: "regular", avatar: "FB" },
];

const STUDENTS = [
  { id: "s1", name: "Игорь Шепель", age: 14, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 86, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-001", joinDate: "2025-10-28", origin: "regular", status: "left", leftDate: "2026-01-07" },
  { id: "s2", name: "Соня Карпова", age: 11, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 79, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-002", joinDate: "2026-01-04", origin: "regular", status: "active" },
  { id: "s3", name: "Lukas Weber", age: 8, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 78, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-003", joinDate: "2025-10-23", origin: "regular", status: "active" },
  { id: "s4", name: "Jonas Schmidt", age: 9, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 91, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-004", joinDate: "2026-06-07", origin: "promo", status: "vacation" },
  { id: "s5", name: "Артём Волков", age: 11, discipline: "bike", coachId: "c7", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-005", joinDate: "2025-09-16", origin: "regular", status: "vacation" },
  { id: "s6", name: "Ярослав Комаров", age: 16, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 87, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-006", joinDate: "2025-12-29", origin: "regular", status: "active" },
  { id: "s7", name: "Юля Зуева", age: 7, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 85, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-007", joinDate: "2025-09-14", origin: "regular", status: "active" },
  { id: "s8", name: "Артём Волков", age: 16, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 95, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-008", joinDate: "2026-06-07", origin: "promo", status: "active" },
  { id: "s9", name: "Ярослав Комаров", age: 9, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Средний", attendance: 86, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-009", joinDate: "2026-01-21", origin: "regular", status: "active" },
  { id: "s10", name: "Felix Brandt", age: 13, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Продвинутый", attendance: 95, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-010", joinDate: "2025-09-04", origin: "regular", status: "active" },
  { id: "s11", name: "Тимур Беляев", age: 7, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Средний", attendance: 88, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-011", joinDate: "2025-11-21", origin: "regular", status: "active" },
  { id: "s12", name: "Ника Краснова", age: 9, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-012", joinDate: "2026-02-22", origin: "regular", status: "active" },
  { id: "s13", name: "Катя Полякова", age: 17, discipline: "skate", coachId: "c4", branchId: "roza", level: "Продвинутый", attendance: 83, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-013", joinDate: "2025-12-20", origin: "regular", status: "active" },
  { id: "s14", name: "Степан Морозов", age: 13, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 84, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-014", joinDate: "2026-02-20", origin: "regular", status: "vacation" },
  { id: "s15", name: "Ника Краснова", age: 16, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Продвинутый", attendance: 93, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-015", joinDate: "2026-03-14", origin: "regular", status: "vacation" },
  { id: "s16", name: "Артём Волков", age: 14, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Продвинутый", attendance: 91, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-016", joinDate: "2026-02-24", origin: "regular", status: "active" },
  { id: "s17", name: "Александр Беляков", age: 8, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Средний", attendance: 74, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-017", joinDate: "2025-09-23", origin: "regular", status: "active" },
  { id: "s18", name: "Иван Жуков", age: 12, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-018", joinDate: "2026-06-02", origin: "regular", status: "active" },
  { id: "s19", name: "Александр Беляков", age: 16, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 84, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-019", flag: "injury", joinDate: "2025-10-11", origin: "regular", status: "active" },
  { id: "s20", name: "David Roth", age: 8, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Продвинутый", attendance: 81, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-020", joinDate: "2026-03-05", origin: "regular", status: "active" },
  { id: "s21", name: "Дарья Тихонова", age: 14, discipline: "bike", coachId: "c7", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-021", flag: "injury", joinDate: "2025-10-06", origin: "regular", status: "left", leftDate: "2026-01-31" },
  { id: "s22", name: "Кирилл Соколов", age: 8, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Средний", attendance: 96, lastNote: "", phone: "+49 151 ХХ-022", joinDate: "2026-01-27", origin: "regular", status: "active" },
  { id: "s23", name: "Марк Гусев", age: 11, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 80, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-023", joinDate: "2025-12-29", origin: "regular", status: "active" },
  { id: "s24", name: "Вера Громова", age: 12, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 81, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-024", joinDate: "2026-03-14", origin: "regular", status: "active" },
  { id: "s25", name: "Ярослав Комаров", age: 10, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 87, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-025", joinDate: "2026-03-06", origin: "regular", status: "active" },
  { id: "s26", name: "Аня Светлова", age: 8, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 93, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-026", joinDate: "2026-03-01", origin: "regular", status: "active" },
  { id: "s27", name: "Klara Vogt", age: 15, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 82, lastNote: "", phone: "+49 151 ХХ-027", joinDate: "2026-01-15", origin: "regular", status: "active" },
  { id: "s28", name: "Игорь Шепель", age: 11, discipline: "skate", coachId: "c6", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-028", joinDate: "2025-10-07", origin: "regular", status: "active" },
  { id: "s29", name: "Klara Vogt", age: 16, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 95, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-029", flag: "injury", joinDate: "2025-11-27", origin: "regular", status: "active" },
  { id: "s30", name: "Игорь Шепель", age: 17, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 96, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-030", joinDate: "2026-01-04", origin: "regular", status: "active" },
  { id: "s31", name: "Денис Кузнецов", age: 14, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 85, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-031", joinDate: "2026-03-14", origin: "regular", status: "active" },
  { id: "s32", name: "Степан Морозов", age: 12, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 74, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-032", joinDate: "2026-06-13", origin: "promo", status: "active" },
  { id: "s33", name: "Макс Орлов", age: 13, discipline: "bike", coachId: "c7", branchId: "roza", level: "Продвинутый", attendance: 88, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-033", joinDate: "2025-09-29", origin: "regular", status: "active" },
  { id: "s34", name: "Дарья Тихонова", age: 12, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 84, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-034", joinDate: "2025-09-17", origin: "regular", status: "active" },
  { id: "s35", name: "Ярослав Комаров", age: 8, discipline: "skate", coachId: "c4", branchId: "roza", level: "Продвинутый", attendance: 73, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-035", joinDate: "2026-03-25", origin: "regular", status: "active" },
  { id: "s36", name: "Игорь Шепель", age: 14, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 85, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-036", joinDate: "2025-12-18", origin: "regular", status: "active" },
  { id: "s37", name: "Денис Кузнецов", age: 8, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 99, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-037", joinDate: "2026-06-18", origin: "promo", status: "active" },
  { id: "s38", name: "Никита Краснов", age: 15, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 91, lastNote: "", phone: "+49 151 ХХ-038", joinDate: "2026-05-14", origin: "regular", status: "active" },
  { id: "s39", name: "Михаил Сафронов", age: 15, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 94, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-039", joinDate: "2026-04-23", origin: "regular", status: "active" },
  { id: "s40", name: "София Беляева", age: 10, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 78, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-040", joinDate: "2025-11-11", origin: "regular", status: "active" },
  { id: "s41", name: "Богдан Никитин", age: 15, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 97, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-041", joinDate: "2026-06-15", origin: "regular", status: "active" },
  { id: "s42", name: "Александр Беляков", age: 8, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 89, lastNote: "", phone: "+49 151 ХХ-042", joinDate: "2026-04-08", origin: "regular", status: "active" },
  { id: "s43", name: "Юля Зуева", age: 10, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 95, lastNote: "", phone: "+49 151 ХХ-043", joinDate: "2026-03-24", origin: "regular", status: "active" },
  { id: "s44", name: "Денис Кузнецов", age: 13, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 95, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-044", joinDate: "2025-11-10", origin: "regular", status: "active" },
  { id: "s45", name: "Денис Кузнецов", age: 9, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 85, lastNote: "", phone: "+49 151 ХХ-045", joinDate: "2025-10-17", origin: "regular", status: "active" },
  { id: "s46", name: "Lena Weber", age: 16, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 81, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-046", joinDate: "2025-10-27", origin: "regular", status: "active" },
  { id: "s47", name: "Дина Костина", age: 13, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 94, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-047", joinDate: "2025-11-21", origin: "regular", status: "active" },
  { id: "s48", name: "Кирилл Соколов", age: 17, discipline: "skate", coachId: "c4", branchId: "roza", level: "Продвинутый", attendance: 77, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-048", joinDate: "2026-04-05", origin: "regular", status: "active" },
  { id: "s49", name: "Денис Кузнецов", age: 10, discipline: "skate", coachId: "c6", branchId: "roza", level: "Продвинутый", attendance: 93, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-049", joinDate: "2026-03-17", origin: "regular", status: "active" },
  { id: "s50", name: "Богдан Никитин", age: 13, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 93, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-050", joinDate: "2026-04-28", origin: "regular", status: "active" },
  { id: "s51", name: "Тимур Беляев", age: 10, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 78, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-051", joinDate: "2026-06-11", origin: "promo", status: "active" },
  { id: "s52", name: "Александр Беляков", age: 8, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "", phone: "+49 151 ХХ-052", joinDate: "2025-10-29", origin: "regular", status: "active" },
  { id: "s53", name: "Олег Прядко", age: 8, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-053", joinDate: "2026-06-02", origin: "regular", status: "active" },
  { id: "s54", name: "Felix Brandt", age: 14, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 65, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-054", joinDate: "2026-02-22", origin: "regular", status: "vacation" },
  { id: "s55", name: "Ника Краснова", age: 12, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 87, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-055", joinDate: "2026-04-11", origin: "regular", status: "active" },
  { id: "s56", name: "Дарья Тихонова", age: 12, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 88, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-056", joinDate: "2025-09-02", origin: "regular", status: "active" },
  { id: "s57", name: "Никита Краснов", age: 7, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-057", joinDate: "2026-01-13", origin: "regular", status: "active" },
  { id: "s58", name: "Anna Roth", age: 11, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 97, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-058", joinDate: "2025-12-01", origin: "regular", status: "active" },
  { id: "s59", name: "Иван Жуков", age: 15, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 90, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-059", joinDate: "2025-10-25", origin: "regular", status: "active" },
  { id: "s60", name: "Полина Рябова", age: 14, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 73, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-060", joinDate: "2026-01-31", origin: "regular", status: "active" },
  { id: "s61", name: "Sofia Becker", age: 11, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 82, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-061", joinDate: "2026-05-18", origin: "promo", status: "active" },
  { id: "s62", name: "Lukas Weber", age: 8, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Средний", attendance: 79, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-062", joinDate: "2025-11-22", origin: "regular", status: "active" },
  { id: "s63", name: "Jonas Schmidt", age: 10, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 86, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-063", joinDate: "2026-05-30", origin: "regular", status: "active" },
  { id: "s64", name: "Степан Морозов", age: 11, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 90, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-064", joinDate: "2026-05-09", origin: "regular", status: "left", leftDate: "2026-06-02" },
  { id: "s65", name: "Klara Vogt", age: 8, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 77, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-065", joinDate: "2026-02-05", origin: "regular", status: "active" },
  { id: "s66", name: "Аня Светлова", age: 14, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 69, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-066", joinDate: "2026-01-02", origin: "regular", status: "active" },
  { id: "s67", name: "Полина Рябова", age: 15, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 84, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-067", joinDate: "2025-10-11", origin: "regular", status: "vacation" },
  { id: "s68", name: "Дина Костина", age: 7, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 99, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-068", joinDate: "2026-05-07", origin: "regular", status: "active" },
  { id: "s69", name: "Лена Грач", age: 12, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-069", joinDate: "2026-05-31", origin: "promo", status: "active" },
  { id: "s70", name: "Lena Weber", age: 14, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 97, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-070", joinDate: "2026-05-02", origin: "regular", status: "active" },
  { id: "s71", name: "Мира Ким", age: 10, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 98, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-071", joinDate: "2025-11-24", origin: "regular", status: "active" },
  { id: "s72", name: "Ника Краснова", age: 9, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 97, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-072", joinDate: "2026-04-05", origin: "regular", status: "active" },
  { id: "s73", name: "Klara Vogt", age: 16, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Средний", attendance: 79, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-073", joinDate: "2026-06-04", origin: "regular", status: "active" },
  { id: "s74", name: "Кирилл Соколов", age: 14, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-074", joinDate: "2026-02-07", origin: "regular", status: "active" },
  { id: "s75", name: "София Беляева", age: 17, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 87, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-075", joinDate: "2026-03-11", origin: "regular", status: "active" },
  { id: "s76", name: "Никита Краснов", age: 17, discipline: "skate", coachId: "c4", branchId: "roza", level: "Продвинутый", attendance: 83, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-076", joinDate: "2026-05-23", origin: "promo", status: "active" },
  { id: "s77", name: "Степан Морозов", age: 11, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 86, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-077", joinDate: "2025-10-03", origin: "regular", status: "active" },
  { id: "s78", name: "Кирилл Мельник", age: 10, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 86, lastNote: "", phone: "+49 151 ХХ-078", joinDate: "2026-06-11", origin: "promo", status: "active" },
  { id: "s79", name: "Иван Жуков", age: 12, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 100, lastNote: "", phone: "+49 151 ХХ-079", joinDate: "2025-10-07", origin: "regular", status: "active" },
  { id: "s80", name: "Ксения Зайцева", age: 11, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-080", joinDate: "2025-10-01", origin: "regular", status: "active" },
  { id: "s81", name: "Катя Полякова", age: 9, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 86, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-081", joinDate: "2025-09-17", origin: "regular", status: "active" },
  { id: "s82", name: "Вика Никитина", age: 16, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 91, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-082", joinDate: "2025-10-07", origin: "regular", status: "active" },
  { id: "s83", name: "Глеб Воронин", age: 10, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Продвинутый", attendance: 77, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-083", joinDate: "2026-01-21", origin: "regular", status: "active" },
  { id: "s84", name: "Кирилл Соколов", age: 12, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 80, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-084", joinDate: "2025-12-19", origin: "regular", status: "active" },
  { id: "s85", name: "Вика Никитина", age: 16, discipline: "skate", coachId: "c6", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-085", joinDate: "2026-06-20", origin: "promo", status: "active" },
  { id: "s86", name: "Вера Громова", age: 13, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 81, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-086", joinDate: "2026-05-01", origin: "regular", status: "active" },
  { id: "s87", name: "Лиза Морозова", age: 7, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 81, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-087", joinDate: "2025-12-07", origin: "regular", status: "vacation" },
  { id: "s88", name: "Андрей Поляков", age: 16, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 94, lastNote: "", phone: "+49 151 ХХ-088", joinDate: "2026-04-09", origin: "regular", status: "active" },
  { id: "s89", name: "Кирилл Соколов", age: 15, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 93, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-089", flag: "injury", joinDate: "2026-03-30", origin: "regular", status: "active" },
  { id: "s90", name: "Катя Полякова", age: 8, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 95, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-090", joinDate: "2025-09-28", origin: "regular", status: "active" },
  { id: "s91", name: "Артём Волков", age: 17, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-091", joinDate: "2025-10-21", origin: "regular", status: "vacation" },
  { id: "s92", name: "Anna Roth", age: 14, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 98, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-092", joinDate: "2026-02-21", origin: "regular", status: "active" },
  { id: "s93", name: "Олеся Орехова", age: 15, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-093", joinDate: "2025-10-26", origin: "regular", status: "active" },
  { id: "s94", name: "Соня Карпова", age: 14, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Продвинутый", attendance: 94, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-094", joinDate: "2025-12-07", origin: "regular", status: "active" },
  { id: "s95", name: "Богдан Никитин", age: 13, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Продвинутый", attendance: 89, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-095", joinDate: "2025-11-11", origin: "regular", status: "active" },
  { id: "s96", name: "Ярослав Комаров", age: 13, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 94, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-096", joinDate: "2026-01-21", origin: "regular", status: "active" },
  { id: "s97", name: "Lena Weber", age: 8, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "", phone: "+49 151 ХХ-097", joinDate: "2025-10-09", origin: "regular", status: "active" },
  { id: "s98", name: "Лена Грач", age: 12, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-098", joinDate: "2026-06-09", origin: "regular", status: "vacation" },
  { id: "s99", name: "София Беляева", age: 15, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 91, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-099", joinDate: "2026-06-04", origin: "regular", status: "active" },
  { id: "s100", name: "Олеся Орехова", age: 13, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 95, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-100", joinDate: "2025-12-31", origin: "regular", status: "active" },
  { id: "s101", name: "Ярослав Комаров", age: 7, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 99, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-101", joinDate: "2026-05-07", origin: "regular", status: "active" },
  { id: "s102", name: "Артём Волков", age: 14, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-102", joinDate: "2026-03-25", origin: "regular", status: "active" },
  { id: "s103", name: "Богдан Никитин", age: 9, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-103", joinDate: "2025-11-24", origin: "regular", status: "active" },
  { id: "s104", name: "Лука Семёнов", age: 16, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-104", flag: "injury", joinDate: "2026-03-19", origin: "regular", status: "active" },
  { id: "s105", name: "Марк Гусев", age: 11, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 70, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-105", joinDate: "2026-04-21", origin: "regular", status: "active" },
  { id: "s106", name: "Денис Кузнецов", age: 13, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 85, lastNote: "", phone: "+49 151 ХХ-106", joinDate: "2026-06-12", origin: "regular", status: "active" },
  { id: "s107", name: "Кирилл Мельник", age: 13, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 98, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-107", joinDate: "2025-12-07", origin: "regular", status: "active" },
  { id: "s108", name: "Кирилл Мельник", age: 11, discipline: "bike", coachId: "c7", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-108", joinDate: "2025-09-30", origin: "regular", status: "active" },
  { id: "s109", name: "Felix Brandt", age: 9, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 81, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-109", joinDate: "2026-06-05", origin: "promo", status: "vacation" },
  { id: "s110", name: "Ярослав Комаров", age: 14, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 95, lastNote: "", phone: "+49 151 ХХ-110", joinDate: "2025-09-26", origin: "regular", status: "active" },
  { id: "s111", name: "Роман Громов", age: 9, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 81, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-111", joinDate: "2026-05-16", origin: "regular", status: "active" },
  { id: "s112", name: "Степан Морозов", age: 10, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 96, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-112", joinDate: "2025-09-30", origin: "regular", status: "active" },
  { id: "s113", name: "Вика Никитина", age: 14, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 80, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-113", joinDate: "2025-10-12", origin: "regular", status: "active" },
  { id: "s114", name: "Felix Brandt", age: 17, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-114", joinDate: "2025-10-06", origin: "regular", status: "active" },
  { id: "s115", name: "Вика Никитина", age: 8, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-115", joinDate: "2025-12-30", origin: "regular", status: "active" },
  { id: "s116", name: "Ника Краснова", age: 9, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 94, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-116", joinDate: "2026-06-19", origin: "regular", status: "active" },
  { id: "s117", name: "Ксения Зайцева", age: 16, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 77, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-117", joinDate: "2025-10-12", origin: "regular", status: "active" },
  { id: "s118", name: "Настя Гусева", age: 10, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 97, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-118", joinDate: "2026-06-26", origin: "promo", status: "active" },
  { id: "s119", name: "Никита Краснов", age: 12, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 94, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-119", joinDate: "2026-01-12", origin: "regular", status: "active" },
  { id: "s120", name: "София Беляева", age: 15, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 77, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-120", joinDate: "2026-02-08", origin: "regular", status: "active" },
  { id: "s121", name: "David Roth", age: 17, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 94, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-121", joinDate: "2026-03-22", origin: "regular", status: "active" },
  { id: "s122", name: "Марк Гусев", age: 11, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 92, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-122", joinDate: "2026-02-01", origin: "regular", status: "active" },
  { id: "s123", name: "Кирилл Мельник", age: 11, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 88, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-123", joinDate: "2025-10-08", origin: "regular", status: "left", leftDate: "2025-11-29" },
  { id: "s124", name: "Глеб Воронин", age: 17, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Продвинутый", attendance: 69, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-124", joinDate: "2025-10-08", origin: "regular", status: "active" },
  { id: "s125", name: "Роман Громов", age: 15, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Продвинутый", attendance: 80, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-125", joinDate: "2026-05-18", origin: "regular", status: "active" },
  { id: "s126", name: "София Беляева", age: 16, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 91, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-126", joinDate: "2025-10-06", origin: "regular", status: "active" },
  { id: "s127", name: "Дарья Тихонова", age: 7, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 80, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-127", joinDate: "2026-03-09", origin: "regular", status: "active" },
  { id: "s128", name: "Андрей Поляков", age: 12, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 96, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-128", joinDate: "2026-04-13", origin: "regular", status: "active" },
  { id: "s129", name: "София Беляева", age: 8, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 78, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-129", joinDate: "2026-02-02", origin: "regular", status: "active" },
  { id: "s130", name: "Дарья Тихонова", age: 13, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Продвинутый", attendance: 95, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-130", joinDate: "2026-05-29", origin: "regular", status: "left", leftDate: "2026-06-08" },
  { id: "s131", name: "Ксения Зайцева", age: 7, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-131", joinDate: "2025-10-24", origin: "regular", status: "active" },
  { id: "s132", name: "Вика Никитина", age: 8, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 93, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-132", joinDate: "2025-11-08", origin: "regular", status: "active" },
  { id: "s133", name: "Александр Беляков", age: 8, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 89, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-133", joinDate: "2025-10-25", origin: "regular", status: "active" },
  { id: "s134", name: "Катя Полякова", age: 13, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 96, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-134", joinDate: "2025-11-19", origin: "regular", status: "active" },
  { id: "s135", name: "Тимур Беляев", age: 15, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 96, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-135", joinDate: "2025-12-17", origin: "regular", status: "active" },
  { id: "s136", name: "Jonas Schmidt", age: 11, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 96, lastNote: "", phone: "+49 151 ХХ-136", joinDate: "2025-12-14", origin: "regular", status: "active" },
  { id: "s137", name: "Мира Ким", age: 12, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Средний", attendance: 89, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-137", joinDate: "2026-01-14", origin: "regular", status: "active" },
  { id: "s138", name: "Олеся Орехова", age: 9, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Продвинутый", attendance: 96, lastNote: "", phone: "+49 151 ХХ-138", joinDate: "2026-01-07", origin: "regular", status: "active" },
  { id: "s139", name: "Глеб Воронин", age: 7, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 93, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-139", joinDate: "2025-09-27", origin: "regular", status: "vacation" },
  { id: "s140", name: "Денис Кузнецов", age: 7, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 81, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-140", joinDate: "2026-04-05", origin: "regular", status: "active" },
  { id: "s141", name: "Mia Schmidt", age: 9, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-141", joinDate: "2025-09-23", origin: "regular", status: "left", leftDate: "2025-11-29" },
  { id: "s142", name: "Ева Линд", age: 10, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 84, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-142", joinDate: "2026-01-13", origin: "regular", status: "active" },
  { id: "s143", name: "Sofia Becker", age: 15, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Продвинутый", attendance: 83, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-143", joinDate: "2026-04-15", origin: "regular", status: "active" },
  { id: "s144", name: "Мира Ким", age: 17, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 85, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-144", joinDate: "2026-04-07", origin: "regular", status: "active" },
  { id: "s145", name: "Никита Краснов", age: 7, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 79, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-145", joinDate: "2025-10-28", origin: "regular", status: "vacation" },
  { id: "s146", name: "Anna Roth", age: 10, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 83, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-146", joinDate: "2025-11-16", origin: "regular", status: "active" },
  { id: "s147", name: "Игорь Шепель", age: 16, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 89, lastNote: "", phone: "+49 151 ХХ-147", joinDate: "2026-03-09", origin: "regular", status: "active" },
  { id: "s148", name: "Макс Орлов", age: 15, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Средний", attendance: 80, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-148", joinDate: "2025-11-15", origin: "regular", status: "active" },
  { id: "s149", name: "Никита Краснов", age: 11, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Средний", attendance: 96, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-149", joinDate: "2025-09-22", origin: "regular", status: "active" },
  { id: "s150", name: "Роман Громов", age: 13, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 77, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-150", joinDate: "2025-09-21", origin: "regular", status: "active" },
  { id: "s151", name: "Олеся Орехова", age: 15, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 79, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-151", joinDate: "2025-12-17", origin: "regular", status: "active" },
  { id: "s152", name: "Иван Жуков", age: 9, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Средний", attendance: 83, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-152", joinDate: "2025-10-23", origin: "regular", status: "active" },
  { id: "s153", name: "Дина Костина", age: 8, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 94, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-153", joinDate: "2026-06-14", origin: "promo", status: "active" },
  { id: "s154", name: "Глеб Воронин", age: 13, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-154", joinDate: "2025-11-19", origin: "regular", status: "active" },
  { id: "s155", name: "David Roth", age: 15, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 88, lastNote: "", phone: "+49 151 ХХ-155", joinDate: "2025-12-31", origin: "regular", status: "active" },
  { id: "s156", name: "Ксения Зайцева", age: 14, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 94, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-156", joinDate: "2025-11-30", origin: "regular", status: "active" },
  { id: "s157", name: "Anna Roth", age: 16, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Продвинутый", attendance: 95, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-157", joinDate: "2025-09-13", origin: "regular", status: "active" },
  { id: "s158", name: "Богдан Никитин", age: 15, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 96, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-158", joinDate: "2026-02-18", origin: "regular", status: "active" },
  { id: "s159", name: "Соня Карпова", age: 7, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Средний", attendance: 83, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-159", joinDate: "2026-03-30", origin: "regular", status: "active" },
  { id: "s160", name: "Кирилл Мельник", age: 10, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 64, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-160", joinDate: "2026-01-06", origin: "regular", status: "active" },
  { id: "s161", name: "Настя Гусева", age: 16, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 95, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-161", joinDate: "2025-10-26", origin: "regular", status: "active" },
  { id: "s162", name: "Маша Соколова", age: 10, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 99, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-162", joinDate: "2025-09-20", origin: "regular", status: "active" },
  { id: "s163", name: "Вера Громова", age: 9, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 92, lastNote: "", phone: "+49 151 ХХ-163", joinDate: "2025-12-23", origin: "regular", status: "active" },
  { id: "s164", name: "Дарья Тихонова", age: 14, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Продвинутый", attendance: 79, lastNote: "", phone: "+49 151 ХХ-164", joinDate: "2026-04-24", origin: "regular", status: "active" },
  { id: "s165", name: "Ксения Зайцева", age: 8, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 85, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-165", joinDate: "2025-12-26", origin: "regular", status: "active" },
  { id: "s166", name: "Вика Никитина", age: 17, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-166", joinDate: "2025-12-08", origin: "regular", status: "active" },
  { id: "s167", name: "Jonas Schmidt", age: 12, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 89, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-167", joinDate: "2026-01-21", origin: "regular", status: "active" },
  { id: "s168", name: "Соня Карпова", age: 13, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-168", joinDate: "2026-01-21", origin: "regular", status: "active" },
  { id: "s169", name: "София Беляева", age: 10, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 93, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-169", joinDate: "2026-05-19", origin: "regular", status: "active" },
  { id: "s170", name: "Ксения Зайцева", age: 14, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 98, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-170", joinDate: "2026-06-02", origin: "promo", status: "active" },
  { id: "s171", name: "Sofia Becker", age: 13, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 91, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-171", joinDate: "2026-01-12", origin: "regular", status: "active" },
  { id: "s172", name: "Ника Краснова", age: 12, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 96, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-172", joinDate: "2026-01-14", origin: "regular", status: "left", leftDate: "2026-06-16" },
  { id: "s173", name: "Игорь Шепель", age: 7, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 87, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-173", joinDate: "2026-04-11", origin: "regular", status: "active" },
  { id: "s174", name: "Кирилл Мельник", age: 12, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 89, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-174", joinDate: "2026-02-08", origin: "regular", status: "active" },
  { id: "s175", name: "Соня Карпова", age: 13, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 78, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-175", joinDate: "2026-05-20", origin: "regular", status: "vacation" },
  { id: "s176", name: "Вера Громова", age: 9, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 89, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-176", joinDate: "2025-12-07", origin: "regular", status: "active" },
  { id: "s177", name: "Никита Краснов", age: 8, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-177", joinDate: "2026-04-12", origin: "regular", status: "left", leftDate: "2026-06-20" },
  { id: "s178", name: "Ярослав Комаров", age: 8, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 80, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-178", joinDate: "2025-12-10", origin: "regular", status: "active" },
  { id: "s179", name: "Ярослав Комаров", age: 14, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Продвинутый", attendance: 84, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-179", joinDate: "2025-10-06", origin: "regular", status: "active" },
  { id: "s180", name: "Марк Гусев", age: 12, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-180", joinDate: "2026-02-17", origin: "regular", status: "active" },
  { id: "s181", name: "Маша Соколова", age: 16, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 90, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-181", joinDate: "2025-11-03", origin: "regular", status: "active" },
  { id: "s182", name: "Роман Громов", age: 15, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 87, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-182", joinDate: "2026-02-01", origin: "regular", status: "active" },
  { id: "s183", name: "Дарья Тихонова", age: 13, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Продвинутый", attendance: 76, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-183", joinDate: "2026-03-29", origin: "regular", status: "active" },
  { id: "s184", name: "Лиза Морозова", age: 14, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Продвинутый", attendance: 99, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-184", joinDate: "2026-01-30", origin: "regular", status: "active" },
  { id: "s185", name: "Степан Морозов", age: 17, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 68, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-185", joinDate: "2025-12-08", origin: "regular", status: "active" },
  { id: "s186", name: "Klara Vogt", age: 15, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 86, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-186", joinDate: "2026-03-14", origin: "regular", status: "active" },
  { id: "s187", name: "Ева Линд", age: 7, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 86, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-187", joinDate: "2025-11-29", origin: "regular", status: "active" },
  { id: "s188", name: "Иван Жуков", age: 16, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 75, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-188", joinDate: "2026-02-02", origin: "regular", status: "active" },
  { id: "s189", name: "Полина Рябова", age: 12, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 82, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-189", joinDate: "2025-09-01", origin: "regular", status: "active" },
  { id: "s190", name: "Макс Орлов", age: 8, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Продвинутый", attendance: 87, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-190", joinDate: "2025-12-17", origin: "regular", status: "active" },
  { id: "s191", name: "Ника Краснова", age: 17, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 98, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-191", joinDate: "2026-06-24", origin: "promo", status: "active" },
  { id: "s192", name: "Маша Соколова", age: 15, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-192", joinDate: "2026-04-15", origin: "regular", status: "active" },
  { id: "s193", name: "Mia Schmidt", age: 17, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 81, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-193", joinDate: "2025-12-19", origin: "regular", status: "active" },
  { id: "s194", name: "Роман Громов", age: 11, discipline: "bike", coachId: "c7", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-194", joinDate: "2025-11-26", origin: "regular", status: "active" },
  { id: "s195", name: "David Roth", age: 9, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Продвинутый", attendance: 75, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-195", joinDate: "2026-01-24", origin: "regular", status: "active" },
  { id: "s196", name: "Ксения Зайцева", age: 11, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 91, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-196", joinDate: "2026-02-19", origin: "regular", status: "vacation" },
  { id: "s197", name: "Lukas Weber", age: 8, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Продвинутый", attendance: 91, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-197", joinDate: "2025-12-30", origin: "regular", status: "active" },
  { id: "s198", name: "Дина Костина", age: 15, discipline: "bike", coachId: "c7", branchId: "roza", level: "Продвинутый", attendance: 96, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-198", joinDate: "2025-12-25", origin: "regular", status: "active" },
  { id: "s199", name: "Klara Vogt", age: 11, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 87, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-199", joinDate: "2025-11-15", origin: "regular", status: "left", leftDate: "2026-01-17" },
  { id: "s200", name: "Мира Ким", age: 14, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 79, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-200", joinDate: "2026-05-02", origin: "regular", status: "active" },
  { id: "s201", name: "Ева Линд", age: 9, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-201", joinDate: "2025-10-08", origin: "regular", status: "active" },
  { id: "s202", name: "Вера Громова", age: 8, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 90, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-202", joinDate: "2026-06-22", origin: "regular", status: "active" },
  { id: "s203", name: "Макс Орлов", age: 7, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Продвинутый", attendance: 87, lastNote: "", phone: "+49 151 ХХ-203", joinDate: "2026-05-12", origin: "regular", status: "active" },
  { id: "s204", name: "Богдан Никитин", age: 14, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 92, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-204", joinDate: "2025-11-15", origin: "regular", status: "active" },
  { id: "s205", name: "Кирилл Мельник", age: 16, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Средний", attendance: 83, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-205", joinDate: "2025-09-03", origin: "regular", status: "active" },
  { id: "s206", name: "Олег Прядко", age: 7, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 83, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-206", joinDate: "2025-10-25", origin: "regular", status: "active" },
  { id: "s207", name: "Дина Костина", age: 15, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 87, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-207", joinDate: "2025-12-22", origin: "regular", status: "active" },
  { id: "s208", name: "Вера Громова", age: 14, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 88, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-208", joinDate: "2026-05-24", origin: "regular", status: "active" },
  { id: "s209", name: "Mia Schmidt", age: 13, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 90, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-209", joinDate: "2025-11-02", origin: "regular", status: "active" },
  { id: "s210", name: "Lena Weber", age: 12, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 87, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-210", joinDate: "2026-04-26", origin: "regular", status: "active" },
  { id: "s211", name: "Полина Рябова", age: 11, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 82, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-211", joinDate: "2026-06-14", origin: "regular", status: "active" },
  { id: "s212", name: "Игорь Шепель", age: 9, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 79, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-212", joinDate: "2026-04-15", origin: "regular", status: "active" },
  { id: "s213", name: "Лука Семёнов", age: 9, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 89, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-213", joinDate: "2026-05-17", origin: "regular", status: "active" },
  { id: "s214", name: "Иван Жуков", age: 15, discipline: "bike", coachId: "c7", branchId: "roza", level: "Продвинутый", attendance: 90, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-214", joinDate: "2026-04-17", origin: "regular", status: "active" },
  { id: "s215", name: "Соня Карпова", age: 16, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 98, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-215", joinDate: "2026-05-02", origin: "regular", status: "active" },
  { id: "s216", name: "Anna Roth", age: 9, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 88, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-216", joinDate: "2026-01-05", origin: "regular", status: "active" },
  { id: "s217", name: "Daniel Becker", age: 12, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-217", joinDate: "2026-01-20", origin: "regular", status: "active" },
  { id: "s218", name: "Дарья Тихонова", age: 17, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 89, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-218", joinDate: "2026-05-25", origin: "promo", status: "active" },
  { id: "s219", name: "Ксения Зайцева", age: 17, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 94, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-219", joinDate: "2026-04-14", origin: "regular", status: "vacation" },
  { id: "s220", name: "Дарья Тихонова", age: 11, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Средний", attendance: 79, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-220", joinDate: "2026-01-25", origin: "regular", status: "active" },
  { id: "s221", name: "Настя Гусева", age: 11, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 83, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-221", joinDate: "2026-02-19", origin: "regular", status: "active" },
  { id: "s222", name: "Daniel Becker", age: 14, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-222", joinDate: "2026-06-04", origin: "promo", status: "vacation" },
  { id: "s223", name: "Никита Краснов", age: 11, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-223", joinDate: "2026-03-16", origin: "regular", status: "active" },
  { id: "s224", name: "Алина Фролова", age: 15, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 96, lastNote: "", phone: "+49 151 ХХ-224", joinDate: "2025-12-19", origin: "regular", status: "vacation" },
  { id: "s225", name: "Макс Орлов", age: 8, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 91, lastNote: "", phone: "+49 151 ХХ-225", joinDate: "2026-03-28", origin: "regular", status: "active" },
  { id: "s226", name: "Лука Семёнов", age: 12, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 78, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-226", joinDate: "2026-04-27", origin: "regular", status: "active" },
  { id: "s227", name: "Ева Линд", age: 13, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 75, lastNote: "", phone: "+49 151 ХХ-227", joinDate: "2025-12-15", origin: "regular", status: "active" },
  { id: "s228", name: "David Roth", age: 10, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-228", joinDate: "2026-03-19", origin: "regular", status: "active" },
  { id: "s229", name: "Дина Костина", age: 12, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-229", joinDate: "2026-06-27", origin: "promo", status: "active" },
  { id: "s230", name: "Daniel Becker", age: 9, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 70, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-230", joinDate: "2026-06-22", origin: "promo", status: "active" },
  { id: "s231", name: "Ева Линд", age: 11, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Продвинутый", attendance: 82, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-231", joinDate: "2026-02-28", origin: "regular", status: "active" },
  { id: "s232", name: "Полина Рябова", age: 13, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 83, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-232", joinDate: "2026-03-19", origin: "regular", status: "active" },
  { id: "s233", name: "София Беляева", age: 13, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 92, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-233", joinDate: "2026-04-03", origin: "regular", status: "active" },
  { id: "s234", name: "Вика Никитина", age: 8, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 92, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-234", joinDate: "2026-06-07", origin: "regular", status: "active" },
  { id: "s235", name: "Вера Громова", age: 14, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 88, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-235", joinDate: "2026-05-08", origin: "regular", status: "active" },
  { id: "s236", name: "Настя Гусева", age: 11, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 76, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-236", joinDate: "2026-04-12", origin: "regular", status: "active" },
  { id: "s237", name: "Felix Brandt", age: 16, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 84, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-237", joinDate: "2026-03-19", origin: "regular", status: "active" },
  { id: "s238", name: "Юля Зуева", age: 12, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 91, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-238", joinDate: "2026-03-27", origin: "regular", status: "active" },
  { id: "s239", name: "Алина Фролова", age: 8, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 91, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-239", joinDate: "2026-04-28", origin: "regular", status: "active" },
  { id: "s240", name: "Александр Беляков", age: 8, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 89, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-240", joinDate: "2026-06-01", origin: "promo", status: "left", leftDate: "2026-06-20" },
  { id: "s241", name: "Кирилл Соколов", age: 7, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 75, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-241", joinDate: "2025-09-14", origin: "regular", status: "vacation" },
  { id: "s242", name: "Михаил Сафронов", age: 17, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 99, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-242", joinDate: "2026-04-08", origin: "regular", status: "active" },
  { id: "s243", name: "Лиза Морозова", age: 9, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-243", flag: "injury", joinDate: "2026-04-25", origin: "regular", status: "active" },
  { id: "s244", name: "Богдан Никитин", age: 14, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 98, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-244", joinDate: "2026-01-12", origin: "regular", status: "active" },
  { id: "s245", name: "Марк Гусев", age: 13, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Средний", attendance: 84, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-245", joinDate: "2025-12-18", origin: "regular", status: "active" },
  { id: "s246", name: "Андрей Поляков", age: 10, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 88, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-246", joinDate: "2026-02-20", origin: "regular", status: "active" },
  { id: "s247", name: "Anna Roth", age: 10, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 86, lastNote: "", phone: "+49 151 ХХ-247", joinDate: "2026-03-14", origin: "regular", status: "active" },
  { id: "s248", name: "Михаил Сафронов", age: 9, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Продвинутый", attendance: 90, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-248", joinDate: "2026-04-04", origin: "regular", status: "active" },
  { id: "s249", name: "Богдан Никитин", age: 16, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-249", joinDate: "2025-10-12", origin: "regular", status: "active" },
  { id: "s250", name: "Тимур Беляев", age: 13, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 71, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-250", joinDate: "2026-06-04", origin: "regular", status: "left", leftDate: "2026-06-12" },
  { id: "s251", name: "Александр Беляков", age: 11, discipline: "bike", coachId: "c7", branchId: "roza", level: "Продвинутый", attendance: 74, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-251", joinDate: "2025-10-06", origin: "regular", status: "active" },
  { id: "s252", name: "Соня Карпова", age: 10, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 84, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-252", joinDate: "2025-09-21", origin: "regular", status: "active" },
  { id: "s253", name: "Алина Фролова", age: 17, discipline: "skate", coachId: "c6", branchId: "roza", level: "Продвинутый", attendance: 84, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-253", joinDate: "2026-01-05", origin: "regular", status: "active" },
  { id: "s254", name: "Юля Зуева", age: 16, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 87, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-254", joinDate: "2025-09-11", origin: "regular", status: "active" },
  { id: "s255", name: "Лиза Морозова", age: 17, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 86, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-255", joinDate: "2026-01-01", origin: "regular", status: "active" },
  { id: "s256", name: "Катя Полякова", age: 12, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 89, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-256", joinDate: "2025-10-29", origin: "regular", status: "active" },
  { id: "s257", name: "Иван Жуков", age: 12, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 90, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-257", joinDate: "2025-12-21", origin: "regular", status: "active" },
  { id: "s258", name: "Вика Никитина", age: 8, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-258", joinDate: "2026-01-10", origin: "regular", status: "active" },
  { id: "s259", name: "Полина Рябова", age: 10, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 82, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-259", joinDate: "2025-11-25", origin: "regular", status: "active" },
  { id: "s260", name: "Денис Кузнецов", age: 11, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Средний", attendance: 84, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-260", joinDate: "2025-10-29", origin: "regular", status: "active" },
  { id: "s261", name: "Соня Карпова", age: 11, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 96, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-261", joinDate: "2025-11-23", origin: "regular", status: "active" },
  { id: "s262", name: "Иван Жуков", age: 9, discipline: "skate", coachId: "c6", branchId: "roza", level: "Продвинутый", attendance: 94, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-262", joinDate: "2025-10-26", origin: "regular", status: "active" },
  { id: "s263", name: "Лена Грач", age: 13, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Средний", attendance: 69, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-263", joinDate: "2026-02-07", origin: "regular", status: "active" },
  { id: "s264", name: "Jonas Schmidt", age: 14, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 82, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-264", joinDate: "2026-03-12", origin: "regular", status: "active" },
  { id: "s265", name: "Михаил Сафронов", age: 17, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 81, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-265", joinDate: "2025-12-11", origin: "regular", status: "vacation" },
  { id: "s266", name: "Lena Weber", age: 8, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 95, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-266", joinDate: "2026-01-03", origin: "regular", status: "vacation" },
  { id: "s267", name: "Ярослав Комаров", age: 11, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 86, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-267", joinDate: "2026-02-02", origin: "regular", status: "active" },
  { id: "s268", name: "Катя Полякова", age: 9, discipline: "bike", coachId: "c7", branchId: "roza", level: "Продвинутый", attendance: 85, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-268", joinDate: "2025-11-01", origin: "regular", status: "active" },
  { id: "s269", name: "Лена Грач", age: 13, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 93, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-269", joinDate: "2026-06-17", origin: "promo", status: "active" },
  { id: "s270", name: "Ева Линд", age: 15, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-270", joinDate: "2026-04-08", origin: "regular", status: "active" },
  { id: "s271", name: "Марк Гусев", age: 9, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 77, lastNote: "", phone: "+49 151 ХХ-271", joinDate: "2025-10-06", origin: "regular", status: "active" },
  { id: "s272", name: "Anna Roth", age: 16, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-272", joinDate: "2026-02-22", origin: "regular", status: "left", leftDate: "2026-04-17" },
  { id: "s273", name: "Lukas Weber", age: 14, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 87, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-273", joinDate: "2026-05-09", origin: "regular", status: "vacation" },
  { id: "s274", name: "Маша Соколова", age: 10, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-274", joinDate: "2026-03-05", origin: "regular", status: "active" },
  { id: "s275", name: "Ника Краснова", age: 14, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 93, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-275", joinDate: "2026-04-24", origin: "regular", status: "active" },
  { id: "s276", name: "Lukas Weber", age: 12, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 92, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-276", joinDate: "2026-04-11", origin: "regular", status: "active" },
  { id: "s277", name: "Михаил Сафронов", age: 12, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-277", joinDate: "2026-05-26", origin: "promo", status: "active" },
  { id: "s278", name: "Олег Прядко", age: 10, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 98, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-278", joinDate: "2026-06-03", origin: "regular", status: "active" },
  { id: "s279", name: "Ева Линд", age: 11, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-279", joinDate: "2026-01-16", origin: "regular", status: "active" },
  { id: "s280", name: "Кирилл Мельник", age: 11, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Средний", attendance: 66, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-280", joinDate: "2026-01-04", origin: "regular", status: "active" },
  { id: "s281", name: "Соня Карпова", age: 11, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 94, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-281", joinDate: "2025-10-15", origin: "regular", status: "active" },
  { id: "s282", name: "Роман Громов", age: 8, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 68, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-282", joinDate: "2026-04-19", origin: "regular", status: "active" },
  { id: "s283", name: "Богдан Никитин", age: 12, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 79, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-283", joinDate: "2026-04-26", origin: "regular", status: "active" },
  { id: "s284", name: "Вика Никитина", age: 12, discipline: "skate", coachId: "c4", branchId: "roza", level: "Продвинутый", attendance: 86, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-284", joinDate: "2026-03-14", origin: "regular", status: "active" },
  { id: "s285", name: "Дина Костина", age: 8, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Продвинутый", attendance: 94, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-285", joinDate: "2026-05-12", origin: "regular", status: "active" },
  { id: "s286", name: "Felix Brandt", age: 17, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 87, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-286", flag: "injury", joinDate: "2025-12-03", origin: "regular", status: "active" },
  { id: "s287", name: "Ника Краснова", age: 17, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 80, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-287", joinDate: "2026-03-01", origin: "regular", status: "active" },
  { id: "s288", name: "Мира Ким", age: 14, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 87, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-288", joinDate: "2026-02-22", origin: "regular", status: "active" },
  { id: "s289", name: "Глеб Воронин", age: 11, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 82, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-289", joinDate: "2026-01-20", origin: "regular", status: "active" },
  { id: "s290", name: "Роман Громов", age: 14, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 68, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-290", joinDate: "2026-05-23", origin: "promo", status: "active" },
  { id: "s291", name: "Daniel Becker", age: 15, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 92, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-291", joinDate: "2026-03-28", origin: "regular", status: "active" },
  { id: "s292", name: "Лена Грач", age: 9, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Продвинутый", attendance: 86, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-292", joinDate: "2026-01-02", origin: "regular", status: "active" },
  { id: "s293", name: "Соня Карпова", age: 10, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Продвинутый", attendance: 93, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-293", joinDate: "2026-05-10", origin: "regular", status: "active" },
  { id: "s294", name: "Daniel Becker", age: 10, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 81, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-294", joinDate: "2025-09-09", origin: "regular", status: "vacation" },
  { id: "s295", name: "Klara Vogt", age: 10, discipline: "skate", coachId: "c6", branchId: "roza", level: "Продвинутый", attendance: 83, lastNote: "", phone: "+49 151 ХХ-295", joinDate: "2025-12-23", origin: "regular", status: "active" },
  { id: "s296", name: "Иван Жуков", age: 9, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 92, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-296", joinDate: "2026-01-03", origin: "regular", status: "active" },
  { id: "s297", name: "Олег Прядко", age: 11, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 86, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-297", joinDate: "2026-06-25", origin: "regular", status: "active" },
  { id: "s298", name: "Макс Орлов", age: 17, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 96, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-298", joinDate: "2026-02-24", origin: "regular", status: "active" },
  { id: "s299", name: "Катя Полякова", age: 9, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 76, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-299", joinDate: "2026-06-09", origin: "regular", status: "active" },
  { id: "s300", name: "Sofia Becker", age: 10, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-300", joinDate: "2026-01-17", origin: "regular", status: "active" },
  { id: "s301", name: "Александр Беляков", age: 7, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-301", joinDate: "2025-12-28", origin: "regular", status: "active" },
  { id: "s302", name: "Денис Кузнецов", age: 9, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Продвинутый", attendance: 93, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-302", joinDate: "2025-12-08", origin: "regular", status: "active" },
  { id: "s303", name: "Лука Семёнов", age: 9, discipline: "skate", coachId: "c6", branchId: "roza", level: "Продвинутый", attendance: 87, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-303", joinDate: "2026-06-02", origin: "regular", status: "active" },
  { id: "s304", name: "Лиза Морозова", age: 8, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 91, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-304", joinDate: "2025-12-08", origin: "regular", status: "active" },
  { id: "s305", name: "Sofia Becker", age: 7, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 83, lastNote: "", phone: "+49 151 ХХ-305", joinDate: "2026-05-06", origin: "regular", status: "active" },
  { id: "s306", name: "Макс Орлов", age: 17, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 99, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-306", joinDate: "2026-05-27", origin: "regular", status: "active" },
  { id: "s307", name: "Иван Жуков", age: 17, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 84, lastNote: "", phone: "+49 151 ХХ-307", joinDate: "2025-12-09", origin: "regular", status: "active" },
  { id: "s308", name: "Дарья Тихонова", age: 7, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-308", joinDate: "2026-03-04", origin: "regular", status: "active" },
  { id: "s309", name: "Катя Полякова", age: 7, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 97, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-309", joinDate: "2025-09-08", origin: "regular", status: "active" },
  { id: "s310", name: "Богдан Никитин", age: 14, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Средний", attendance: 91, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-310", joinDate: "2025-11-04", origin: "regular", status: "active" },
  { id: "s311", name: "Дина Костина", age: 9, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 95, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-311", joinDate: "2025-09-28", origin: "regular", status: "active" },
  { id: "s312", name: "София Беляева", age: 12, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 90, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-312", joinDate: "2025-11-04", origin: "regular", status: "active" },
  { id: "s313", name: "Юля Зуева", age: 12, discipline: "bike", coachId: "c7", branchId: "roza", level: "Продвинутый", attendance: 75, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-313", joinDate: "2026-05-10", origin: "regular", status: "vacation" },
  { id: "s314", name: "Anna Roth", age: 9, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 89, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-314", joinDate: "2025-09-07", origin: "regular", status: "active" },
  { id: "s315", name: "Полина Рябова", age: 17, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 85, lastNote: "", phone: "+49 151 ХХ-315", joinDate: "2026-04-29", origin: "regular", status: "active" },
  { id: "s316", name: "Felix Brandt", age: 14, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 81, lastNote: "", phone: "+49 151 ХХ-316", joinDate: "2026-02-22", origin: "regular", status: "active" },
  { id: "s317", name: "Иван Жуков", age: 14, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Средний", attendance: 93, lastNote: "", phone: "+49 151 ХХ-317", flag: "injury", joinDate: "2025-09-27", origin: "regular", status: "active" },
  { id: "s318", name: "Степан Морозов", age: 7, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 90, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-318", joinDate: "2026-05-03", origin: "regular", status: "vacation" },
  { id: "s319", name: "David Roth", age: 15, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 87, lastNote: "", phone: "+49 151 ХХ-319", joinDate: "2025-10-04", origin: "regular", status: "active" },
  { id: "s320", name: "Настя Гусева", age: 17, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 91, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-320", joinDate: "2025-10-08", origin: "regular", status: "active" },
  { id: "s321", name: "Полина Рябова", age: 17, discipline: "skate", coachId: "c4", branchId: "roza", level: "Продвинутый", attendance: 82, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-321", joinDate: "2025-09-28", origin: "regular", status: "active" },
  { id: "s322", name: "Александр Беляков", age: 11, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 74, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-322", joinDate: "2026-06-16", origin: "promo", status: "active" },
  { id: "s323", name: "Klara Vogt", age: 16, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 71, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-323", joinDate: "2026-01-06", origin: "regular", status: "vacation" },
  { id: "s324", name: "Полина Рябова", age: 13, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-324", joinDate: "2026-04-02", origin: "regular", status: "active" },
  { id: "s325", name: "Богдан Никитин", age: 13, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 93, lastNote: "", phone: "+49 151 ХХ-325", joinDate: "2025-12-25", origin: "regular", status: "active" },
  { id: "s326", name: "Ярослав Комаров", age: 12, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 71, lastNote: "", phone: "+49 151 ХХ-326", joinDate: "2026-03-14", origin: "regular", status: "active" },
  { id: "s327", name: "David Roth", age: 16, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 85, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-327", joinDate: "2026-04-15", origin: "regular", status: "active" },
  { id: "s328", name: "David Roth", age: 11, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 78, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-328", joinDate: "2026-04-08", origin: "regular", status: "active" },
  { id: "s329", name: "Артём Волков", age: 11, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 82, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-329", joinDate: "2025-10-01", origin: "regular", status: "active" },
  { id: "s330", name: "Степан Морозов", age: 10, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 85, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-330", joinDate: "2025-10-21", origin: "regular", status: "active" },
  { id: "s331", name: "Александр Беляков", age: 15, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 92, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-331", joinDate: "2025-12-16", origin: "regular", status: "active" },
  { id: "s332", name: "Иван Жуков", age: 7, discipline: "bike", coachId: "c7", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-332", joinDate: "2026-01-14", origin: "regular", status: "active" },
  { id: "s333", name: "Вера Громова", age: 14, discipline: "skate", coachId: "c4", branchId: "roza", level: "Продвинутый", attendance: 97, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-333", joinDate: "2025-11-20", origin: "regular", status: "active" },
  { id: "s334", name: "Дина Костина", age: 15, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 93, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-334", joinDate: "2026-06-10", origin: "promo", status: "vacation" },
  { id: "s335", name: "Кирилл Мельник", age: 11, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 70, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-335", joinDate: "2026-04-19", origin: "regular", status: "active" },
  { id: "s336", name: "Лена Грач", age: 13, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Продвинутый", attendance: 78, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-336", joinDate: "2026-04-29", origin: "regular", status: "active" },
  { id: "s337", name: "Кирилл Мельник", age: 8, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 76, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-337", joinDate: "2025-12-28", origin: "regular", status: "active" },
  { id: "s338", name: "Ярослав Комаров", age: 17, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 91, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-338", joinDate: "2026-01-23", origin: "regular", status: "active" },
  { id: "s339", name: "Lukas Weber", age: 16, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 98, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-339", flag: "injury", joinDate: "2026-04-21", origin: "regular", status: "vacation" },
  { id: "s340", name: "София Беляева", age: 8, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 92, lastNote: "", phone: "+49 151 ХХ-340", joinDate: "2025-12-29", origin: "regular", status: "active" },
  { id: "s341", name: "Иван Жуков", age: 11, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 96, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-341", joinDate: "2025-12-11", origin: "regular", status: "active" },
  { id: "s342", name: "Лена Грач", age: 8, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 76, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-342", joinDate: "2026-06-06", origin: "promo", status: "active" },
  { id: "s343", name: "Михаил Сафронов", age: 13, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 82, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-343", joinDate: "2026-01-15", origin: "regular", status: "active" },
  { id: "s344", name: "Klara Vogt", age: 15, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Средний", attendance: 82, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-344", joinDate: "2025-10-07", origin: "regular", status: "left", leftDate: "2026-03-14" },
  { id: "s345", name: "Глеб Воронин", age: 10, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-345", joinDate: "2026-06-19", origin: "promo", status: "active" },
  { id: "s346", name: "Вера Громова", age: 16, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 84, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-346", joinDate: "2026-04-28", origin: "regular", status: "active" },
  { id: "s347", name: "Богдан Никитин", age: 12, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 88, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-347", joinDate: "2026-03-26", origin: "regular", status: "active" },
  { id: "s348", name: "Jonas Schmidt", age: 13, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-348", joinDate: "2026-05-15", origin: "promo", status: "active" },
  { id: "s349", name: "Андрей Поляков", age: 12, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 82, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-349", joinDate: "2025-09-21", origin: "regular", status: "active" },
  { id: "s350", name: "Лука Семёнов", age: 16, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 85, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-350", joinDate: "2026-02-13", origin: "regular", status: "active" },
  { id: "s351", name: "Ника Краснова", age: 14, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "", phone: "+49 151 ХХ-351", joinDate: "2025-09-14", origin: "regular", status: "vacation" },
  { id: "s352", name: "Sofia Becker", age: 9, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 81, lastNote: "", phone: "+49 151 ХХ-352", joinDate: "2026-06-22", origin: "promo", status: "active" },
  { id: "s353", name: "Вика Никитина", age: 7, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Продвинутый", attendance: 79, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-353", joinDate: "2026-01-16", origin: "regular", status: "active" },
  { id: "s354", name: "Lukas Weber", age: 12, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Продвинутый", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-354", joinDate: "2025-11-29", origin: "regular", status: "active" },
  { id: "s355", name: "Вика Никитина", age: 15, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 80, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-355", joinDate: "2026-04-15", origin: "regular", status: "active" },
  { id: "s356", name: "Олег Прядко", age: 7, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 86, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-356", joinDate: "2025-12-02", origin: "regular", status: "active" },
  { id: "s357", name: "Дина Костина", age: 14, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 77, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-357", joinDate: "2026-04-12", origin: "regular", status: "active" },
  { id: "s358", name: "Mia Schmidt", age: 12, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 82, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-358", joinDate: "2026-05-10", origin: "regular", status: "active" },
  { id: "s359", name: "Дина Костина", age: 14, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Продвинутый", attendance: 90, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-359", joinDate: "2026-04-29", origin: "regular", status: "active" },
  { id: "s360", name: "Роман Громов", age: 16, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 81, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-360", joinDate: "2026-02-18", origin: "regular", status: "active" },
  { id: "s361", name: "Аня Светлова", age: 9, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Продвинутый", attendance: 86, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-361", joinDate: "2025-10-24", origin: "regular", status: "active" },
  { id: "s362", name: "Вера Громова", age: 14, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 84, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-362", joinDate: "2026-02-16", origin: "regular", status: "active" },
  { id: "s363", name: "Тимур Беляев", age: 12, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 73, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-363", joinDate: "2026-05-12", origin: "regular", status: "active" },
  { id: "s364", name: "Богдан Никитин", age: 7, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Продвинутый", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-364", joinDate: "2026-03-25", origin: "regular", status: "active" },
  { id: "s365", name: "Lukas Weber", age: 17, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 81, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-365", joinDate: "2026-06-09", origin: "promo", status: "left", leftDate: "2026-06-18" },
  { id: "s366", name: "Дина Костина", age: 10, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 90, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-366", joinDate: "2026-02-13", origin: "regular", status: "vacation" },
  { id: "s367", name: "Полина Рябова", age: 13, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 88, lastNote: "", phone: "+49 151 ХХ-367", joinDate: "2026-03-26", origin: "regular", status: "active" },
  { id: "s368", name: "Глеб Воронин", age: 15, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Продвинутый", attendance: 93, lastNote: "", phone: "+49 151 ХХ-368", joinDate: "2025-09-01", origin: "regular", status: "active" },
  { id: "s369", name: "Богдан Никитин", age: 13, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 88, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-369", joinDate: "2026-06-05", origin: "promo", status: "active" },
  { id: "s370", name: "Глеб Воронин", age: 11, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 98, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-370", joinDate: "2026-05-24", origin: "regular", status: "active" },
  { id: "s371", name: "Ника Краснова", age: 10, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 99, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-371", joinDate: "2026-04-15", origin: "regular", status: "active" },
  { id: "s372", name: "Ярослав Комаров", age: 15, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 83, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-372", joinDate: "2025-12-14", origin: "regular", status: "active" },
  { id: "s373", name: "Кирилл Соколов", age: 15, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Продвинутый", attendance: 78, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-373", joinDate: "2025-11-07", origin: "regular", status: "active" },
  { id: "s374", name: "Соня Карпова", age: 15, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Продвинутый", attendance: 86, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-374", flag: "injury", joinDate: "2026-04-13", origin: "regular", status: "active" },
  { id: "s375", name: "Михаил Сафронов", age: 15, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Продвинутый", attendance: 98, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-375", joinDate: "2026-05-07", origin: "regular", status: "active" },
  { id: "s376", name: "Михаил Сафронов", age: 10, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 81, lastNote: "", phone: "+49 151 ХХ-376", joinDate: "2026-01-01", origin: "regular", status: "active" },
  { id: "s377", name: "Вика Никитина", age: 17, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-377", joinDate: "2026-02-07", origin: "regular", status: "active" },
  { id: "s378", name: "Настя Гусева", age: 9, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 90, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-378", joinDate: "2026-06-10", origin: "promo", status: "active" },
  { id: "s379", name: "Алина Фролова", age: 10, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 91, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-379", joinDate: "2025-10-29", origin: "regular", status: "active" },
  { id: "s380", name: "Jonas Schmidt", age: 9, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 89, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-380", joinDate: "2025-10-31", origin: "regular", status: "active" },
  { id: "s381", name: "Иван Жуков", age: 17, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-381", joinDate: "2025-11-18", origin: "regular", status: "active" },
  { id: "s382", name: "Маша Соколова", age: 17, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 89, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-382", joinDate: "2026-01-28", origin: "regular", status: "active" },
  { id: "s383", name: "Юля Зуева", age: 10, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 94, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-383", joinDate: "2026-01-18", origin: "regular", status: "active" },
  { id: "s384", name: "Mia Schmidt", age: 12, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 91, lastNote: "", phone: "+49 151 ХХ-384", joinDate: "2026-05-06", origin: "regular", status: "active" },
  { id: "s385", name: "Никита Краснов", age: 11, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-385", joinDate: "2026-01-03", origin: "regular", status: "active" },
  { id: "s386", name: "Андрей Поляков", age: 17, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Продвинутый", attendance: 93, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-386", joinDate: "2025-11-14", origin: "regular", status: "active" },
  { id: "s387", name: "Михаил Сафронов", age: 10, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 99, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-387", joinDate: "2026-05-19", origin: "promo", status: "active" },
  { id: "s388", name: "Дарья Тихонова", age: 10, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 91, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-388", joinDate: "2025-10-06", origin: "regular", status: "active" },
  { id: "s389", name: "Марк Гусев", age: 8, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-389", flag: "injury", joinDate: "2026-04-01", origin: "regular", status: "active" },
  { id: "s390", name: "Lukas Weber", age: 7, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 91, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-390", joinDate: "2026-05-18", origin: "promo", status: "active" },
  { id: "s391", name: "Глеб Воронин", age: 9, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 93, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-391", joinDate: "2026-01-31", origin: "regular", status: "active" },
  { id: "s392", name: "Кирилл Мельник", age: 13, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 92, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-392", joinDate: "2026-06-24", origin: "regular", status: "active" },
  { id: "s393", name: "Александр Беляков", age: 11, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 84, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-393", joinDate: "2025-11-16", origin: "regular", status: "active" },
  { id: "s394", name: "Полина Рябова", age: 15, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 85, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-394", joinDate: "2026-05-06", origin: "regular", status: "active" },
  { id: "s395", name: "Mia Schmidt", age: 8, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Продвинутый", attendance: 96, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-395", joinDate: "2026-06-10", origin: "promo", status: "active" },
  { id: "s396", name: "Настя Гусева", age: 11, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-396", joinDate: "2026-02-12", origin: "regular", status: "active" },
  { id: "s397", name: "Вера Громова", age: 14, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 93, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-397", joinDate: "2026-01-01", origin: "regular", status: "active" },
  { id: "s398", name: "Богдан Никитин", age: 17, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 87, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-398", joinDate: "2025-12-29", origin: "regular", status: "active" },
  { id: "s399", name: "Дарья Тихонова", age: 17, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 96, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-399", joinDate: "2026-03-30", origin: "regular", status: "left", leftDate: "2026-05-30" },
  { id: "s400", name: "Алина Фролова", age: 13, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 88, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-400", joinDate: "2026-03-15", origin: "regular", status: "active" },
  { id: "s401", name: "Lukas Weber", age: 7, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 82, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-401", joinDate: "2025-11-17", origin: "regular", status: "active" },
  { id: "s402", name: "Mia Schmidt", age: 10, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Продвинутый", attendance: 81, lastNote: "", phone: "+49 151 ХХ-402", joinDate: "2025-09-19", origin: "regular", status: "active" },
  { id: "s403", name: "Юля Зуева", age: 12, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 89, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-403", joinDate: "2026-02-17", origin: "regular", status: "active" },
  { id: "s404", name: "Роман Громов", age: 16, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-404", joinDate: "2026-04-14", origin: "regular", status: "vacation" },
  { id: "s405", name: "Андрей Поляков", age: 17, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 92, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-405", joinDate: "2026-04-22", origin: "regular", status: "left", leftDate: "2026-05-11" },
  { id: "s406", name: "Sofia Becker", age: 11, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 88, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-406", joinDate: "2026-03-29", origin: "regular", status: "active" },
  { id: "s407", name: "David Roth", age: 17, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 89, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-407", joinDate: "2025-11-19", origin: "regular", status: "vacation" },
  { id: "s408", name: "Мира Ким", age: 8, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 91, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-408", joinDate: "2026-01-14", origin: "regular", status: "active" },
  { id: "s409", name: "Sofia Becker", age: 17, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 97, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-409", joinDate: "2026-03-23", origin: "regular", status: "active" },
  { id: "s410", name: "Полина Рябова", age: 14, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 81, lastNote: "", phone: "+49 151 ХХ-410", joinDate: "2026-02-16", origin: "regular", status: "active" },
  { id: "s411", name: "Михаил Сафронов", age: 14, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 69, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-411", joinDate: "2026-06-01", origin: "promo", status: "active" },
  { id: "s412", name: "Марк Гусев", age: 16, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 91, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-412", joinDate: "2026-05-08", origin: "regular", status: "active" },
  { id: "s413", name: "София Беляева", age: 15, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 84, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-413", joinDate: "2025-09-19", origin: "regular", status: "active" },
  { id: "s414", name: "Соня Карпова", age: 8, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-414", joinDate: "2025-12-30", origin: "regular", status: "active" },
  { id: "s415", name: "Мира Ким", age: 16, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 76, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-415", joinDate: "2026-01-26", origin: "regular", status: "active" },
  { id: "s416", name: "Маша Соколова", age: 10, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 79, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-416", flag: "injury", joinDate: "2025-10-17", origin: "regular", status: "active" },
  { id: "s417", name: "Лука Семёнов", age: 9, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-417", joinDate: "2025-10-21", origin: "regular", status: "active" },
  { id: "s418", name: "Дарья Тихонова", age: 9, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 79, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-418", joinDate: "2025-10-22", origin: "regular", status: "active" },
  { id: "s419", name: "Богдан Никитин", age: 8, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-419", joinDate: "2026-02-01", origin: "regular", status: "active" },
  { id: "s420", name: "Александр Беляков", age: 14, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 92, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-420", joinDate: "2025-09-24", origin: "regular", status: "active" },
  { id: "s421", name: "Аня Светлова", age: 14, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 82, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-421", joinDate: "2025-09-29", origin: "regular", status: "active" },
  { id: "s422", name: "Лука Семёнов", age: 15, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-422", joinDate: "2026-03-11", origin: "regular", status: "active" },
  { id: "s423", name: "Кирилл Мельник", age: 15, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 96, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-423", joinDate: "2026-01-04", origin: "regular", status: "active" },
  { id: "s424", name: "Михаил Сафронов", age: 8, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-424", joinDate: "2026-06-17", origin: "promo", status: "active" },
  { id: "s425", name: "Олеся Орехова", age: 17, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 90, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-425", joinDate: "2025-11-29", origin: "regular", status: "vacation" },
  { id: "s426", name: "Lukas Weber", age: 15, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 92, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-426", joinDate: "2026-03-15", origin: "regular", status: "active" },
  { id: "s427", name: "David Roth", age: 12, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Продвинутый", attendance: 89, lastNote: "", phone: "+49 151 ХХ-427", joinDate: "2026-01-02", origin: "regular", status: "active" },
  { id: "s428", name: "Mia Schmidt", age: 17, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 84, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-428", joinDate: "2026-06-26", origin: "regular", status: "active" },
  { id: "s429", name: "Настя Гусева", age: 16, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 95, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-429", joinDate: "2026-01-09", origin: "regular", status: "active" },
  { id: "s430", name: "David Roth", age: 15, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Продвинутый", attendance: 69, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-430", joinDate: "2025-09-05", origin: "regular", status: "active" },
  { id: "s431", name: "Тимур Беляев", age: 8, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 83, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-431", joinDate: "2026-04-27", origin: "regular", status: "active" },
  { id: "s432", name: "Lena Weber", age: 14, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-432", joinDate: "2026-06-07", origin: "promo", status: "active" },
  { id: "s433", name: "Артём Волков", age: 8, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-433", joinDate: "2026-02-24", origin: "regular", status: "active" },
  { id: "s434", name: "София Беляева", age: 14, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 96, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-434", joinDate: "2026-02-01", origin: "regular", status: "active" },
  { id: "s435", name: "Юля Зуева", age: 9, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-435", joinDate: "2026-04-06", origin: "regular", status: "active" },
  { id: "s436", name: "Олег Прядко", age: 15, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 80, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-436", joinDate: "2026-04-22", origin: "regular", status: "active" },
  { id: "s437", name: "Глеб Воронин", age: 12, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-437", joinDate: "2025-12-11", origin: "regular", status: "active" },
  { id: "s438", name: "Daniel Becker", age: 12, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 75, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-438", joinDate: "2026-05-06", origin: "regular", status: "vacation" },
  { id: "s439", name: "Соня Карпова", age: 9, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-439", joinDate: "2026-03-15", origin: "regular", status: "active" },
  { id: "s440", name: "Михаил Сафронов", age: 9, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 71, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-440", joinDate: "2026-06-22", origin: "regular", status: "active" },
  { id: "s441", name: "Ксения Зайцева", age: 7, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 74, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-441", joinDate: "2025-09-12", origin: "regular", status: "active" },
  { id: "s442", name: "Богдан Никитин", age: 12, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "", phone: "+49 151 ХХ-442", joinDate: "2026-03-22", origin: "regular", status: "active" },
  { id: "s443", name: "Лена Грач", age: 17, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 77, lastNote: "", phone: "+49 151 ХХ-443", joinDate: "2026-06-17", origin: "regular", status: "active" },
  { id: "s444", name: "David Roth", age: 13, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 85, lastNote: "", phone: "+49 151 ХХ-444", joinDate: "2025-09-26", origin: "regular", status: "active" },
  { id: "s445", name: "Вика Никитина", age: 10, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 82, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-445", joinDate: "2026-05-13", origin: "regular", status: "active" },
  { id: "s446", name: "Мира Ким", age: 12, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 96, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-446", joinDate: "2026-01-25", origin: "regular", status: "active" },
  { id: "s447", name: "Дина Костина", age: 14, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 91, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-447", joinDate: "2025-12-27", origin: "regular", status: "active" },
  { id: "s448", name: "Игорь Шепель", age: 15, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 78, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-448", joinDate: "2026-02-28", origin: "regular", status: "active" },
  { id: "s449", name: "Богдан Никитин", age: 17, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Продвинутый", attendance: 90, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-449", joinDate: "2025-12-07", origin: "regular", status: "active" },
  { id: "s450", name: "Мира Ким", age: 7, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 87, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-450", joinDate: "2025-11-10", origin: "regular", status: "active" },
  { id: "s451", name: "Олег Прядко", age: 8, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 74, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-451", joinDate: "2025-09-21", origin: "regular", status: "active" },
  { id: "s452", name: "Ярослав Комаров", age: 12, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 94, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-452", joinDate: "2026-04-14", origin: "regular", status: "left", leftDate: "2026-05-31" },
  { id: "s453", name: "Олеся Орехова", age: 12, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-453", joinDate: "2025-11-07", origin: "regular", status: "vacation" },
  { id: "s454", name: "Ника Краснова", age: 8, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-454", joinDate: "2026-01-30", origin: "regular", status: "active" },
  { id: "s455", name: "Михаил Сафронов", age: 11, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 99, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-455", joinDate: "2026-04-01", origin: "regular", status: "active" },
  { id: "s456", name: "Игорь Шепель", age: 11, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 94, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-456", joinDate: "2025-11-07", origin: "regular", status: "active" },
  { id: "s457", name: "Роман Громов", age: 13, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 89, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-457", joinDate: "2026-03-07", origin: "regular", status: "active" },
  { id: "s458", name: "Daniel Becker", age: 7, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-458", joinDate: "2026-01-18", origin: "regular", status: "active" },
  { id: "s459", name: "Лиза Морозова", age: 7, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-459", joinDate: "2026-01-10", origin: "regular", status: "active" },
  { id: "s460", name: "Артём Волков", age: 11, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 92, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-460", joinDate: "2026-05-05", origin: "regular", status: "active" },
  { id: "s461", name: "София Беляева", age: 7, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 90, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-461", joinDate: "2026-01-30", origin: "regular", status: "active" },
  { id: "s462", name: "Ева Линд", age: 13, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 89, lastNote: "", phone: "+49 151 ХХ-462", joinDate: "2026-02-21", origin: "regular", status: "active" },
  { id: "s463", name: "Маша Соколова", age: 11, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 93, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-463", joinDate: "2026-04-28", origin: "regular", status: "active" },
  { id: "s464", name: "Катя Полякова", age: 16, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Продвинутый", attendance: 72, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-464", joinDate: "2025-11-12", origin: "regular", status: "active" },
  { id: "s465", name: "Роман Громов", age: 14, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-465", joinDate: "2025-12-25", origin: "regular", status: "active" },
  { id: "s466", name: "Ева Линд", age: 17, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 89, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-466", joinDate: "2026-03-23", origin: "regular", status: "active" },
  { id: "s467", name: "Jonas Schmidt", age: 13, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Продвинутый", attendance: 90, lastNote: "", phone: "+49 151 ХХ-467", joinDate: "2026-06-13", origin: "regular", status: "active" },
  { id: "s468", name: "Игорь Шепель", age: 14, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 81, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-468", joinDate: "2025-09-08", origin: "regular", status: "active" },
  { id: "s469", name: "Ева Линд", age: 14, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 78, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-469", joinDate: "2025-11-03", origin: "regular", status: "active" },
  { id: "s470", name: "Ника Краснова", age: 13, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 85, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-470", joinDate: "2026-01-13", origin: "regular", status: "active" },
  { id: "s471", name: "Lukas Weber", age: 10, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 97, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-471", joinDate: "2026-03-10", origin: "regular", status: "vacation" },
  { id: "s472", name: "Лука Семёнов", age: 8, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Продвинутый", attendance: 83, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-472", joinDate: "2025-12-29", origin: "regular", status: "active" },
  { id: "s473", name: "Кирилл Соколов", age: 8, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 94, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-473", joinDate: "2026-06-15", origin: "regular", status: "active" },
  { id: "s474", name: "Jonas Schmidt", age: 12, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 84, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-474", joinDate: "2025-10-03", origin: "regular", status: "active" },
  { id: "s475", name: "Lena Weber", age: 17, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 87, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-475", joinDate: "2026-04-26", origin: "regular", status: "active" },
  { id: "s476", name: "Klara Vogt", age: 12, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-476", joinDate: "2026-02-02", origin: "regular", status: "active" },
  { id: "s477", name: "Лена Грач", age: 15, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 70, lastNote: "", phone: "+49 151 ХХ-477", joinDate: "2025-10-30", origin: "regular", status: "active" },
  { id: "s478", name: "Mia Schmidt", age: 13, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-478", joinDate: "2025-09-20", origin: "regular", status: "active" },
  { id: "s479", name: "Дарья Тихонова", age: 10, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 73, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-479", joinDate: "2026-05-11", origin: "regular", status: "vacation" },
  { id: "s480", name: "Вера Громова", age: 10, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 94, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-480", joinDate: "2025-12-30", origin: "regular", status: "active" },
  { id: "s481", name: "Jonas Schmidt", age: 11, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 84, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-481", joinDate: "2025-11-09", origin: "regular", status: "active" },
  { id: "s482", name: "Felix Brandt", age: 14, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 95, lastNote: "", phone: "+49 151 ХХ-482", joinDate: "2026-03-09", origin: "regular", status: "active" },
  { id: "s483", name: "Роман Громов", age: 16, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 97, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-483", joinDate: "2026-06-04", origin: "regular", status: "active" },
  { id: "s484", name: "София Беляева", age: 14, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Продвинутый", attendance: 100, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-484", joinDate: "2025-11-19", origin: "regular", status: "active" },
  { id: "s485", name: "Klara Vogt", age: 13, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 70, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-485", joinDate: "2025-10-21", origin: "regular", status: "active" },
  { id: "s486", name: "Соня Карпова", age: 8, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 82, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-486", joinDate: "2026-03-28", origin: "regular", status: "active" },
  { id: "s487", name: "Лиза Морозова", age: 7, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 94, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-487", joinDate: "2026-01-22", origin: "regular", status: "left", leftDate: "2026-04-27" },
  { id: "s488", name: "Никита Краснов", age: 11, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 88, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-488", joinDate: "2025-12-21", origin: "regular", status: "active" },
  { id: "s489", name: "Mia Schmidt", age: 15, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 73, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-489", joinDate: "2025-12-30", origin: "regular", status: "active" },
  { id: "s490", name: "Лена Грач", age: 12, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 99, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-490", joinDate: "2025-10-21", origin: "regular", status: "active" },
  { id: "s491", name: "София Беляева", age: 14, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 99, lastNote: "", phone: "+49 151 ХХ-491", joinDate: "2026-03-08", origin: "regular", status: "active" },
  { id: "s492", name: "Jonas Schmidt", age: 17, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 86, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-492", joinDate: "2026-03-03", origin: "regular", status: "vacation" },
  { id: "s493", name: "София Беляева", age: 13, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 79, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-493", joinDate: "2026-01-20", origin: "regular", status: "active" },
  { id: "s494", name: "Роман Громов", age: 16, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Продвинутый", attendance: 72, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-494", joinDate: "2025-11-02", origin: "regular", status: "active" },
  { id: "s495", name: "Лука Семёнов", age: 7, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 90, lastNote: "", phone: "+49 151 ХХ-495", joinDate: "2026-04-21", origin: "regular", status: "vacation" },
  { id: "s496", name: "Mia Schmidt", age: 11, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 74, lastNote: "", phone: "+49 151 ХХ-496", joinDate: "2025-12-18", origin: "regular", status: "active" },
  { id: "s497", name: "Lena Weber", age: 9, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 81, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-497", joinDate: "2025-09-11", origin: "regular", status: "left", leftDate: "2026-03-01" },
  { id: "s498", name: "Полина Рябова", age: 11, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-498", joinDate: "2026-01-03", origin: "regular", status: "active" },
  { id: "s499", name: "Артём Волков", age: 8, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 89, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-499", joinDate: "2026-06-17", origin: "regular", status: "active" },
  { id: "s500", name: "Игорь Шепель", age: 16, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 63, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-500", joinDate: "2026-06-11", origin: "promo", status: "active" },
  { id: "s501", name: "Макс Орлов", age: 10, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 92, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-501", joinDate: "2025-12-29", origin: "regular", status: "active" },
  { id: "s502", name: "Полина Рябова", age: 10, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 84, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-502", joinDate: "2025-11-15", origin: "regular", status: "active" },
  { id: "s503", name: "Кирилл Соколов", age: 9, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 82, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-503", joinDate: "2025-09-02", origin: "regular", status: "active" },
  { id: "s504", name: "Никита Краснов", age: 14, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Продвинутый", attendance: 73, lastNote: "", phone: "+49 151 ХХ-504", joinDate: "2025-11-14", origin: "regular", status: "active" },
  { id: "s505", name: "Алина Фролова", age: 8, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 88, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-505", joinDate: "2026-06-04", origin: "promo", status: "active" },
  { id: "s506", name: "Денис Кузнецов", age: 13, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 88, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-506", joinDate: "2025-09-14", origin: "regular", status: "active" },
  { id: "s507", name: "Катя Полякова", age: 11, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 73, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-507", joinDate: "2026-03-03", origin: "regular", status: "active" },
  { id: "s508", name: "Юля Зуева", age: 7, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 94, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-508", joinDate: "2025-12-31", origin: "regular", status: "active" },
  { id: "s509", name: "Lukas Weber", age: 14, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 92, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-509", joinDate: "2025-09-09", origin: "regular", status: "active" },
  { id: "s510", name: "Ксения Зайцева", age: 7, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 98, lastNote: "", phone: "+49 151 ХХ-510", joinDate: "2025-09-27", origin: "regular", status: "active" },
  { id: "s511", name: "Олег Прядко", age: 8, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 94, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-511", flag: "injury", joinDate: "2026-04-04", origin: "regular", status: "active" },
  { id: "s512", name: "Марк Гусев", age: 16, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Продвинутый", attendance: 86, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-512", joinDate: "2025-10-03", origin: "regular", status: "active" },
  { id: "s513", name: "Мира Ким", age: 7, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 78, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-513", joinDate: "2026-03-05", origin: "regular", status: "active" },
  { id: "s514", name: "Мира Ким", age: 13, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 76, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-514", flag: "injury", joinDate: "2025-10-26", origin: "regular", status: "active" },
  { id: "s515", name: "Александр Беляков", age: 10, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 91, lastNote: "", phone: "+49 151 ХХ-515", joinDate: "2025-12-23", origin: "regular", status: "active" },
  { id: "s516", name: "Юля Зуева", age: 13, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 98, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-516", joinDate: "2025-09-23", origin: "regular", status: "active" },
  { id: "s517", name: "Полина Рябова", age: 16, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-517", joinDate: "2026-05-25", origin: "regular", status: "active" },
  { id: "s518", name: "Марк Гусев", age: 14, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Продвинутый", attendance: 87, lastNote: "", phone: "+49 151 ХХ-518", joinDate: "2025-09-16", origin: "regular", status: "vacation" },
  { id: "s519", name: "Ярослав Комаров", age: 14, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 95, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-519", joinDate: "2026-05-04", origin: "regular", status: "active" },
  { id: "s520", name: "Lena Weber", age: 8, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 68, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-520", joinDate: "2026-04-07", origin: "regular", status: "active" },
  { id: "s521", name: "Тимур Беляев", age: 8, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 96, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-521", joinDate: "2026-05-10", origin: "regular", status: "active" },
  { id: "s522", name: "Артём Волков", age: 10, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 80, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-522", joinDate: "2026-04-16", origin: "regular", status: "vacation" },
  { id: "s523", name: "Аня Светлова", age: 7, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 79, lastNote: "", phone: "+49 151 ХХ-523", joinDate: "2025-10-12", origin: "regular", status: "active" },
  { id: "s524", name: "Артём Волков", age: 13, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-524", joinDate: "2025-11-15", origin: "regular", status: "vacation" },
  { id: "s525", name: "Марк Гусев", age: 16, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 91, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-525", joinDate: "2026-01-19", origin: "regular", status: "active" },
  { id: "s526", name: "Юля Зуева", age: 10, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 94, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-526", joinDate: "2026-06-27", origin: "promo", status: "active" },
  { id: "s527", name: "Аня Светлова", age: 15, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 88, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-527", joinDate: "2026-05-30", origin: "regular", status: "active" },
  { id: "s528", name: "Кирилл Соколов", age: 8, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-528", joinDate: "2026-04-09", origin: "regular", status: "vacation" },
  { id: "s529", name: "Алина Фролова", age: 12, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Продвинутый", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-529", joinDate: "2025-10-29", origin: "regular", status: "active" },
  { id: "s530", name: "Андрей Поляков", age: 16, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 89, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-530", joinDate: "2026-06-10", origin: "promo", status: "active" },
  { id: "s531", name: "Аня Светлова", age: 10, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 89, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-531", joinDate: "2026-04-20", origin: "regular", status: "active" },
  { id: "s532", name: "Felix Brandt", age: 9, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 93, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-532", joinDate: "2026-03-31", origin: "regular", status: "active" },
  { id: "s533", name: "Андрей Поляков", age: 14, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-533", flag: "injury", joinDate: "2026-04-21", origin: "regular", status: "active" },
  { id: "s534", name: "Олеся Орехова", age: 9, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Продвинутый", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-534", joinDate: "2025-10-19", origin: "regular", status: "active" },
  { id: "s535", name: "Артём Волков", age: 10, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 95, lastNote: "", phone: "+49 151 ХХ-535", joinDate: "2026-02-08", origin: "regular", status: "active" },
  { id: "s536", name: "Глеб Воронин", age: 15, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-536", joinDate: "2026-03-11", origin: "regular", status: "active" },
  { id: "s537", name: "Андрей Поляков", age: 11, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 74, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-537", joinDate: "2026-05-01", origin: "regular", status: "vacation" },
  { id: "s538", name: "Lena Weber", age: 15, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 84, lastNote: "", phone: "+49 151 ХХ-538", joinDate: "2025-10-14", origin: "regular", status: "vacation" },
  { id: "s539", name: "София Беляева", age: 9, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-539", joinDate: "2025-10-20", origin: "regular", status: "active" },
  { id: "s540", name: "София Беляева", age: 17, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 89, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-540", joinDate: "2026-03-10", origin: "regular", status: "active" },
  { id: "s541", name: "Богдан Никитин", age: 14, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Продвинутый", attendance: 83, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-541", joinDate: "2026-06-12", origin: "regular", status: "left", leftDate: "2026-06-23" },
  { id: "s542", name: "Артём Волков", age: 9, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 89, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-542", joinDate: "2025-11-02", origin: "regular", status: "active" },
  { id: "s543", name: "Глеб Воронин", age: 8, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 78, lastNote: "", phone: "+49 151 ХХ-543", joinDate: "2026-04-05", origin: "regular", status: "active" },
  { id: "s544", name: "Аня Светлова", age: 12, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 92, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-544", joinDate: "2025-09-27", origin: "regular", status: "active" },
  { id: "s545", name: "Катя Полякова", age: 7, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 82, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-545", joinDate: "2026-02-07", origin: "regular", status: "active" },
  { id: "s546", name: "David Roth", age: 10, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 84, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-546", joinDate: "2026-06-23", origin: "promo", status: "active" },
  { id: "s547", name: "Денис Кузнецов", age: 14, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 77, lastNote: "", phone: "+49 151 ХХ-547", joinDate: "2026-05-05", origin: "regular", status: "active" },
  { id: "s548", name: "Роман Громов", age: 17, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-548", joinDate: "2025-10-26", origin: "regular", status: "active" },
  { id: "s549", name: "Олеся Орехова", age: 17, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Продвинутый", attendance: 79, lastNote: "", phone: "+49 151 ХХ-549", joinDate: "2026-06-12", origin: "regular", status: "active" },
  { id: "s550", name: "Ксения Зайцева", age: 16, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 81, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-550", joinDate: "2026-06-21", origin: "promo", status: "active" },
  { id: "s551", name: "Лука Семёнов", age: 10, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-551", joinDate: "2026-06-15", origin: "regular", status: "active" },
  { id: "s552", name: "Александр Беляков", age: 8, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Продвинутый", attendance: 88, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-552", flag: "injury", joinDate: "2026-06-13", origin: "regular", status: "left", leftDate: "2026-06-27" },
  { id: "s553", name: "Felix Brandt", age: 7, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 72, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-553", joinDate: "2026-01-15", origin: "regular", status: "left", leftDate: "2026-03-26" },
  { id: "s554", name: "Felix Brandt", age: 16, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 91, lastNote: "", phone: "+49 151 ХХ-554", joinDate: "2026-02-06", origin: "regular", status: "active" },
  { id: "s555", name: "Ксения Зайцева", age: 14, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 97, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-555", joinDate: "2026-02-27", origin: "regular", status: "left", leftDate: "2026-06-19" },
  { id: "s556", name: "Роман Громов", age: 10, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-556", joinDate: "2025-11-13", origin: "regular", status: "active" },
  { id: "s557", name: "Артём Волков", age: 16, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "", phone: "+49 151 ХХ-557", joinDate: "2026-03-25", origin: "regular", status: "vacation" },
  { id: "s558", name: "Никита Краснов", age: 17, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 87, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-558", joinDate: "2025-09-16", origin: "regular", status: "vacation" },
  { id: "s559", name: "Макс Орлов", age: 7, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 91, lastNote: "", phone: "+49 151 ХХ-559", joinDate: "2026-05-30", origin: "promo", status: "active" },
  { id: "s560", name: "Михаил Сафронов", age: 17, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Продвинутый", attendance: 95, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-560", joinDate: "2026-02-22", origin: "regular", status: "active" },
  { id: "s561", name: "Lukas Weber", age: 13, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 89, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-561", joinDate: "2026-02-07", origin: "regular", status: "active" },
  { id: "s562", name: "Олег Прядко", age: 16, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-562", joinDate: "2026-06-18", origin: "regular", status: "active" },
  { id: "s563", name: "Юля Зуева", age: 7, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 85, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-563", joinDate: "2025-11-19", origin: "regular", status: "active" },
  { id: "s564", name: "Соня Карпова", age: 15, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Продвинутый", attendance: 91, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-564", joinDate: "2025-09-26", origin: "regular", status: "active" },
  { id: "s565", name: "Александр Беляков", age: 11, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 97, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-565", joinDate: "2026-01-18", origin: "regular", status: "active" },
  { id: "s566", name: "Иван Жуков", age: 16, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-566", joinDate: "2026-04-06", origin: "regular", status: "active" },
  { id: "s567", name: "Катя Полякова", age: 8, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 77, lastNote: "", phone: "+49 151 ХХ-567", joinDate: "2026-04-15", origin: "regular", status: "active" },
  { id: "s568", name: "Мира Ким", age: 16, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 79, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-568", joinDate: "2025-12-20", origin: "regular", status: "active" },
  { id: "s569", name: "Лука Семёнов", age: 15, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Продвинутый", attendance: 88, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-569", joinDate: "2025-10-29", origin: "regular", status: "active" },
  { id: "s570", name: "Соня Карпова", age: 14, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-570", joinDate: "2025-10-27", origin: "regular", status: "active" },
  { id: "s571", name: "Андрей Поляков", age: 16, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 82, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-571", joinDate: "2026-05-08", origin: "regular", status: "active" },
  { id: "s572", name: "Дарья Тихонова", age: 13, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 88, lastNote: "", phone: "+49 151 ХХ-572", joinDate: "2026-02-05", origin: "regular", status: "left", leftDate: "2026-05-18" },
  { id: "s573", name: "Катя Полякова", age: 12, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Продвинутый", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-573", joinDate: "2025-09-29", origin: "regular", status: "left", leftDate: "2026-03-03" },
  { id: "s574", name: "Felix Brandt", age: 11, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 87, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-574", joinDate: "2025-12-18", origin: "regular", status: "active" },
  { id: "s575", name: "Вера Громова", age: 9, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 82, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-575", joinDate: "2026-01-09", origin: "regular", status: "active" },
  { id: "s576", name: "Соня Карпова", age: 13, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 71, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-576", joinDate: "2025-11-01", origin: "regular", status: "left", leftDate: "2026-05-12" },
  { id: "s577", name: "Дарья Тихонова", age: 17, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 84, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-577", joinDate: "2026-04-09", origin: "regular", status: "active" },
  { id: "s578", name: "Лиза Морозова", age: 11, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 82, lastNote: "", phone: "+49 151 ХХ-578", joinDate: "2026-03-14", origin: "regular", status: "active" },
  { id: "s579", name: "Макс Орлов", age: 8, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 88, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-579", joinDate: "2025-12-27", origin: "regular", status: "active" },
  { id: "s580", name: "Klara Vogt", age: 17, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 90, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-580", joinDate: "2026-03-01", origin: "regular", status: "vacation" },
  { id: "s581", name: "Daniel Becker", age: 13, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 81, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-581", joinDate: "2025-09-22", origin: "regular", status: "active" },
  { id: "s582", name: "Anna Roth", age: 7, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Продвинутый", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-582", joinDate: "2026-04-24", origin: "regular", status: "active" },
  { id: "s583", name: "Lena Weber", age: 8, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 92, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-583", joinDate: "2026-02-08", origin: "regular", status: "active" },
  { id: "s584", name: "Лена Грач", age: 12, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 84, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-584", joinDate: "2026-06-21", origin: "regular", status: "active" },
  { id: "s585", name: "Юля Зуева", age: 16, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 80, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-585", joinDate: "2026-01-27", origin: "regular", status: "vacation" },
  { id: "s586", name: "Тимур Беляев", age: 13, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-586", joinDate: "2025-09-11", origin: "regular", status: "active" },
  { id: "s587", name: "Sofia Becker", age: 12, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 95, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-587", joinDate: "2025-11-27", origin: "regular", status: "active" },
  { id: "s588", name: "Sofia Becker", age: 13, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 84, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-588", joinDate: "2026-04-24", origin: "regular", status: "active" },
  { id: "s589", name: "Лиза Морозова", age: 13, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 86, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-589", joinDate: "2026-03-05", origin: "regular", status: "vacation" },
  { id: "s590", name: "Юля Зуева", age: 9, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 95, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-590", joinDate: "2025-10-25", origin: "regular", status: "active" },
  { id: "s591", name: "Маша Соколова", age: 14, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 86, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-591", joinDate: "2026-03-25", origin: "regular", status: "active" },
  { id: "s592", name: "Дина Костина", age: 14, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 87, lastNote: "", phone: "+49 151 ХХ-592", joinDate: "2026-03-22", origin: "regular", status: "active" },
  { id: "s593", name: "Лука Семёнов", age: 17, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 86, lastNote: "", phone: "+49 151 ХХ-593", joinDate: "2026-02-21", origin: "regular", status: "active" },
  { id: "s594", name: "Ника Краснова", age: 11, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 84, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-594", joinDate: "2025-11-26", origin: "regular", status: "vacation" },
  { id: "s595", name: "Кирилл Мельник", age: 17, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "", phone: "+49 151 ХХ-595", joinDate: "2025-10-29", origin: "regular", status: "active" },
  { id: "s596", name: "David Roth", age: 9, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 80, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-596", joinDate: "2025-12-09", origin: "regular", status: "active" },
  { id: "s597", name: "Марк Гусев", age: 7, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 89, lastNote: "", phone: "+49 151 ХХ-597", joinDate: "2026-02-26", origin: "regular", status: "active" },
  { id: "s598", name: "Felix Brandt", age: 14, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 68, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-598", joinDate: "2025-11-15", origin: "regular", status: "active" },
  { id: "s599", name: "Дина Костина", age: 7, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-599", joinDate: "2025-11-14", origin: "regular", status: "active" },
  { id: "s600", name: "Юля Зуева", age: 13, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 85, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-600", joinDate: "2025-11-28", origin: "regular", status: "active" },
  { id: "s601", name: "Олег Прядко", age: 17, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-601", flag: "injury", joinDate: "2025-10-09", origin: "regular", status: "active" },
  { id: "s602", name: "Настя Гусева", age: 11, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 88, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-602", joinDate: "2026-05-11", origin: "regular", status: "active" },
  { id: "s603", name: "Дарья Тихонова", age: 7, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 86, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-603", joinDate: "2026-06-16", origin: "promo", status: "active" },
  { id: "s604", name: "Кирилл Мельник", age: 17, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Продвинутый", attendance: 80, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-604", joinDate: "2026-06-17", origin: "regular", status: "active" },
  { id: "s605", name: "Дарья Тихонова", age: 17, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 93, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-605", joinDate: "2026-02-13", origin: "regular", status: "active" },
  { id: "s606", name: "Александр Беляков", age: 16, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 79, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-606", joinDate: "2026-02-09", origin: "regular", status: "active" },
  { id: "s607", name: "Anna Roth", age: 14, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 81, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-607", joinDate: "2025-10-05", origin: "regular", status: "active" },
  { id: "s608", name: "Соня Карпова", age: 17, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "", phone: "+49 151 ХХ-608", joinDate: "2026-02-03", origin: "regular", status: "active" },
  { id: "s609", name: "Богдан Никитин", age: 9, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 98, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-609", joinDate: "2025-09-29", origin: "regular", status: "active" },
  { id: "s610", name: "Ева Линд", age: 9, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Продвинутый", attendance: 83, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-610", joinDate: "2025-10-08", origin: "regular", status: "active" },
  { id: "s611", name: "Юля Зуева", age: 14, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-611", joinDate: "2026-04-20", origin: "regular", status: "left", leftDate: "2026-06-07" },
  { id: "s612", name: "Дарья Тихонова", age: 9, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Продвинутый", attendance: 91, lastNote: "", phone: "+49 151 ХХ-612", joinDate: "2026-01-25", origin: "regular", status: "vacation" },
  { id: "s613", name: "Глеб Воронин", age: 8, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 85, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-613", joinDate: "2025-10-17", origin: "regular", status: "active" },
  { id: "s614", name: "David Roth", age: 8, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Продвинутый", attendance: 86, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-614", joinDate: "2026-05-18", origin: "regular", status: "active" },
  { id: "s615", name: "Ксения Зайцева", age: 8, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Продвинутый", attendance: 84, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-615", joinDate: "2025-09-22", origin: "regular", status: "active" },
  { id: "s616", name: "Anna Roth", age: 14, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 84, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-616", joinDate: "2026-06-20", origin: "promo", status: "active" },
  { id: "s617", name: "Ярослав Комаров", age: 10, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 88, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-617", joinDate: "2026-05-02", origin: "regular", status: "active" },
  { id: "s618", name: "Андрей Поляков", age: 17, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 92, lastNote: "", phone: "+49 151 ХХ-618", joinDate: "2025-10-02", origin: "regular", status: "active" },
  { id: "s619", name: "Дина Костина", age: 14, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 99, lastNote: "", phone: "+49 151 ХХ-619", joinDate: "2026-02-23", origin: "regular", status: "active" },
  { id: "s620", name: "Дарья Тихонова", age: 14, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Продвинутый", attendance: 100, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-620", joinDate: "2025-10-14", origin: "regular", status: "active" },
  { id: "s621", name: "София Беляева", age: 17, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 86, lastNote: "", phone: "+49 151 ХХ-621", joinDate: "2025-11-28", origin: "regular", status: "left", leftDate: "2026-05-29" },
  { id: "s622", name: "Лиза Морозова", age: 11, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 74, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-622", joinDate: "2026-04-13", origin: "regular", status: "active" },
  { id: "s623", name: "David Roth", age: 11, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Продвинутый", attendance: 99, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-623", joinDate: "2026-05-27", origin: "promo", status: "active" },
  { id: "s624", name: "Ксения Зайцева", age: 7, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-624", joinDate: "2026-03-10", origin: "regular", status: "active" },
  { id: "s625", name: "Ника Краснова", age: 8, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 89, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-625", joinDate: "2026-03-18", origin: "regular", status: "active" },
  { id: "s626", name: "Алина Фролова", age: 16, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 94, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-626", joinDate: "2026-02-21", origin: "regular", status: "active" },
  { id: "s627", name: "Klara Vogt", age: 15, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 89, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-627", joinDate: "2025-09-27", origin: "regular", status: "active" },
  { id: "s628", name: "Klara Vogt", age: 9, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 81, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-628", joinDate: "2026-02-19", origin: "regular", status: "vacation" },
  { id: "s629", name: "Настя Гусева", age: 12, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 93, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-629", joinDate: "2025-10-19", origin: "regular", status: "active" },
  { id: "s630", name: "Полина Рябова", age: 13, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 90, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-630", joinDate: "2026-03-17", origin: "regular", status: "active" },
  { id: "s631", name: "Лена Грач", age: 17, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-631", joinDate: "2025-11-16", origin: "regular", status: "active" },
  { id: "s632", name: "Михаил Сафронов", age: 9, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Продвинутый", attendance: 80, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-632", joinDate: "2026-06-26", origin: "regular", status: "active" },
  { id: "s633", name: "Anna Roth", age: 8, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 91, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-633", joinDate: "2026-02-06", origin: "regular", status: "active" },
  { id: "s634", name: "Ярослав Комаров", age: 13, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 76, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-634", joinDate: "2026-03-20", origin: "regular", status: "active" },
  { id: "s635", name: "Тимур Беляев", age: 8, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 94, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-635", joinDate: "2025-10-14", origin: "regular", status: "active" },
  { id: "s636", name: "Марк Гусев", age: 9, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 86, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-636", joinDate: "2026-03-12", origin: "regular", status: "active" },
  { id: "s637", name: "Макс Орлов", age: 13, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-637", joinDate: "2026-02-16", origin: "regular", status: "active" },
  { id: "s638", name: "Артём Волков", age: 15, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 93, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-638", joinDate: "2026-05-28", origin: "regular", status: "vacation" },
  { id: "s639", name: "Александр Беляков", age: 16, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 73, lastNote: "", phone: "+49 151 ХХ-639", joinDate: "2026-05-19", origin: "promo", status: "active" },
  { id: "s640", name: "Ярослав Комаров", age: 11, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Продвинутый", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-640", joinDate: "2025-12-02", origin: "regular", status: "active" },
  { id: "s641", name: "Соня Карпова", age: 17, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 94, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-641", joinDate: "2026-02-22", origin: "regular", status: "active" },
  { id: "s642", name: "Артём Волков", age: 16, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 87, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-642", joinDate: "2026-05-07", origin: "regular", status: "active" },
  { id: "s643", name: "Глеб Воронин", age: 17, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 79, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-643", joinDate: "2025-11-10", origin: "regular", status: "active" },
  { id: "s644", name: "Александр Беляков", age: 8, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 80, lastNote: "", phone: "+49 151 ХХ-644", joinDate: "2026-01-30", origin: "regular", status: "active" },
  { id: "s645", name: "Степан Морозов", age: 9, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 77, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-645", joinDate: "2025-10-22", origin: "regular", status: "active" },
  { id: "s646", name: "Глеб Воронин", age: 8, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Продвинутый", attendance: 88, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-646", joinDate: "2026-06-04", origin: "regular", status: "active" },
  { id: "s647", name: "Настя Гусева", age: 10, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 83, lastNote: "", phone: "+49 151 ХХ-647", joinDate: "2025-09-20", origin: "regular", status: "active" },
  { id: "s648", name: "Anna Roth", age: 8, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-648", joinDate: "2025-11-07", origin: "regular", status: "active" },
  { id: "s649", name: "Ксения Зайцева", age: 8, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 99, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-649", joinDate: "2025-11-18", origin: "regular", status: "active" },
  { id: "s650", name: "Jonas Schmidt", age: 12, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 90, lastNote: "", phone: "+49 151 ХХ-650", joinDate: "2025-11-24", origin: "regular", status: "active" },
  { id: "s651", name: "Катя Полякова", age: 12, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Продвинутый", attendance: 87, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-651", joinDate: "2025-09-23", origin: "regular", status: "active" },
  { id: "s652", name: "Klara Vogt", age: 14, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 94, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-652", joinDate: "2025-12-31", origin: "regular", status: "active" },
  { id: "s653", name: "Лиза Морозова", age: 8, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Продвинутый", attendance: 82, lastNote: "", phone: "+49 151 ХХ-653", joinDate: "2026-01-24", origin: "regular", status: "active" },
  { id: "s654", name: "Mia Schmidt", age: 13, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 94, lastNote: "", phone: "+49 151 ХХ-654", joinDate: "2026-04-18", origin: "regular", status: "active" },
  { id: "s655", name: "Игорь Шепель", age: 10, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 75, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-655", joinDate: "2026-01-01", origin: "regular", status: "active" },
  { id: "s656", name: "Макс Орлов", age: 7, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 80, lastNote: "", phone: "+49 151 ХХ-656", joinDate: "2026-04-29", origin: "regular", status: "active" },
  { id: "s657", name: "Полина Рябова", age: 9, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 92, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-657", joinDate: "2025-12-09", origin: "regular", status: "active" },
  { id: "s658", name: "Полина Рябова", age: 8, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Продвинутый", attendance: 88, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-658", joinDate: "2026-06-20", origin: "regular", status: "active" },
  { id: "s659", name: "Игорь Шепель", age: 8, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 82, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-659", joinDate: "2026-01-23", origin: "regular", status: "active" },
  { id: "s660", name: "Соня Карпова", age: 15, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 90, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-660", joinDate: "2026-05-16", origin: "regular", status: "active" },
  { id: "s661", name: "Ника Краснова", age: 7, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 95, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-661", joinDate: "2025-12-12", origin: "regular", status: "active" },
  { id: "s662", name: "Кирилл Соколов", age: 16, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 68, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-662", joinDate: "2025-11-10", origin: "regular", status: "active" },
  { id: "s663", name: "Lena Weber", age: 8, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Продвинутый", attendance: 94, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-663", joinDate: "2025-09-27", origin: "regular", status: "active" },
  { id: "s664", name: "David Roth", age: 8, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Продвинутый", attendance: 91, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-664", joinDate: "2026-03-10", origin: "regular", status: "active" },
  { id: "s665", name: "Алина Фролова", age: 16, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Продвинутый", attendance: 91, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-665", joinDate: "2025-10-23", origin: "regular", status: "active" },
  { id: "s666", name: "Макс Орлов", age: 15, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Продвинутый", attendance: 84, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-666", flag: "injury", joinDate: "2026-05-23", origin: "promo", status: "active" },
  { id: "s667", name: "Вика Никитина", age: 9, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-667", joinDate: "2025-11-22", origin: "regular", status: "active" },
  { id: "s668", name: "Макс Орлов", age: 15, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 99, lastNote: "", phone: "+49 151 ХХ-668", joinDate: "2026-05-21", origin: "promo", status: "active" },
  { id: "s669", name: "Klara Vogt", age: 13, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 85, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-669", joinDate: "2025-12-23", origin: "regular", status: "active" },
  { id: "s670", name: "Артём Волков", age: 10, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 93, lastNote: "", phone: "+49 151 ХХ-670", joinDate: "2026-02-26", origin: "regular", status: "active" },
  { id: "s671", name: "Алина Фролова", age: 16, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 93, lastNote: "", phone: "+49 151 ХХ-671", joinDate: "2026-04-01", origin: "regular", status: "left", leftDate: "2026-06-05" },
  { id: "s672", name: "Ева Линд", age: 11, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 80, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-672", flag: "injury", joinDate: "2026-03-11", origin: "regular", status: "active" },
  { id: "s673", name: "Денис Кузнецов", age: 10, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Продвинутый", attendance: 82, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-673", joinDate: "2025-10-12", origin: "regular", status: "active" },
  { id: "s674", name: "Денис Кузнецов", age: 7, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 75, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-674", joinDate: "2025-09-15", origin: "regular", status: "active" },
  { id: "s675", name: "Игорь Шепель", age: 7, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Продвинутый", attendance: 92, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-675", joinDate: "2025-10-21", origin: "regular", status: "active" },
  { id: "s676", name: "Богдан Никитин", age: 12, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 96, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-676", joinDate: "2026-02-19", origin: "regular", status: "active" },
  { id: "s677", name: "Дарья Тихонова", age: 12, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 89, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-677", joinDate: "2025-11-10", origin: "regular", status: "left", leftDate: "2026-06-11" },
  { id: "s678", name: "Никита Краснов", age: 7, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-678", joinDate: "2026-04-30", origin: "regular", status: "active" },
  { id: "s679", name: "Игорь Шепель", age: 7, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 94, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-679", joinDate: "2025-11-11", origin: "regular", status: "active" },
  { id: "s680", name: "Настя Гусева", age: 15, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 90, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-680", joinDate: "2026-04-29", origin: "regular", status: "active" },
  { id: "s681", name: "Олег Прядко", age: 12, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 87, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-681", joinDate: "2025-09-03", origin: "regular", status: "active" },
  { id: "s682", name: "Игорь Шепель", age: 11, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 73, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-682", joinDate: "2025-09-10", origin: "regular", status: "active" },
  { id: "s683", name: "Вика Никитина", age: 16, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 80, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-683", joinDate: "2025-11-16", origin: "regular", status: "active" },
  { id: "s684", name: "Mia Schmidt", age: 15, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 97, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-684", joinDate: "2026-05-29", origin: "regular", status: "active" },
  { id: "s685", name: "Лука Семёнов", age: 14, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Продвинутый", attendance: 97, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-685", joinDate: "2025-12-31", origin: "regular", status: "active" },
  { id: "s686", name: "Лиза Морозова", age: 10, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Продвинутый", attendance: 86, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-686", joinDate: "2025-09-25", origin: "regular", status: "active" },
  { id: "s687", name: "Лука Семёнов", age: 7, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 86, lastNote: "", phone: "+49 151 ХХ-687", joinDate: "2026-04-23", origin: "regular", status: "vacation" },
  { id: "s688", name: "Jonas Schmidt", age: 13, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 95, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-688", joinDate: "2026-05-14", origin: "promo", status: "active" },
  { id: "s689", name: "Алина Фролова", age: 9, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 86, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-689", joinDate: "2026-05-22", origin: "regular", status: "active" },
  { id: "s690", name: "Lena Weber", age: 8, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 99, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-690", joinDate: "2026-01-28", origin: "regular", status: "active" },
  { id: "s691", name: "Ева Линд", age: 10, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Продвинутый", attendance: 94, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-691", joinDate: "2026-02-28", origin: "regular", status: "active" },
  { id: "s692", name: "Аня Светлова", age: 14, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "", phone: "+49 151 ХХ-692", joinDate: "2026-04-02", origin: "regular", status: "active" },
  { id: "s693", name: "Богдан Никитин", age: 11, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Продвинутый", attendance: 95, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-693", joinDate: "2025-10-14", origin: "regular", status: "active" },
  { id: "s694", name: "Богдан Никитин", age: 11, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 91, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-694", joinDate: "2026-03-04", origin: "regular", status: "vacation" },
  { id: "s695", name: "Lukas Weber", age: 12, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 89, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-695", joinDate: "2026-05-28", origin: "regular", status: "active" },
  { id: "s696", name: "Кирилл Мельник", age: 13, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-696", joinDate: "2026-05-18", origin: "promo", status: "active" },
  { id: "s697", name: "Алина Фролова", age: 15, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 89, lastNote: "", phone: "+49 151 ХХ-697", joinDate: "2026-04-29", origin: "regular", status: "left", leftDate: "2026-05-24" },
  { id: "s698", name: "София Беляева", age: 13, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 93, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-698", joinDate: "2026-03-11", origin: "regular", status: "active" },
  { id: "s699", name: "Иван Жуков", age: 8, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 80, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-699", joinDate: "2025-09-09", origin: "regular", status: "active" },
  { id: "s700", name: "Никита Краснов", age: 8, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 79, lastNote: "", phone: "+49 151 ХХ-700", joinDate: "2025-10-05", origin: "regular", status: "active" },
  { id: "s701", name: "Мира Ким", age: 11, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 73, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-701", flag: "injury", joinDate: "2025-10-24", origin: "regular", status: "active" },
  { id: "s702", name: "Юля Зуева", age: 15, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Продвинутый", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-702", joinDate: "2026-02-18", origin: "regular", status: "active" },
  { id: "s703", name: "Маша Соколова", age: 11, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 87, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-703", joinDate: "2026-02-28", origin: "regular", status: "active" },
  { id: "s704", name: "Никита Краснов", age: 14, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Продвинутый", attendance: 95, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-704", joinDate: "2025-11-29", origin: "regular", status: "active" },
  { id: "s705", name: "Daniel Becker", age: 15, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 93, lastNote: "", phone: "+49 151 ХХ-705", joinDate: "2026-04-26", origin: "regular", status: "active" },
  { id: "s706", name: "Марк Гусев", age: 14, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 73, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-706", joinDate: "2026-05-04", origin: "regular", status: "active" },
  { id: "s707", name: "Кирилл Соколов", age: 17, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Продвинутый", attendance: 92, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-707", joinDate: "2025-11-09", origin: "regular", status: "vacation" },
  { id: "s708", name: "Klara Vogt", age: 13, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Продвинутый", attendance: 93, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-708", joinDate: "2026-04-23", origin: "regular", status: "left", leftDate: "2026-05-19" },
  { id: "s709", name: "Лена Грач", age: 16, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 86, lastNote: "", phone: "+49 151 ХХ-709", joinDate: "2025-09-23", origin: "regular", status: "active" },
  { id: "s710", name: "Кирилл Соколов", age: 14, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 79, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-710", joinDate: "2025-09-22", origin: "regular", status: "active" },
  { id: "s711", name: "Ксения Зайцева", age: 10, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-711", joinDate: "2026-02-06", origin: "regular", status: "active" },
  { id: "s712", name: "Тимур Беляев", age: 7, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 83, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-712", joinDate: "2026-06-06", origin: "promo", status: "active" },
  { id: "s713", name: "David Roth", age: 7, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 94, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-713", joinDate: "2025-12-07", origin: "regular", status: "active" },
  { id: "s714", name: "Lena Weber", age: 15, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 93, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-714", joinDate: "2025-09-25", origin: "regular", status: "active" },
  { id: "s715", name: "Lukas Weber", age: 10, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 97, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-715", joinDate: "2026-02-17", origin: "regular", status: "active" },
  { id: "s716", name: "Александр Беляков", age: 10, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 76, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-716", joinDate: "2026-03-08", origin: "regular", status: "active" },
  { id: "s717", name: "Mia Schmidt", age: 15, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 97, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-717", joinDate: "2026-03-24", origin: "regular", status: "active" },
  { id: "s718", name: "София Беляева", age: 16, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 84, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-718", joinDate: "2026-03-17", origin: "regular", status: "active" },
  { id: "s719", name: "Иван Жуков", age: 13, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 86, lastNote: "", phone: "+49 151 ХХ-719", joinDate: "2025-12-05", origin: "regular", status: "active" },
  { id: "s720", name: "Михаил Сафронов", age: 9, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-720", flag: "injury", joinDate: "2026-05-13", origin: "regular", status: "active" },
  { id: "s721", name: "Дина Костина", age: 14, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 75, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-721", joinDate: "2026-05-24", origin: "promo", status: "active" },
  { id: "s722", name: "Anna Roth", age: 13, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "", phone: "+49 151 ХХ-722", joinDate: "2026-04-06", origin: "regular", status: "vacation" },
  { id: "s723", name: "Юля Зуева", age: 15, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 79, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-723", joinDate: "2025-12-02", origin: "regular", status: "active" },
  { id: "s724", name: "Михаил Сафронов", age: 9, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-724", joinDate: "2026-02-12", origin: "regular", status: "vacation" },
  { id: "s725", name: "Mia Schmidt", age: 12, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 77, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-725", joinDate: "2026-02-15", origin: "regular", status: "active" },
  { id: "s726", name: "Катя Полякова", age: 17, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 98, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-726", joinDate: "2026-02-04", origin: "regular", status: "active" },
  { id: "s727", name: "Вика Никитина", age: 14, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 83, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-727", joinDate: "2026-04-07", origin: "regular", status: "active" },
  { id: "s728", name: "Мира Ким", age: 14, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-728", joinDate: "2026-04-16", origin: "regular", status: "active" },
  { id: "s729", name: "Anna Roth", age: 14, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 86, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-729", joinDate: "2025-09-22", origin: "regular", status: "active" },
  { id: "s730", name: "Ника Краснова", age: 17, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 92, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-730", flag: "injury", joinDate: "2026-02-28", origin: "regular", status: "active" },
  { id: "s731", name: "Вика Никитина", age: 9, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 90, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-731", joinDate: "2026-04-11", origin: "regular", status: "active" },
  { id: "s732", name: "Тимур Беляев", age: 16, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 65, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-732", joinDate: "2025-09-30", origin: "regular", status: "vacation" },
  { id: "s733", name: "Степан Морозов", age: 7, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Продвинутый", attendance: 65, lastNote: "", phone: "+49 151 ХХ-733", flag: "injury", joinDate: "2026-03-27", origin: "regular", status: "active" },
  { id: "s734", name: "Катя Полякова", age: 16, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 82, lastNote: "", phone: "+49 151 ХХ-734", joinDate: "2025-11-21", origin: "regular", status: "active" },
  { id: "s735", name: "Марк Гусев", age: 15, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 82, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-735", joinDate: "2025-11-13", origin: "regular", status: "active" },
  { id: "s736", name: "Богдан Никитин", age: 15, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 86, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-736", flag: "injury", joinDate: "2026-04-13", origin: "regular", status: "left", leftDate: "2026-04-22" },
  { id: "s737", name: "Аня Светлова", age: 8, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 94, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-737", joinDate: "2025-12-30", origin: "regular", status: "active" },
  { id: "s738", name: "Anna Roth", age: 9, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 79, lastNote: "", phone: "+49 151 ХХ-738", joinDate: "2026-03-07", origin: "regular", status: "active" },
  { id: "s739", name: "Ксения Зайцева", age: 13, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 76, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-739", joinDate: "2026-06-18", origin: "promo", status: "left", leftDate: "2026-06-26" },
  { id: "s740", name: "Маша Соколова", age: 8, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 88, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-740", joinDate: "2026-03-09", origin: "regular", status: "active" },
  { id: "s741", name: "Ксения Зайцева", age: 17, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 73, lastNote: "", phone: "+49 151 ХХ-741", joinDate: "2025-10-10", origin: "regular", status: "active" },
  { id: "s742", name: "David Roth", age: 15, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 83, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-742", joinDate: "2026-05-30", origin: "promo", status: "active" },
  { id: "s743", name: "Артём Волков", age: 16, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Продвинутый", attendance: 91, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-743", joinDate: "2026-01-21", origin: "regular", status: "active" },
  { id: "s744", name: "Лиза Морозова", age: 11, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 86, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-744", joinDate: "2025-10-29", origin: "regular", status: "left", leftDate: "2025-12-16" },
  { id: "s745", name: "Роман Громов", age: 14, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 86, lastNote: "", phone: "+49 151 ХХ-745", joinDate: "2026-05-14", origin: "regular", status: "active" },
  { id: "s746", name: "Ева Линд", age: 14, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 75, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-746", joinDate: "2025-10-31", origin: "regular", status: "active" },
  { id: "s747", name: "Катя Полякова", age: 14, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 82, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-747", joinDate: "2026-01-12", origin: "regular", status: "active" },
  { id: "s748", name: "Дарья Тихонова", age: 9, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Продвинутый", attendance: 88, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-748", joinDate: "2025-12-19", origin: "regular", status: "active" },
  { id: "s749", name: "David Roth", age: 11, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 87, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-749", joinDate: "2026-01-25", origin: "regular", status: "active" },
  { id: "s750", name: "Klara Vogt", age: 7, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 85, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-750", joinDate: "2026-05-10", origin: "regular", status: "active" },
];

const SESSIONS = [
  { id: "sn1", type: "group", discipline: "bmx", coachId: "c1", branchId: "roza", date: "2026-06-27", time: "14:00", duration: 90, groupName: "Рампа Б", studentIds: ["s203", "s263", "s205"], note: "Отработали базовую технику, прогресс заметен.", status: "done" },
  { id: "sn2", type: "group", discipline: "bmx", coachId: "c1", branchId: "roza", date: "2026-06-24", time: "15:30", duration: 45, groupName: "Рампа А", studentIds: ["s293", "s83"], note: "", status: "done" },
  { id: "sn3", type: "group", discipline: "bmx", coachId: "c1", branchId: "roza", date: "2026-06-25", time: "17:30", duration: 60, groupName: "Рампа А", studentIds: ["s220", "s95", "s102", "s339", "s299"], note: "Отработали базовую технику, прогресс заметен.", status: "done" },
  { id: "sn4", type: "group", discipline: "bmx", coachId: "c1", branchId: "roza", date: "2026-06-30", time: "16:00", duration: 75, groupName: "Памп-трек", studentIds: ["s72", "s240", "s14", "s339", "s148"], note: "", status: "upcoming" },
  { id: "sn5", type: "group", discipline: "bmx", coachId: "c1", branchId: "roza", date: "2026-07-01", time: "18:00", duration: 90, groupName: "Рампа Б", studentIds: ["s45", "s260", "s205", "s98", "s17"], note: "", status: "upcoming" },
  { id: "sn6", type: "individual", discipline: "bmx", coachId: "c2", branchId: "roza", date: "2026-06-30", time: "15:30", duration: 45, groupName: "Рампа Б", studentIds: ["s324"], note: "", status: "upcoming" },
  { id: "sn7", type: "individual", discipline: "bmx", coachId: "c2", branchId: "roza", date: "2026-07-01", time: "14:00", duration: 60, groupName: "Памп-трек", studentIds: ["s134"], note: "", status: "upcoming" },
  { id: "sn8", type: "group", discipline: "bmx", coachId: "c2", branchId: "roza", date: "2026-06-24", time: "16:30", duration: 75, groupName: "Рампа Б", studentIds: ["s289", "s235", "s267", "s345"], note: "Повторили технику безопасности перед новым трюком.", status: "done" },
  { id: "sn9", type: "group", discipline: "bmx", coachId: "c2", branchId: "roza", date: "2026-06-27", time: "18:00", duration: 75, groupName: "Рампа Б", studentIds: ["s267", "s174", "s289", "s65"], note: "Сняли на видео для разбора ошибок.", status: "done" },
  { id: "sn10", type: "group", discipline: "rollers", coachId: "c3", branchId: "roza", date: "2026-06-24", time: "19:00", duration: 45, groupName: "Зал 1", studentIds: ["s307", "s105", "s231", "s276", "s190"], note: "Закрепили элемент с прошлой тренировки.", status: "done" },
  { id: "sn11", type: "group", discipline: "rollers", coachId: "c3", branchId: "roza", date: "2026-06-29", time: "15:00", duration: 75, groupName: "Открытая площадка", studentIds: ["s146", "s56", "s157", "s305"], note: "", status: "upcoming" },
  { id: "sn12", type: "individual", discipline: "rollers", coachId: "c3", branchId: "roza", date: "2026-06-28", time: "18:30", duration: 60, groupName: "Зал 2", studentIds: ["s320"], note: "", status: "upcoming" },
  { id: "sn13", type: "group", discipline: "rollers", coachId: "c3", branchId: "roza", date: "2026-06-28", time: "14:00", duration: 45, groupName: "Зал 1", studentIds: ["s190", "s172", "s325", "s322"], note: "Хорошая динамика, можно усложнять программу.", status: "done" },
  { id: "sn14", type: "individual", discipline: "rollers", coachId: "c3", branchId: "roza", date: "2026-06-26", time: "14:00", duration: 75, groupName: "Открытая площадка", studentIds: ["s154"], note: "Нужно больше практики на торможении/балансе.", status: "done" },
  { id: "sn15", type: "individual", discipline: "skate", coachId: "c4", branchId: "roza", date: "2026-07-01", time: "17:00", duration: 75, groupName: "Боул", studentIds: ["s218"], note: "", status: "upcoming" },
  { id: "sn16", type: "group", discipline: "skate", coachId: "c4", branchId: "roza", date: "2026-06-28", time: "15:00", duration: 90, groupName: "Боул", studentIds: ["s1", "s250", "s165", "s120", "s35"], note: "", status: "upcoming" },
  { id: "sn17", type: "individual", discipline: "skate", coachId: "c4", branchId: "roza", date: "2026-06-28", time: "17:30", duration: 90, groupName: "Рампа Б", studentIds: ["s230"], note: "", status: "upcoming" },
  { id: "sn18", type: "group", discipline: "skate", coachId: "c4", branchId: "roza", date: "2026-06-24", time: "19:00", duration: 45, groupName: "Стрит-зона", studentIds: ["s200", "s175", "s6", "s107"], note: "Сняли на видео для разбора ошибок.", status: "done" },
  { id: "sn19", type: "individual", discipline: "skate", coachId: "c4", branchId: "roza", date: "2026-06-29", time: "14:00", duration: 45, groupName: "Рампа Б", studentIds: ["s142"], note: "", status: "upcoming" },
  { id: "sn20", type: "group", discipline: "rollers", coachId: "c5", branchId: "roza", date: "2026-06-29", time: "16:30", duration: 90, groupName: "Открытая площадка", studentIds: ["s143", "s348", "s23", "s160"], note: "", status: "upcoming" },
  { id: "sn21", type: "group", discipline: "rollers", coachId: "c5", branchId: "roza", date: "2026-06-24", time: "16:00", duration: 45, groupName: "Зал 2", studentIds: ["s334", "s136", "s138"], note: "Уверенно выполнил(а) связку трюков.", status: "done" },
  { id: "sn22", type: "individual", discipline: "rollers", coachId: "c5", branchId: "roza", date: "2026-06-29", time: "16:00", duration: 45, groupName: "Открытая площадка", studentIds: ["s138"], note: "", status: "upcoming" },
  { id: "sn23", type: "group", discipline: "rollers", coachId: "c5", branchId: "roza", date: "2026-06-27", time: "15:00", duration: 45, groupName: "Зал 2", studentIds: ["s75", "s179", "s301", "s207", "s247"], note: "Нужно больше практики на торможении/балансе.", status: "done" },
  { id: "sn24", type: "individual", discipline: "rollers", coachId: "c5", branchId: "roza", date: "2026-06-24", time: "17:30", duration: 75, groupName: "Зал 1", studentIds: ["s348"], note: "Закрепили элемент с прошлой тренировки.", status: "done" },
  { id: "sn25", type: "group", discipline: "skate", coachId: "c6", branchId: "roza", date: "2026-06-30", time: "15:30", duration: 90, groupName: "Боул", studentIds: ["s29", "s279", "s131", "s122", "s210"], note: "", status: "upcoming" },
  { id: "sn26", type: "individual", discipline: "skate", coachId: "c6", branchId: "roza", date: "2026-06-30", time: "14:00", duration: 45, groupName: "Рампа Б", studentIds: ["s308"], note: "", status: "upcoming" },
  { id: "sn27", type: "group", discipline: "skate", coachId: "c6", branchId: "roza", date: "2026-06-25", time: "14:00", duration: 45, groupName: "Стрит-зона", studentIds: ["s122", "s85", "s91", "s303"], note: "Повторили технику безопасности перед новым трюком.", status: "done" },
  { id: "sn28", type: "individual", discipline: "skate", coachId: "c6", branchId: "roza", date: "2026-06-29", time: "17:30", duration: 75, groupName: "Рампа Б", studentIds: ["s323"], note: "", status: "upcoming" },
  { id: "sn29", type: "individual", discipline: "bike", coachId: "c7", branchId: "roza", date: "2026-06-29", time: "17:00", duration: 60, groupName: "Дёрт-парк", studentIds: ["s254"], note: "", status: "upcoming" },
  { id: "sn30", type: "group", discipline: "bike", coachId: "c7", branchId: "roza", date: "2026-06-24", time: "18:00", duration: 75, groupName: "Памп-трек", studentIds: ["s43", "s168", "s313"], note: "Отработали базовую технику, прогресс заметен.", status: "done" },
  { id: "sn31", type: "group", discipline: "bike", coachId: "c7", branchId: "roza", date: "2026-06-26", time: "17:00", duration: 90, groupName: "Дёрт-парк", studentIds: ["s270", "s254", "s252", "s88", "s69"], note: "Нужно больше практики на торможении/балансе.", status: "done" },
  { id: "sn32", type: "group", discipline: "bike", coachId: "c7", branchId: "roza", date: "2026-06-30", time: "16:30", duration: 90, groupName: "Памп-трек", studentIds: ["s34", "s21", "s340", "s88"], note: "", status: "upcoming" },
  { id: "sn33", type: "individual", discipline: "scooter", coachId: "c8", branchId: "roza", date: "2026-06-30", time: "14:00", duration: 90, groupName: "Зал 1", studentIds: ["s12"], note: "", status: "upcoming" },
  { id: "sn34", type: "group", discipline: "scooter", coachId: "c8", branchId: "roza", date: "2026-06-24", time: "17:00", duration: 45, groupName: "Стрит-зона", studentIds: ["s296", "s153", "s152"], note: "Хорошая динамика, можно усложнять программу.", status: "done" },
  { id: "sn35", type: "group", discipline: "scooter", coachId: "c8", branchId: "roza", date: "2026-07-01", time: "17:30", duration: 90, groupName: "Стрит-зона", studentIds: ["s176", "s344", "s101", "s86"], note: "", status: "upcoming" },
  { id: "sn36", type: "individual", discipline: "scooter", coachId: "c8", branchId: "roza", date: "2026-07-01", time: "16:30", duration: 75, groupName: "Стрит-зона", studentIds: ["s255"], note: "", status: "upcoming" },
  { id: "sn37", type: "group", discipline: "scooter", coachId: "c8", branchId: "roza", date: "2026-06-27", time: "17:30", duration: 60, groupName: "Стрит-зона", studentIds: ["s37", "s296", "s344", "s338", "s137"], note: "Отработали базовую технику, прогресс заметен.", status: "done" },
  { id: "sn38", type: "group", discipline: "skate", coachId: "c9", branchId: "irkutsk", date: "2026-06-27", time: "18:30", duration: 90, groupName: "Боул", studentIds: ["s670", "s556", "s453", "s365"], note: "Хорошая динамика, можно усложнять программу.", status: "done" },
  { id: "sn39", type: "individual", discipline: "skate", coachId: "c9", branchId: "irkutsk", date: "2026-06-24", time: "17:00", duration: 60, groupName: "Стрит-зона", studentIds: ["s566"], note: "Сняли на видео для разбора ошибок.", status: "done" },
  { id: "sn40", type: "group", discipline: "skate", coachId: "c9", branchId: "irkutsk", date: "2026-06-24", time: "15:00", duration: 45, groupName: "Боул", studentIds: ["s468", "s476", "s462", "s367", "s702"], note: "Повторили технику безопасности перед новым трюком.", status: "done" },
  { id: "sn41", type: "group", discipline: "skate", coachId: "c9", branchId: "irkutsk", date: "2026-07-01", time: "18:30", duration: 45, groupName: "Стрит-зона", studentIds: ["s729", "s505", "s420"], note: "", status: "upcoming" },
  { id: "sn42", type: "group", discipline: "skate", coachId: "c9", branchId: "irkutsk", date: "2026-07-01", time: "16:30", duration: 90, groupName: "Боул", studentIds: ["s476", "s570"], note: "", status: "upcoming" },
  { id: "sn43", type: "group", discipline: "scooter", coachId: "c10", branchId: "irkutsk", date: "2026-06-29", time: "17:00", duration: 60, groupName: "Стрит-зона", studentIds: ["s402", "s717", "s554"], note: "", status: "upcoming" },
  { id: "sn44", type: "group", discipline: "scooter", coachId: "c10", branchId: "irkutsk", date: "2026-06-24", time: "16:30", duration: 75, groupName: "Стрит-зона", studentIds: ["s421", "s598", "s675", "s706"], note: "Отработали базовую технику, прогресс заметен.", status: "done" },
  { id: "sn45", type: "individual", discipline: "scooter", coachId: "c10", branchId: "irkutsk", date: "2026-06-24", time: "16:30", duration: 75, groupName: "Зал 1", studentIds: ["s413"], note: "Уверенно выполнил(а) связку трюков.", status: "done" },
  { id: "sn46", type: "group", discipline: "scooter", coachId: "c10", branchId: "irkutsk", date: "2026-06-24", time: "16:00", duration: 60, groupName: "Стрит-зона", studentIds: ["s521", "s678", "s497"], note: "Закрепили элемент с прошлой тренировки.", status: "done" },
  { id: "sn47", type: "group", discipline: "scooter", coachId: "c10", branchId: "irkutsk", date: "2026-06-28", time: "17:00", duration: 90, groupName: "Стрит-зона", studentIds: ["s689", "s600", "s678", "s523"], note: "", status: "done" },
  { id: "sn48", type: "individual", discipline: "bike", coachId: "c11", branchId: "irkutsk", date: "2026-06-29", time: "18:30", duration: 75, groupName: "Памп-трек", studentIds: ["s679"], note: "", status: "upcoming" },
  { id: "sn49", type: "group", discipline: "bike", coachId: "c11", branchId: "irkutsk", date: "2026-06-27", time: "18:30", duration: 75, groupName: "Дёрт-парк", studentIds: ["s701", "s398"], note: "Уверенно выполнил(а) связку трюков.", status: "done" },
  { id: "sn50", type: "group", discipline: "bike", coachId: "c11", branchId: "irkutsk", date: "2026-06-30", time: "15:00", duration: 45, groupName: "Памп-трек", studentIds: ["s620", "s715", "s640", "s610"], note: "", status: "upcoming" },
  { id: "sn51", type: "individual", discipline: "bike", coachId: "c11", branchId: "irkutsk", date: "2026-06-26", time: "14:00", duration: 90, groupName: "Дёрт-парк", studentIds: ["s693"], note: "Нужно больше практики на торможении/балансе.", status: "done" },
  { id: "sn52", type: "group", discipline: "bike", coachId: "c11", branchId: "irkutsk", date: "2026-06-29", time: "18:00", duration: 60, groupName: "Памп-трек", studentIds: ["s516", "s748", "s693"], note: "", status: "upcoming" },
  { id: "sn53", type: "group", discipline: "bike", coachId: "c11", branchId: "irkutsk", date: "2026-06-24", time: "17:00", duration: 60, groupName: "Дёрт-парк", studentIds: ["s376", "s426", "s379", "s415", "s390"], note: "Нужно больше практики на торможении/балансе.", status: "done" },
  { id: "sn54", type: "individual", discipline: "bmx", coachId: "c12", branchId: "irkutsk", date: "2026-06-26", time: "16:00", duration: 60, groupName: "Рампа А", studentIds: ["s508"], note: "Сняли на видео для разбора ошибок.", status: "done" },
  { id: "sn55", type: "group", discipline: "bmx", coachId: "c12", branchId: "irkutsk", date: "2026-06-24", time: "15:00", duration: 60, groupName: "Рампа Б", studentIds: ["s378", "s404", "s478"], note: "Хорошая динамика, можно усложнять программу.", status: "done" },
  { id: "sn56", type: "group", discipline: "bmx", coachId: "c12", branchId: "irkutsk", date: "2026-06-29", time: "16:30", duration: 45, groupName: "Памп-трек", studentIds: ["s404", "s671", "s595"], note: "", status: "upcoming" },
  { id: "sn57", type: "group", discipline: "bmx", coachId: "c12", branchId: "irkutsk", date: "2026-07-01", time: "19:00", duration: 90, groupName: "Памп-трек", studentIds: ["s595", "s594", "s672", "s411"], note: "", status: "upcoming" },
  { id: "sn58", type: "group", discipline: "bmx", coachId: "c12", branchId: "irkutsk", date: "2026-06-27", time: "16:00", duration: 60, groupName: "Рампа А", studentIds: ["s366", "s530", "s616", "s357"], note: "Сняли на видео для разбора ошибок.", status: "done" },
  { id: "sn59", type: "individual", discipline: "skate", coachId: "c13", branchId: "irkutsk", date: "2026-06-27", time: "15:00", duration: 90, groupName: "Стрит-зона", studentIds: ["s533"], note: "Уверенно выполнил(а) связку трюков.", status: "done" },
  { id: "sn60", type: "individual", discipline: "skate", coachId: "c13", branchId: "irkutsk", date: "2026-06-29", time: "18:00", duration: 60, groupName: "Рампа Б", studentIds: ["s493"], note: "", status: "upcoming" },
  { id: "sn61", type: "group", discipline: "skate", coachId: "c13", branchId: "irkutsk", date: "2026-06-29", time: "15:30", duration: 60, groupName: "Стрит-зона", studentIds: ["s460", "s609", "s442", "s597", "s719"], note: "", status: "upcoming" },
  { id: "sn62", type: "group", discipline: "skate", coachId: "c13", branchId: "irkutsk", date: "2026-06-27", time: "18:00", duration: 60, groupName: "Боул", studentIds: ["s746", "s514"], note: "", status: "done" },
  { id: "sn63", type: "group", discipline: "skate", coachId: "c13", branchId: "irkutsk", date: "2026-06-26", time: "14:00", duration: 60, groupName: "Рампа Б", studentIds: ["s719", "s542", "s533", "s590"], note: "Хорошая динамика, можно усложнять программу.", status: "done" },
  { id: "sn64", type: "group", discipline: "rollers", coachId: "c14", branchId: "irkutsk", date: "2026-06-30", time: "16:30", duration: 90, groupName: "Зал 2", studentIds: ["s467", "s648", "s436"], note: "", status: "upcoming" },
  { id: "sn65", type: "group", discipline: "rollers", coachId: "c14", branchId: "irkutsk", date: "2026-06-27", time: "14:00", duration: 45, groupName: "Зал 1", studentIds: ["s546", "s397"], note: "Отработали базовую технику, прогресс заметен.", status: "done" },
  { id: "sn66", type: "individual", discipline: "rollers", coachId: "c14", branchId: "irkutsk", date: "2026-06-26", time: "15:00", duration: 45, groupName: "Зал 1", studentIds: ["s397"], note: "Нужно больше практики на торможении/балансе.", status: "done" },
  { id: "sn67", type: "individual", discipline: "rollers", coachId: "c14", branchId: "irkutsk", date: "2026-06-25", time: "17:30", duration: 45, groupName: "Зал 1", studentIds: ["s565"], note: "Повторили технику безопасности перед новым трюком.", status: "done" },
  { id: "sn68", type: "group", discipline: "rollers", coachId: "c14", branchId: "irkutsk", date: "2026-06-24", time: "19:00", duration: 45, groupName: "Зал 1", studentIds: ["s546", "s716", "s506"], note: "Связались с родителями — пропуск без предупреждения.", status: "missed" },
  { id: "sn69", type: "group", discipline: "rollers", coachId: "c14", branchId: "irkutsk", date: "2026-06-29", time: "18:30", duration: 90, groupName: "Зал 1", studentIds: ["s739", "s467"], note: "", status: "upcoming" },
  { id: "sn70", type: "group", discipline: "rollers", coachId: "c15", branchId: "irkutsk", date: "2026-07-01", time: "15:30", duration: 75, groupName: "Зал 2", studentIds: ["s427", "s712", "s629", "s447", "s563"], note: "", status: "upcoming" },
  { id: "sn71", type: "group", discipline: "rollers", coachId: "c15", branchId: "irkutsk", date: "2026-06-24", time: "16:30", duration: 75, groupName: "Зал 1", studentIds: ["s733", "s683", "s385", "s724", "s573"], note: "Отработали базовую технику, прогресс заметен.", status: "done" },
  { id: "sn72", type: "individual", discipline: "rollers", coachId: "c15", branchId: "irkutsk", date: "2026-06-24", time: "16:30", duration: 75, groupName: "Открытая площадка", studentIds: ["s550"], note: "Хорошая динамика, можно усложнять программу.", status: "done" },
  { id: "sn73", type: "group", discipline: "rollers", coachId: "c15", branchId: "irkutsk", date: "2026-07-01", time: "17:30", duration: 45, groupName: "Зал 2", studentIds: ["s602", "s456"], note: "", status: "upcoming" },
  { id: "sn74", type: "individual", discipline: "rollers", coachId: "c15", branchId: "irkutsk", date: "2026-06-27", time: "18:30", duration: 45, groupName: "Открытая площадка", studentIds: ["s393"], note: "Отработали базовую технику, прогресс заметен.", status: "done" },
  { id: "sn75", type: "individual", discipline: "rollers", coachId: "c15", branchId: "irkutsk", date: "2026-06-28", time: "16:30", duration: 60, groupName: "Зал 1", studentIds: ["s459"], note: "Сняли на видео для разбора ошибок.", status: "done" },
  { id: "sn76", type: "individual", discipline: "bike", coachId: "c16", branchId: "irkutsk", date: "2026-06-27", time: "16:30", duration: 60, groupName: "Памп-трек", studentIds: ["s725"], note: "Связались с родителями — пропуск без предупреждения.", status: "missed" },
  { id: "sn77", type: "group", discipline: "bike", coachId: "c16", branchId: "irkutsk", date: "2026-06-30", time: "17:30", duration: 75, groupName: "Памп-трек", studentIds: ["s740", "s440", "s417"], note: "", status: "upcoming" },
  { id: "sn78", type: "individual", discipline: "bike", coachId: "c16", branchId: "irkutsk", date: "2026-06-25", time: "17:00", duration: 60, groupName: "Памп-трек", studentIds: ["s638"], note: "Нужно больше практики на торможении/балансе.", status: "done" },
  { id: "sn79", type: "group", discipline: "bike", coachId: "c16", branchId: "irkutsk", date: "2026-06-25", time: "17:30", duration: 75, groupName: "Дёрт-парк", studentIds: ["s730", "s414", "s582", "s509"], note: "Хорошая динамика, можно усложнять программу.", status: "done" },
  { id: "sn80", type: "group", discipline: "bike", coachId: "c16", branchId: "irkutsk", date: "2026-06-26", time: "18:00", duration: 75, groupName: "Дёрт-парк", studentIds: ["s529", "s571", "s458", "s735", "s371"], note: "Сняли на видео для разбора ошибок.", status: "done" },
  { id: "sn81", type: "group", discipline: "bike", coachId: "c16", branchId: "irkutsk", date: "2026-06-25", time: "18:30", duration: 90, groupName: "Памп-трек", studentIds: ["s361", "s435"], note: "Уверенно выполнил(а) связку трюков.", status: "done" },
  { id: "sn82", type: "group", discipline: "bmx", coachId: "c17", branchId: "irkutsk", date: "2026-06-27", time: "15:30", duration: 60, groupName: "Памп-трек", studentIds: ["s572", "s732", "s728", "s354"], note: "Нужно больше практики на торможении/балансе.", status: "done" },
  { id: "sn83", type: "individual", discipline: "bmx", coachId: "c17", branchId: "irkutsk", date: "2026-06-24", time: "15:00", duration: 75, groupName: "Памп-трек", studentIds: ["s669"], note: "Отработали базовую технику, прогресс заметен.", status: "done" },
  { id: "sn84", type: "individual", discipline: "bmx", coachId: "c17", branchId: "irkutsk", date: "2026-06-29", time: "18:30", duration: 45, groupName: "Памп-трек", studentIds: ["s604"], note: "", status: "upcoming" },
  { id: "sn85", type: "individual", discipline: "bmx", coachId: "c17", branchId: "irkutsk", date: "2026-06-26", time: "17:00", duration: 60, groupName: "Памп-трек", studentIds: ["s572"], note: "Отработали базовую технику, прогресс заметен.", status: "done" },
];

const WEEK_STATS_BY_BRANCH = {
  roza: [
    { day: "Пн", count: 18 }, { day: "Вт", count: 17 }, { day: "Ср", count: 19 },
    { day: "Чт", count: 16 }, { day: "Пт", count: 16 }, { day: "Сб", count: 28 }, { day: "Вс", count: 24 },
  ],
  irkutsk: [
    { day: "Пн", count: 20 }, { day: "Вт", count: 22 }, { day: "Ср", count: 18 },
    { day: "Чт", count: 22 }, { day: "Пт", count: 19 }, { day: "Сб", count: 27 }, { day: "Вс", count: 27 },
  ],
};

// Посещаемость по направлениям, % — отдельно для каждого филиала (рассчитано по тестовой выборке учеников)
const ATTENDANCE_BY_BRANCH_DISCIPLINE = {
  roza: { bmx: 88, rollers: 88, skate: 89, bike: 89, scooter: 90 },
  irkutsk: { bmx: 88, rollers: 88, skate: 89, bike: 89, scooter: 87 },
};

/* ============================================================
   ИКОНКИ ДИСЦИПЛИН (мини SVG-значки в духе деки/наклейки)
   ============================================================ */
function DisciplineGlyph({ d, size = 16 }) {
  const c = DISCIPLINES[d]?.color || "#888";
  const icons = {
    bmx: <Bike size={size} color={c} strokeWidth={2.5} />,
    bike: <Bike size={size} color={c} strokeWidth={2.5} />,
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
function nextId(prefix) { return `${prefix}${_idCounter++}`; }
function initialsOf(name) { return name.trim().split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2); }

/* ============================================================
   ЭКРАН ВХОДА — почта + пароль, разделение по ролям
   ============================================================ */
function LoginScreen({ coaches, managers, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [showDemo, setShowDemo] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    // trim убирает случайные пробелы/переносы при копировании из подсказки
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    if (!normalizedEmail || !normalizedPassword) {
      setError("Введите почту и пароль");
      return;
    }
    const coach = coaches.find(c => c.email.toLowerCase().trim() === normalizedEmail);
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
        <div className="login-subtitle">Для тренеров и управляющих филиалов</div>

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

          {error && <div className="login-error"><AlertCircle size={13} /> {error}</div>}

          <button type="submit" className="login-submit">Войти</button>
        </form>

        <button type="button" className="login-demo-toggle" onClick={() => setShowDemo(v => !v)}>
          {showDemo ? "Скрыть тестовые доступы" : "Показать тестовые доступы (демо)"}
        </button>
        {showDemo && (
          <div className="login-demo-list">
            <div><b>Владелец:</b> owner@extremekids.ru / owner2026</div>
            <div><b>Управляющий «Роза»:</b> roza@extremekids.ru / roza2026</div>
            <div><b>Управляющий «Иркутский»:</b> irkutsk@extremekids.ru / irkutsk2026</div>
            <div><b>Тренер (пример):</b> c1@extremekids.ru / coach2026</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null); // { kind: 'coach'|'manager', record }
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [adminTab, setAdminTab] = useState("overview");
  const [searchQ, setSearchQ] = useState("");

  // Данные теперь живут в state верхнего уровня, чтобы формы могли их менять
  const [students, setStudents] = useState(STUDENTS);
  const [sessions, setSessions] = useState(SESSIONS);
  const [coaches, setCoaches] = useState(COACHES);
  const [managers, setManagers] = useState(MANAGERS);

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

  function flashToast(text) {
    setToast(text);
    setTimeout(() => setToast(null), 2400);
  }

  function addSession(payload) {
    const s = { id: nextId("sn"), status: "upcoming", ...payload };
    setSessions(prev => [s, ...prev]);
    flashToast("Тренировка добавлена в дневник");
  }

  // Создаёт серию тренировок по расписанию (день недели + время) на N недель вперёд —
  // дальше остаётся только отмечать посещаемость, не создавая каждую тренировку заново
  function addRecurringSessions({ slots, startDate, weeksAhead, ...base }) {
    const templateId = nextId("tpl");
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
          ...base,
          date: isoDate(d),
          time: slot.time,
        });
      }
    });
    setSessions(prev => [...newSessions, ...prev]);
    flashToast(`Создано тренировок: ${newSessions.length}`);
  }

  function saveSession(id, payload) {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...payload } : s));
    flashToast("Изменения сохранены");
  }

  function saveAttendance(sessionId, { note, present }) {
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      const presentIds = s.studentIds.filter(sid => present[sid]);
      return { ...s, note, status: presentIds.length > 0 ? "done" : "missed" };
    }));
    flashToast("Запись сохранена в дневник");
  }

  function deleteSession(id) {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (selectedSession?.id === id) setSelectedSession(null);
    flashToast("Тренировка удалена");
  }

  function addStudent(payload) {
    const s = { id: nextId("s"), attendance: 100, lastNote: "", joinDate: TODAY_ISO, status: "active", ...payload };
    setStudents(prev => [s, ...prev]);
    flashToast("Ученик добавлен");
  }

  function quickUpdateStudent(id, patch) {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
    flashToast("Статус ученика обновлён");
  }

  function saveStudent(id, payload) {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, ...payload } : s));
    flashToast("Изменения сохранены");
  }

  function deleteStudent(id) {
    setStudents(prev => prev.filter(s => s.id !== id));
    // удаляем ученика и из составов тренировок, чтобы не остались битые ссылки
    setSessions(prev => prev.map(s => ({ ...s, studentIds: s.studentIds.filter(sid => sid !== id) })));
    if (selectedStudent?.id === id) setSelectedStudent(null);
    flashToast("Ученик удалён");
  }

  function addCoach(payload) {
    const c = { id: nextId("c"), avatar: initialsOf(payload.name), ...payload };
    setCoaches(prev => [c, ...prev]);
    flashToast("Тренер добавлен");
  }

  function saveCoach(id, payload) {
    setCoaches(prev => prev.map(c => c.id === id ? { ...c, ...payload, avatar: initialsOf(payload.name) } : c));
    flashToast("Изменения сохранены");
  }

  function deleteCoach(id) {
    setCoaches(prev => prev.filter(c => c.id !== id));
    flashToast("Тренер удалён");
  }

  function addManager(payload) {
    const m = { id: nextId("m"), avatar: initialsOf(payload.name), ...payload };
    setManagers(prev => [m, ...prev]);
    flashToast("Управляющий добавлен");
  }

  function saveManager(id, payload) {
    setManagers(prev => prev.map(m => m.id === id ? { ...m, ...payload, avatar: initialsOf(payload.name) } : m));
    flashToast("Изменения сохранены");
  }

  function deleteManager(id) {
    setManagers(prev => prev.filter(m => m.id !== id));
    flashToast("Управляющий удалён");
  }

  function requestDelete(kind, id, label) {
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

  function handleConfirmedDelete() {
    if (!confirmDelete) return;
    if (confirmDelete.kind === "session") deleteSession(confirmDelete.id);
    if (confirmDelete.kind === "student") deleteStudent(confirmDelete.id);
    if (confirmDelete.kind === "coach") deleteCoach(confirmDelete.id);
    if (confirmDelete.kind === "manager") deleteManager(confirmDelete.id);
    setConfirmDelete(null);
  }

  function handleLogout() {
    setCurrentUser(null);
    setSelectedSession(null);
    setSelectedStudent(null);
    setAdminTab("overview");
  }

  // Не авторизован — только экран входа
  if (!currentUser) {
    return (
      <div className="root">
        <style>{CSS}</style>
        <LoginScreen coaches={coaches} managers={managers} onLogin={setCurrentUser} />
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
      <style>{CSS}</style>

      {toast && <div className="toast"><CheckCircle2 size={14} />{toast}</div>}

      {view === "coach" ? (
        <CoachView
          coach={activeCoach}
          coaches={coaches}
          students={students}
          sessions={sessions}
          session={selectedSession}
          setSession={setSelectedSession}
          student={selectedStudent}
          setStudent={setSelectedStudent}
          onNewSession={() => setShowNewSession(true)}
          onNewStudent={() => setShowNewStudent(true)}
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
          tab={adminTab}
          setTab={setAdminTab}
          searchQ={searchQ}
          setSearchQ={setSearchQ}
          students={students}
          sessions={sessions}
          coaches={coaches}
          managers={managers}
          manager={activeManager}
          onNewSession={() => setShowNewSession(true)}
          onNewStudent={() => setShowNewStudent(true)}
          onEditStudent={(s) => setEditingStudent(s)}
          onDeleteStudent={(s) => requestDelete("student", s.id, s.name)}
          onQuickUpdateStudent={quickUpdateStudent}
          onEditSession={(s) => setEditingSession(s)}
          onDeleteSession={(s) => requestDelete("session", s.id, `тренировку ${formatDate(s.date)} в ${s.time}`)}
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
          coaches={coaches}
          students={students}
          defaultCoachId={view === "coach" ? activeCoach.id : null}
          onClose={() => setShowNewSession(false)}
          onSave={(payload) => { addSession(payload); setShowNewSession(false); }}
          onSaveRecurring={(payload) => { addRecurringSessions(payload); setShowNewSession(false); }}
        />
      )}
      {editingSession && (
        <SessionModal
          coaches={coaches}
          students={students}
          initialSession={editingSession}
          onClose={() => setEditingSession(null)}
          onSave={(payload) => { saveSession(editingSession.id, payload); setEditingSession(null); }}
        />
      )}
      {showNewStudent && (
        <StudentModal
          coaches={coaches}
          defaultCoachId={view === "coach" ? activeCoach.id : null}
          onClose={() => setShowNewStudent(false)}
          onSave={(payload) => { addStudent(payload); setShowNewStudent(false); }}
        />
      )}
      {editingStudent && (
        <StudentModal
          coaches={coaches}
          initialStudent={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSave={(payload) => { saveStudent(editingStudent.id, payload); setEditingStudent(null); }}
        />
      )}
      {showNewCoach && (
        <CoachModal
          existingCoaches={coaches}
          managers={managers}
          onClose={() => setShowNewCoach(false)}
          onSave={(payload) => { addCoach(payload); setShowNewCoach(false); }}
        />
      )}
      {editingCoach && (
        <CoachModal
          initialCoach={editingCoach}
          existingCoaches={coaches}
          managers={managers}
          onClose={() => setEditingCoach(null)}
          onSave={(payload) => { saveCoach(editingCoach.id, payload); setEditingCoach(null); }}
        />
      )}
      {showNewManager && (
        <ManagerModal
          existingManagers={managers}
          coaches={coaches}
          onClose={() => setShowNewManager(false)}
          onSave={(payload) => { addManager(payload); setShowNewManager(false); }}
        />
      )}
      {editingManager && (
        <ManagerModal
          initialManager={editingManager}
          existingManagers={managers}
          coaches={coaches}
          onClose={() => setEditingManager(null)}
          onSave={(payload) => { saveManager(editingManager.id, payload); setEditingManager(null); }}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          label={confirmDelete.label}
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
function CoachView({ coach, coaches, students, sessions, session, setSession, student, setStudent, onNewSession, onNewStudent, onEditSession, onDeleteSession, onEditStudent, onDeleteStudent, onSaveAttendance, onQuickUpdateStudent, onLogout }) {
  const [tab, setTab] = useState("today");
  const disc = DISCIPLINES[coach.discipline];

  // тренер может смотреть свой дневник в любом филиале, даже если сам ведёт занятия только в одном —
  // пригодится, если нужно подменить коллегу или сверить расписание другого зала
  const [activeBranch, setActiveBranch] = useState(coach.branches[0]);
  const effectiveBranch = activeBranch;

  const mySessions = sessions.filter(s => s.coachId === coach.id && s.branchId === effectiveBranch);
  const [selectedDate, setSelectedDate] = useState(TODAY_ISO);
  const myStudents = students.filter(s => coachesOfStudent(s).includes(coach.id) && s.branchId === effectiveBranch);

  if (session) return (
    <SessionDetail
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
      sessions={sessions}
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
            <span className="diary-date">{BRANCHES[effectiveBranch].label} · 28.06.2026</span>
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
            <StudentsTab students={myStudents} onOpen={setStudent} disc={disc} onNewStudent={onNewStudent} />
          )}
          {tab === "stats" && (
            <CoachStatsTab coach={coach} students={myStudents} sessions={mySessions} disc={disc} />
          )}
          {tab === "help" && <CoachHelpTab disc={disc} />}
        </main>

        <button className="fab" style={{ background: disc.color }} onClick={onNewSession} aria-label="Новая тренировка">
          <Plus size={24} color="#16181C" strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}

function TodayTab({ coachSessions, selectedDate, setSelectedDate, onOpen, disc }) {
  const isToday = selectedDate === TODAY_ISO;
  const markedDates = useMemo(() => new Set(coachSessions.map(s => s.date)), [coachSessions]);
  const daySessions = coachSessions
    .filter(s => s.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));

  const past = coachSessions
    .filter(s => s.date < TODAY_ISO)
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
        <button className="date-nav-label" onClick={toggleOpen}>
          <Calendar size={13} />
          <span>{label}</span>
          <span className="date-nav-weekday">{weekdayLabel}</span>
        </button>
        <button className="date-nav-arrow" onClick={() => onSelect(shiftIsoDate(selectedDate, 1))} aria-label="Следующий день">
          <ChevronRight size={16} />
        </button>
        {selectedDate !== TODAY_ISO && (
          <button className="date-nav-today" onClick={() => pick(TODAY_ISO)}>Сегодня</button>
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
              if (iso === TODAY_ISO) cls.push("is-today");
              if (markedDates?.has(iso)) cls.push("has-sessions");
              return (
                <button key={i} className={cls.join(" ")} onClick={() => pick(iso)}>
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

function StudentsTab({ students, onOpen, disc, onNewStudent }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | vacation | left | promo
  const filtered = students.filter(s => {
    if (!s.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (statusFilter === "promo") return (s.origin || "regular") === "promo";
    if (statusFilter !== "all") return (s.status || "active") === statusFilter;
    return true;
  });
  const promoCount = students.filter(s => (s.origin || "regular") === "promo").length;
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
      <div className="status-filter-row">
        <button className={statusFilter === "all" ? "status-chip active" : "status-chip"} onClick={() => setStatusFilter("all")}>Все</button>
        <button className={statusFilter === "active" ? "status-chip active" : "status-chip"} onClick={() => setStatusFilter("active")}>Активные</button>
        <button className={statusFilter === "vacation" ? "status-chip active" : "status-chip"} onClick={() => setStatusFilter("vacation")}>В отпуске</button>
        <button className={statusFilter === "left" ? "status-chip active" : "status-chip"} onClick={() => setStatusFilter("left")}>Ушли</button>
        {promoCount > 0 && (
          <button className={statusFilter === "promo" ? "status-chip active" : "status-chip"} onClick={() => setStatusFilter("promo")}>
            <Star size={11} /> С пробного ({promoCount})
          </button>
        )}
      </div>
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
                  {s.flag === "injury" && <AlertCircle size={13} color="#FF5454" />}
                  {(s.origin || "regular") === "promo" && <Star size={12} color="#FFC24B" />}
                </div>
                <div className="student-row-meta">
                  {s.age} лет · {s.level}
                  {(s.status || "active") !== "active" && (
                    <span className="status-dot-label" style={{ color: st.color }}> · {st.label}</span>
                  )}
                </div>
              </div>
              <div className="student-row-attendance">
                <div className="attendance-ring" style={{ "--pct": s.attendance, "--c": disc.color }}>
                  {s.attendance}%
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
function SalaryPanel({ coach, sessions }) {
  const [open, setOpen] = useState(false);
  const monthKey = TODAY_ISO.slice(0, 7);
  const monthSessions = sessions
    .filter(s => s.status === "done" && s.date.startsWith(monthKey))
    .sort((a, b) => (a.date === b.date ? b.time.localeCompare(a.time) : b.date.localeCompare(a.date)));
  const salary = calcCoachSalary(coach, monthSessions);

  return (
    <div className="panel salary-panel">
      <button className="salary-panel-toggle" onClick={() => setOpen(v => !v)}>
        <div>
          <div className="panel-title">Зарплата за {monthLabelFull(monthKey)}</div>
          <div className="salary-panel-sub">{salary.totalSessions} тренировок проведено</div>
        </div>
        <div className="salary-panel-total">
          {salary.total.toLocaleString("ru-RU")} ₽
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
                  <div className="salary-breakdown-meta">{s.groupName}{s.type !== "individual" ? ` · ${s.studentIds.length} чел.` : ""}</div>
                </div>
                <div className="salary-breakdown-amount">+{sessionEarning(coach, s).toLocaleString("ru-RU")} ₽</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function FlowChart({ students }) {
  const rows = buildFlowStats(students, 6);
  const maxVal = Math.max(...rows.map(r => Math.max(r.in, r.out)), 1);
  const totalIn = rows.reduce((a, r) => a + r.in, 0);
  const totalOut = rows.reduce((a, r) => a + r.out, 0);
  return (
    <div className="panel">
      <div className="panel-title-row">
        <div className="panel-title">Приток / отток учеников</div>
        <div className="flow-legend">
          <span><i style={{ background: "#3DDC97" }} /> Пришли ({totalIn})</span>
          <span><i style={{ background: "#FF5454" }} /> Ушли ({totalOut})</span>
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

function CoachStatsTab({ coach, students, sessions, disc }) {
  const enrolled = students.filter(isEnrolled);
  const avgAttendance = Math.round(enrolled.reduce((a, s) => a + s.attendance, 0) / (enrolled.length || 1));
  const done = sessions.filter(s => s.status === "done").length;
  const missed = sessions.filter(s => s.status === "missed").length;
  const levels = ["Начальный", "Средний", "Продвинутый"].map(lv => ({
    level: lv, count: enrolled.filter(s => s.level === lv).length
  }));
  const maxLevel = Math.max(...levels.map(l => l.count), 1);
  const promoCount = enrolled.filter(s => (s.origin || "regular") === "promo").length;
  const leftCount = students.filter(s => s.status === "left").length;

  return (
    <div className="tab-content">
      <div className="stat-grid">
        <StatBlock label="Средняя посещаемость" value={`${avgAttendance}%`} icon={<Target size={16} />} accent={disc.color} />
        <StatBlock label="Учеников" value={enrolled.length} icon={<Users size={16} />} accent={disc.color} />
        <StatBlock label="Проведено" value={done} icon={<CheckCircle2 size={16} />} accent="#3DDC97" />
        <StatBlock label="Пропущено" value={missed} icon={<AlertCircle size={16} />} accent="#FF5454" />
      </div>

      <SalaryPanel coach={coach} sessions={sessions} />

      <FlowChart students={students} />

      {(promoCount > 0 || leftCount > 0) && (
        <div className="stat-grid">
          <StatBlock label="С пробного, не переведены" value={promoCount} icon={<Star size={16} />} accent="#FFC24B" />
          <StatBlock label="Ушли всего" value={leftCount} icon={<AlertCircle size={16} />} accent="#FF5454" />
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
function SessionDetail({ session, onBack, students, onEdit, onDelete, onSaveAttendance }) {
  const [note, setNote] = useState(session.note || "");
  const [noteError, setNoteError] = useState(false);
  const disc = DISCIPLINES[session.discipline];
  const roster = students.filter(s => session.studentIds.includes(s.id));
  const [present, setPresent] = useState(Object.fromEntries(roster.map(s => [s.id, session.status !== "missed"])));

  function handleSave() {
    if (!note.trim()) { setNoteError(true); return; }
    if (onSaveAttendance) onSaveAttendance({ note: note.trim(), present });
    onBack();
  }

  return (
    <div className="phone-frame">
      <div className="phone-screen" style={{ "--accent": disc.color }}>
        <header className="detail-header">
          <button className="back-btn" onClick={onBack}><ChevronLeft size={20} /></button>
          <div className="detail-header-title">
            <DisciplineGlyph d={session.discipline} size={14} />
            {SESSION_TYPES[session.type].label} тренировка
          </div>
          <div className="detail-header-actions">
            <button className="icon-action-btn" onClick={onEdit} aria-label="Редактировать"><Settings size={16} /></button>
            <button className="icon-action-btn danger" onClick={onDelete} aria-label="Удалить"><X size={16} /></button>
          </div>
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
                <label key={s.id} className="roster-row">
                  <input
                    type="checkbox"
                    checked={present[s.id]}
                    onChange={() => setPresent(p => ({ ...p, [s.id]: !p[s.id] }))}
                  />
                  <span className="roster-check" style={{ background: present[s.id] ? disc.color : "transparent" }}>
                    {present[s.id] && <CheckCircle2 size={13} color="#16181C" />}
                  </span>
                  <span className="roster-name">{s.name}</span>
                  <span className="roster-level">{s.level}</span>
                </label>
              ))}
            </div>

            <div className="detail-divider" />

            <div className="detail-label">Заметка тренера <span className="required-mark">*</span></div>
            <textarea
              className={noteError ? "note-textarea note-textarea-error" : "note-textarea"}
              placeholder="Что отработали, чей прогресс, на что обратить внимание в следующий раз..."
              value={note}
              onChange={e => { setNote(e.target.value); if (noteError) setNoteError(false); }}
              rows={5}
            />
            {noteError && <div className="form-error"><AlertCircle size={13} /> Заметка обязательна — опишите, как прошла тренировка</div>}
          </div>
        </main>

        <div className="detail-footer">
          <button className="save-btn" style={{ background: disc.color }} onClick={handleSave}>
            Сохранить запись
          </button>
        </div>
      </div>
    </div>
  );
}

function MetaChip({ icon, text }) {
  return <span className="meta-chip">{icon}{text}</span>;
}

function formatDate(d) {
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
    if (next === "left") onQuickUpdate({ status: "left", leftDate: TODAY_ISO });
    else onQuickUpdate({ status: next });
  }
  function convertToRegular() {
    if (onQuickUpdate) onQuickUpdate({ origin: "regular" });
  }

  const [commentDraft, setCommentDraft] = useState("");
  function addComment() {
    if (!commentDraft.trim() || !onQuickUpdate) return;
    const entry = { id: `cm${Date.now()}`, date: TODAY_ISO, text: commentDraft.trim() };
    onQuickUpdate({ comments: [entry, ...(student.comments || [])] });
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
          <button className="back-btn" onClick={onBack}><ChevronLeft size={20} /></button>
          <div className="detail-header-title">Карточка ученика</div>
          <div className="detail-header-actions">
            <button className="icon-action-btn" onClick={onEdit} aria-label="Редактировать"><Settings size={16} /></button>
            <button className="icon-action-btn danger" onClick={onDelete} aria-label="Удалить"><X size={16} /></button>
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
            <div className="student-profile-meta">{student.age} лет · {disc.label} · {coach?.name}</div>
            <div className="student-profile-stats">
              <div className="profile-stat"><div className="profile-stat-val">{student.attendance}%</div><div className="profile-stat-lbl">Посещение</div></div>
              <div className="profile-stat"><div className="profile-stat-val">{student.level}</div><div className="profile-stat-lbl">Уровень</div></div>
              <div className="profile-stat"><div className="profile-stat-val">{history.length}</div><div className="profile-stat-lbl">Записей</div></div>
            </div>
          </div>

          {onQuickUpdate && (
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
                  <span><Star size={13} /> Пришёл с пробного занятия {formatDate(student.joinDate)}</span>
                  <button onClick={convertToRegular}>Перевести в основные</button>
                </div>
              )}
            </>
          )}

          {onQuickUpdate && (
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
function AdminView({ tab, setTab, searchQ, setSearchQ, students, sessions, coaches, managers, manager, onNewSession, onNewStudent, onEditStudent, onDeleteStudent, onQuickUpdateStudent, onEditSession, onDeleteSession, onNewCoach, onEditCoach, onDeleteCoach, onNewManager, onEditManager, onDeleteManager, onLogout }) {
  const isOwner = manager.role === "owner";
  // Управляющий филиала заперт на свой филиал; владелец может смотреть "все филиалы"
  const [branchFilter, setBranchFilter] = useState(isOwner ? "all" : manager.branches[0]);

  const fStudents = branchFilter === "all" ? students : students.filter(s => s.branchId === branchFilter);
  const fSessions = branchFilter === "all" ? sessions : sessions.filter(s => s.branchId === branchFilter);
  const fCoaches = branchFilter === "all" ? coaches : coaches.filter(c => c.branches.includes(branchFilter));

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
            students={fStudents} sessions={fSessions} coaches={fCoaches}
            onNewCoach={onNewCoach} onEditCoach={onEditCoach} onDeleteCoach={onDeleteCoach}
            onQuickUpdateStudent={onQuickUpdateStudent}
          />
        )}
        {tab === "students" && (
          <AdminStudents
            searchQ={searchQ} students={fStudents} coaches={coaches}
            onEdit={onEditStudent} onDelete={onDeleteStudent}
            onQuickUpdateStudent={onQuickUpdateStudent}
          />
        )}
        {tab === "schedule" && (
          <AdminSchedule
            sessions={fSessions} coaches={coaches}
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
  const items = [
    { id: "overview",  label: "Обзор",         icon: <BarChart3 size={17} /> },
    { id: "loads",     label: "Загруженность",  icon: <TrendingUp size={17} /> },
    { id: "salary",    label: "Зарплата",       icon: <Award size={17} /> },
    { id: "coaches",   label: "Тренеры",        icon: <UserCircle2 size={17} /> },
    { id: "students",  label: "Ученики",        icon: <Users size={17} /> },
    { id: "schedule",  label: "Расписание",     icon: <Calendar size={17} /> },
    ...(manager.role === "owner" ? [{ id: "managers", label: "Управляющие", icon: <Settings size={17} /> }] : []),
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
          <div className="admin-user-role">{manager.role === "owner" ? "Владелец · оба филиала" : `Управляющий · ${BRANCHES[manager.branches[0]].label}`}</div>
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
  const enrolled = students.filter(isEnrolled);
  const totalStudents = enrolled.length;
  const activeToday = sessions.filter(s => s.date === TODAY_ISO).length;
  const missedThisWeek = sessions.filter(s => s.status === "missed").length;
  const avgAttendance = Math.round(enrolled.reduce((a, s) => a + s.attendance, 0) / (enrolled.length || 1));

  const branchIds = branchFilter === "all" ? Object.keys(BRANCHES) : [branchFilter];
  const weekStats = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, i) => ({
    day,
    count: branchIds.reduce((sum, bId) => sum + WEEK_STATS_BY_BRANCH[bId][i].count, 0),
  }));
  const maxWeek = Math.max(...weekStats.map(w => w.count), 1);

  const byDiscipline = Object.entries(DISCIPLINES).map(([key, d]) => ({
    ...d,
    key,
    count: enrolled.filter(s => s.discipline === key).length,
  }));
  const maxDisc = Math.max(...byDiscipline.map(d => d.count), 1);

  const attentionAll = enrolled.filter(s => s.flag || s.attendance < 80);
  const [attentionExpanded, setAttentionExpanded] = useState(false);
  const ATTENTION_PAGE = 10;
  const attentionShown = attentionExpanded ? attentionAll : attentionAll.slice(0, ATTENTION_PAGE);

  return (
    <div className="admin-page">
      <div className="kpi-row">
        <KpiCard label="Всего учеников" value={totalStudents} delta="+12 за месяц" icon={<Users size={18} />} />
        <KpiCard label="Тренировок сегодня" value={activeToday} delta="по расписанию" icon={<Calendar size={18} />} />
        <KpiCard label="Средняя посещаемость" value={`${avgAttendance}%`} delta="+3% к прошлой неделе" icon={<Target size={18} />} />
        <KpiCard label="Пропущено за неделю" value={missedThisWeek} delta="требует внимания" icon={<AlertCircle size={18} />} warn />
      </div>

      <div className="admin-grid-2">
        <div className="panel">
          <div className="panel-title">Загрузка по дням недели</div>
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
          <div className="panel-title">Ученики по направлениям</div>
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

      <FlowChart students={students} />

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
                  {s.flag === "injury" ? "Травма — ограничение нагрузки" : `Низкая посещаемость · ${s.attendance}%`}
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

function AdminCoaches({ students, sessions, coaches, onEditCoach, onDeleteCoach, onNewCoach, onQuickUpdateStudent }) {
  const [openCoachId, setOpenCoachId] = useState(null);
  const openCoach = coaches.find(c => c.id === openCoachId);

  if (openCoach) {
    return (
      <AdminCoachDetail
        coach={openCoach}
        students={students.filter(s => coachesOfStudent(s).includes(openCoach.id))}
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
          const myStudents = students.filter(s => coachesOfStudent(s).includes(c.id));
          const enrolled = myStudents.filter(isEnrolled);
          const avgAtt = Math.round(enrolled.reduce((a, s) => a + s.attendance, 0) / (enrolled.length || 1));
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
                {(c.grade || "regular") === "pro" && <span className="grade-badge pro">Про</span>}
                {c.branches.map(bId => (
                  <span key={bId} className="branch-chip-sm" style={{ color: BRANCHES[bId].color, borderColor: BRANCHES[bId].color }}>{BRANCHES[bId].label}</span>
                ))}
              </div>
              <div className="coach-admin-stats">
                <div><span className="cas-val">{enrolled.length}</span><span className="cas-lbl">учеников</span></div>
                <div><span className="cas-val">{avgAtt}%</span><span className="cas-lbl">посещение</span></div>
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
function AdminCoachDetail({ coach, students, sessions, onBack, onEdit, onDelete, onQuickUpdateStudent }) {
  const d = DISCIPLINES[coach.discipline];
  const enrolled = students.filter(isEnrolled);
  const avgAttendance = Math.round(enrolled.reduce((a, s) => a + s.attendance, 0) / (enrolled.length || 1));
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
            {(coach.grade || "regular") === "pro" && <span className="grade-badge pro">Про</span>}
          </div>
          <div className="coach-admin-meta"><DisciplineGlyph d={coach.discipline} size={13} /> {d.label} · стаж {coach.exp} · {coach.email}</div>
          <div className="coach-admin-branches" style={{ marginTop: 6 }}>
            {coach.branches.map(bId => (
              <span key={bId} className="branch-chip-sm" style={{ color: BRANCHES[bId].color, borderColor: BRANCHES[bId].color }}>{BRANCHES[bId].label}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="kpi-row">
        <KpiCard label="Учеников" value={enrolled.length} delta={`из них ${leftCount} ушло`} icon={<Users size={18} />} />
        <KpiCard label="Средняя посещаемость" value={`${avgAttendance}%`} delta="" icon={<Target size={18} />} />
        <KpiCard label="Проведено тренировок" value={done.length} delta="" icon={<CheckCircle2 size={18} />} />
        <KpiCard label="Пропущено" value={missedCount} delta={promoCount > 0 ? `${promoCount} с пробного` : ""} icon={<AlertCircle size={18} />} warn={missedCount > 0} />
      </div>

      <FlowChart students={students} />

      <div className="panel">
        <div className="panel-title">Ученики</div>
        <div className="admin-student-mini-list">
          {students.map(s => {
            const st = STUDENT_STATUS[s.status || "active"];
            return (
              <div className="admin-student-mini-row" key={s.id}>
                <span className="attention-dot" style={{ background: st.color }} />
                <div className="admin-student-mini-name">
                  {s.name}
                  {(s.origin || "regular") === "promo" && <Star size={11} color="#FFC24B" />}
                </div>
                <div className="admin-student-mini-meta">{s.attendance}% посещение · {st.label}</div>
                {onQuickUpdateStudent && (s.origin || "regular") === "promo" && s.status !== "left" && (
                  <button className="mini-convert-btn" onClick={() => onQuickUpdateStudent(s.id, { origin: "regular" })}>В основные</button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Тренировки с комментариями</div>
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
        <div className="admin-page-head-title">Управляющие</div>
        <button className="topbar-btn primary" onClick={onNewManager}><Plus size={14} /> Управляющий</button>
      </div>
      <div className="coach-grid">
        {managers.map(m => {
          const isOwner = m.role === "owner";
          const isSelf = m.id === currentManagerId;
          return (
            <div className="coach-admin-card" key={m.id} style={{ "--accent": "#3DA5FF" }}>
              <div className="coach-admin-top">
                <div className="coach-admin-avatar" style={{ background: "#3DA5FF" }}>{m.avatar}</div>
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
                <span className="grade-badge" style={{ background: "rgba(61,165,255,.15)", color: "#3DA5FF" }}>
                  {isOwner ? "Владелец" : "Управляющий филиала"}
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

function AdminStudents({ searchQ, students, coaches, onEdit, onDelete, onQuickUpdateStudent }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const filtered = students.filter(s => {
    if (!s.name.toLowerCase().includes(searchQ.toLowerCase())) return false;
    if (statusFilter === "promo") return (s.origin || "regular") === "promo";
    if (statusFilter !== "all") return (s.status || "active") === statusFilter;
    return true;
  });
  const promoCount = students.filter(s => (s.origin || "regular") === "promo").length;

  return (
    <div className="admin-page">
      <div className="status-filter-row">
        <button className={statusFilter === "all" ? "status-chip active" : "status-chip"} onClick={() => setStatusFilter("all")}>Все</button>
        <button className={statusFilter === "active" ? "status-chip active" : "status-chip"} onClick={() => setStatusFilter("active")}>Активные</button>
        <button className={statusFilter === "vacation" ? "status-chip active" : "status-chip"} onClick={() => setStatusFilter("vacation")}>В отпуске</button>
        <button className={statusFilter === "left" ? "status-chip active" : "status-chip"} onClick={() => setStatusFilter("left")}>Ушли</button>
        {promoCount > 0 && (
          <button className={statusFilter === "promo" ? "status-chip active" : "status-chip"} onClick={() => setStatusFilter("promo")}>
            <Star size={11} /> С пробного ({promoCount})
          </button>
        )}
      </div>
      <div className="panel">
        <div className="table-scroll">
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
                  <td className="table-name-cell">
                    {s.name}
                    {s.flag === "injury" && <AlertCircle size={13} color="#FF5454" />}
                    {(s.origin || "regular") === "promo" && <Star size={12} color="#FFC24B" />}
                  </td>
                  <td>{s.age}</td>
                  <td><span className="table-branch-tag" style={{ color: b.color, borderColor: b.color }}>{b.label}</span></td>
                  <td><span className="table-disc-tag" style={{ color: d.color, borderColor: d.color }}><DisciplineGlyph d={s.discipline} size={12}/>{d.label}</span></td>
                  <td>{coach?.name}</td>
                  <td>
                    {onQuickUpdateStudent ? (
                      <select
                        className="status-select"
                        style={{ color: st.color, borderColor: st.color }}
                        value={s.status || "active"}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (next === "left") onQuickUpdateStudent(s.id, { status: "left", leftDate: TODAY_ISO });
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
                      <div className="table-attendance-track"><div className="table-attendance-fill" style={{ width: `${s.attendance}%`, background: d.color }} /></div>
                      {s.attendance}%
                    </div>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="table-action-btn" onClick={() => onEdit(s)} aria-label="Редактировать"><Settings size={14} /></button>
                      <button className="table-action-btn danger" onClick={() => onDelete(s)} aria-label="Удалить"><X size={14} /></button>
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

function AdminSchedule({ sessions, coaches, onEdit, onDelete }) {
  const [selectedDate, setSelectedDate] = useState(TODAY_ISO);
  const [showAll, setShowAll] = useState(false);
  const markedDates = useMemo(() => new Set(sessions.map(s => s.date)), [sessions]);

  const byDay = sessions.reduce((acc, s) => {
    (acc[s.date] = acc[s.date] || []).push(s);
    return acc;
  }, {});
  const days = showAll ? Object.keys(byDay).sort() : (byDay[selectedDate] ? [selectedDate] : []);

  return (
    <div className="admin-page">
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
                  <div className="table-actions">
                    <button className="table-action-btn" onClick={() => onEdit(s)} aria-label="Редактировать"><Settings size={13} /></button>
                    <button className="table-action-btn danger" onClick={() => onDelete(s)} aria-label="Удалить"><X size={13} /></button>
                  </div>
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
        <span className="help-intro-tag" style={{ color: "#3DA5FF", borderColor: "#3DA5FF" }}>ПАМЯТКА УПРАВЛЯЮЩЕГО</span>
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
  const maxWeek = Math.max(...branchIds.flatMap(b => WEEK_STATS_BY_BRANCH[b].map(w => w.count)));

  const totalWeek = (bId) => WEEK_STATS_BY_BRANCH[bId].reduce((a, w) => a + w.count, 0);
  const busiestDay = (bId) => WEEK_STATS_BY_BRANCH[bId].reduce((a, w) => w.count > a.count ? w : a, WEEK_STATS_BY_BRANCH[bId][0]);

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
                {WEEK_STATS_BY_BRANCH[bId].map(w => (
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
          const rows = Object.entries(ATTENDANCE_BY_BRANCH_DISCIPLINE[bId]).filter(([, v]) => v !== null);
          return (
            <div className="panel" key={bId}>
              <div className="panel-title">{b.label} · посещаемость по направлениям</div>
              <div className="disc-distribution">
                {rows.map(([discKey, pct]) => {
                  const d = DISCIPLINES[discKey];
                  return (
                    <div className="disc-dist-row" key={discKey}>
                      <div className="disc-dist-label"><DisciplineGlyph d={discKey} size={14} />{d.label}</div>
                      <div className="disc-dist-track">
                        <div className="disc-dist-fill" style={{ width: `${pct}%`, background: pct < 80 ? "#FF5454" : d.color }} />
                      </div>
                      <div className="disc-dist-count">{pct}%</div>
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
            const avgAtt = Math.round(bStudents.reduce((a, s) => a + s.attendance, 0) / (bStudents.length || 1));
            return (
              <div className="branch-compare-row" key={bId}>
                <span className="branch-compare-name"><span className="discipline-key-dot" style={{ background: b.color }} />{b.label}</span>
                <span>{bStudents.length}</span>
                <span>{totalWeek(bId)}</span>
                <span>{avgAtt}%</span>
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
  const [selectedMonth, setSelectedMonth] = useState(months[0] || "2026-06");

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

  const grandTotal = rows.reduce((sum, r) => sum + r.salary.total, 0);
  const totalSessions = rows.reduce((sum, r) => sum + r.salary.totalSessions, 0);

  return (
    <div className="admin-page">
      {/* Шапка с выбором месяца */}
      <div className="salary-header">
        <div className="admin-page-head-title">Зарплата тренеров</div>
        <div className="salary-month-picker">
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
          <div className="salary-kpi-val">{grandTotal.toLocaleString("ru-RU")} ₽</div>
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
            {rows.length > 0 ? Math.round(grandTotal / rows.length).toLocaleString("ru-RU") : 0} ₽
          </div>
          <div className="salary-kpi-lbl">Средняя зарплата</div>
        </div>
      </div>

      {/* Таблица по тренерам */}
      <div className="panel">
        <div className="table-scroll">
        <table className="admin-table salary-table">
          <thead>
            <tr>
              <th>Тренер</th>
              <th>Грейд</th>
              <th>Групповых</th>
              <th>Заработок групп.</th>
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
              const hasEarned = salary.total > 0;
              return (
                <tr key={coach.id} className={!hasEarned ? "salary-row-zero" : ""}>
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
                      {isPro ? "Про" : "Обычный"}
                    </span>
                  </td>
                  <td className="salary-num">{salary.groupSessions}</td>
                  <td className="salary-num">{salary.groupEarned.toLocaleString("ru-RU")} ₽</td>
                  <td className="salary-num">{salary.indSessions}</td>
                  <td className="salary-num">{salary.indEarned.toLocaleString("ru-RU")} ₽</td>
                  <td>
                    <span className="salary-total">{salary.total.toLocaleString("ru-RU")} ₽</span>
                  </td>
                  <td>
                    <SalaryBar value={salary.total} max={rows[0]?.salary.total || 1} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="salary-tfoot">
              <td colSpan={2}>ИТОГО</td>
              <td className="salary-num">{rows.reduce((s,r) => s + r.salary.groupSessions, 0)}</td>
              <td className="salary-num">{rows.reduce((s,r) => s + r.salary.groupEarned, 0).toLocaleString("ru-RU")} ₽</td>
              <td className="salary-num">{rows.reduce((s,r) => s + r.salary.indSessions, 0)}</td>
              <td className="salary-num">{rows.reduce((s,r) => s + r.salary.indEarned, 0).toLocaleString("ru-RU")} ₽</td>
              <td><span className="salary-total">{grandTotal.toLocaleString("ru-RU")} ₽</span></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        </div>
      </div>

      {/* Тарифная сетка */}
      <div className="panel">
        <div className="panel-title">Тарифная сетка</div>
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

function SessionModal({ coaches, students, defaultCoachId, defaultBranchId, initialSession, onClose, onSave, onSaveRecurring }) {
  const isEditing = Boolean(initialSession);
  const [mode, setMode] = useState("single"); // "single" | "recurring" — режим доступен только при создании
  const [coachId, setCoachId] = useState(initialSession?.coachId || defaultCoachId || coaches[0].id);
  const coach = coaches.find(c => c.id === coachId);
  const [discipline, setDiscipline] = useState(initialSession?.discipline || coach.discipline);
  const [branchId, setBranchId] = useState(
    initialSession?.branchId ||
    (defaultBranchId && coach.branches.includes(defaultBranchId) ? defaultBranchId : coach.branches[0])
  );
  const [type, setType] = useState(initialSession?.type || "group");
  const [date, setDate] = useState(initialSession?.date || TODAY_ISO);
  const [time, setTime] = useState(initialSession?.time || "16:00");
  const [groupName, setGroupName] = useState(initialSession?.groupName || "");
  const [note, setNote] = useState(initialSession?.note || "");
  const [studentIds, setStudentIds] = useState(initialSession?.studentIds || []);
  const [studentQuery, setStudentQuery] = useState("");
  const [error, setError] = useState("");

  // Режим "Регулярная" — расписание из нескольких слотов (день недели + время), повторяется по неделям
  const [slots, setSlots] = useState([{ weekday: 0, time: "16:00" }]);
  const [startDate, setStartDate] = useState(TODAY_ISO);
  const [weeksAhead, setWeeksAhead] = useState(8);

  const pool = students
    .filter(s => coachesOfStudent(s).includes(coachId) && s.branchId === branchId)
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

  function handleSave() {
    if (!groupName.trim()) { setError("Укажи название группы"); return; }
    if (studentIds.length === 0) { setError("Выбери хотя бы одного ученика"); return; }
    if (type === "individual" && studentIds.length > 1) { setError("В индивидуальной тренировке только один ученик"); return; }
    const duration = SESSION_TYPES[type].fixedDuration;

    if (mode === "recurring") {
      if (slots.length === 0) { setError("Добавь хотя бы одно время в расписании"); return; }
      onSaveRecurring({
        type, discipline, coachId, branchId, groupName: groupName.trim(), studentIds, note: note.trim(),
        duration, slots, startDate, weeksAhead: Number(weeksAhead),
      });
      return;
    }
    onSave({ type, discipline, coachId, branchId, date, time, duration, groupName: groupName.trim(), studentIds, note: note.trim() });
  }

  const disc = DISCIPLINES[discipline];

  return (
    <ModalShell onClose={onClose} accent={disc.color}>
      <div className="modal-header">
        <div className="modal-title"><DisciplineGlyph d={discipline} size={16} /> {isEditing ? "Редактирование тренировки" : "Новая тренировка"}</div>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
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
            <select className="form-select" value={coachId} onChange={e => handleCoachChange(e.target.value)}>
              {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
        </div>

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

        <FormField label="Название группы">
          <input className="form-input" placeholder="БМХ Начинающие, Группа А..." value={groupName} onChange={e => setGroupName(e.target.value)} />
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
                    {studentIds.includes(s.id) && <CheckCircle2 size={12} color="#16181C" />}
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
function StudentModal({ coaches, defaultCoachId, defaultBranchId, initialStudent, onClose, onSave }) {
  const isEditing = Boolean(initialStudent);
  const [name, setName] = useState(initialStudent?.name || "");
  const [age, setAge] = useState(initialStudent?.age || 10);
  const initialCoach = coaches.find(c => c.id === (initialStudent?.coachId || defaultCoachId || coaches[0].id));
  const [coachId, setCoachId] = useState(initialCoach.id);
  const [discipline, setDiscipline] = useState(initialStudent?.discipline || initialCoach.discipline);
  const [branchId, setBranchId] = useState(
    initialStudent?.branchId ||
    (defaultBranchId && initialCoach.branches.includes(defaultBranchId) ? defaultBranchId : initialCoach.branches[0])
  );
  const [level, setLevel] = useState(initialStudent?.level || "Начальный");
  const [phone, setPhone] = useState(initialStudent?.phone || "");
  const [extraCoachIds, setExtraCoachIds] = useState(initialStudent?.extraCoachIds || []);
  const [extraDisciplines, setExtraDisciplines] = useState(initialStudent?.extraDisciplines || []);
  const [comments, setComments] = useState(initialStudent?.comments || []);
  const [commentDraft, setCommentDraft] = useState("");
  const [error, setError] = useState("");

  function handleCoachChange(id) {
    const c = coaches.find(x => x.id === id);
    setCoachId(id);
    setDiscipline(c.discipline);
    setBranchId(c.branches[0]);
    setExtraCoachIds(prev => prev.filter(x => x !== id));
  }

  function toggleExtraCoach(id) {
    if (id === coachId) return;
    setExtraCoachIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleExtraDiscipline(key) {
    if (key === discipline) return;
    setExtraDisciplines(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]);
  }

  function addComment() {
    if (!commentDraft.trim()) return;
    setComments(prev => [{ id: `cm${Date.now()}`, date: TODAY_ISO, text: commentDraft.trim() }, ...prev]);
    setCommentDraft("");
  }
  function removeComment(id) {
    setComments(prev => prev.filter(c => c.id !== id));
  }

  function handleSave() {
    if (!name.trim()) { setError("Укажи имя ученика"); return; }
    if (!phone.trim()) { setError("Укажи контактный телефон"); return; }
    onSave({
      name: name.trim(), age: Number(age), discipline, coachId, branchId, level, phone: phone.trim(),
      extraCoachIds, extraDisciplines, comments,
    });
  }

  const disc = DISCIPLINES[discipline];
  const coach = coaches.find(c => c.id === coachId);
  const otherCoaches = coaches.filter(c => c.id !== coachId);

  return (
    <ModalShell onClose={onClose} accent={disc.color}>
      <div className="modal-header">
        <div className="modal-title"><Users size={16} /> {isEditing ? "Редактирование ученика" : "Новый ученик"}</div>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="modal-body">
        <FormField label="Имя и фамилия">
          <input className="form-input" placeholder="Имя Фамилия" value={name} onChange={e => setName(e.target.value)} />
        </FormField>

        <div className="form-row-2">
          <FormField label="Возраст">
            <input className="form-input" type="number" min={4} max={25} value={age} onChange={e => setAge(e.target.value)} />
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
          <select className="form-select" value={coachId} onChange={e => handleCoachChange(e.target.value)}>
            {coaches.map(c => <option key={c.id} value={c.id}>{c.name} — {DISCIPLINES[c.discipline].label}</option>)}
          </select>
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
          <div className="disc-picker">
            {Object.entries(DISCIPLINES).map(([k, d]) => (
              <span key={k} className={k === discipline ? "disc-pill active" : "disc-pill"} style={k === discipline ? { borderColor: d.color, color: d.color } : {}}>
                <DisciplineGlyph d={k} size={12} /> {d.label}
              </span>
            ))}
          </div>
          <div className="form-hint">Определяется выбранным основным тренером</div>
        </FormField>

        <FormField label="Дополнительные направления (если занимается ещё чем-то)">
          <div className="disc-picker">
            {Object.entries(DISCIPLINES).filter(([k]) => k !== discipline).map(([k, d]) => (
              <button
                key={k} type="button"
                className={extraDisciplines.includes(k) ? "disc-pill active" : "disc-pill"}
                style={extraDisciplines.includes(k) ? { borderColor: d.color, color: d.color } : {}}
                onClick={() => toggleExtraDiscipline(k)}
              >
                <DisciplineGlyph d={k} size={12} /> {d.label}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Дополнительные тренеры (если тренируется ещё у кого-то)">
          {otherCoaches.length === 0 ? (
            <div className="form-hint">Больше тренеров в системе нет</div>
          ) : (
            <div className="picker-list">
              {otherCoaches.map(c => (
                <label key={c.id} className="picker-row">
                  <input type="checkbox" checked={extraCoachIds.includes(c.id)} onChange={() => toggleExtraCoach(c.id)} />
                  <span className="picker-check" style={{ background: extraCoachIds.includes(c.id) ? disc.color : "transparent" }}>
                    {extraCoachIds.includes(c.id) && <CheckCircle2 size={12} color="#16181C" />}
                  </span>
                  <span className="picker-name">{c.name}</span>
                  <span className="picker-meta">{DISCIPLINES[c.discipline].label}</span>
                </label>
              ))}
            </div>
          )}
        </FormField>

        <FormField label="Телефон родителя/ученика">
          <input className="form-input" placeholder="+49 151 ХХ-ХХ-ХХ" value={phone} onChange={e => setPhone(e.target.value)} />
        </FormField>

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
      <div className="modal-card" style={{ "--accent": accent }} onClick={e => e.stopPropagation()}>
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
function ConfirmDialog({ label, onCancel, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-card" onClick={e => e.stopPropagation()}>
        <div className="confirm-icon"><AlertCircle size={22} color="#FF5454" /></div>
        <div className="confirm-title">Удалить запись?</div>
        <div className="confirm-text">Ты собираешься удалить {label}. Это действие нельзя отменить.</div>
        <div className="confirm-actions">
          <button className="modal-btn-secondary" onClick={onCancel}>Отмена</button>
          <button className="confirm-btn-danger" onClick={onConfirm}>Удалить</button>
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
        <div className="confirm-icon"><AlertCircle size={22} color="#FFC83D" /></div>
        <div className="confirm-title">Действие невозможно</div>
        <div className="confirm-text">{text}</div>
        <div className="confirm-actions">
          <button className="modal-btn-primary" style={{ background: "#EDEFF2" }} onClick={onClose}>Понятно</button>
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

function CoachModal({ initialCoach, existingCoaches, managers, onClose, onSave }) {
  const isEditing = Boolean(initialCoach);
  const [name, setName] = useState(initialCoach?.name || "");
  const [discipline, setDiscipline] = useState(initialCoach?.discipline || "rollers");
  const [exp, setExp] = useState(initialCoach?.exp || "1 год");
  const [grade, setGrade] = useState(initialCoach?.grade || "regular");
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
    const byCoach = (existingCoaches || []).some(c => c.id !== initialCoach?.id && c.email.toLowerCase() === trimmedEmail);
    const byManager = (managers || []).some(m => m.email.toLowerCase() === trimmedEmail);
    return byCoach || byManager;
  }

  function handleSave() {
    if (!name.trim()) { setError("Укажи имя тренера"); return; }
    if (branches.length === 0) { setError("Выбери хотя бы один филиал"); return; }
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes("@")) { setError("Укажи корректную почту для входа"); return; }
    if (emailTakenByAnother(trimmedEmail)) { setError("Эта почта уже занята другим аккаунтом"); return; }

    if (isEditing) {
      onSave({ name: name.trim(), discipline, exp: exp.trim(), grade, branches, email: trimmedEmail, password });
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
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
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
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="modal-body">
        <FormField label="Имя и фамилия">
          <input className="form-input" placeholder="Имя Фамилия" value={name} onChange={e => setName(e.target.value)} />
        </FormField>

        <FormField label="Почта для входа">
          <input className="form-input" placeholder="coach@extremekids.ru" value={email} onChange={e => { setEmail(e.target.value); setError(""); }} />
        </FormField>

        {isEditing && (
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

        <FormField label="Грейд">
          <div className="segmented">
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
                  {branches.includes(k) && <CheckCircle2 size={12} color="#16181C" />}
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
function ManagerModal({ initialManager, existingManagers, coaches, onClose, onSave }) {
  const isEditing = Boolean(initialManager);
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
    const byCoach = (coaches || []).some(c => c.email.toLowerCase() === trimmedEmail);
    return byManager || byCoach;
  }

  function handleSave() {
    if (!name.trim()) { setError("Укажи имя управляющего"); return; }
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes("@")) { setError("Укажи корректную почту для входа"); return; }
    if (emailTakenByAnother(trimmedEmail)) { setError("Эта почта уже занята другим аккаунтом"); return; }

    const branches = role === "owner" ? ["roza", "irkutsk"] : [singleBranch];
    if (isEditing) {
      onSave({ name: name.trim(), email: trimmedEmail, role, branches, password });
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
      <ModalShell onClose={onClose} accent="#3DA5FF">
        <div className="modal-header">
          <div className="modal-title"><CheckCircle2 size={16} /> Управляющий добавлен</div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="credentials-hint">Передайте эти данные управляющему — пароль показывается один раз, повторно посмотреть его нельзя (только сбросить заново в карточке).</p>
          <div className="credentials-box">
            <div className="credentials-row"><span>Почта</span><b>{pendingPayload.email}</b></div>
            <div className="credentials-row"><span>Пароль</span><b>{pendingPayload.password}</b></div>
          </div>
          <button className="modal-btn-secondary" onClick={() => handleCopy(loginText)} style={{ width: "100%" }}>
            {copied ? "Скопировано" : "Скопировать почту и пароль"}
          </button>
        </div>
        <div className="modal-footer">
          <button className="modal-btn-primary" style={{ background: "#3DA5FF" }} onClick={() => onSave(pendingPayload)}>
            Готово
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose} accent="#3DA5FF">
      <div className="modal-header">
        <div className="modal-title"><Settings size={16} /> {isEditing ? "Редактирование управляющего" : "Новый управляющий"}</div>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="modal-body">
        <FormField label="Имя и фамилия">
          <input className="form-input" placeholder="Имя Фамилия" value={name} onChange={e => setName(e.target.value)} />
        </FormField>

        <FormField label="Почта для входа">
          <input className="form-input" placeholder="manager@extremekids.ru" value={email} onChange={e => { setEmail(e.target.value); setError(""); }} />
        </FormField>

        {isEditing && (
          <FormField label="Пароль">
            <div className="password-reset-row">
              <div className={passwordJustReset ? "password-reset-value shown" : "password-reset-value"}>
                {passwordJustReset ? password : "••••••••"}
              </div>
              <button type="button" className="modal-btn-secondary" onClick={resetPassword}>Сбросить пароль</button>
            </div>
            {passwordJustReset && (
              <p className="credentials-hint">Новый пароль показан один раз — сохраните изменения и передайте его управляющему.</p>
            )}
          </FormField>
        )}

        <FormField label="Уровень доступа">
          <div className="segmented">
            <button className={role === "branch_manager" ? "seg active" : "seg"} onClick={() => setRole("branch_manager")}>
              Управляющий филиала
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
                    {singleBranch === k && <CheckCircle2 size={12} color="#16181C" />}
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
        <button className="modal-btn-primary" style={{ background: "#3DA5FF" }} onClick={handleSave}>{isEditing ? "Сохранить изменения" : "Добавить управляющего"}</button>
      </div>
    </ModalShell>
  );
}

/* ============================================================
   СТИЛИ
   ============================================================ */
const CSS = `
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
.admin-table td { padding: 12px; font-size: 13px; border-bottom: 1px solid #1C1F25; }
.table-name-cell { font-weight: 600; display: flex; align-items: center; gap: 6px; }
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
.salary-kpi { background: #16181C; border: 1px solid #2A2E36; border-radius: 14px; padding: 16px 18px; }
.salary-kpi-val { font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 600; }
.salary-kpi-sub { font-size: 14px; color: #8A8F99; }
.salary-kpi-lbl { font-size: 11px; color: #8A8F99; margin-top: 4px; }

.salary-table tfoot td { padding: 12px; border-top: 1px solid #2A2E36; font-weight: 700; font-size: 12px; letter-spacing: .3px; text-transform: uppercase; color: #8A8F99; }
.salary-row-zero td { opacity: 0.45; }
.salary-coach-cell { display: flex; align-items: center; gap: 10px; }
.salary-avatar { width: 32px; height: 32px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px; color: #16181C; flex-shrink: 0; }
.salary-name { font-size: 13px; font-weight: 600; }
.salary-disc { font-size: 11px; color: #8A8F99; display: flex; align-items: center; gap: 4px; margin-top: 2px; }
.salary-num { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #8A8F99; }
.salary-total { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 700; color: #EDEFF2; }
.salary-bar-wrap { width: 70px; height: 6px; background: #1C1F25; border-radius: 3px; overflow: hidden; }
.salary-bar-fill { height: 100%; background: linear-gradient(90deg, #3DA5FF, #B14DFF); border-radius: 3px; }

/* ===== Grade badge ===== */
.grade-badge { font-size: 10px; font-weight: 700; letter-spacing: .4px; padding: 3px 9px; border-radius: 999px; }
.grade-badge.pro { background: rgba(255,200,61,.15); color: #FFC83D; }
.grade-badge.regular { background: rgba(138,143,153,.12); color: #8A8F99; }

/* ===== Rate grid in salary tab ===== */
.rate-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.rate-card { background: #1C1F25; border: 1px solid #2A2E36; border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
.rate-card-badge { font-size: 11px; font-weight: 700; letter-spacing: .3px; width: fit-content; padding: 3px 10px; border-radius: 999px; margin-bottom: 2px; }
.rate-card-badge.pro { background: rgba(255,200,61,.15); color: #FFC83D; }
.rate-card-badge.regular { background: rgba(138,143,153,.12); color: #8A8F99; }
.rate-row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font-size: 12px; color: #8A8F99; }
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

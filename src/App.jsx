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
  { id: "s1", name: "Игорь Шепель", age: 14, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 86, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-001" },
  { id: "s2", name: "Соня Карпова", age: 11, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 79, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-002" },
  { id: "s3", name: "Lukas Weber", age: 8, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 78, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-003" },
  { id: "s4", name: "Jonas Schmidt", age: 9, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 91, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-004" },
  { id: "s5", name: "Артём Волков", age: 11, discipline: "bike", coachId: "c7", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-005" },
  { id: "s6", name: "Ярослав Комаров", age: 16, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 87, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-006" },
  { id: "s7", name: "Юля Зуева", age: 7, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 85, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-007" },
  { id: "s8", name: "Артём Волков", age: 16, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 95, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-008" },
  { id: "s9", name: "Ярослав Комаров", age: 9, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Средний", attendance: 86, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-009" },
  { id: "s10", name: "Felix Brandt", age: 13, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Продвинутый", attendance: 95, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-010" },
  { id: "s11", name: "Тимур Беляев", age: 7, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Средний", attendance: 88, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-011" },
  { id: "s12", name: "Ника Краснова", age: 9, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-012" },
  { id: "s13", name: "Катя Полякова", age: 17, discipline: "skate", coachId: "c4", branchId: "roza", level: "Продвинутый", attendance: 83, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-013" },
  { id: "s14", name: "Степан Морозов", age: 13, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 84, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-014" },
  { id: "s15", name: "Ника Краснова", age: 16, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Продвинутый", attendance: 93, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-015" },
  { id: "s16", name: "Артём Волков", age: 14, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Продвинутый", attendance: 91, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-016" },
  { id: "s17", name: "Александр Беляков", age: 8, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Средний", attendance: 74, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-017" },
  { id: "s18", name: "Иван Жуков", age: 12, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-018" },
  { id: "s19", name: "Александр Беляков", age: 16, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 84, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-019", flag: "injury" },
  { id: "s20", name: "David Roth", age: 8, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Продвинутый", attendance: 81, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-020" },
  { id: "s21", name: "Дарья Тихонова", age: 14, discipline: "bike", coachId: "c7", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-021", flag: "injury" },
  { id: "s22", name: "Кирилл Соколов", age: 8, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Средний", attendance: 96, lastNote: "", phone: "+49 151 ХХ-022" },
  { id: "s23", name: "Марк Гусев", age: 11, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 80, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-023" },
  { id: "s24", name: "Вера Громова", age: 12, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 81, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-024" },
  { id: "s25", name: "Ярослав Комаров", age: 10, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 87, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-025" },
  { id: "s26", name: "Аня Светлова", age: 8, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 93, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-026" },
  { id: "s27", name: "Klara Vogt", age: 15, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 82, lastNote: "", phone: "+49 151 ХХ-027" },
  { id: "s28", name: "Игорь Шепель", age: 11, discipline: "skate", coachId: "c6", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-028" },
  { id: "s29", name: "Klara Vogt", age: 16, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 95, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-029", flag: "injury" },
  { id: "s30", name: "Игорь Шепель", age: 17, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 96, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-030" },
  { id: "s31", name: "Денис Кузнецов", age: 14, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 85, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-031" },
  { id: "s32", name: "Степан Морозов", age: 12, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 74, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-032" },
  { id: "s33", name: "Макс Орлов", age: 13, discipline: "bike", coachId: "c7", branchId: "roza", level: "Продвинутый", attendance: 88, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-033" },
  { id: "s34", name: "Дарья Тихонова", age: 12, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 84, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-034" },
  { id: "s35", name: "Ярослав Комаров", age: 8, discipline: "skate", coachId: "c4", branchId: "roza", level: "Продвинутый", attendance: 73, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-035" },
  { id: "s36", name: "Игорь Шепель", age: 14, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 85, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-036" },
  { id: "s37", name: "Денис Кузнецов", age: 8, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 99, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-037" },
  { id: "s38", name: "Никита Краснов", age: 15, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 91, lastNote: "", phone: "+49 151 ХХ-038" },
  { id: "s39", name: "Михаил Сафронов", age: 15, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 94, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-039" },
  { id: "s40", name: "София Беляева", age: 10, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 78, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-040" },
  { id: "s41", name: "Богдан Никитин", age: 15, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 97, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-041" },
  { id: "s42", name: "Александр Беляков", age: 8, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 89, lastNote: "", phone: "+49 151 ХХ-042" },
  { id: "s43", name: "Юля Зуева", age: 10, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 95, lastNote: "", phone: "+49 151 ХХ-043" },
  { id: "s44", name: "Денис Кузнецов", age: 13, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 95, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-044" },
  { id: "s45", name: "Денис Кузнецов", age: 9, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 85, lastNote: "", phone: "+49 151 ХХ-045" },
  { id: "s46", name: "Lena Weber", age: 16, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 81, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-046" },
  { id: "s47", name: "Дина Костина", age: 13, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 94, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-047" },
  { id: "s48", name: "Кирилл Соколов", age: 17, discipline: "skate", coachId: "c4", branchId: "roza", level: "Продвинутый", attendance: 77, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-048" },
  { id: "s49", name: "Денис Кузнецов", age: 10, discipline: "skate", coachId: "c6", branchId: "roza", level: "Продвинутый", attendance: 93, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-049" },
  { id: "s50", name: "Богдан Никитин", age: 13, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 93, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-050" },
  { id: "s51", name: "Тимур Беляев", age: 10, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 78, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-051" },
  { id: "s52", name: "Александр Беляков", age: 8, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "", phone: "+49 151 ХХ-052" },
  { id: "s53", name: "Олег Прядко", age: 8, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-053" },
  { id: "s54", name: "Felix Brandt", age: 14, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 65, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-054" },
  { id: "s55", name: "Ника Краснова", age: 12, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 87, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-055" },
  { id: "s56", name: "Дарья Тихонова", age: 12, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 88, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-056" },
  { id: "s57", name: "Никита Краснов", age: 7, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-057" },
  { id: "s58", name: "Anna Roth", age: 11, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 97, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-058" },
  { id: "s59", name: "Иван Жуков", age: 15, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 90, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-059" },
  { id: "s60", name: "Полина Рябова", age: 14, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 73, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-060" },
  { id: "s61", name: "Sofia Becker", age: 11, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 82, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-061" },
  { id: "s62", name: "Lukas Weber", age: 8, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Средний", attendance: 79, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-062" },
  { id: "s63", name: "Jonas Schmidt", age: 10, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 86, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-063" },
  { id: "s64", name: "Степан Морозов", age: 11, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 90, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-064" },
  { id: "s65", name: "Klara Vogt", age: 8, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 77, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-065" },
  { id: "s66", name: "Аня Светлова", age: 14, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 69, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-066" },
  { id: "s67", name: "Полина Рябова", age: 15, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 84, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-067" },
  { id: "s68", name: "Дина Костина", age: 7, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 99, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-068" },
  { id: "s69", name: "Лена Грач", age: 12, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-069" },
  { id: "s70", name: "Lena Weber", age: 14, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 97, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-070" },
  { id: "s71", name: "Мира Ким", age: 10, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 98, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-071" },
  { id: "s72", name: "Ника Краснова", age: 9, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 97, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-072" },
  { id: "s73", name: "Klara Vogt", age: 16, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Средний", attendance: 79, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-073" },
  { id: "s74", name: "Кирилл Соколов", age: 14, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-074" },
  { id: "s75", name: "София Беляева", age: 17, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 87, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-075" },
  { id: "s76", name: "Никита Краснов", age: 17, discipline: "skate", coachId: "c4", branchId: "roza", level: "Продвинутый", attendance: 83, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-076" },
  { id: "s77", name: "Степан Морозов", age: 11, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 86, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-077" },
  { id: "s78", name: "Кирилл Мельник", age: 10, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 86, lastNote: "", phone: "+49 151 ХХ-078" },
  { id: "s79", name: "Иван Жуков", age: 12, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 100, lastNote: "", phone: "+49 151 ХХ-079" },
  { id: "s80", name: "Ксения Зайцева", age: 11, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-080" },
  { id: "s81", name: "Катя Полякова", age: 9, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 86, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-081" },
  { id: "s82", name: "Вика Никитина", age: 16, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 91, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-082" },
  { id: "s83", name: "Глеб Воронин", age: 10, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Продвинутый", attendance: 77, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-083" },
  { id: "s84", name: "Кирилл Соколов", age: 12, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 80, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-084" },
  { id: "s85", name: "Вика Никитина", age: 16, discipline: "skate", coachId: "c6", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-085" },
  { id: "s86", name: "Вера Громова", age: 13, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 81, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-086" },
  { id: "s87", name: "Лиза Морозова", age: 7, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 81, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-087" },
  { id: "s88", name: "Андрей Поляков", age: 16, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 94, lastNote: "", phone: "+49 151 ХХ-088" },
  { id: "s89", name: "Кирилл Соколов", age: 15, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 93, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-089", flag: "injury" },
  { id: "s90", name: "Катя Полякова", age: 8, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 95, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-090" },
  { id: "s91", name: "Артём Волков", age: 17, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-091" },
  { id: "s92", name: "Anna Roth", age: 14, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 98, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-092" },
  { id: "s93", name: "Олеся Орехова", age: 15, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-093" },
  { id: "s94", name: "Соня Карпова", age: 14, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Продвинутый", attendance: 94, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-094" },
  { id: "s95", name: "Богдан Никитин", age: 13, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Продвинутый", attendance: 89, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-095" },
  { id: "s96", name: "Ярослав Комаров", age: 13, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 94, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-096" },
  { id: "s97", name: "Lena Weber", age: 8, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "", phone: "+49 151 ХХ-097" },
  { id: "s98", name: "Лена Грач", age: 12, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-098" },
  { id: "s99", name: "София Беляева", age: 15, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 91, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-099" },
  { id: "s100", name: "Олеся Орехова", age: 13, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 95, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-100" },
  { id: "s101", name: "Ярослав Комаров", age: 7, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 99, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-101" },
  { id: "s102", name: "Артём Волков", age: 14, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-102" },
  { id: "s103", name: "Богдан Никитин", age: 9, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-103" },
  { id: "s104", name: "Лука Семёнов", age: 16, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-104", flag: "injury" },
  { id: "s105", name: "Марк Гусев", age: 11, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 70, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-105" },
  { id: "s106", name: "Денис Кузнецов", age: 13, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 85, lastNote: "", phone: "+49 151 ХХ-106" },
  { id: "s107", name: "Кирилл Мельник", age: 13, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 98, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-107" },
  { id: "s108", name: "Кирилл Мельник", age: 11, discipline: "bike", coachId: "c7", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-108" },
  { id: "s109", name: "Felix Brandt", age: 9, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 81, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-109" },
  { id: "s110", name: "Ярослав Комаров", age: 14, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 95, lastNote: "", phone: "+49 151 ХХ-110" },
  { id: "s111", name: "Роман Громов", age: 9, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 81, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-111" },
  { id: "s112", name: "Степан Морозов", age: 10, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 96, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-112" },
  { id: "s113", name: "Вика Никитина", age: 14, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 80, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-113" },
  { id: "s114", name: "Felix Brandt", age: 17, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-114" },
  { id: "s115", name: "Вика Никитина", age: 8, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-115" },
  { id: "s116", name: "Ника Краснова", age: 9, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 94, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-116" },
  { id: "s117", name: "Ксения Зайцева", age: 16, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 77, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-117" },
  { id: "s118", name: "Настя Гусева", age: 10, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 97, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-118" },
  { id: "s119", name: "Никита Краснов", age: 12, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 94, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-119" },
  { id: "s120", name: "София Беляева", age: 15, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 77, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-120" },
  { id: "s121", name: "David Roth", age: 17, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 94, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-121" },
  { id: "s122", name: "Марк Гусев", age: 11, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 92, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-122" },
  { id: "s123", name: "Кирилл Мельник", age: 11, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 88, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-123" },
  { id: "s124", name: "Глеб Воронин", age: 17, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Продвинутый", attendance: 69, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-124" },
  { id: "s125", name: "Роман Громов", age: 15, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Продвинутый", attendance: 80, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-125" },
  { id: "s126", name: "София Беляева", age: 16, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 91, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-126" },
  { id: "s127", name: "Дарья Тихонова", age: 7, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 80, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-127" },
  { id: "s128", name: "Андрей Поляков", age: 12, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 96, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-128" },
  { id: "s129", name: "София Беляева", age: 8, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 78, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-129" },
  { id: "s130", name: "Дарья Тихонова", age: 13, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Продвинутый", attendance: 95, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-130" },
  { id: "s131", name: "Ксения Зайцева", age: 7, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-131" },
  { id: "s132", name: "Вика Никитина", age: 8, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 93, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-132" },
  { id: "s133", name: "Александр Беляков", age: 8, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 89, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-133" },
  { id: "s134", name: "Катя Полякова", age: 13, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 96, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-134" },
  { id: "s135", name: "Тимур Беляев", age: 15, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 96, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-135" },
  { id: "s136", name: "Jonas Schmidt", age: 11, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 96, lastNote: "", phone: "+49 151 ХХ-136" },
  { id: "s137", name: "Мира Ким", age: 12, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Средний", attendance: 89, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-137" },
  { id: "s138", name: "Олеся Орехова", age: 9, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Продвинутый", attendance: 96, lastNote: "", phone: "+49 151 ХХ-138" },
  { id: "s139", name: "Глеб Воронин", age: 7, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 93, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-139" },
  { id: "s140", name: "Денис Кузнецов", age: 7, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 81, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-140" },
  { id: "s141", name: "Mia Schmidt", age: 9, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-141" },
  { id: "s142", name: "Ева Линд", age: 10, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 84, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-142" },
  { id: "s143", name: "Sofia Becker", age: 15, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Продвинутый", attendance: 83, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-143" },
  { id: "s144", name: "Мира Ким", age: 17, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 85, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-144" },
  { id: "s145", name: "Никита Краснов", age: 7, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 79, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-145" },
  { id: "s146", name: "Anna Roth", age: 10, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 83, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-146" },
  { id: "s147", name: "Игорь Шепель", age: 16, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 89, lastNote: "", phone: "+49 151 ХХ-147" },
  { id: "s148", name: "Макс Орлов", age: 15, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Средний", attendance: 80, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-148" },
  { id: "s149", name: "Никита Краснов", age: 11, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Средний", attendance: 96, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-149" },
  { id: "s150", name: "Роман Громов", age: 13, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 77, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-150" },
  { id: "s151", name: "Олеся Орехова", age: 15, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 79, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-151" },
  { id: "s152", name: "Иван Жуков", age: 9, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Средний", attendance: 83, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-152" },
  { id: "s153", name: "Дина Костина", age: 8, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 94, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-153" },
  { id: "s154", name: "Глеб Воронин", age: 13, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-154" },
  { id: "s155", name: "David Roth", age: 15, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 88, lastNote: "", phone: "+49 151 ХХ-155" },
  { id: "s156", name: "Ксения Зайцева", age: 14, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 94, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-156" },
  { id: "s157", name: "Anna Roth", age: 16, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Продвинутый", attendance: 95, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-157" },
  { id: "s158", name: "Богдан Никитин", age: 15, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 96, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-158" },
  { id: "s159", name: "Соня Карпова", age: 7, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Средний", attendance: 83, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-159" },
  { id: "s160", name: "Кирилл Мельник", age: 10, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 64, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-160" },
  { id: "s161", name: "Настя Гусева", age: 16, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 95, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-161" },
  { id: "s162", name: "Маша Соколова", age: 10, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 99, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-162" },
  { id: "s163", name: "Вера Громова", age: 9, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 92, lastNote: "", phone: "+49 151 ХХ-163" },
  { id: "s164", name: "Дарья Тихонова", age: 14, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Продвинутый", attendance: 79, lastNote: "", phone: "+49 151 ХХ-164" },
  { id: "s165", name: "Ксения Зайцева", age: 8, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 85, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-165" },
  { id: "s166", name: "Вика Никитина", age: 17, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-166" },
  { id: "s167", name: "Jonas Schmidt", age: 12, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 89, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-167" },
  { id: "s168", name: "Соня Карпова", age: 13, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-168" },
  { id: "s169", name: "София Беляева", age: 10, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 93, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-169" },
  { id: "s170", name: "Ксения Зайцева", age: 14, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 98, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-170" },
  { id: "s171", name: "Sofia Becker", age: 13, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 91, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-171" },
  { id: "s172", name: "Ника Краснова", age: 12, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 96, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-172" },
  { id: "s173", name: "Игорь Шепель", age: 7, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 87, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-173" },
  { id: "s174", name: "Кирилл Мельник", age: 12, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 89, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-174" },
  { id: "s175", name: "Соня Карпова", age: 13, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 78, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-175" },
  { id: "s176", name: "Вера Громова", age: 9, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 89, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-176" },
  { id: "s177", name: "Никита Краснов", age: 8, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-177" },
  { id: "s178", name: "Ярослав Комаров", age: 8, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 80, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-178" },
  { id: "s179", name: "Ярослав Комаров", age: 14, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Продвинутый", attendance: 84, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-179" },
  { id: "s180", name: "Марк Гусев", age: 12, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-180" },
  { id: "s181", name: "Маша Соколова", age: 16, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 90, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-181" },
  { id: "s182", name: "Роман Громов", age: 15, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 87, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-182" },
  { id: "s183", name: "Дарья Тихонова", age: 13, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Продвинутый", attendance: 76, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-183" },
  { id: "s184", name: "Лиза Морозова", age: 14, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Продвинутый", attendance: 99, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-184" },
  { id: "s185", name: "Степан Морозов", age: 17, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 68, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-185" },
  { id: "s186", name: "Klara Vogt", age: 15, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 86, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-186" },
  { id: "s187", name: "Ева Линд", age: 7, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 86, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-187" },
  { id: "s188", name: "Иван Жуков", age: 16, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 75, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-188" },
  { id: "s189", name: "Полина Рябова", age: 12, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 82, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-189" },
  { id: "s190", name: "Макс Орлов", age: 8, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Продвинутый", attendance: 87, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-190" },
  { id: "s191", name: "Ника Краснова", age: 17, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 98, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-191" },
  { id: "s192", name: "Маша Соколова", age: 15, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-192" },
  { id: "s193", name: "Mia Schmidt", age: 17, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 81, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-193" },
  { id: "s194", name: "Роман Громов", age: 11, discipline: "bike", coachId: "c7", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-194" },
  { id: "s195", name: "David Roth", age: 9, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Продвинутый", attendance: 75, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-195" },
  { id: "s196", name: "Ксения Зайцева", age: 11, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 91, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-196" },
  { id: "s197", name: "Lukas Weber", age: 8, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Продвинутый", attendance: 91, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-197" },
  { id: "s198", name: "Дина Костина", age: 15, discipline: "bike", coachId: "c7", branchId: "roza", level: "Продвинутый", attendance: 96, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-198" },
  { id: "s199", name: "Klara Vogt", age: 11, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 87, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-199" },
  { id: "s200", name: "Мира Ким", age: 14, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 79, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-200" },
  { id: "s201", name: "Ева Линд", age: 9, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-201" },
  { id: "s202", name: "Вера Громова", age: 8, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 90, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-202" },
  { id: "s203", name: "Макс Орлов", age: 7, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Продвинутый", attendance: 87, lastNote: "", phone: "+49 151 ХХ-203" },
  { id: "s204", name: "Богдан Никитин", age: 14, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 92, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-204" },
  { id: "s205", name: "Кирилл Мельник", age: 16, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Средний", attendance: 83, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-205" },
  { id: "s206", name: "Олег Прядко", age: 7, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 83, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-206" },
  { id: "s207", name: "Дина Костина", age: 15, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 87, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-207" },
  { id: "s208", name: "Вера Громова", age: 14, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 88, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-208" },
  { id: "s209", name: "Mia Schmidt", age: 13, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 90, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-209" },
  { id: "s210", name: "Lena Weber", age: 12, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 87, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-210" },
  { id: "s211", name: "Полина Рябова", age: 11, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 82, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-211" },
  { id: "s212", name: "Игорь Шепель", age: 9, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 79, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-212" },
  { id: "s213", name: "Лука Семёнов", age: 9, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 89, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-213" },
  { id: "s214", name: "Иван Жуков", age: 15, discipline: "bike", coachId: "c7", branchId: "roza", level: "Продвинутый", attendance: 90, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-214" },
  { id: "s215", name: "Соня Карпова", age: 16, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 98, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-215" },
  { id: "s216", name: "Anna Roth", age: 9, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 88, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-216" },
  { id: "s217", name: "Daniel Becker", age: 12, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-217" },
  { id: "s218", name: "Дарья Тихонова", age: 17, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 89, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-218" },
  { id: "s219", name: "Ксения Зайцева", age: 17, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 94, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-219" },
  { id: "s220", name: "Дарья Тихонова", age: 11, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Средний", attendance: 79, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-220" },
  { id: "s221", name: "Настя Гусева", age: 11, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 83, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-221" },
  { id: "s222", name: "Daniel Becker", age: 14, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-222" },
  { id: "s223", name: "Никита Краснов", age: 11, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-223" },
  { id: "s224", name: "Алина Фролова", age: 15, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 96, lastNote: "", phone: "+49 151 ХХ-224" },
  { id: "s225", name: "Макс Орлов", age: 8, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 91, lastNote: "", phone: "+49 151 ХХ-225" },
  { id: "s226", name: "Лука Семёнов", age: 12, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 78, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-226" },
  { id: "s227", name: "Ева Линд", age: 13, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 75, lastNote: "", phone: "+49 151 ХХ-227" },
  { id: "s228", name: "David Roth", age: 10, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-228" },
  { id: "s229", name: "Дина Костина", age: 12, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-229" },
  { id: "s230", name: "Daniel Becker", age: 9, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 70, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-230" },
  { id: "s231", name: "Ева Линд", age: 11, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Продвинутый", attendance: 82, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-231" },
  { id: "s232", name: "Полина Рябова", age: 13, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 83, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-232" },
  { id: "s233", name: "София Беляева", age: 13, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 92, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-233" },
  { id: "s234", name: "Вика Никитина", age: 8, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 92, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-234" },
  { id: "s235", name: "Вера Громова", age: 14, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 88, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-235" },
  { id: "s236", name: "Настя Гусева", age: 11, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 76, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-236" },
  { id: "s237", name: "Felix Brandt", age: 16, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 84, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-237" },
  { id: "s238", name: "Юля Зуева", age: 12, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 91, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-238" },
  { id: "s239", name: "Алина Фролова", age: 8, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 91, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-239" },
  { id: "s240", name: "Александр Беляков", age: 8, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 89, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-240" },
  { id: "s241", name: "Кирилл Соколов", age: 7, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 75, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-241" },
  { id: "s242", name: "Михаил Сафронов", age: 17, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 99, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-242" },
  { id: "s243", name: "Лиза Морозова", age: 9, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-243", flag: "injury" },
  { id: "s244", name: "Богдан Никитин", age: 14, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 98, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-244" },
  { id: "s245", name: "Марк Гусев", age: 13, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Средний", attendance: 84, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-245" },
  { id: "s246", name: "Андрей Поляков", age: 10, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 88, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-246" },
  { id: "s247", name: "Anna Roth", age: 10, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 86, lastNote: "", phone: "+49 151 ХХ-247" },
  { id: "s248", name: "Михаил Сафронов", age: 9, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Продвинутый", attendance: 90, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-248" },
  { id: "s249", name: "Богдан Никитин", age: 16, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-249" },
  { id: "s250", name: "Тимур Беляев", age: 13, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 71, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-250" },
  { id: "s251", name: "Александр Беляков", age: 11, discipline: "bike", coachId: "c7", branchId: "roza", level: "Продвинутый", attendance: 74, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-251" },
  { id: "s252", name: "Соня Карпова", age: 10, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 84, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-252" },
  { id: "s253", name: "Алина Фролова", age: 17, discipline: "skate", coachId: "c6", branchId: "roza", level: "Продвинутый", attendance: 84, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-253" },
  { id: "s254", name: "Юля Зуева", age: 16, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 87, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-254" },
  { id: "s255", name: "Лиза Морозова", age: 17, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 86, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-255" },
  { id: "s256", name: "Катя Полякова", age: 12, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 89, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-256" },
  { id: "s257", name: "Иван Жуков", age: 12, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 90, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-257" },
  { id: "s258", name: "Вика Никитина", age: 8, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-258" },
  { id: "s259", name: "Полина Рябова", age: 10, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 82, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-259" },
  { id: "s260", name: "Денис Кузнецов", age: 11, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Средний", attendance: 84, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-260" },
  { id: "s261", name: "Соня Карпова", age: 11, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 96, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-261" },
  { id: "s262", name: "Иван Жуков", age: 9, discipline: "skate", coachId: "c6", branchId: "roza", level: "Продвинутый", attendance: 94, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-262" },
  { id: "s263", name: "Лена Грач", age: 13, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Средний", attendance: 69, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-263" },
  { id: "s264", name: "Jonas Schmidt", age: 14, discipline: "skate", coachId: "c4", branchId: "roza", level: "Начальный", attendance: 82, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-264" },
  { id: "s265", name: "Михаил Сафронов", age: 17, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 81, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-265" },
  { id: "s266", name: "Lena Weber", age: 8, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 95, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-266" },
  { id: "s267", name: "Ярослав Комаров", age: 11, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 86, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-267" },
  { id: "s268", name: "Катя Полякова", age: 9, discipline: "bike", coachId: "c7", branchId: "roza", level: "Продвинутый", attendance: 85, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-268" },
  { id: "s269", name: "Лена Грач", age: 13, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 93, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-269" },
  { id: "s270", name: "Ева Линд", age: 15, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-270" },
  { id: "s271", name: "Марк Гусев", age: 9, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 77, lastNote: "", phone: "+49 151 ХХ-271" },
  { id: "s272", name: "Anna Roth", age: 16, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-272" },
  { id: "s273", name: "Lukas Weber", age: 14, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 87, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-273" },
  { id: "s274", name: "Маша Соколова", age: 10, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-274" },
  { id: "s275", name: "Ника Краснова", age: 14, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 93, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-275" },
  { id: "s276", name: "Lukas Weber", age: 12, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 92, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-276" },
  { id: "s277", name: "Михаил Сафронов", age: 12, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-277" },
  { id: "s278", name: "Олег Прядко", age: 10, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 98, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-278" },
  { id: "s279", name: "Ева Линд", age: 11, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-279" },
  { id: "s280", name: "Кирилл Мельник", age: 11, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Средний", attendance: 66, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-280" },
  { id: "s281", name: "Соня Карпова", age: 11, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 94, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-281" },
  { id: "s282", name: "Роман Громов", age: 8, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 68, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-282" },
  { id: "s283", name: "Богдан Никитин", age: 12, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Средний", attendance: 79, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-283" },
  { id: "s284", name: "Вика Никитина", age: 12, discipline: "skate", coachId: "c4", branchId: "roza", level: "Продвинутый", attendance: 86, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-284" },
  { id: "s285", name: "Дина Костина", age: 8, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Продвинутый", attendance: 94, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-285" },
  { id: "s286", name: "Felix Brandt", age: 17, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 87, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-286", flag: "injury" },
  { id: "s287", name: "Ника Краснова", age: 17, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 80, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-287" },
  { id: "s288", name: "Мира Ким", age: 14, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 87, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-288" },
  { id: "s289", name: "Глеб Воронин", age: 11, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 82, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-289" },
  { id: "s290", name: "Роман Громов", age: 14, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 68, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-290" },
  { id: "s291", name: "Daniel Becker", age: 15, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 92, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-291" },
  { id: "s292", name: "Лена Грач", age: 9, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Продвинутый", attendance: 86, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-292" },
  { id: "s293", name: "Соня Карпова", age: 10, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Продвинутый", attendance: 93, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-293" },
  { id: "s294", name: "Daniel Becker", age: 10, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 81, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-294" },
  { id: "s295", name: "Klara Vogt", age: 10, discipline: "skate", coachId: "c6", branchId: "roza", level: "Продвинутый", attendance: 83, lastNote: "", phone: "+49 151 ХХ-295" },
  { id: "s296", name: "Иван Жуков", age: 9, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 92, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-296" },
  { id: "s297", name: "Олег Прядко", age: 11, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 86, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-297" },
  { id: "s298", name: "Макс Орлов", age: 17, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 96, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-298" },
  { id: "s299", name: "Катя Полякова", age: 9, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 76, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-299" },
  { id: "s300", name: "Sofia Becker", age: 10, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-300" },
  { id: "s301", name: "Александр Беляков", age: 7, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-301" },
  { id: "s302", name: "Денис Кузнецов", age: 9, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Продвинутый", attendance: 93, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-302" },
  { id: "s303", name: "Лука Семёнов", age: 9, discipline: "skate", coachId: "c6", branchId: "roza", level: "Продвинутый", attendance: 87, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-303" },
  { id: "s304", name: "Лиза Морозова", age: 8, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 91, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-304" },
  { id: "s305", name: "Sofia Becker", age: 7, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 83, lastNote: "", phone: "+49 151 ХХ-305" },
  { id: "s306", name: "Макс Орлов", age: 17, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 99, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-306" },
  { id: "s307", name: "Иван Жуков", age: 17, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 84, lastNote: "", phone: "+49 151 ХХ-307" },
  { id: "s308", name: "Дарья Тихонова", age: 7, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-308" },
  { id: "s309", name: "Катя Полякова", age: 7, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 97, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-309" },
  { id: "s310", name: "Богдан Никитин", age: 14, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Средний", attendance: 91, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-310" },
  { id: "s311", name: "Дина Костина", age: 9, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 95, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-311" },
  { id: "s312", name: "София Беляева", age: 12, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 90, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-312" },
  { id: "s313", name: "Юля Зуева", age: 12, discipline: "bike", coachId: "c7", branchId: "roza", level: "Продвинутый", attendance: 75, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-313" },
  { id: "s314", name: "Anna Roth", age: 9, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Продвинутый", attendance: 89, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-314" },
  { id: "s315", name: "Полина Рябова", age: 17, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 85, lastNote: "", phone: "+49 151 ХХ-315" },
  { id: "s316", name: "Felix Brandt", age: 14, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 81, lastNote: "", phone: "+49 151 ХХ-316" },
  { id: "s317", name: "Иван Жуков", age: 14, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Средний", attendance: 93, lastNote: "", phone: "+49 151 ХХ-317", flag: "injury" },
  { id: "s318", name: "Степан Морозов", age: 7, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 90, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-318" },
  { id: "s319", name: "David Roth", age: 15, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 87, lastNote: "", phone: "+49 151 ХХ-319" },
  { id: "s320", name: "Настя Гусева", age: 17, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 91, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-320" },
  { id: "s321", name: "Полина Рябова", age: 17, discipline: "skate", coachId: "c4", branchId: "roza", level: "Продвинутый", attendance: 82, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-321" },
  { id: "s322", name: "Александр Беляков", age: 11, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 74, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-322" },
  { id: "s323", name: "Klara Vogt", age: 16, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 71, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-323" },
  { id: "s324", name: "Полина Рябова", age: 13, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-324" },
  { id: "s325", name: "Богдан Никитин", age: 13, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 93, lastNote: "", phone: "+49 151 ХХ-325" },
  { id: "s326", name: "Ярослав Комаров", age: 12, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 71, lastNote: "", phone: "+49 151 ХХ-326" },
  { id: "s327", name: "David Roth", age: 16, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 85, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-327" },
  { id: "s328", name: "David Roth", age: 11, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 78, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-328" },
  { id: "s329", name: "Артём Волков", age: 11, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 82, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-329" },
  { id: "s330", name: "Степан Морозов", age: 10, discipline: "skate", coachId: "c6", branchId: "roza", level: "Средний", attendance: 85, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-330" },
  { id: "s331", name: "Александр Беляков", age: 15, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Начальный", attendance: 92, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-331" },
  { id: "s332", name: "Иван Жуков", age: 7, discipline: "bike", coachId: "c7", branchId: "roza", level: "Продвинутый", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-332" },
  { id: "s333", name: "Вера Громова", age: 14, discipline: "skate", coachId: "c4", branchId: "roza", level: "Продвинутый", attendance: 97, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-333" },
  { id: "s334", name: "Дина Костина", age: 15, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 93, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-334" },
  { id: "s335", name: "Кирилл Мельник", age: 11, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Средний", attendance: 70, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-335" },
  { id: "s336", name: "Лена Грач", age: 13, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Продвинутый", attendance: 78, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-336" },
  { id: "s337", name: "Кирилл Мельник", age: 8, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 76, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-337" },
  { id: "s338", name: "Ярослав Комаров", age: 17, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Начальный", attendance: 91, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-338" },
  { id: "s339", name: "Lukas Weber", age: 16, discipline: "bmx", coachId: "c1", branchId: "roza", level: "Начальный", attendance: 98, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-339", flag: "injury" },
  { id: "s340", name: "София Беляева", age: 8, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 92, lastNote: "", phone: "+49 151 ХХ-340" },
  { id: "s341", name: "Иван Жуков", age: 11, discipline: "skate", coachId: "c6", branchId: "roza", level: "Начальный", attendance: 96, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-341" },
  { id: "s342", name: "Лена Грач", age: 8, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 76, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-342" },
  { id: "s343", name: "Михаил Сафронов", age: 13, discipline: "bike", coachId: "c7", branchId: "roza", level: "Начальный", attendance: 82, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-343" },
  { id: "s344", name: "Klara Vogt", age: 15, discipline: "scooter", coachId: "c8", branchId: "roza", level: "Средний", attendance: 82, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-344" },
  { id: "s345", name: "Глеб Воронин", age: 10, discipline: "bmx", coachId: "c2", branchId: "roza", level: "Средний", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-345" },
  { id: "s346", name: "Вера Громова", age: 16, discipline: "skate", coachId: "c4", branchId: "roza", level: "Средний", attendance: 84, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-346" },
  { id: "s347", name: "Богдан Никитин", age: 12, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 88, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-347" },
  { id: "s348", name: "Jonas Schmidt", age: 13, discipline: "rollers", coachId: "c5", branchId: "roza", level: "Начальный", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-348" },
  { id: "s349", name: "Андрей Поляков", age: 12, discipline: "bike", coachId: "c7", branchId: "roza", level: "Средний", attendance: 82, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-349" },
  { id: "s350", name: "Лука Семёнов", age: 16, discipline: "rollers", coachId: "c3", branchId: "roza", level: "Начальный", attendance: 85, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-350" },
  { id: "s351", name: "Ника Краснова", age: 14, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "", phone: "+49 151 ХХ-351" },
  { id: "s352", name: "Sofia Becker", age: 9, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 81, lastNote: "", phone: "+49 151 ХХ-352" },
  { id: "s353", name: "Вика Никитина", age: 7, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Продвинутый", attendance: 79, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-353" },
  { id: "s354", name: "Lukas Weber", age: 12, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Продвинутый", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-354" },
  { id: "s355", name: "Вика Никитина", age: 15, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 80, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-355" },
  { id: "s356", name: "Олег Прядко", age: 7, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 86, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-356" },
  { id: "s357", name: "Дина Костина", age: 14, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 77, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-357" },
  { id: "s358", name: "Mia Schmidt", age: 12, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 82, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-358" },
  { id: "s359", name: "Дина Костина", age: 14, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Продвинутый", attendance: 90, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-359" },
  { id: "s360", name: "Роман Громов", age: 16, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 81, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-360" },
  { id: "s361", name: "Аня Светлова", age: 9, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Продвинутый", attendance: 86, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-361" },
  { id: "s362", name: "Вера Громова", age: 14, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 84, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-362" },
  { id: "s363", name: "Тимур Беляев", age: 12, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 73, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-363" },
  { id: "s364", name: "Богдан Никитин", age: 7, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Продвинутый", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-364" },
  { id: "s365", name: "Lukas Weber", age: 17, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 81, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-365" },
  { id: "s366", name: "Дина Костина", age: 10, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 90, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-366" },
  { id: "s367", name: "Полина Рябова", age: 13, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 88, lastNote: "", phone: "+49 151 ХХ-367" },
  { id: "s368", name: "Глеб Воронин", age: 15, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Продвинутый", attendance: 93, lastNote: "", phone: "+49 151 ХХ-368" },
  { id: "s369", name: "Богдан Никитин", age: 13, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 88, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-369" },
  { id: "s370", name: "Глеб Воронин", age: 11, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 98, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-370" },
  { id: "s371", name: "Ника Краснова", age: 10, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 99, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-371" },
  { id: "s372", name: "Ярослав Комаров", age: 15, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 83, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-372" },
  { id: "s373", name: "Кирилл Соколов", age: 15, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Продвинутый", attendance: 78, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-373" },
  { id: "s374", name: "Соня Карпова", age: 15, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Продвинутый", attendance: 86, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-374", flag: "injury" },
  { id: "s375", name: "Михаил Сафронов", age: 15, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Продвинутый", attendance: 98, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-375" },
  { id: "s376", name: "Михаил Сафронов", age: 10, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 81, lastNote: "", phone: "+49 151 ХХ-376" },
  { id: "s377", name: "Вика Никитина", age: 17, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-377" },
  { id: "s378", name: "Настя Гусева", age: 9, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 90, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-378" },
  { id: "s379", name: "Алина Фролова", age: 10, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 91, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-379" },
  { id: "s380", name: "Jonas Schmidt", age: 9, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 89, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-380" },
  { id: "s381", name: "Иван Жуков", age: 17, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-381" },
  { id: "s382", name: "Маша Соколова", age: 17, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 89, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-382" },
  { id: "s383", name: "Юля Зуева", age: 10, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 94, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-383" },
  { id: "s384", name: "Mia Schmidt", age: 12, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 91, lastNote: "", phone: "+49 151 ХХ-384" },
  { id: "s385", name: "Никита Краснов", age: 11, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-385" },
  { id: "s386", name: "Андрей Поляков", age: 17, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Продвинутый", attendance: 93, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-386" },
  { id: "s387", name: "Михаил Сафронов", age: 10, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 99, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-387" },
  { id: "s388", name: "Дарья Тихонова", age: 10, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 91, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-388" },
  { id: "s389", name: "Марк Гусев", age: 8, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-389", flag: "injury" },
  { id: "s390", name: "Lukas Weber", age: 7, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 91, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-390" },
  { id: "s391", name: "Глеб Воронин", age: 9, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 93, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-391" },
  { id: "s392", name: "Кирилл Мельник", age: 13, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 92, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-392" },
  { id: "s393", name: "Александр Беляков", age: 11, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 84, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-393" },
  { id: "s394", name: "Полина Рябова", age: 15, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 85, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-394" },
  { id: "s395", name: "Mia Schmidt", age: 8, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Продвинутый", attendance: 96, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-395" },
  { id: "s396", name: "Настя Гусева", age: 11, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-396" },
  { id: "s397", name: "Вера Громова", age: 14, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 93, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-397" },
  { id: "s398", name: "Богдан Никитин", age: 17, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 87, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-398" },
  { id: "s399", name: "Дарья Тихонова", age: 17, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 96, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-399" },
  { id: "s400", name: "Алина Фролова", age: 13, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 88, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-400" },
  { id: "s401", name: "Lukas Weber", age: 7, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 82, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-401" },
  { id: "s402", name: "Mia Schmidt", age: 10, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Продвинутый", attendance: 81, lastNote: "", phone: "+49 151 ХХ-402" },
  { id: "s403", name: "Юля Зуева", age: 12, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 89, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-403" },
  { id: "s404", name: "Роман Громов", age: 16, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-404" },
  { id: "s405", name: "Андрей Поляков", age: 17, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 92, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-405" },
  { id: "s406", name: "Sofia Becker", age: 11, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 88, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-406" },
  { id: "s407", name: "David Roth", age: 17, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 89, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-407" },
  { id: "s408", name: "Мира Ким", age: 8, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 91, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-408" },
  { id: "s409", name: "Sofia Becker", age: 17, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 97, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-409" },
  { id: "s410", name: "Полина Рябова", age: 14, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 81, lastNote: "", phone: "+49 151 ХХ-410" },
  { id: "s411", name: "Михаил Сафронов", age: 14, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 69, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-411" },
  { id: "s412", name: "Марк Гусев", age: 16, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 91, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-412" },
  { id: "s413", name: "София Беляева", age: 15, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 84, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-413" },
  { id: "s414", name: "Соня Карпова", age: 8, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-414" },
  { id: "s415", name: "Мира Ким", age: 16, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 76, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-415" },
  { id: "s416", name: "Маша Соколова", age: 10, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 79, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-416", flag: "injury" },
  { id: "s417", name: "Лука Семёнов", age: 9, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-417" },
  { id: "s418", name: "Дарья Тихонова", age: 9, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 79, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-418" },
  { id: "s419", name: "Богдан Никитин", age: 8, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-419" },
  { id: "s420", name: "Александр Беляков", age: 14, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 92, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-420" },
  { id: "s421", name: "Аня Светлова", age: 14, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 82, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-421" },
  { id: "s422", name: "Лука Семёнов", age: 15, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-422" },
  { id: "s423", name: "Кирилл Мельник", age: 15, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 96, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-423" },
  { id: "s424", name: "Михаил Сафронов", age: 8, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-424" },
  { id: "s425", name: "Олеся Орехова", age: 17, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 90, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-425" },
  { id: "s426", name: "Lukas Weber", age: 15, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 92, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-426" },
  { id: "s427", name: "David Roth", age: 12, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Продвинутый", attendance: 89, lastNote: "", phone: "+49 151 ХХ-427" },
  { id: "s428", name: "Mia Schmidt", age: 17, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 84, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-428" },
  { id: "s429", name: "Настя Гусева", age: 16, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 95, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-429" },
  { id: "s430", name: "David Roth", age: 15, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Продвинутый", attendance: 69, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-430" },
  { id: "s431", name: "Тимур Беляев", age: 8, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 83, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-431" },
  { id: "s432", name: "Lena Weber", age: 14, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-432" },
  { id: "s433", name: "Артём Волков", age: 8, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-433" },
  { id: "s434", name: "София Беляева", age: 14, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 96, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-434" },
  { id: "s435", name: "Юля Зуева", age: 9, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-435" },
  { id: "s436", name: "Олег Прядко", age: 15, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 80, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-436" },
  { id: "s437", name: "Глеб Воронин", age: 12, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-437" },
  { id: "s438", name: "Daniel Becker", age: 12, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 75, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-438" },
  { id: "s439", name: "Соня Карпова", age: 9, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-439" },
  { id: "s440", name: "Михаил Сафронов", age: 9, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 71, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-440" },
  { id: "s441", name: "Ксения Зайцева", age: 7, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 74, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-441" },
  { id: "s442", name: "Богдан Никитин", age: 12, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "", phone: "+49 151 ХХ-442" },
  { id: "s443", name: "Лена Грач", age: 17, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 77, lastNote: "", phone: "+49 151 ХХ-443" },
  { id: "s444", name: "David Roth", age: 13, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 85, lastNote: "", phone: "+49 151 ХХ-444" },
  { id: "s445", name: "Вика Никитина", age: 10, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 82, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-445" },
  { id: "s446", name: "Мира Ким", age: 12, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 96, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-446" },
  { id: "s447", name: "Дина Костина", age: 14, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 91, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-447" },
  { id: "s448", name: "Игорь Шепель", age: 15, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 78, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-448" },
  { id: "s449", name: "Богдан Никитин", age: 17, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Продвинутый", attendance: 90, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-449" },
  { id: "s450", name: "Мира Ким", age: 7, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 87, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-450" },
  { id: "s451", name: "Олег Прядко", age: 8, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 74, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-451" },
  { id: "s452", name: "Ярослав Комаров", age: 12, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 94, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-452" },
  { id: "s453", name: "Олеся Орехова", age: 12, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-453" },
  { id: "s454", name: "Ника Краснова", age: 8, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-454" },
  { id: "s455", name: "Михаил Сафронов", age: 11, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 99, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-455" },
  { id: "s456", name: "Игорь Шепель", age: 11, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 94, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-456" },
  { id: "s457", name: "Роман Громов", age: 13, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 89, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-457" },
  { id: "s458", name: "Daniel Becker", age: 7, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-458" },
  { id: "s459", name: "Лиза Морозова", age: 7, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-459" },
  { id: "s460", name: "Артём Волков", age: 11, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 92, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-460" },
  { id: "s461", name: "София Беляева", age: 7, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 90, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-461" },
  { id: "s462", name: "Ева Линд", age: 13, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 89, lastNote: "", phone: "+49 151 ХХ-462" },
  { id: "s463", name: "Маша Соколова", age: 11, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 93, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-463" },
  { id: "s464", name: "Катя Полякова", age: 16, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Продвинутый", attendance: 72, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-464" },
  { id: "s465", name: "Роман Громов", age: 14, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-465" },
  { id: "s466", name: "Ева Линд", age: 17, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 89, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-466" },
  { id: "s467", name: "Jonas Schmidt", age: 13, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Продвинутый", attendance: 90, lastNote: "", phone: "+49 151 ХХ-467" },
  { id: "s468", name: "Игорь Шепель", age: 14, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 81, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-468" },
  { id: "s469", name: "Ева Линд", age: 14, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 78, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-469" },
  { id: "s470", name: "Ника Краснова", age: 13, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 85, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-470" },
  { id: "s471", name: "Lukas Weber", age: 10, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 97, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-471" },
  { id: "s472", name: "Лука Семёнов", age: 8, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Продвинутый", attendance: 83, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-472" },
  { id: "s473", name: "Кирилл Соколов", age: 8, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 94, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-473" },
  { id: "s474", name: "Jonas Schmidt", age: 12, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 84, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-474" },
  { id: "s475", name: "Lena Weber", age: 17, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 87, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-475" },
  { id: "s476", name: "Klara Vogt", age: 12, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-476" },
  { id: "s477", name: "Лена Грач", age: 15, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 70, lastNote: "", phone: "+49 151 ХХ-477" },
  { id: "s478", name: "Mia Schmidt", age: 13, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-478" },
  { id: "s479", name: "Дарья Тихонова", age: 10, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 73, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-479" },
  { id: "s480", name: "Вера Громова", age: 10, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 94, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-480" },
  { id: "s481", name: "Jonas Schmidt", age: 11, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 84, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-481" },
  { id: "s482", name: "Felix Brandt", age: 14, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 95, lastNote: "", phone: "+49 151 ХХ-482" },
  { id: "s483", name: "Роман Громов", age: 16, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 97, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-483" },
  { id: "s484", name: "София Беляева", age: 14, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Продвинутый", attendance: 100, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-484" },
  { id: "s485", name: "Klara Vogt", age: 13, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 70, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-485" },
  { id: "s486", name: "Соня Карпова", age: 8, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 82, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-486" },
  { id: "s487", name: "Лиза Морозова", age: 7, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 94, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-487" },
  { id: "s488", name: "Никита Краснов", age: 11, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 88, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-488" },
  { id: "s489", name: "Mia Schmidt", age: 15, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 73, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-489" },
  { id: "s490", name: "Лена Грач", age: 12, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 99, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-490" },
  { id: "s491", name: "София Беляева", age: 14, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 99, lastNote: "", phone: "+49 151 ХХ-491" },
  { id: "s492", name: "Jonas Schmidt", age: 17, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 86, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-492" },
  { id: "s493", name: "София Беляева", age: 13, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 79, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-493" },
  { id: "s494", name: "Роман Громов", age: 16, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Продвинутый", attendance: 72, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-494" },
  { id: "s495", name: "Лука Семёнов", age: 7, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 90, lastNote: "", phone: "+49 151 ХХ-495" },
  { id: "s496", name: "Mia Schmidt", age: 11, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 74, lastNote: "", phone: "+49 151 ХХ-496" },
  { id: "s497", name: "Lena Weber", age: 9, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 81, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-497" },
  { id: "s498", name: "Полина Рябова", age: 11, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-498" },
  { id: "s499", name: "Артём Волков", age: 8, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 89, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-499" },
  { id: "s500", name: "Игорь Шепель", age: 16, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 63, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-500" },
  { id: "s501", name: "Макс Орлов", age: 10, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 92, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-501" },
  { id: "s502", name: "Полина Рябова", age: 10, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 84, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-502" },
  { id: "s503", name: "Кирилл Соколов", age: 9, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 82, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-503" },
  { id: "s504", name: "Никита Краснов", age: 14, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Продвинутый", attendance: 73, lastNote: "", phone: "+49 151 ХХ-504" },
  { id: "s505", name: "Алина Фролова", age: 8, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 88, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-505" },
  { id: "s506", name: "Денис Кузнецов", age: 13, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 88, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-506" },
  { id: "s507", name: "Катя Полякова", age: 11, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 73, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-507" },
  { id: "s508", name: "Юля Зуева", age: 7, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 94, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-508" },
  { id: "s509", name: "Lukas Weber", age: 14, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 92, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-509" },
  { id: "s510", name: "Ксения Зайцева", age: 7, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 98, lastNote: "", phone: "+49 151 ХХ-510" },
  { id: "s511", name: "Олег Прядко", age: 8, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 94, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-511", flag: "injury" },
  { id: "s512", name: "Марк Гусев", age: 16, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Продвинутый", attendance: 86, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-512" },
  { id: "s513", name: "Мира Ким", age: 7, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 78, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-513" },
  { id: "s514", name: "Мира Ким", age: 13, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 76, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-514", flag: "injury" },
  { id: "s515", name: "Александр Беляков", age: 10, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 91, lastNote: "", phone: "+49 151 ХХ-515" },
  { id: "s516", name: "Юля Зуева", age: 13, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 98, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-516" },
  { id: "s517", name: "Полина Рябова", age: 16, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-517" },
  { id: "s518", name: "Марк Гусев", age: 14, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Продвинутый", attendance: 87, lastNote: "", phone: "+49 151 ХХ-518" },
  { id: "s519", name: "Ярослав Комаров", age: 14, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 95, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-519" },
  { id: "s520", name: "Lena Weber", age: 8, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 68, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-520" },
  { id: "s521", name: "Тимур Беляев", age: 8, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 96, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-521" },
  { id: "s522", name: "Артём Волков", age: 10, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 80, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-522" },
  { id: "s523", name: "Аня Светлова", age: 7, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 79, lastNote: "", phone: "+49 151 ХХ-523" },
  { id: "s524", name: "Артём Волков", age: 13, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-524" },
  { id: "s525", name: "Марк Гусев", age: 16, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 91, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-525" },
  { id: "s526", name: "Юля Зуева", age: 10, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 94, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-526" },
  { id: "s527", name: "Аня Светлова", age: 15, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 88, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-527" },
  { id: "s528", name: "Кирилл Соколов", age: 8, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-528" },
  { id: "s529", name: "Алина Фролова", age: 12, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Продвинутый", attendance: 100, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-529" },
  { id: "s530", name: "Андрей Поляков", age: 16, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 89, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-530" },
  { id: "s531", name: "Аня Светлова", age: 10, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 89, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-531" },
  { id: "s532", name: "Felix Brandt", age: 9, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 93, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-532" },
  { id: "s533", name: "Андрей Поляков", age: 14, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-533", flag: "injury" },
  { id: "s534", name: "Олеся Орехова", age: 9, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Продвинутый", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-534" },
  { id: "s535", name: "Артём Волков", age: 10, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 95, lastNote: "", phone: "+49 151 ХХ-535" },
  { id: "s536", name: "Глеб Воронин", age: 15, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-536" },
  { id: "s537", name: "Андрей Поляков", age: 11, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 74, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-537" },
  { id: "s538", name: "Lena Weber", age: 15, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 84, lastNote: "", phone: "+49 151 ХХ-538" },
  { id: "s539", name: "София Беляева", age: 9, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-539" },
  { id: "s540", name: "София Беляева", age: 17, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 89, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-540" },
  { id: "s541", name: "Богдан Никитин", age: 14, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Продвинутый", attendance: 83, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-541" },
  { id: "s542", name: "Артём Волков", age: 9, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 89, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-542" },
  { id: "s543", name: "Глеб Воронин", age: 8, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 78, lastNote: "", phone: "+49 151 ХХ-543" },
  { id: "s544", name: "Аня Светлова", age: 12, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 92, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-544" },
  { id: "s545", name: "Катя Полякова", age: 7, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 82, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-545" },
  { id: "s546", name: "David Roth", age: 10, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 84, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-546" },
  { id: "s547", name: "Денис Кузнецов", age: 14, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 77, lastNote: "", phone: "+49 151 ХХ-547" },
  { id: "s548", name: "Роман Громов", age: 17, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-548" },
  { id: "s549", name: "Олеся Орехова", age: 17, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Продвинутый", attendance: 79, lastNote: "", phone: "+49 151 ХХ-549" },
  { id: "s550", name: "Ксения Зайцева", age: 16, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 81, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-550" },
  { id: "s551", name: "Лука Семёнов", age: 10, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-551" },
  { id: "s552", name: "Александр Беляков", age: 8, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Продвинутый", attendance: 88, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-552", flag: "injury" },
  { id: "s553", name: "Felix Brandt", age: 7, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 72, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-553" },
  { id: "s554", name: "Felix Brandt", age: 16, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 91, lastNote: "", phone: "+49 151 ХХ-554" },
  { id: "s555", name: "Ксения Зайцева", age: 14, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 97, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-555" },
  { id: "s556", name: "Роман Громов", age: 10, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-556" },
  { id: "s557", name: "Артём Волков", age: 16, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "", phone: "+49 151 ХХ-557" },
  { id: "s558", name: "Никита Краснов", age: 17, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 87, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-558" },
  { id: "s559", name: "Макс Орлов", age: 7, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 91, lastNote: "", phone: "+49 151 ХХ-559" },
  { id: "s560", name: "Михаил Сафронов", age: 17, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Продвинутый", attendance: 95, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-560" },
  { id: "s561", name: "Lukas Weber", age: 13, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 89, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-561" },
  { id: "s562", name: "Олег Прядко", age: 16, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-562" },
  { id: "s563", name: "Юля Зуева", age: 7, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 85, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-563" },
  { id: "s564", name: "Соня Карпова", age: 15, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Продвинутый", attendance: 91, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-564" },
  { id: "s565", name: "Александр Беляков", age: 11, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 97, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-565" },
  { id: "s566", name: "Иван Жуков", age: 16, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-566" },
  { id: "s567", name: "Катя Полякова", age: 8, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 77, lastNote: "", phone: "+49 151 ХХ-567" },
  { id: "s568", name: "Мира Ким", age: 16, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 79, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-568" },
  { id: "s569", name: "Лука Семёнов", age: 15, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Продвинутый", attendance: 88, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-569" },
  { id: "s570", name: "Соня Карпова", age: 14, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-570" },
  { id: "s571", name: "Андрей Поляков", age: 16, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 82, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-571" },
  { id: "s572", name: "Дарья Тихонова", age: 13, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 88, lastNote: "", phone: "+49 151 ХХ-572" },
  { id: "s573", name: "Катя Полякова", age: 12, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Продвинутый", attendance: 100, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-573" },
  { id: "s574", name: "Felix Brandt", age: 11, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 87, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-574" },
  { id: "s575", name: "Вера Громова", age: 9, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 82, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-575" },
  { id: "s576", name: "Соня Карпова", age: 13, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 71, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-576" },
  { id: "s577", name: "Дарья Тихонова", age: 17, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 84, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-577" },
  { id: "s578", name: "Лиза Морозова", age: 11, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 82, lastNote: "", phone: "+49 151 ХХ-578" },
  { id: "s579", name: "Макс Орлов", age: 8, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 88, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-579" },
  { id: "s580", name: "Klara Vogt", age: 17, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 90, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-580" },
  { id: "s581", name: "Daniel Becker", age: 13, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 81, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-581" },
  { id: "s582", name: "Anna Roth", age: 7, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Продвинутый", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-582" },
  { id: "s583", name: "Lena Weber", age: 8, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 92, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-583" },
  { id: "s584", name: "Лена Грач", age: 12, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 84, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-584" },
  { id: "s585", name: "Юля Зуева", age: 16, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 80, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-585" },
  { id: "s586", name: "Тимур Беляев", age: 13, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-586" },
  { id: "s587", name: "Sofia Becker", age: 12, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 95, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-587" },
  { id: "s588", name: "Sofia Becker", age: 13, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 84, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-588" },
  { id: "s589", name: "Лиза Морозова", age: 13, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 86, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-589" },
  { id: "s590", name: "Юля Зуева", age: 9, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 95, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-590" },
  { id: "s591", name: "Маша Соколова", age: 14, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 86, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-591" },
  { id: "s592", name: "Дина Костина", age: 14, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 87, lastNote: "", phone: "+49 151 ХХ-592" },
  { id: "s593", name: "Лука Семёнов", age: 17, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 86, lastNote: "", phone: "+49 151 ХХ-593" },
  { id: "s594", name: "Ника Краснова", age: 11, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 84, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-594" },
  { id: "s595", name: "Кирилл Мельник", age: 17, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "", phone: "+49 151 ХХ-595" },
  { id: "s596", name: "David Roth", age: 9, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 80, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-596" },
  { id: "s597", name: "Марк Гусев", age: 7, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 89, lastNote: "", phone: "+49 151 ХХ-597" },
  { id: "s598", name: "Felix Brandt", age: 14, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 68, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-598" },
  { id: "s599", name: "Дина Костина", age: 7, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-599" },
  { id: "s600", name: "Юля Зуева", age: 13, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 85, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-600" },
  { id: "s601", name: "Олег Прядко", age: 17, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-601", flag: "injury" },
  { id: "s602", name: "Настя Гусева", age: 11, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 88, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-602" },
  { id: "s603", name: "Дарья Тихонова", age: 7, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 86, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-603" },
  { id: "s604", name: "Кирилл Мельник", age: 17, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Продвинутый", attendance: 80, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-604" },
  { id: "s605", name: "Дарья Тихонова", age: 17, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 93, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-605" },
  { id: "s606", name: "Александр Беляков", age: 16, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 79, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-606" },
  { id: "s607", name: "Anna Roth", age: 14, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 81, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-607" },
  { id: "s608", name: "Соня Карпова", age: 17, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "", phone: "+49 151 ХХ-608" },
  { id: "s609", name: "Богдан Никитин", age: 9, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 98, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-609" },
  { id: "s610", name: "Ева Линд", age: 9, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Продвинутый", attendance: 83, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-610" },
  { id: "s611", name: "Юля Зуева", age: 14, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-611" },
  { id: "s612", name: "Дарья Тихонова", age: 9, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Продвинутый", attendance: 91, lastNote: "", phone: "+49 151 ХХ-612" },
  { id: "s613", name: "Глеб Воронин", age: 8, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 85, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-613" },
  { id: "s614", name: "David Roth", age: 8, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Продвинутый", attendance: 86, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-614" },
  { id: "s615", name: "Ксения Зайцева", age: 8, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Продвинутый", attendance: 84, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-615" },
  { id: "s616", name: "Anna Roth", age: 14, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 84, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-616" },
  { id: "s617", name: "Ярослав Комаров", age: 10, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 88, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-617" },
  { id: "s618", name: "Андрей Поляков", age: 17, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 92, lastNote: "", phone: "+49 151 ХХ-618" },
  { id: "s619", name: "Дина Костина", age: 14, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 99, lastNote: "", phone: "+49 151 ХХ-619" },
  { id: "s620", name: "Дарья Тихонова", age: 14, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Продвинутый", attendance: 100, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-620" },
  { id: "s621", name: "София Беляева", age: 17, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 86, lastNote: "", phone: "+49 151 ХХ-621" },
  { id: "s622", name: "Лиза Морозова", age: 11, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 74, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-622" },
  { id: "s623", name: "David Roth", age: 11, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Продвинутый", attendance: 99, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-623" },
  { id: "s624", name: "Ксения Зайцева", age: 7, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-624" },
  { id: "s625", name: "Ника Краснова", age: 8, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 89, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-625" },
  { id: "s626", name: "Алина Фролова", age: 16, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 94, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-626" },
  { id: "s627", name: "Klara Vogt", age: 15, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 89, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-627" },
  { id: "s628", name: "Klara Vogt", age: 9, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 81, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-628" },
  { id: "s629", name: "Настя Гусева", age: 12, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 93, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-629" },
  { id: "s630", name: "Полина Рябова", age: 13, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 90, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-630" },
  { id: "s631", name: "Лена Грач", age: 17, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-631" },
  { id: "s632", name: "Михаил Сафронов", age: 9, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Продвинутый", attendance: 80, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-632" },
  { id: "s633", name: "Anna Roth", age: 8, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 91, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-633" },
  { id: "s634", name: "Ярослав Комаров", age: 13, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 76, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-634" },
  { id: "s635", name: "Тимур Беляев", age: 8, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 94, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-635" },
  { id: "s636", name: "Марк Гусев", age: 9, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 86, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-636" },
  { id: "s637", name: "Макс Орлов", age: 13, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-637" },
  { id: "s638", name: "Артём Волков", age: 15, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 93, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-638" },
  { id: "s639", name: "Александр Беляков", age: 16, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 73, lastNote: "", phone: "+49 151 ХХ-639" },
  { id: "s640", name: "Ярослав Комаров", age: 11, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Продвинутый", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-640" },
  { id: "s641", name: "Соня Карпова", age: 17, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 94, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-641" },
  { id: "s642", name: "Артём Волков", age: 16, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 87, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-642" },
  { id: "s643", name: "Глеб Воронин", age: 17, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 79, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-643" },
  { id: "s644", name: "Александр Беляков", age: 8, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 80, lastNote: "", phone: "+49 151 ХХ-644" },
  { id: "s645", name: "Степан Морозов", age: 9, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 77, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-645" },
  { id: "s646", name: "Глеб Воронин", age: 8, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Продвинутый", attendance: 88, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-646" },
  { id: "s647", name: "Настя Гусева", age: 10, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 83, lastNote: "", phone: "+49 151 ХХ-647" },
  { id: "s648", name: "Anna Roth", age: 8, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-648" },
  { id: "s649", name: "Ксения Зайцева", age: 8, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 99, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-649" },
  { id: "s650", name: "Jonas Schmidt", age: 12, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 90, lastNote: "", phone: "+49 151 ХХ-650" },
  { id: "s651", name: "Катя Полякова", age: 12, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Продвинутый", attendance: 87, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-651" },
  { id: "s652", name: "Klara Vogt", age: 14, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 94, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-652" },
  { id: "s653", name: "Лиза Морозова", age: 8, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Продвинутый", attendance: 82, lastNote: "", phone: "+49 151 ХХ-653" },
  { id: "s654", name: "Mia Schmidt", age: 13, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 94, lastNote: "", phone: "+49 151 ХХ-654" },
  { id: "s655", name: "Игорь Шепель", age: 10, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 75, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-655" },
  { id: "s656", name: "Макс Орлов", age: 7, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 80, lastNote: "", phone: "+49 151 ХХ-656" },
  { id: "s657", name: "Полина Рябова", age: 9, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 92, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-657" },
  { id: "s658", name: "Полина Рябова", age: 8, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Продвинутый", attendance: 88, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-658" },
  { id: "s659", name: "Игорь Шепель", age: 8, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 82, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-659" },
  { id: "s660", name: "Соня Карпова", age: 15, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 90, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-660" },
  { id: "s661", name: "Ника Краснова", age: 7, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 95, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-661" },
  { id: "s662", name: "Кирилл Соколов", age: 16, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 68, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-662" },
  { id: "s663", name: "Lena Weber", age: 8, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Продвинутый", attendance: 94, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-663" },
  { id: "s664", name: "David Roth", age: 8, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Продвинутый", attendance: 91, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-664" },
  { id: "s665", name: "Алина Фролова", age: 16, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Продвинутый", attendance: 91, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-665" },
  { id: "s666", name: "Макс Орлов", age: 15, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Продвинутый", attendance: 84, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-666", flag: "injury" },
  { id: "s667", name: "Вика Никитина", age: 9, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-667" },
  { id: "s668", name: "Макс Орлов", age: 15, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 99, lastNote: "", phone: "+49 151 ХХ-668" },
  { id: "s669", name: "Klara Vogt", age: 13, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 85, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-669" },
  { id: "s670", name: "Артём Волков", age: 10, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 93, lastNote: "", phone: "+49 151 ХХ-670" },
  { id: "s671", name: "Алина Фролова", age: 16, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 93, lastNote: "", phone: "+49 151 ХХ-671" },
  { id: "s672", name: "Ева Линд", age: 11, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Начальный", attendance: 80, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-672", flag: "injury" },
  { id: "s673", name: "Денис Кузнецов", age: 10, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Продвинутый", attendance: 82, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-673" },
  { id: "s674", name: "Денис Кузнецов", age: 7, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 75, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-674" },
  { id: "s675", name: "Игорь Шепель", age: 7, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Продвинутый", attendance: 92, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-675" },
  { id: "s676", name: "Богдан Никитин", age: 12, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 96, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-676" },
  { id: "s677", name: "Дарья Тихонова", age: 12, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 89, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-677" },
  { id: "s678", name: "Никита Краснов", age: 7, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-678" },
  { id: "s679", name: "Игорь Шепель", age: 7, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Средний", attendance: 94, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-679" },
  { id: "s680", name: "Настя Гусева", age: 15, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 90, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-680" },
  { id: "s681", name: "Олег Прядко", age: 12, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 87, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-681" },
  { id: "s682", name: "Игорь Шепель", age: 11, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 73, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-682" },
  { id: "s683", name: "Вика Никитина", age: 16, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 80, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-683" },
  { id: "s684", name: "Mia Schmidt", age: 15, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 97, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-684" },
  { id: "s685", name: "Лука Семёнов", age: 14, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Продвинутый", attendance: 97, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-685" },
  { id: "s686", name: "Лиза Морозова", age: 10, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Продвинутый", attendance: 86, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-686" },
  { id: "s687", name: "Лука Семёнов", age: 7, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 86, lastNote: "", phone: "+49 151 ХХ-687" },
  { id: "s688", name: "Jonas Schmidt", age: 13, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 95, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-688" },
  { id: "s689", name: "Алина Фролова", age: 9, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 86, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-689" },
  { id: "s690", name: "Lena Weber", age: 8, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 99, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-690" },
  { id: "s691", name: "Ева Линд", age: 10, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Продвинутый", attendance: 94, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-691" },
  { id: "s692", name: "Аня Светлова", age: 14, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "", phone: "+49 151 ХХ-692" },
  { id: "s693", name: "Богдан Никитин", age: 11, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Продвинутый", attendance: 95, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-693" },
  { id: "s694", name: "Богдан Никитин", age: 11, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 91, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-694" },
  { id: "s695", name: "Lukas Weber", age: 12, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 89, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-695" },
  { id: "s696", name: "Кирилл Мельник", age: 13, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-696" },
  { id: "s697", name: "Алина Фролова", age: 15, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 89, lastNote: "", phone: "+49 151 ХХ-697" },
  { id: "s698", name: "София Беляева", age: 13, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 93, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-698" },
  { id: "s699", name: "Иван Жуков", age: 8, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 80, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-699" },
  { id: "s700", name: "Никита Краснов", age: 8, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 79, lastNote: "", phone: "+49 151 ХХ-700" },
  { id: "s701", name: "Мира Ким", age: 11, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 73, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-701", flag: "injury" },
  { id: "s702", name: "Юля Зуева", age: 15, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Продвинутый", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-702" },
  { id: "s703", name: "Маша Соколова", age: 11, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 87, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-703" },
  { id: "s704", name: "Никита Краснов", age: 14, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Продвинутый", attendance: 95, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-704" },
  { id: "s705", name: "Daniel Becker", age: 15, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 93, lastNote: "", phone: "+49 151 ХХ-705" },
  { id: "s706", name: "Марк Гусев", age: 14, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 73, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-706" },
  { id: "s707", name: "Кирилл Соколов", age: 17, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Продвинутый", attendance: 92, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-707" },
  { id: "s708", name: "Klara Vogt", age: 13, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Продвинутый", attendance: 93, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-708" },
  { id: "s709", name: "Лена Грач", age: 16, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 86, lastNote: "", phone: "+49 151 ХХ-709" },
  { id: "s710", name: "Кирилл Соколов", age: 14, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Средний", attendance: 79, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-710" },
  { id: "s711", name: "Ксения Зайцева", age: 10, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-711" },
  { id: "s712", name: "Тимур Беляев", age: 7, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 83, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-712" },
  { id: "s713", name: "David Roth", age: 7, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 94, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-713" },
  { id: "s714", name: "Lena Weber", age: 15, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 93, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-714" },
  { id: "s715", name: "Lukas Weber", age: 10, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 97, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-715" },
  { id: "s716", name: "Александр Беляков", age: 10, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 76, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-716" },
  { id: "s717", name: "Mia Schmidt", age: 15, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Средний", attendance: 97, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-717" },
  { id: "s718", name: "София Беляева", age: 16, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Начальный", attendance: 84, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-718" },
  { id: "s719", name: "Иван Жуков", age: 13, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Средний", attendance: 86, lastNote: "", phone: "+49 151 ХХ-719" },
  { id: "s720", name: "Михаил Сафронов", age: 9, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Начальный", attendance: 90, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-720", flag: "injury" },
  { id: "s721", name: "Дина Костина", age: 14, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 75, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-721" },
  { id: "s722", name: "Anna Roth", age: 13, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 100, lastNote: "", phone: "+49 151 ХХ-722" },
  { id: "s723", name: "Юля Зуева", age: 15, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 79, lastNote: "Отработали базовую технику, прогресс заметен.", phone: "+49 151 ХХ-723" },
  { id: "s724", name: "Михаил Сафронов", age: 9, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-724" },
  { id: "s725", name: "Mia Schmidt", age: 12, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 77, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-725" },
  { id: "s726", name: "Катя Полякова", age: 17, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Средний", attendance: 98, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-726" },
  { id: "s727", name: "Вика Никитина", age: 14, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 83, lastNote: "Хорошая динамика, можно усложнять программу.", phone: "+49 151 ХХ-727" },
  { id: "s728", name: "Мира Ким", age: 14, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 100, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-728" },
  { id: "s729", name: "Anna Roth", age: 14, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 86, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-729" },
  { id: "s730", name: "Ника Краснова", age: 17, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 92, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-730", flag: "injury" },
  { id: "s731", name: "Вика Никитина", age: 9, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 90, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-731" },
  { id: "s732", name: "Тимур Беляев", age: 16, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 65, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-732" },
  { id: "s733", name: "Степан Морозов", age: 7, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Продвинутый", attendance: 65, lastNote: "", phone: "+49 151 ХХ-733", flag: "injury" },
  { id: "s734", name: "Катя Полякова", age: 16, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Начальный", attendance: 82, lastNote: "", phone: "+49 151 ХХ-734" },
  { id: "s735", name: "Марк Гусев", age: 15, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 82, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-735" },
  { id: "s736", name: "Богдан Никитин", age: 15, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 86, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-736", flag: "injury" },
  { id: "s737", name: "Аня Светлова", age: 8, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 94, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-737" },
  { id: "s738", name: "Anna Roth", age: 9, discipline: "rollers", coachId: "c15", branchId: "irkutsk", level: "Средний", attendance: 79, lastNote: "", phone: "+49 151 ХХ-738" },
  { id: "s739", name: "Ксения Зайцева", age: 13, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 76, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-739" },
  { id: "s740", name: "Маша Соколова", age: 8, discipline: "bike", coachId: "c16", branchId: "irkutsk", level: "Средний", attendance: 88, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-740" },
  { id: "s741", name: "Ксения Зайцева", age: 17, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Начальный", attendance: 73, lastNote: "", phone: "+49 151 ХХ-741" },
  { id: "s742", name: "David Roth", age: 15, discipline: "rollers", coachId: "c14", branchId: "irkutsk", level: "Средний", attendance: 83, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-742" },
  { id: "s743", name: "Артём Волков", age: 16, discipline: "scooter", coachId: "c10", branchId: "irkutsk", level: "Продвинутый", attendance: 91, lastNote: "Повторили технику безопасности перед новым трюком.", phone: "+49 151 ХХ-743" },
  { id: "s744", name: "Лиза Морозова", age: 11, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Начальный", attendance: 86, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-744" },
  { id: "s745", name: "Роман Громов", age: 14, discipline: "bmx", coachId: "c17", branchId: "irkutsk", level: "Средний", attendance: 86, lastNote: "", phone: "+49 151 ХХ-745" },
  { id: "s746", name: "Ева Линд", age: 14, discipline: "skate", coachId: "c13", branchId: "irkutsk", level: "Начальный", attendance: 75, lastNote: "Закрепили элемент с прошлой тренировки.", phone: "+49 151 ХХ-746" },
  { id: "s747", name: "Катя Полякова", age: 14, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 82, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-747" },
  { id: "s748", name: "Дарья Тихонова", age: 9, discipline: "bike", coachId: "c11", branchId: "irkutsk", level: "Продвинутый", attendance: 88, lastNote: "Сняли на видео для разбора ошибок.", phone: "+49 151 ХХ-748" },
  { id: "s749", name: "David Roth", age: 11, discipline: "skate", coachId: "c9", branchId: "irkutsk", level: "Начальный", attendance: 87, lastNote: "Уверенно выполнил(а) связку трюков.", phone: "+49 151 ХХ-749" },
  { id: "s750", name: "Klara Vogt", age: 7, discipline: "bmx", coachId: "c12", branchId: "irkutsk", level: "Продвинутый", attendance: 85, lastNote: "Нужно больше практики на торможении/балансе.", phone: "+49 151 ХХ-750" },
];

const SESSIONS = [
  { id: "sn1", type: "group", discipline: "bmx", coachId: "c1", branchId: "roza", date: "2026-06-27", time: "14:00", duration: 90, location: "Рампа Б", studentIds: ["s203", "s263", "s205"], note: "Отработали базовую технику, прогресс заметен.", status: "done" },
  { id: "sn2", type: "group", discipline: "bmx", coachId: "c1", branchId: "roza", date: "2026-06-24", time: "15:30", duration: 45, location: "Рампа А", studentIds: ["s293", "s83"], note: "", status: "done" },
  { id: "sn3", type: "group", discipline: "bmx", coachId: "c1", branchId: "roza", date: "2026-06-25", time: "17:30", duration: 60, location: "Рампа А", studentIds: ["s220", "s95", "s102", "s339", "s299"], note: "Отработали базовую технику, прогресс заметен.", status: "done" },
  { id: "sn4", type: "group", discipline: "bmx", coachId: "c1", branchId: "roza", date: "2026-06-30", time: "16:00", duration: 75, location: "Памп-трек", studentIds: ["s72", "s240", "s14", "s339", "s148"], note: "", status: "upcoming" },
  { id: "sn5", type: "group", discipline: "bmx", coachId: "c1", branchId: "roza", date: "2026-07-01", time: "18:00", duration: 90, location: "Рампа Б", studentIds: ["s45", "s260", "s205", "s98", "s17"], note: "", status: "upcoming" },
  { id: "sn6", type: "individual", discipline: "bmx", coachId: "c2", branchId: "roza", date: "2026-06-30", time: "15:30", duration: 45, location: "Рампа Б", studentIds: ["s324"], note: "", status: "upcoming" },
  { id: "sn7", type: "individual", discipline: "bmx", coachId: "c2", branchId: "roza", date: "2026-07-01", time: "14:00", duration: 60, location: "Памп-трек", studentIds: ["s134"], note: "", status: "upcoming" },
  { id: "sn8", type: "group", discipline: "bmx", coachId: "c2", branchId: "roza", date: "2026-06-24", time: "16:30", duration: 75, location: "Рампа Б", studentIds: ["s289", "s235", "s267", "s345"], note: "Повторили технику безопасности перед новым трюком.", status: "done" },
  { id: "sn9", type: "group", discipline: "bmx", coachId: "c2", branchId: "roza", date: "2026-06-27", time: "18:00", duration: 75, location: "Рампа Б", studentIds: ["s267", "s174", "s289", "s65"], note: "Сняли на видео для разбора ошибок.", status: "done" },
  { id: "sn10", type: "group", discipline: "rollers", coachId: "c3", branchId: "roza", date: "2026-06-24", time: "19:00", duration: 45, location: "Зал 1", studentIds: ["s307", "s105", "s231", "s276", "s190"], note: "Закрепили элемент с прошлой тренировки.", status: "done" },
  { id: "sn11", type: "group", discipline: "rollers", coachId: "c3", branchId: "roza", date: "2026-06-29", time: "15:00", duration: 75, location: "Открытая площадка", studentIds: ["s146", "s56", "s157", "s305"], note: "", status: "upcoming" },
  { id: "sn12", type: "individual", discipline: "rollers", coachId: "c3", branchId: "roza", date: "2026-06-28", time: "18:30", duration: 60, location: "Зал 2", studentIds: ["s320"], note: "", status: "upcoming" },
  { id: "sn13", type: "group", discipline: "rollers", coachId: "c3", branchId: "roza", date: "2026-06-28", time: "14:00", duration: 45, location: "Зал 1", studentIds: ["s190", "s172", "s325", "s322"], note: "Хорошая динамика, можно усложнять программу.", status: "done" },
  { id: "sn14", type: "individual", discipline: "rollers", coachId: "c3", branchId: "roza", date: "2026-06-26", time: "14:00", duration: 75, location: "Открытая площадка", studentIds: ["s154"], note: "Нужно больше практики на торможении/балансе.", status: "done" },
  { id: "sn15", type: "individual", discipline: "skate", coachId: "c4", branchId: "roza", date: "2026-07-01", time: "17:00", duration: 75, location: "Боул", studentIds: ["s218"], note: "", status: "upcoming" },
  { id: "sn16", type: "group", discipline: "skate", coachId: "c4", branchId: "roza", date: "2026-06-28", time: "15:00", duration: 90, location: "Боул", studentIds: ["s1", "s250", "s165", "s120", "s35"], note: "", status: "upcoming" },
  { id: "sn17", type: "individual", discipline: "skate", coachId: "c4", branchId: "roza", date: "2026-06-28", time: "17:30", duration: 90, location: "Рампа Б", studentIds: ["s230"], note: "", status: "upcoming" },
  { id: "sn18", type: "group", discipline: "skate", coachId: "c4", branchId: "roza", date: "2026-06-24", time: "19:00", duration: 45, location: "Стрит-зона", studentIds: ["s200", "s175", "s6", "s107"], note: "Сняли на видео для разбора ошибок.", status: "done" },
  { id: "sn19", type: "individual", discipline: "skate", coachId: "c4", branchId: "roza", date: "2026-06-29", time: "14:00", duration: 45, location: "Рампа Б", studentIds: ["s142"], note: "", status: "upcoming" },
  { id: "sn20", type: "group", discipline: "rollers", coachId: "c5", branchId: "roza", date: "2026-06-29", time: "16:30", duration: 90, location: "Открытая площадка", studentIds: ["s143", "s348", "s23", "s160"], note: "", status: "upcoming" },
  { id: "sn21", type: "group", discipline: "rollers", coachId: "c5", branchId: "roza", date: "2026-06-24", time: "16:00", duration: 45, location: "Зал 2", studentIds: ["s334", "s136", "s138"], note: "Уверенно выполнил(а) связку трюков.", status: "done" },
  { id: "sn22", type: "individual", discipline: "rollers", coachId: "c5", branchId: "roza", date: "2026-06-29", time: "16:00", duration: 45, location: "Открытая площадка", studentIds: ["s138"], note: "", status: "upcoming" },
  { id: "sn23", type: "group", discipline: "rollers", coachId: "c5", branchId: "roza", date: "2026-06-27", time: "15:00", duration: 45, location: "Зал 2", studentIds: ["s75", "s179", "s301", "s207", "s247"], note: "Нужно больше практики на торможении/балансе.", status: "done" },
  { id: "sn24", type: "individual", discipline: "rollers", coachId: "c5", branchId: "roza", date: "2026-06-24", time: "17:30", duration: 75, location: "Зал 1", studentIds: ["s348"], note: "Закрепили элемент с прошлой тренировки.", status: "done" },
  { id: "sn25", type: "group", discipline: "skate", coachId: "c6", branchId: "roza", date: "2026-06-30", time: "15:30", duration: 90, location: "Боул", studentIds: ["s29", "s279", "s131", "s122", "s210"], note: "", status: "upcoming" },
  { id: "sn26", type: "individual", discipline: "skate", coachId: "c6", branchId: "roza", date: "2026-06-30", time: "14:00", duration: 45, location: "Рампа Б", studentIds: ["s308"], note: "", status: "upcoming" },
  { id: "sn27", type: "group", discipline: "skate", coachId: "c6", branchId: "roza", date: "2026-06-25", time: "14:00", duration: 45, location: "Стрит-зона", studentIds: ["s122", "s85", "s91", "s303"], note: "Повторили технику безопасности перед новым трюком.", status: "done" },
  { id: "sn28", type: "individual", discipline: "skate", coachId: "c6", branchId: "roza", date: "2026-06-29", time: "17:30", duration: 75, location: "Рампа Б", studentIds: ["s323"], note: "", status: "upcoming" },
  { id: "sn29", type: "individual", discipline: "bike", coachId: "c7", branchId: "roza", date: "2026-06-29", time: "17:00", duration: 60, location: "Дёрт-парк", studentIds: ["s254"], note: "", status: "upcoming" },
  { id: "sn30", type: "group", discipline: "bike", coachId: "c7", branchId: "roza", date: "2026-06-24", time: "18:00", duration: 75, location: "Памп-трек", studentIds: ["s43", "s168", "s313"], note: "Отработали базовую технику, прогресс заметен.", status: "done" },
  { id: "sn31", type: "group", discipline: "bike", coachId: "c7", branchId: "roza", date: "2026-06-26", time: "17:00", duration: 90, location: "Дёрт-парк", studentIds: ["s270", "s254", "s252", "s88", "s69"], note: "Нужно больше практики на торможении/балансе.", status: "done" },
  { id: "sn32", type: "group", discipline: "bike", coachId: "c7", branchId: "roza", date: "2026-06-30", time: "16:30", duration: 90, location: "Памп-трек", studentIds: ["s34", "s21", "s340", "s88"], note: "", status: "upcoming" },
  { id: "sn33", type: "individual", discipline: "scooter", coachId: "c8", branchId: "roza", date: "2026-06-30", time: "14:00", duration: 90, location: "Зал 1", studentIds: ["s12"], note: "", status: "upcoming" },
  { id: "sn34", type: "group", discipline: "scooter", coachId: "c8", branchId: "roza", date: "2026-06-24", time: "17:00", duration: 45, location: "Стрит-зона", studentIds: ["s296", "s153", "s152"], note: "Хорошая динамика, можно усложнять программу.", status: "done" },
  { id: "sn35", type: "group", discipline: "scooter", coachId: "c8", branchId: "roza", date: "2026-07-01", time: "17:30", duration: 90, location: "Стрит-зона", studentIds: ["s176", "s344", "s101", "s86"], note: "", status: "upcoming" },
  { id: "sn36", type: "individual", discipline: "scooter", coachId: "c8", branchId: "roza", date: "2026-07-01", time: "16:30", duration: 75, location: "Стрит-зона", studentIds: ["s255"], note: "", status: "upcoming" },
  { id: "sn37", type: "group", discipline: "scooter", coachId: "c8", branchId: "roza", date: "2026-06-27", time: "17:30", duration: 60, location: "Стрит-зона", studentIds: ["s37", "s296", "s344", "s338", "s137"], note: "Отработали базовую технику, прогресс заметен.", status: "done" },
  { id: "sn38", type: "group", discipline: "skate", coachId: "c9", branchId: "irkutsk", date: "2026-06-27", time: "18:30", duration: 90, location: "Боул", studentIds: ["s670", "s556", "s453", "s365"], note: "Хорошая динамика, можно усложнять программу.", status: "done" },
  { id: "sn39", type: "individual", discipline: "skate", coachId: "c9", branchId: "irkutsk", date: "2026-06-24", time: "17:00", duration: 60, location: "Стрит-зона", studentIds: ["s566"], note: "Сняли на видео для разбора ошибок.", status: "done" },
  { id: "sn40", type: "group", discipline: "skate", coachId: "c9", branchId: "irkutsk", date: "2026-06-24", time: "15:00", duration: 45, location: "Боул", studentIds: ["s468", "s476", "s462", "s367", "s702"], note: "Повторили технику безопасности перед новым трюком.", status: "done" },
  { id: "sn41", type: "group", discipline: "skate", coachId: "c9", branchId: "irkutsk", date: "2026-07-01", time: "18:30", duration: 45, location: "Стрит-зона", studentIds: ["s729", "s505", "s420"], note: "", status: "upcoming" },
  { id: "sn42", type: "group", discipline: "skate", coachId: "c9", branchId: "irkutsk", date: "2026-07-01", time: "16:30", duration: 90, location: "Боул", studentIds: ["s476", "s570"], note: "", status: "upcoming" },
  { id: "sn43", type: "group", discipline: "scooter", coachId: "c10", branchId: "irkutsk", date: "2026-06-29", time: "17:00", duration: 60, location: "Стрит-зона", studentIds: ["s402", "s717", "s554"], note: "", status: "upcoming" },
  { id: "sn44", type: "group", discipline: "scooter", coachId: "c10", branchId: "irkutsk", date: "2026-06-24", time: "16:30", duration: 75, location: "Стрит-зона", studentIds: ["s421", "s598", "s675", "s706"], note: "Отработали базовую технику, прогресс заметен.", status: "done" },
  { id: "sn45", type: "individual", discipline: "scooter", coachId: "c10", branchId: "irkutsk", date: "2026-06-24", time: "16:30", duration: 75, location: "Зал 1", studentIds: ["s413"], note: "Уверенно выполнил(а) связку трюков.", status: "done" },
  { id: "sn46", type: "group", discipline: "scooter", coachId: "c10", branchId: "irkutsk", date: "2026-06-24", time: "16:00", duration: 60, location: "Стрит-зона", studentIds: ["s521", "s678", "s497"], note: "Закрепили элемент с прошлой тренировки.", status: "done" },
  { id: "sn47", type: "group", discipline: "scooter", coachId: "c10", branchId: "irkutsk", date: "2026-06-28", time: "17:00", duration: 90, location: "Стрит-зона", studentIds: ["s689", "s600", "s678", "s523"], note: "", status: "done" },
  { id: "sn48", type: "individual", discipline: "bike", coachId: "c11", branchId: "irkutsk", date: "2026-06-29", time: "18:30", duration: 75, location: "Памп-трек", studentIds: ["s679"], note: "", status: "upcoming" },
  { id: "sn49", type: "group", discipline: "bike", coachId: "c11", branchId: "irkutsk", date: "2026-06-27", time: "18:30", duration: 75, location: "Дёрт-парк", studentIds: ["s701", "s398"], note: "Уверенно выполнил(а) связку трюков.", status: "done" },
  { id: "sn50", type: "group", discipline: "bike", coachId: "c11", branchId: "irkutsk", date: "2026-06-30", time: "15:00", duration: 45, location: "Памп-трек", studentIds: ["s620", "s715", "s640", "s610"], note: "", status: "upcoming" },
  { id: "sn51", type: "individual", discipline: "bike", coachId: "c11", branchId: "irkutsk", date: "2026-06-26", time: "14:00", duration: 90, location: "Дёрт-парк", studentIds: ["s693"], note: "Нужно больше практики на торможении/балансе.", status: "done" },
  { id: "sn52", type: "group", discipline: "bike", coachId: "c11", branchId: "irkutsk", date: "2026-06-29", time: "18:00", duration: 60, location: "Памп-трек", studentIds: ["s516", "s748", "s693"], note: "", status: "upcoming" },
  { id: "sn53", type: "group", discipline: "bike", coachId: "c11", branchId: "irkutsk", date: "2026-06-24", time: "17:00", duration: 60, location: "Дёрт-парк", studentIds: ["s376", "s426", "s379", "s415", "s390"], note: "Нужно больше практики на торможении/балансе.", status: "done" },
  { id: "sn54", type: "individual", discipline: "bmx", coachId: "c12", branchId: "irkutsk", date: "2026-06-26", time: "16:00", duration: 60, location: "Рампа А", studentIds: ["s508"], note: "Сняли на видео для разбора ошибок.", status: "done" },
  { id: "sn55", type: "group", discipline: "bmx", coachId: "c12", branchId: "irkutsk", date: "2026-06-24", time: "15:00", duration: 60, location: "Рампа Б", studentIds: ["s378", "s404", "s478"], note: "Хорошая динамика, можно усложнять программу.", status: "done" },
  { id: "sn56", type: "group", discipline: "bmx", coachId: "c12", branchId: "irkutsk", date: "2026-06-29", time: "16:30", duration: 45, location: "Памп-трек", studentIds: ["s404", "s671", "s595"], note: "", status: "upcoming" },
  { id: "sn57", type: "group", discipline: "bmx", coachId: "c12", branchId: "irkutsk", date: "2026-07-01", time: "19:00", duration: 90, location: "Памп-трек", studentIds: ["s595", "s594", "s672", "s411"], note: "", status: "upcoming" },
  { id: "sn58", type: "group", discipline: "bmx", coachId: "c12", branchId: "irkutsk", date: "2026-06-27", time: "16:00", duration: 60, location: "Рампа А", studentIds: ["s366", "s530", "s616", "s357"], note: "Сняли на видео для разбора ошибок.", status: "done" },
  { id: "sn59", type: "individual", discipline: "skate", coachId: "c13", branchId: "irkutsk", date: "2026-06-27", time: "15:00", duration: 90, location: "Стрит-зона", studentIds: ["s533"], note: "Уверенно выполнил(а) связку трюков.", status: "done" },
  { id: "sn60", type: "individual", discipline: "skate", coachId: "c13", branchId: "irkutsk", date: "2026-06-29", time: "18:00", duration: 60, location: "Рампа Б", studentIds: ["s493"], note: "", status: "upcoming" },
  { id: "sn61", type: "group", discipline: "skate", coachId: "c13", branchId: "irkutsk", date: "2026-06-29", time: "15:30", duration: 60, location: "Стрит-зона", studentIds: ["s460", "s609", "s442", "s597", "s719"], note: "", status: "upcoming" },
  { id: "sn62", type: "group", discipline: "skate", coachId: "c13", branchId: "irkutsk", date: "2026-06-27", time: "18:00", duration: 60, location: "Боул", studentIds: ["s746", "s514"], note: "", status: "done" },
  { id: "sn63", type: "group", discipline: "skate", coachId: "c13", branchId: "irkutsk", date: "2026-06-26", time: "14:00", duration: 60, location: "Рампа Б", studentIds: ["s719", "s542", "s533", "s590"], note: "Хорошая динамика, можно усложнять программу.", status: "done" },
  { id: "sn64", type: "group", discipline: "rollers", coachId: "c14", branchId: "irkutsk", date: "2026-06-30", time: "16:30", duration: 90, location: "Зал 2", studentIds: ["s467", "s648", "s436"], note: "", status: "upcoming" },
  { id: "sn65", type: "group", discipline: "rollers", coachId: "c14", branchId: "irkutsk", date: "2026-06-27", time: "14:00", duration: 45, location: "Зал 1", studentIds: ["s546", "s397"], note: "Отработали базовую технику, прогресс заметен.", status: "done" },
  { id: "sn66", type: "individual", discipline: "rollers", coachId: "c14", branchId: "irkutsk", date: "2026-06-26", time: "15:00", duration: 45, location: "Зал 1", studentIds: ["s397"], note: "Нужно больше практики на торможении/балансе.", status: "done" },
  { id: "sn67", type: "individual", discipline: "rollers", coachId: "c14", branchId: "irkutsk", date: "2026-06-25", time: "17:30", duration: 45, location: "Зал 1", studentIds: ["s565"], note: "Повторили технику безопасности перед новым трюком.", status: "done" },
  { id: "sn68", type: "group", discipline: "rollers", coachId: "c14", branchId: "irkutsk", date: "2026-06-24", time: "19:00", duration: 45, location: "Зал 1", studentIds: ["s546", "s716", "s506"], note: "Связались с родителями — пропуск без предупреждения.", status: "missed" },
  { id: "sn69", type: "group", discipline: "rollers", coachId: "c14", branchId: "irkutsk", date: "2026-06-29", time: "18:30", duration: 90, location: "Зал 1", studentIds: ["s739", "s467"], note: "", status: "upcoming" },
  { id: "sn70", type: "group", discipline: "rollers", coachId: "c15", branchId: "irkutsk", date: "2026-07-01", time: "15:30", duration: 75, location: "Зал 2", studentIds: ["s427", "s712", "s629", "s447", "s563"], note: "", status: "upcoming" },
  { id: "sn71", type: "group", discipline: "rollers", coachId: "c15", branchId: "irkutsk", date: "2026-06-24", time: "16:30", duration: 75, location: "Зал 1", studentIds: ["s733", "s683", "s385", "s724", "s573"], note: "Отработали базовую технику, прогресс заметен.", status: "done" },
  { id: "sn72", type: "individual", discipline: "rollers", coachId: "c15", branchId: "irkutsk", date: "2026-06-24", time: "16:30", duration: 75, location: "Открытая площадка", studentIds: ["s550"], note: "Хорошая динамика, можно усложнять программу.", status: "done" },
  { id: "sn73", type: "group", discipline: "rollers", coachId: "c15", branchId: "irkutsk", date: "2026-07-01", time: "17:30", duration: 45, location: "Зал 2", studentIds: ["s602", "s456"], note: "", status: "upcoming" },
  { id: "sn74", type: "individual", discipline: "rollers", coachId: "c15", branchId: "irkutsk", date: "2026-06-27", time: "18:30", duration: 45, location: "Открытая площадка", studentIds: ["s393"], note: "Отработали базовую технику, прогресс заметен.", status: "done" },
  { id: "sn75", type: "individual", discipline: "rollers", coachId: "c15", branchId: "irkutsk", date: "2026-06-28", time: "16:30", duration: 60, location: "Зал 1", studentIds: ["s459"], note: "Сняли на видео для разбора ошибок.", status: "done" },
  { id: "sn76", type: "individual", discipline: "bike", coachId: "c16", branchId: "irkutsk", date: "2026-06-27", time: "16:30", duration: 60, location: "Памп-трек", studentIds: ["s725"], note: "Связались с родителями — пропуск без предупреждения.", status: "missed" },
  { id: "sn77", type: "group", discipline: "bike", coachId: "c16", branchId: "irkutsk", date: "2026-06-30", time: "17:30", duration: 75, location: "Памп-трек", studentIds: ["s740", "s440", "s417"], note: "", status: "upcoming" },
  { id: "sn78", type: "individual", discipline: "bike", coachId: "c16", branchId: "irkutsk", date: "2026-06-25", time: "17:00", duration: 60, location: "Памп-трек", studentIds: ["s638"], note: "Нужно больше практики на торможении/балансе.", status: "done" },
  { id: "sn79", type: "group", discipline: "bike", coachId: "c16", branchId: "irkutsk", date: "2026-06-25", time: "17:30", duration: 75, location: "Дёрт-парк", studentIds: ["s730", "s414", "s582", "s509"], note: "Хорошая динамика, можно усложнять программу.", status: "done" },
  { id: "sn80", type: "group", discipline: "bike", coachId: "c16", branchId: "irkutsk", date: "2026-06-26", time: "18:00", duration: 75, location: "Дёрт-парк", studentIds: ["s529", "s571", "s458", "s735", "s371"], note: "Сняли на видео для разбора ошибок.", status: "done" },
  { id: "sn81", type: "group", discipline: "bike", coachId: "c16", branchId: "irkutsk", date: "2026-06-25", time: "18:30", duration: 90, location: "Памп-трек", studentIds: ["s361", "s435"], note: "Уверенно выполнил(а) связку трюков.", status: "done" },
  { id: "sn82", type: "group", discipline: "bmx", coachId: "c17", branchId: "irkutsk", date: "2026-06-27", time: "15:30", duration: 60, location: "Памп-трек", studentIds: ["s572", "s732", "s728", "s354"], note: "Нужно больше практики на торможении/балансе.", status: "done" },
  { id: "sn83", type: "individual", discipline: "bmx", coachId: "c17", branchId: "irkutsk", date: "2026-06-24", time: "15:00", duration: 75, location: "Памп-трек", studentIds: ["s669"], note: "Отработали базовую технику, прогресс заметен.", status: "done" },
  { id: "sn84", type: "individual", discipline: "bmx", coachId: "c17", branchId: "irkutsk", date: "2026-06-29", time: "18:30", duration: 45, location: "Памп-трек", studentIds: ["s604"], note: "", status: "upcoming" },
  { id: "sn85", type: "individual", discipline: "bmx", coachId: "c17", branchId: "irkutsk", date: "2026-06-26", time: "17:00", duration: 60, location: "Памп-трек", studentIds: ["s572"], note: "Отработали базовую технику, прогресс заметен.", status: "done" },
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
function LoginScreen({ coaches, onLogin }) {
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
    const manager = MANAGERS.find(m => m.email.toLowerCase().trim() === normalizedEmail);
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

  const [showNewSession, setShowNewSession] = useState(false);
  const [showNewStudent, setShowNewStudent] = useState(false);
  const [showNewCoach, setShowNewCoach] = useState(false);
  const [editingSession, setEditingSession] = useState(null); // тренировка, которую сейчас редактируем
  const [editingStudent, setEditingStudent] = useState(null); // ученик, которого сейчас редактируем
  const [editingCoach, setEditingCoach] = useState(null); // тренер, которого сейчас редактируем
  const [confirmDelete, setConfirmDelete] = useState(null); // { kind: 'session'|'student'|'coach', id, label }
  const [blockedDeleteMsg, setBlockedDeleteMsg] = useState(null); // если удаление тренера запрещено
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
    const s = { id: nextId("s"), attendance: 100, lastNote: "", ...payload };
    setStudents(prev => [s, ...prev]);
    flashToast("Ученик добавлен");
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

  function requestDelete(kind, id, label) {
    if (kind === "coach") {
      const hasStudents = students.some(s => s.coachId === id);
      const hasSessions = sessions.some(s => s.coachId === id);
      if (hasStudents || hasSessions) {
        setBlockedDeleteMsg(
          `Нельзя удалить ${label} — за ним закреплены ${hasStudents ? "ученики" : ""}${hasStudents && hasSessions ? " и " : ""}${hasSessions ? "тренировки" : ""}. Сначала переназначь их другому тренеру.`
        );
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
        <LoginScreen coaches={coaches} onLogin={setCurrentUser} />
      </div>
    );
  }

  const view = currentUser.kind === "coach" ? "coach" : "admin";
  // Берём тренера свежим из state coaches — на случай если управляющий отредактировал его карточку
  const activeCoach = view === "coach"
    ? (coaches.find(c => c.id === currentUser.record.id) || currentUser.record)
    : null;
  const activeManager = view === "admin" ? currentUser.record : null;

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
          manager={activeManager}
          onNewSession={() => setShowNewSession(true)}
          onNewStudent={() => setShowNewStudent(true)}
          onEditStudent={(s) => setEditingStudent(s)}
          onDeleteStudent={(s) => requestDelete("student", s.id, s.name)}
          onEditSession={(s) => setEditingSession(s)}
          onDeleteSession={(s) => requestDelete("session", s.id, `тренировку ${formatDate(s.date)} в ${s.time}`)}
          onNewCoach={() => setShowNewCoach(true)}
          onEditCoach={(c) => setEditingCoach(c)}
          onDeleteCoach={(c) => requestDelete("coach", c.id, c.name)}
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
          onClose={() => setShowNewCoach(false)}
          onSave={(payload) => { addCoach(payload); setShowNewCoach(false); }}
        />
      )}
      {editingCoach && (
        <CoachModal
          initialCoach={editingCoach}
          onClose={() => setEditingCoach(null)}
          onSave={(payload) => { saveCoach(editingCoach.id, payload); setEditingCoach(null); }}
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
function CoachView({ coach, coaches, students, sessions, session, setSession, student, setStudent, onNewSession, onNewStudent, onEditSession, onDeleteSession, onEditStudent, onDeleteStudent, onSaveAttendance, onLogout }) {
  const [tab, setTab] = useState("today");
  const disc = DISCIPLINES[coach.discipline];

  const hasTwoBranches = coach.branches.length > 1;
  const [activeBranch, setActiveBranch] = useState(coach.branches[0]);

  // если сменили тренера и у нового нет такого филиала — сбрасываем на первый доступный
  const effectiveBranch = coach.branches.includes(activeBranch) ? activeBranch : coach.branches[0];

  const mySessions = sessions.filter(s => s.coachId === coach.id && s.branchId === effectiveBranch);
  const [selectedDate, setSelectedDate] = useState(TODAY_ISO);
  const myStudents = students.filter(s => s.coachId === coach.id && s.branchId === effectiveBranch);

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
                  <DisciplineGlyph d={coach.discipline} size={12} /> {disc.label} · {myStudents.length} учеников{hasTwoBranches ? ` в ${BRANCHES[effectiveBranch].label}` : ""}
                </div>
              </div>
            </div>
            <button className="logout-btn" onClick={onLogout} title="Выйти">
              <LogOut size={16} />
            </button>
          </div>

          {hasTwoBranches && (
            <div className="branch-switch">
              {coach.branches.map(bId => {
                const b = BRANCHES[bId];
                return (
                  <button
                    key={bId}
                    className={effectiveBranch === bId ? "branch-pill active" : "branch-pill"}
                    style={effectiveBranch === bId ? { borderColor: b.color, color: b.color } : {}}
                    onClick={() => setActiveBranch(bId)}
                  >
                    <MapPin size={11} /> {b.label}
                  </button>
                );
              })}
            </div>
          )}

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

  const upcoming = coachSessions
    .filter(s => s.date > TODAY_ISO)
    .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
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
          <Section title="Скоро" count={upcoming.length}>
            {upcoming.length === 0 ? <Empty text="Нет запланированных тренировок" /> :
              upcoming.map(s => <SessionCard key={s.id} s={s} onOpen={onOpen} />)}
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
        <span className="session-type-tag">{s.type === "group" ? "ГРУППА" : "ИНДИВИДУАЛ"}</span>
        <span className="session-loc"><MapPin size={12} /> {s.location}</span>
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
  const filtered = students.filter(s => s.name.toLowerCase().includes(q.toLowerCase()));
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
      <div className="student-list">
        {filtered.map(s => (
          <button key={s.id} className="student-row" onClick={() => onOpen(s)}>
            <div className="student-row-avatar" style={{ borderColor: disc.color }}>
              {s.name.split(" ").map(n => n[0]).join("")}
            </div>
            <div className="student-row-info">
              <div className="student-row-name">
                {s.name}
                {s.flag === "injury" && <AlertCircle size={13} color="#FF5454" />}
              </div>
              <div className="student-row-meta">{s.age} лет · {s.level}</div>
            </div>
            <div className="student-row-attendance">
              <div className="attendance-ring" style={{ "--pct": s.attendance, "--c": disc.color }}>
                {s.attendance}%
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CoachStatsTab({ coach, students, sessions, disc }) {
  const avgAttendance = Math.round(students.reduce((a, s) => a + s.attendance, 0) / students.length);
  const done = sessions.filter(s => s.status === "done").length;
  const missed = sessions.filter(s => s.status === "missed").length;
  const levels = ["Начальный", "Средний", "Продвинутый"].map(lv => ({
    level: lv, count: students.filter(s => s.level === lv).length
  }));
  const maxLevel = Math.max(...levels.map(l => l.count), 1);

  return (
    <div className="tab-content">
      <div className="stat-grid">
        <StatBlock label="Средняя посещаемость" value={`${avgAttendance}%`} icon={<Target size={16} />} accent={disc.color} />
        <StatBlock label="Учеников" value={students.length} icon={<Users size={16} />} accent={disc.color} />
        <StatBlock label="Проведено" value={done} icon={<CheckCircle2 size={16} />} accent="#3DDC97" />
        <StatBlock label="Пропущено" value={missed} icon={<AlertCircle size={16} />} accent="#FF5454" />
      </div>
      <Section title="Уровни группы" count={students.length}>
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
  const disc = DISCIPLINES[session.discipline];
  const roster = students.filter(s => session.studentIds.includes(s.id));
  const [present, setPresent] = useState(Object.fromEntries(roster.map(s => [s.id, session.status !== "missed"])));

  function handleSave() {
    if (onSaveAttendance) onSaveAttendance({ note, present });
    onBack();
  }

  return (
    <div className="phone-frame">
      <div className="phone-screen" style={{ "--accent": disc.color }}>
        <header className="detail-header">
          <button className="back-btn" onClick={onBack}><ChevronLeft size={20} /></button>
          <div className="detail-header-title">
            <DisciplineGlyph d={session.discipline} size={14} />
            {session.type === "group" ? "Групповая тренировка" : "Индивидуальная тренировка"}
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
              <MetaChip icon={<MapPin size={13} />} text={session.location} />
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

            <div className="detail-label">Заметка тренера</div>
            <textarea
              className="note-textarea"
              placeholder="Что отработали, чей прогресс, на что обратить внимание в следующий раз..."
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={5}
            />
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
function StudentDetail({ student, onBack, sessions, coaches, onEdit, onDelete }) {
  const disc = DISCIPLINES[student.discipline];
  const coach = coaches.find(c => c.id === student.coachId);
  const history = sessions.filter(s => s.studentIds.includes(student.id)).sort((a,b) => b.date.localeCompare(a.date));

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
function AdminView({ tab, setTab, searchQ, setSearchQ, students, sessions, coaches, manager, onNewSession, onNewStudent, onEditStudent, onDeleteStudent, onEditSession, onDeleteSession, onNewCoach, onEditCoach, onDeleteCoach, onLogout }) {
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
            students={fStudents} coaches={fCoaches}
            onNewCoach={onNewCoach} onEditCoach={onEditCoach} onDeleteCoach={onDeleteCoach}
          />
        )}
        {tab === "students" && (
          <AdminStudents
            searchQ={searchQ} students={fStudents} coaches={coaches}
            onEdit={onEditStudent} onDelete={onDeleteStudent}
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
  const totalStudents = students.length;
  const activeToday = sessions.filter(s => s.date === TODAY_ISO).length;
  const missedThisWeek = sessions.filter(s => s.status === "missed").length;
  const avgAttendance = Math.round(students.reduce((a, s) => a + s.attendance, 0) / (students.length || 1));

  const branchIds = branchFilter === "all" ? Object.keys(BRANCHES) : [branchFilter];
  const weekStats = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, i) => ({
    day,
    count: branchIds.reduce((sum, bId) => sum + WEEK_STATS_BY_BRANCH[bId][i].count, 0),
  }));
  const maxWeek = Math.max(...weekStats.map(w => w.count), 1);

  const byDiscipline = Object.entries(DISCIPLINES).map(([key, d]) => ({
    ...d,
    key,
    count: students.filter(s => s.discipline === key).length,
  }));
  const maxDisc = Math.max(...byDiscipline.map(d => d.count), 1);

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

      <div className="panel">
        <div className="panel-title">Требует внимания</div>
        <div className="attention-list">
          {students.filter(s => s.flag || s.attendance < 80).map(s => {
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

function AdminCoaches({ students, coaches, onNewCoach, onEditCoach, onDeleteCoach }) {
  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div className="admin-page-head-title">Тренеры</div>
        <button className="topbar-btn primary" onClick={onNewCoach}><Plus size={14} /> Тренер</button>
      </div>
      <div className="coach-grid">
        {coaches.map(c => {
          const d = DISCIPLINES[c.discipline];
          const myStudents = students.filter(s => s.coachId === c.id);
          const avgAtt = Math.round(myStudents.reduce((a, s) => a + s.attendance, 0) / (myStudents.length || 1));
          return (
            <div className="coach-admin-card" key={c.id} style={{ "--accent": d.color }}>
              <div className="coach-admin-top">
                <div className="coach-admin-avatar" style={{ background: d.color }}>{c.avatar}</div>
                <div className="coach-admin-top-right">
                  <span className="coach-admin-disc-tag">{d.short}</span>
                  <div className="table-actions">
                    <button className="table-action-btn" onClick={() => onEditCoach(c)} aria-label="Редактировать"><Settings size={13} /></button>
                    <button className="table-action-btn danger" onClick={() => onDeleteCoach(c)} aria-label="Удалить"><X size={13} /></button>
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
                <div><span className="cas-val">{myStudents.length}</span><span className="cas-lbl">учеников</span></div>
                <div><span className="cas-val">{avgAtt}%</span><span className="cas-lbl">посещение</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminStudents({ searchQ, students, coaches, onEdit, onDelete }) {
  const filtered = students.filter(s => s.name.toLowerCase().includes(searchQ.toLowerCase()));
  return (
    <div className="admin-page">
      <div className="panel">
        <div className="table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Ученик</th><th>Возраст</th><th>Филиал</th><th>Направление</th><th>Тренер</th><th>Уровень</th><th>Посещение</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const d = DISCIPLINES[s.discipline];
              const b = BRANCHES[s.branchId];
              const coach = coaches.find(c => c.id === s.coachId);
              return (
                <tr key={s.id}>
                  <td className="table-name-cell">
                    {s.name}
                    {s.flag === "injury" && <AlertCircle size={13} color="#FF5454" />}
                  </td>
                  <td>{s.age}</td>
                  <td><span className="table-branch-tag" style={{ color: b.color, borderColor: b.color }}>{b.label}</span></td>
                  <td><span className="table-disc-tag" style={{ color: d.color, borderColor: d.color }}><DisciplineGlyph d={s.discipline} size={12}/>{d.label}</span></td>
                  <td>{coach?.name}</td>
                  <td>{s.level}</td>
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
                    <div className="schedule-row-title">{s.type === "group" ? "Групповая" : "Индивидуальная"} · {d.label}</div>
                    <div className="schedule-row-sub">{coach?.name} · {s.location} · {s.studentIds.length} чел.</div>
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

  // Функция расчёта зарплаты одного тренера за месяц
  function calcCoachSalary(coach, monthSessions) {
    const rates = SALARY_RATES[coach.grade || "regular"];
    let groupSessions = 0, groupEarned = 0;
    let indSessions = 0, indEarned = 0;

    monthSessions.forEach(s => {
      if (s.type === "individual") {
        indSessions++;
        indEarned += rates.individual;
      } else {
        // групповая: 150р × кол-во пришедших (используем studentIds как присутствующих)
        const attendees = s.studentIds.length;
        groupSessions++;
        groupEarned += rates.group * attendees;
      }
    });

    return {
      groupSessions, groupEarned,
      indSessions, indEarned,
      total: groupEarned + indEarned,
      totalSessions: groupSessions + indSessions,
    };
  }

  const monthLabel = (m) => {
    const [y, mo] = m.split("-");
    const names = ["","Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
    return `${names[Number(mo)]} ${y}`;
  };

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
function SessionModal({ coaches, students, defaultCoachId, defaultBranchId, initialSession, onClose, onSave }) {
  const isEditing = Boolean(initialSession);
  const [coachId, setCoachId] = useState(initialSession?.coachId || defaultCoachId || coaches[0].id);
  const coach = coaches.find(c => c.id === coachId);
  const [discipline, setDiscipline] = useState(initialSession?.discipline || coach.discipline);
  const [branchId, setBranchId] = useState(
    initialSession?.branchId ||
    (defaultBranchId && coach.branches.includes(defaultBranchId) ? defaultBranchId : coach.branches[0])
  );
  const [type, setType] = useState(initialSession?.type || "group");
  const [date, setDate] = useState(initialSession?.date || "2026-06-29");
  const [time, setTime] = useState(initialSession?.time || "16:00");
  const [duration, setDuration] = useState(initialSession?.duration || 60);
  const [location, setLocation] = useState(initialSession?.location || "");
  const [note, setNote] = useState(initialSession?.note || "");
  const [studentIds, setStudentIds] = useState(initialSession?.studentIds || []);
  const [error, setError] = useState("");

  const pool = students.filter(s => s.coachId === coachId && s.branchId === branchId);

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

  function handleSave() {
    if (!location.trim()) { setError("Укажи место проведения"); return; }
    if (studentIds.length === 0) { setError("Выбери хотя бы одного ученика"); return; }
    if (type === "individual" && studentIds.length > 1) { setError("В индивидуальной тренировке только один ученик"); return; }
    onSave({ type, discipline, coachId, branchId, date, time, duration: Number(duration), location: location.trim(), studentIds, note: note.trim() });
  }

  const disc = DISCIPLINES[discipline];

  return (
    <ModalShell onClose={onClose} accent={disc.color}>
      <div className="modal-header">
        <div className="modal-title"><DisciplineGlyph d={discipline} size={16} /> {isEditing ? "Редактирование тренировки" : "Новая тренировка"}</div>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="modal-body">
        <div className="form-row-2">
          <FormField label="Тип">
            <div className="segmented">
              <button className={type === "group" ? "seg active" : "seg"} onClick={() => setType("group")}>Группа</button>
              <button className={type === "individual" ? "seg active" : "seg"} onClick={() => setType("individual")}>Индивидуальная</button>
            </div>
          </FormField>
          <FormField label="Тренер">
            <select className="form-select" value={coachId} onChange={e => handleCoachChange(e.target.value)}>
              {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
        </div>

        <div className="form-row-2">
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
          <FormField label="Дата">
            <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </FormField>
        </div>

        <div className="form-row-2">
          <FormField label="Время">
            <input className="form-input" type="time" value={time} onChange={e => setTime(e.target.value)} />
          </FormField>
          <FormField label="Длительность, мин">
            <input className="form-input" type="number" min={15} step={15} value={duration} onChange={e => setDuration(e.target.value)} />
          </FormField>
        </div>

        <FormField label="Место">
          <input className="form-input" placeholder="Рампа А, Зал 2..." value={location} onChange={e => setLocation(e.target.value)} />
        </FormField>

        <FormField label={`Состав ${type === "individual" ? "(выбери одного)" : ""}`}>
          {pool.length === 0 ? (
            <div className="empty-state">У этого тренера пока нет учеников в этом филиале и направлении</div>
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

        <FormField label="Заметка (необязательно)">
          <textarea className="form-textarea" rows={3} placeholder="План тренировки, на что обратить внимание..." value={note} onChange={e => setNote(e.target.value)} />
        </FormField>

        {error && <div className="form-error"><AlertCircle size={13} /> {error}</div>}
      </div>

      <div className="modal-footer">
        <button className="modal-btn-secondary" onClick={onClose}>Отмена</button>
        <button className="modal-btn-primary" style={{ background: disc.color }} onClick={handleSave}>{isEditing ? "Сохранить изменения" : "Создать тренировку"}</button>
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
  const [error, setError] = useState("");

  function handleCoachChange(id) {
    const c = coaches.find(x => x.id === id);
    setCoachId(id);
    setDiscipline(c.discipline);
    setBranchId(c.branches[0]);
  }

  function handleSave() {
    if (!name.trim()) { setError("Укажи имя ученика"); return; }
    if (!phone.trim()) { setError("Укажи контактный телефон"); return; }
    onSave({ name: name.trim(), age: Number(age), discipline, coachId, branchId, level, phone: phone.trim() });
  }

  const disc = DISCIPLINES[discipline];
  const coach = coaches.find(c => c.id === coachId);

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

        <FormField label="Тренер">
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

        <FormField label="Направление">
          <div className="disc-picker">
            {Object.entries(DISCIPLINES).map(([k, d]) => (
              <span key={k} className={k === discipline ? "disc-pill active" : "disc-pill"} style={k === discipline ? { borderColor: d.color, color: d.color } : {}}>
                <DisciplineGlyph d={k} size={12} /> {d.label}
              </span>
            ))}
          </div>
          <div className="form-hint">Определяется выбранным тренером</div>
        </FormField>

        <FormField label="Телефон родителя/ученика">
          <input className="form-input" placeholder="+49 151 ХХ-ХХ-ХХ" value={phone} onChange={e => setPhone(e.target.value)} />
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
function CoachModal({ initialCoach, onClose, onSave }) {
  const isEditing = Boolean(initialCoach);
  const [name, setName] = useState(initialCoach?.name || "");
  const [discipline, setDiscipline] = useState(initialCoach?.discipline || "rollers");
  const [exp, setExp] = useState(initialCoach?.exp || "1 год");
  const [grade, setGrade] = useState(initialCoach?.grade || "regular");
  const [branches, setBranches] = useState(initialCoach?.branches || ["roza"]);
  const [error, setError] = useState("");

  function toggleBranch(bId) {
    setBranches(prev => prev.includes(bId) ? prev.filter(x => x !== bId) : [...prev, bId]);
  }

  function handleSave() {
    if (!name.trim()) { setError("Укажи имя тренера"); return; }
    if (branches.length === 0) { setError("Выбери хотя бы один филиал"); return; }
    onSave({ name: name.trim(), discipline, exp: exp.trim(), grade, branches });
  }

  const disc = DISCIPLINES[discipline];

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
.disc-pill { display: flex; align-items: center; gap: 5px; border: 1px solid #2A2E36; border-radius: 999px; padding: 5px 11px; font-size: 11px; color: #565B66; }
.disc-pill.active { font-weight: 600; }

.form-error { display: flex; align-items: center; gap: 6px; color: #FF5454; font-size: 12px; background: rgba(255,84,84,.1); padding: 9px 12px; border-radius: 10px; }

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
`;

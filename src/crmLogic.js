export function directionsOf(student) {
  return [student.discipline].filter(Boolean);
}

export function presentIds(session) {
  if (session.attendance) return session.studentIds.filter(id => session.attendance[id] === 'present');
  // Legacy records only stored the session status. Preserve old payroll until confirmed.
  return session.status === 'done' ? session.studentIds : [];
}

export const SALARY_RATES = {
  regular: {group:150, individual:300},
  pro: {group:150, individual:400},
};

export const coachGradePending = coach => !Object.hasOwn(SALARY_RATES, coach.grade || 'regular');

export function sessionEarning(coach, session) {
  if (session.status !== 'done' || (coach.id && session.coachId !== coach.id)) return 0;
  if (coachGradePending(coach)) return null;
  const present = presentIds(session);
  if (!present.length) return 0;
  const rates = SALARY_RATES[coach.grade || 'regular'];
  if (session.type === 'promo') return present.reduce((sum,id) =>
    sum + (session.promoResults?.[id] === 'bought' ? 500 : rates.individual), 0);
  return session.type === 'individual' ? rates.individual : rates.group * present.length;
}

export function calcCoachSalary(coach, monthSessions) {
  if (coachGradePending(coach)) {
    const done = monthSessions.filter(s => s.status === 'done' && (!coach.id || s.coachId === coach.id));
    const indSessions = done.filter(s => s.type === 'individual').length;
    return {groupSessions:done.length-indSessions,groupEarned:null,indSessions,indEarned:null,
      total:null,totalSessions:done.length,requiresGradeConfirmation:true};
  }
  let groupSessions = 0, groupEarned = 0, indSessions = 0, indEarned = 0;
  monthSessions.filter(s => s.status === 'done' && (!coach.id || s.coachId === coach.id)).forEach(s => {
    const amount = sessionEarning(coach, s);
    if (s.type === 'individual') {indSessions++; indEarned += amount;}
    else {groupSessions++; groupEarned += amount;}
  });
  return {groupSessions, groupEarned, indSessions, indEarned, total:groupEarned+indEarned, totalSessions:groupSessions+indSessions};
}

export function attendancePercent(studentId, sessions, fallback = null) {
  const records = sessions.filter(s => s.status !== 'upcoming' && s.studentIds.includes(studentId) && ['present', 'absent'].includes(s.attendance?.[studentId]));
  if (!records.length) return fallback;
  return 100 * records.filter(s => s.attendance[studentId] === 'present').length / records.length;
}

export function averageSessionAttendance(sessions) {
  const ids = [...new Set(sessions.flatMap(s => s.studentIds))];
  const values = ids.map(id => attendancePercent(id, sessions)).filter(Number.isFinite);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

export function directionAttendanceStats(students, sessions, branchId, discipline) {
  const scoped = sessions.filter(s => s.branchId === branchId && s.discipline === discipline);
  const values = students.filter(s => s.branchId === branchId && directionsOf(s).includes(discipline))
    .map(s => attendancePercent(s.id, scoped)).filter(Number.isFinite);
  const percent = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  return {percent, requiresAttention: percent !== null && percent < 70};
}

export function formatAttendance(value) {
  if (!Number.isFinite(value)) return '—';
  const rounded = Number(value.toFixed(1));
  return value < 70 && rounded >= 70 ? '<70%' : `${rounded.toLocaleString('ru-RU')}%`;
}

export function isArchived(student) { return !!student.archivedAt; }

export function archiveStudent(student, date) {
  return {...student, archivedAt: date};
}

export function canSelectStudentForSession(student, {coachId, branchId, discipline, studentIds = []}) {
  return student.coachId === coachId &&
    student.branchId === branchId && directionsOf(student).includes(discipline) &&
    ((!isArchived(student) && student.status !== 'left') || studentIds.includes(student.id));
}

export function attendanceSelection(session, studentId, readOnly = false) {
  const stored = session.attendance?.[studentId];
  if (stored === 'present') return true;
  if (stored === 'absent') return false;
  return session.status === 'upcoming' && !readOnly ? true : null;
}

export function finalizeSession(session, {note, attendance, promoResults}) {
  if (!note?.trim()) throw new Error('Заметка обязательна');
  if (session.studentIds.some(id => !['present', 'absent'].includes(attendance?.[id]))) throw new Error('Отметьте посещение каждого ученика');
  const present = session.studentIds.filter(id => attendance[id] === 'present');
  const results = session.type === 'promo' ? Object.fromEntries(session.studentIds.filter(id => ['bought','not_bought'].includes(promoResults?.[id])).map(id => [id, promoResults[id]])) : {};
  if (session.type === 'promo' && present.some(id => !['bought','not_bought'].includes(results[id]))) throw new Error('Выберите «Купил» или «Не купил» для каждого присутствовавшего участника промо');
  return {...session, note: note.trim(), attendance: Object.fromEntries(session.studentIds.map(id => [id, attendance[id]])), promoResults: results, status: present.length ? 'done' : 'missed'};
}

export function promoStats(sessions) {
  const promo = sessions.filter(s => s.type === 'promo' && s.status !== 'upcoming');
  let attended = 0, bought = 0, notBought = 0, unknown = 0, absent = 0;
  let total = 0;
  for (const s of promo) for (const id of s.studentIds) {
    // An absence with no purchase decision is neither a successful nor a failed sale.
    if (s.attendance?.[id] !== 'absent' || ['bought','not_bought'].includes(s.promoResults?.[id])) total++;
    if (s.attendance?.[id] === 'absent') absent++;
    if (s.attendance?.[id] === 'present') attended++;
    if (s.promoResults?.[id] === 'bought') bought++;
    else if (s.promoResults?.[id] === 'not_bought') notBought++;
    else unknown++;
  }
  return {sessions: promo.length, attended, bought, notBought, unknown, absent, conversion: total ? Math.round(100 * bought / total) : null};
}

export function studentFilterCoaches(coaches, user, branchId = 'all') {
  if (!user || (user.kind !== 'coach' && user.record.role !== 'owner')) return [];
  const branches = user.record.branches;
  if (branchId !== 'all' && !branches.includes(branchId)) return [];
  return coaches.filter(c => (user.kind !== 'coach' || c.id === user.record.id) &&
    c.branches.some(id => branches.includes(id) && (branchId === 'all' || id === branchId)));
}

export function matchesStudent(s, {query = '', direction = 'all', age = 'all', level = 'all', coachId = 'all', status = 'all', archived = 'exclude'} = {}) {
  const archiveMatches = status === 'archived' ? isArchived(s) : archived === 'include' || !isArchived(s);
  return archiveMatches && s.name.toLowerCase().includes(query.trim().toLowerCase()) &&
    (direction === 'all' || directionsOf(s).includes(direction)) &&
    (coachId === 'all' || s.coachId === coachId) &&
    (age === 'all' || s.age === Number(age)) && (level === 'all' || s.level === level) &&
    (status === 'all' || status === 'archived' || (status === 'promo' ? s.origin === 'promo' : (s.status || 'active') === status));
}

export function weekStats(sessions, referenceDate) {
  const start = new Date(referenceDate + 'T00:00:00');
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const end = new Date(start); end.setDate(end.getDate() + 7);
  const scoped = sessions.filter(s => { const d = new Date(s.date + 'T00:00:00'); return d >= start && d < end; });
  return ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((day,i) => ({day,count:scoped.filter(s => (new Date(s.date+'T00:00:00').getDay()+6)%7 === i).length}));
}

export function canAccessSession(user, session) {
  return !!user && !!session && (user.kind === 'coach' ? session.coachId === user.record.id && user.record.branches.includes(session.branchId) : user.record.branches.includes(session.branchId));
}

export function canEditSession(user, session) {
  return canAccessSession(user, session) && (user.kind === 'coach' || user.record.role === 'owner');
}

export function needsAttention(student) {
  return !isArchived(student) && student.status !== 'left' && (!!student.flag || (Number.isFinite(student.attendance) && student.attendance < 70));
}

export function reconcilePromoStudent(student, updated, sessions) {
  if (!updated.studentIds.includes(student.id)) return student;
  const result = updated.promoResults?.[student.id];
  if (['bought', 'not_bought'].includes(result)) {
    return {...student, origin: result === 'bought' ? 'regular' : 'promo',
      status: result === 'bought' ? 'active' : 'left',
      leftDate: result === 'not_bought' ? updated.date : null,
      promoStatusManual: false,
      promoPriorState: student.promoPriorState || {origin:student.origin, status:student.status, leftDate:student.leftDate},
      promoConversionSessionId: updated.id};
  }
  if (student.promoConversionSessionId === updated.id) {
    const other = sessions.find(s => s.id !== updated.id && s.type === 'promo' && s.status !== 'upcoming' && s.studentIds.includes(student.id) && ['bought','not_bought'].includes(s.promoResults?.[student.id]));
    if (other) return reconcilePromoStudent(student, other, []);
    return {...student, ...(student.promoPriorState || {origin:'promo'}), promoPriorState:null, promoConversionSessionId:null};
  }
  return student;
}

export function updateSessionInState(state, id, payload) {
  const previous = state.sessions.find(s => s.id === id);
  if (!previous) return state;
  const updated = {...previous, ...payload};
  const syncDate = previous.type === 'promo' && previous.status !== 'upcoming' && updated.type === 'promo' &&
    updated.status !== 'upcoming' && previous.date !== updated.date;
  return {...state, sessions: state.sessions.map(s => s.id === id ? updated : s),
    students: syncDate ? state.students.map(s =>
      previous.studentIds.includes(s.id) && updated.studentIds.includes(s.id) &&
      previous.promoResults?.[s.id] === 'not_bought' && updated.promoResults?.[s.id] === 'not_bought' &&
      s.promoConversionSessionId === id && !s.promoStatusManual && s.origin === 'promo' &&
      !(s.promoStatusManual === undefined && s.promoPriorState?.status === 'left' && s.promoPriorState?.leftDate === s.leftDate) &&
      s.status === 'left' && (s.leftDate === previous.date || s.promoStatusManual === false ||
        (s.promoPriorState && s.promoPriorState.status !== 'left')) ? {...s, leftDate: updated.date} : s
    ) : state.students};
}

// Apply the existing correction rule when removing the source of an automatic conversion.
// Manual conversions have no marker and are preserved. Roster/history are never rewritten.
export function removeSessionFromState({students, sessions}, id) {
  const removed = sessions.find(s => s.id === id);
  const remaining = sessions.filter(s => s.id !== id);
  return {
    sessions: remaining,
    students: removed?.type === 'promo'
      ? students.map(s => reconcilePromoStudent(s, {...removed, promoResults: {}}, remaining))
      : students,
  };
}

export function repairMissingPromoSources(students, sessions) {
  let changed = false;
  const repaired = students.map(student => {
    const source = student.promoConversionSessionId;
    if (!source || sessions.some(s => s.id === source)) return student;
    changed = true;
    return reconcilePromoStudent(student, {id: source, studentIds: [student.id], promoResults: {}}, sessions);
  });
  return changed ? repaired : students;
}

// Identity is explicit. Equal names never imply the same child.
export function childKey(student) { return student.childId || student.id; }
export function uniqueChildren(students) { return new Set(students.map(childKey)).size; }
export function uniqueBranchChildren(students, branchId) {
  return uniqueChildren(students.filter(s => s.branchId === branchId && !isArchived(s)));
}

export function validateEnrollment(students, candidate, editingId = null) {
  if (!candidate.childId) throw new Error('Выберите ребёнка или создайте нового');
  if (students.some(s => s.id !== editingId && childKey(s) === candidate.childId && s.discipline === candidate.discipline)) {
    throw new Error('У этого ребёнка уже есть запись по направлению, в том числе возможная архивная. Используйте её или восстановите из архива.');
  }
}

// One direction per working record; factual session direction routes historical marks.
// Ambiguous legacy coaches are left unassigned, never guessed.
export function migrateSchoolData(students, sessions, coaches) {
  const migrated = [], routes = new Map(), issues = [];
  for (const old of students) {
    const directions = [...new Set([old.discipline, ...(old.extraDisciplines || []), ...sessions.filter(s => s.studentIds.includes(old.id)).map(s => s.discipline)].filter(Boolean))];
    const byDirection = new Map();
    for (const discipline of directions) {
      let id = discipline === old.discipline ? old.id : `${old.id}::${discipline}`;
      while (migrated.some(s => s.id === id) || (id !== old.id && students.some(s => s.id === id))) id += ':';
      const candidates = coaches.filter(c => [old.coachId, ...(old.extraCoachIds || [])].includes(c.id) && c.discipline === discipline && c.branches.includes(old.branchId));
      const coachId = discipline === old.discipline ? old.coachId : candidates.length === 1 ? candidates[0].id : null;
      const {extraCoachIds, extraDisciplines, ...base} = old;
      const row = {...base, id, childId:childKey(old), discipline, coachId, attendanceCoachId:old.attendanceCoachId || old.coachId};
      if (old.extraDisciplines?.length) row.legacyReview = true;
      if (discipline !== old.discipline) {
        row.attendance = null; // The old aggregate is not direction-specific.
        row.promoConversionSessionId = null;
        row.promoPriorState = null;
        row.legacyReview = true; // Status/origin were shared; operator must review.
      }
      if (extraCoachIds?.length || extraDisciplines?.length) row.legacyAssignments = old.legacyAssignments || {coachId:old.coachId, discipline:old.discipline, extraCoachIds, extraDisciplines};
      if (!coachId || row.legacyReview) issues.push({studentId:id, message:'Проверьте наставника и статус перенесённого направления'});
      byDirection.set(discipline,id); migrated.push(row);
    }
    routes.set(old.id, byDirection);
  }
  const remapped = sessions.map(session => {
    const route = id => routes.get(id)?.get(session.discipline) || id;
    const mapMarks = marks => marks && Object.fromEntries(Object.entries(marks).map(([id,value]) => [route(id),value]));
    return {...session, studentIds:session.studentIds.map(route),
      ...(session.attendance ? {attendance:mapMarks(session.attendance)} : {}),
      ...(session.promoResults ? {promoResults:mapMarks(session.promoResults)} : {})};
  });
  // Conversion provenance follows its factual roster when an old shared record splits.
  for (const old of students) {
    if (!old.promoConversionSessionId) continue;
    const source = remapped.find(s => s.id === old.promoConversionSessionId);
    if (!source) continue; // Existing orphan repair handles missing sources.
    const original = migrated.find(s => s.id === old.id);
    const target = migrated.find(s => childKey(s) === childKey(old) && s.discipline === source.discipline && source.studentIds.includes(s.id));
    if (original && target && original.id !== target.id) {
      original.promoConversionSessionId = null;
      original.promoPriorState = null;
      original.legacyReview = true;
      target.promoConversionSessionId = source.id;
      target.promoPriorState = old.promoPriorState || null;
    }
  }
  return {schemaVersion:2, students:migrated, sessions:remapped, migrationIssues:issues};
}

export function validateSessionRoster(candidate, students, sessions) {
  const rows = candidate.studentIds.map(id => students.find(s => s.id === id));
  if (!rows.length || rows.some(s => !s)) throw new Error('Выберите существующих учеников');
  if (rows.some(s => s.discipline !== candidate.discipline || s.coachId !== candidate.coachId || s.branchId !== candidate.branchId)) throw new Error('Состав должен соответствовать наставнику, направлению и филиалу');
  if (new Set(rows.map(childKey)).size !== rows.length) throw new Error('Один ребёнок не может быть дважды в составе');
  for (const row of rows) {
    const prior = sessions.filter(s => s.id !== candidate.id && s.type === 'promo' && s.discipline === candidate.discipline && s.studentIds.some(id => {const r=students.find(x=>x.id===id); return r && childKey(r) === childKey(row);}));
    if (candidate.type === 'promo' && prior.length) throw new Error(`Повторное промо запрещено: ${row.name}. На одно направление допускается одно пробное занятие.`);
    if (row.origin === 'promo' && !prior.length && candidate.type !== 'promo') throw new Error(`Первое занятие ${row.name} должно быть промо. Выберите тип «Промо».`);
  }
}

export function coachStudents(students, sessions, coachId) {
  const ownSessions = sessions.filter(s => s.coachId === coachId);
  return students.filter(s => s.coachId === coachId).map(s => ({...s, attendance:attendancePercent(s.id, ownSessions, !s.attendanceCoachId || s.attendanceCoachId === coachId ? s.attendance : null)}));
}

export function updateEnrollment(students, id, payload) {
  const old = students.find(s => s.id === id);
  if (!old) throw new Error('Запись ученика не найдена');
  if (payload.discipline !== old.discipline) throw new Error('Для другого направления создайте отдельную запись этого ребёнка');
  const candidate = {...old,...payload};
  validateEnrollment(students, candidate, id);
  // A changed identity link is an explicit operator action, never name matching.
  return students.map(s => s.id === id ? {...candidate,legacyReview:false} : childKey(s) === candidate.childId ? {...s,name:payload.name,age:payload.age} : s);
}

export function patchEnrollment(student, patch) {
  const next = {...student,...patch};
  if (patch.origin === 'regular') return {...next,promoConversionSessionId:null,promoPriorState:null};
  // A manual status stays manual even when its value/date matches the promo's automatic result.
  if (patch.status && student.promoConversionSessionId) next.promoStatusManual = true;
  if (patch.status && student.promoPriorState) next.promoPriorState = {...student.promoPriorState,status:patch.status,leftDate:patch.leftDate || null};
  return next;
}

// Storage-only mapping. Calculations remain in the unchanged crmLogic.js.
export const coachDirections = coach => [...new Set(coach?.disciplines || [coach?.discipline])].filter(Boolean);
const initials = name => (name || '').split(/\s+/).map(x => x[0]).slice(0,2).join('').toUpperCase();
const copy = (row, fields) => Object.fromEntries(fields.filter(k => Object.hasOwn(row,k)).map(k => [k,row[k]]));
export function fromSnapshot(raw, authUserId) {
  for (const k of ['students','sessions','participants','comments','coaches','managers']) {
    if (!Array.isArray(raw?.[k])) throw new Error('Неполный ответ базы. Данные не загружены');
  }
  const staff = row => ({...copy(row,['id','name','email','discipline','disciplines','exp','grade','branches','role','revision']),avatar:initials(row.name)});
  const coaches = raw.coaches.map(staff), managers = raw.managers.map(staff);
  const identities = [...raw.coaches.filter(c => c.user_id === authUserId).map(c => ({kind:'coach',record:staff(c)})),
    ...raw.managers.filter(m => m.user_id === authUserId).map(m => ({kind:'manager',record:staff(m)}))];
  if (identities.length !== 1) throw new Error('Аккаунту не назначена однозначная роль CRM');
  const students = raw.students.map(s => ({
    ...copy(s,['id','name','age','discipline','level','phone','origin','status','flag','revision']),
    childId:s.child_id || s.id, coachId:s.coach_id, branchId:s.branch_id, joinDate:s.join_date || null,
    leftDate:s.left_date || null, archivedAt:s.archived_at || null, birthDate:s.birth_date || null,
    attendance:s.legacy_attendance ?? null, attendanceCoachId:s.attendance_coach_id || null,
    lastNote:s.last_note || '', legacyReview:!!s.legacy_review, legacyAssignments:s.legacy_assignments || null,
    promoConversionSessionId:s.promo_conversion_session_id || null, promoPriorState:s.promo_prior_state || null,
    ...(typeof s.promo_status_manual === 'boolean' ? {promoStatusManual:s.promo_status_manual} : {}),
    statusHistory:s.status_history || [],
    comments:raw.comments.filter(c => c.student_id===s.id).map(c => copy(c,['id','date','text'])),
  }));
  const sessions = raw.sessions.map(s => {
    const roster = raw.participants.filter(p => p.session_id === s.id);
    return {...copy(s,['id','type','discipline','date','time','duration','note','status','revision']),
      coachId:s.coach_id,branchId:s.branch_id,groupName:s.group_name || '',templateId:s.template_id || null,
      studentIds:roster.map(p => p.student_id),
      ...(s.attendance_recorded ? {attendance:Object.fromEntries(roster.map(p => [p.student_id,p.present===true?'present':p.present===false?'absent':null]))} : {}),
      promoResults:Object.fromEntries(roster.filter(p => ['bought','not_bought'].includes(p.promo_result)).map(p => [p.student_id,p.promo_result])),
    };
  });
  return {school:{schemaVersion:2,students,sessions,migrationIssues:[]},coaches,managers,user:identities[0],authUserId};
}
const names = {childId:'child_id',coachId:'coach_id',branchId:'branch_id',studentIds:'student_ids',groupName:'group_name',
  sessionIds:'session_ids',
  templateId:'template_id',joinDate:'join_date',leftDate:'left_date',archivedAt:'archived_at',promoResults:'promo_results'};
// Only explicitly allowed input fields cross the API. No password, role spoofing, history or auto-status marker.
const allowed = new Set(['id','name','age','discipline','coachId','branchId','level','phone','childId','comments','joinDate','status','origin','flag',
  'leftDate','archivedAt','type','date','time','duration','groupName','studentIds','note','templateId','attendance','promoResults',
  'email','disciplines','exp','grade','branches','role','sessions','scope','sessionIds']);
export function toPayload(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([key,value]) => allowed.has(key) && value!==undefined).map(([key,value]) =>
    [names[key] || key,key==='sessions' ? value.map(toPayload) : key==='comments' ? value.map(c => copy(c,['id','date','text'])) : value]));
}
export function expectedVersions(state) {
  return Object.fromEntries(['students','sessions','coaches','managers'].map(table => [table,Object.fromEntries(
    (state.school?.[table] || state[table] || []).filter(r => Number.isInteger(r.revision)).map(r => [r.id,r.revision]))]));
}

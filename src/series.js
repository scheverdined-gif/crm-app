export function hasSessionHistory(session) {
  return session.status !== 'upcoming' || Object.hasOwn(session,'attendance') ||
    Object.values(session.promoResults || {}).some(v=>v!==null && v!==undefined);
}
export function seriesSelection(sessions,anchor,scope='single') {
  if(!['single','series','following'].includes(scope))throw new Error('Неизвестный вариант удаления');
  const linked=sessions.filter(s=>scope==='single'?s.id===anchor.id:
    !!anchor.templateId && s.templateId===anchor.templateId &&
    (scope!=='following'||`${s.date}T${s.time.padEnd(8,':00')}`>=`${anchor.date}T${anchor.time.padEnd(8,':00')}`));
  return {deletable:linked.filter(s=>!hasSessionHistory(s)),preserved:linked.filter(hasSessionHistory)};
}

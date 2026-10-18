// Presentation helpers only: no attendance, conversion or payroll rules.
export function suggestedSessionName(type, directionLabel) {
  if (!directionLabel) return '';
  return type === 'promo' ? `Промо · ${directionLabel}` : type === 'individual' ? `Индивидуальная · ${directionLabel}` : '';
}

export function groupNameSuggestions(sessions, {branchId, discipline}) {
  return [...new Set(sessions.filter(s => s.branchId === branchId && s.discipline === discipline &&
    ['group','sport_group'].includes(s.type)).map(s => s.groupName?.trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b,'ru'));
}

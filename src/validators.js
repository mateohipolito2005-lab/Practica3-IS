'use strict';
function isValidDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T12:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}
function validText(value, min, max) {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
}
function isStrongPassword(password) {
  return typeof password === 'string' &&
         password.length >= 8;
}
function validateTask(input) {
  const issues = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return ['Se requiere un objeto de tarea.'];
  if (!validText(input.title, 1, 100)) issues.push('El título debe tener entre 1 y 100 caracteres.');
  if (!Number.isSafeInteger(input.subjectId) || input.subjectId <= 0) issues.push('Selecciona una materia válida.');
  if (!isValidDate(input.dueDate)) issues.push('Ingresa una fecha válida (AAAA-MM-DD).');
  if (!['alta', 'media', 'baja'].includes(input.priority)) issues.push('La prioridad debe ser alta, media o baja.');
  if (input.notes !== undefined && (typeof input.notes !== 'string' || input.notes.length > 1000)) issues.push('Las notas deben tener hasta 1000 caracteres.');
  if (input.status !== undefined && !['pendiente', 'completada'].includes(input.status)) issues.push('El estado no es válido.');
  return issues;
}
function todayInEcuador(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${obj.year}-${obj.month}-${obj.day}`;
}
function isOverdue(task, today = todayInEcuador()) {
  return task.status === 'pendiente' && task.due_date < today;
}
module.exports = {
  isValidDate,
  validateTask,
  todayInEcuador,
  isOverdue,
  validText,
  isStrongPassword
};
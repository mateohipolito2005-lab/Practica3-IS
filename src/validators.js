function isValidDate(dateStr) {
    const regEx = /^\d{4}-\d{2}-\d{2}$/;
    if(!dateStr.match(regEx)) return false;  // Invalid format
    const d = new Date(dateStr);
    const dNum = d.getTime();
    if(!dNum && dNum !== 0) return false; // NaN validation
    return d.toISOString().slice(0,10) === dateStr;
}

function validateTask(input) {
    let issues = [];
    if (input.title === undefined || typeof input.title !== 'string' || input.title.trim() === '') issues.push('El título es obligatorio y debe ser texto');
    if (input.dueDate !== undefined && !isValidDate(input.dueDate)) issues.push('Ingresa una fecha válida (AAAA-MM-DD)');
    if (input.priority !== undefined && !['alta', 'media', 'baja'].includes(input.priority)) issues.push('La prioridad debe ser alta, media o baja');
    if (input.notes !== undefined && (typeof input.notes !== 'string' || input.notes.length > 250)) issues.push('Las notas deben ser texto y menor a 250 caracteres');
    if (input.status !== undefined && !['pendiente', 'completada'].includes(input.status)) issues.push('El estado debe ser pendiente o completada');
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

function validText(text) {
    return typeof text === 'string' && text.trim().length > 0;
}

function isValidateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Función añadida por Snaider
function esTextoValido(texto) {
    return typeof texto === 'string' && texto.trim().length > 0;
}

module.exports = {
    isValidDate,
    validateTask,
    todayInEcuador,
    isOverdue,
    validText,
    isValidateEmail,
    esTextoValido
};
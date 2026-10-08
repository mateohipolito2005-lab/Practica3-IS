'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { openDatabase } = require('./db');
const { validateTask, validText, todayInEcuador, isOverdue } = require('./validators');

const PUBLIC = path.resolve(__dirname, '../public');
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const SAFE_FILES = { '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/styles.css': 'styles.css' };
const MIME = { 'index.html': 'text/html; charset=utf-8', 'app.js': 'text/javascript; charset=utf-8', 'styles.css': 'text/css; charset=utf-8' };

function json(res, status, body) {
  const output = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(output), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" });
  res.end(output);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    if (!(req.headers['content-type'] || '').startsWith('application/json')) return reject(Object.assign(new Error('Se requiere JSON.'), { status: 415 }));
    let body = '', total = 0;
    req.on('data', chunk => {
      total += chunk.length;
      if (total > 32_768) { reject(Object.assign(new Error('Solicitud demasiado grande.'), {status: 413})); req.destroy(); return; }
      body += chunk;
    });
    req.on('end', () => { try { const data = JSON.parse(body); if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error(); resolve(data); } catch { reject(Object.assign(new Error('JSON inválido.'), { status: 400 })); } });
    req.on('error', reject);
  });
}
function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}
function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash || !/^[a-f0-9]{128}$/.test(hash)) return false;
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), crypto.scryptSync(password, salt, 64));
}
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(part => part.trim().split('=')).filter(p => p.length === 2));
}
function makeCookie(token, secure) {
  return `unitask_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}${secure ? '; Secure' : ''}`;
}
function createApplication({ dbPath = process.env.DB_PATH || path.resolve(__dirname, '../data/unitask.sqlite'), production = process.env.NODE_ENV === 'production' } = {}) {
  const db = openDatabase(dbPath);
  const attempts = new Map();
  const userBySession = db.prepare(`SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at > ?`);
  const getSubject = db.prepare('SELECT id FROM subjects WHERE id=? AND user_id=?');
  const findTask = db.prepare('SELECT * FROM tasks WHERE id=? AND user_id=?');
  const fullTasks = `SELECT t.id, t.title, t.notes, t.due_date, t.priority, t.status, t.subject_id, t.created_at, t.updated_at, s.name AS subject_name FROM tasks t JOIN subjects s ON s.id=t.subject_id WHERE t.user_id=?`;
  function requireUser(req, res) {
    const token = cookies(req).unitask_session;
    if (!token || !/^[a-f0-9]{64}$/.test(token)) { json(res, 401, {error:'Inicia sesión para continuar.'}); return null; }
    const user = userBySession.get(crypto.createHash('sha256').update(token).digest('hex'), new Date().toISOString());
    if (!user) { json(res, 401, {error:'La sesión venció. Inicia sesión nuevamente.'}); return null; }
    return user;
  }
  function createSession(userId, res) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + SESSION_MS).toISOString();
    db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(crypto.createHash('sha256').update(token).digest('hex'), userId, expires);
    res.setHeader('Set-Cookie', makeCookie(token, production));
  }
  const server = http.createServer(async (req, res) => {
    const ip = (req.socket.remoteAddress || 'unknown');
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const pathname = url.pathname;
      res.setHeader('X-Frame-Options','DENY');
      res.setHeader('Referrer-Policy','no-referrer');
      if (['POST','PATCH','PUT','DELETE'].includes(req.method) && req.headers.origin) {
        const expected = process.env.PUBLIC_ORIGIN || `${production ? 'https' : 'http'}://${req.headers.host}`;
        if (req.headers.origin !== expected) return json(res, 403, {error:'Origen no autorizado.'});
      }
      if (req.method === 'GET' && pathname === '/health') return json(res, 200, {status:'ok'});
      if (req.method === 'GET' && Object.hasOwn(SAFE_FILES, pathname)) {
        const filename = SAFE_FILES[pathname];
        const content = fs.readFileSync(path.join(PUBLIC, filename));
        res.writeHead(200, {'Content-Type':MIME[filename], 'Content-Length':content.length, 'X-Content-Type-Options':'nosniff', 'Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"});
        return res.end(content);
      }
      if (!pathname.startsWith('/api/')) return json(res,404,{error:'Ruta no encontrada.'});
      if (['/api/auth/login','/api/auth/register'].includes(pathname) && req.method === 'POST') {
        const now = Date.now(), entry = attempts.get(ip) || { until: now + 15*60_000, count: 0 };
        if (now > entry.until) { entry.count = 0; entry.until = now + 15*60_000; }
        if (++entry.count > 20) return json(res,429,{error:'Demasiados intentos. Espera unos minutos.'});
        attempts.set(ip,entry);
        const data = await readBody(req);
        const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
        const password = data.password;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof password !== 'string' || password.length < 8 || password.length > 128) return json(res,422,{error:'Ingresa correo válido y contraseña de 8 a 128 caracteres.'});
        if (pathname.endsWith('register')) {
          const name = typeof data.name === 'string' ? data.name.trim() : '';
          if (!validText(name,2,60)) return json(res,422,{error:'El nombre debe tener entre 2 y 60 caracteres.'});
          if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) return json(res,409,{error:'El correo ya está registrado.'});
          const result = db.prepare('INSERT INTO users(email,name,password_hash) VALUES(?,?,?)').run(email,name,passwordHash(password));
          db.prepare('INSERT INTO subjects(user_id,name) VALUES(?,?)').run(result.lastInsertRowid,'General');
          createSession(Number(result.lastInsertRowid),res);
          return json(res,201,{user:{id:Number(result.lastInsertRowid),name,email}});
        }
        const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
        if (!user || !verifyPassword(password,user.password_hash)) return json(res,401,{error:'Credenciales incorrectas.'});
        createSession(user.id,res);
        return json(res,200,{user:{id:user.id,name:user.name,email:user.email}});
      }
      if (pathname === '/api/auth/me' && req.method === 'GET') {
        const user = requireUser(req,res); return user && json(res,200,{user});
      }
      if (pathname === '/api/auth/logout' && req.method === 'POST') {
        const token = cookies(req).unitask_session;
        if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(crypto.createHash('sha256').update(token).digest('hex'));
        res.setHeader('Set-Cookie', 'unitask_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' + (production?'; Secure':''));
        return json(res,200,{message:'Sesión cerrada.'});
      }
      const user = requireUser(req,res);
      if (!user) return;
      if (pathname === '/api/subjects') {
        if (req.method === 'GET') return json(res,200,{subjects:db.prepare('SELECT id,name FROM subjects WHERE user_id=? ORDER BY name').all(user.id)});
        if (req.method === 'POST') {
          const data = await readBody(req);
          const name = typeof data.name === 'string' ? data.name.trim() : '';
          if (!validText(name,1,60)) return json(res,422,{error:'El nombre de materia debe tener entre 1 y 60 caracteres.'});
          if (db.prepare('SELECT id FROM subjects WHERE user_id=? AND name=?').get(user.id,name)) return json(res,409,{error:'Esta materia ya existe.'});
          const id = db.prepare('INSERT INTO subjects(user_id,name) VALUES(?,?)').run(user.id,name).lastInsertRowid;
          return json(res,201,{subject:{id:Number(id),name}});
        }
      }
      if (pathname === '/api/stats' && req.method === 'GET') {
        const today = todayInEcuador();
        const row = db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN status='completada' THEN 1 ELSE 0 END) AS completadas, SUM(CASE WHEN status='pendiente' THEN 1 ELSE 0 END) AS pendientes, SUM(CASE WHEN status='pendiente' AND due_date < ? THEN 1 ELSE 0 END) AS vencidas FROM tasks WHERE user_id=?`).get(today,user.id);
        return json(res,200,{stats: {total:row.total, completadas:row.completadas || 0, pendientes:row.pendientes || 0, vencidas:row.vencidas || 0}});
      }
      if (pathname === '/api/tasks') {
        if (req.method === 'GET') {
          const filters = [], params = [user.id];
          const state = url.searchParams.get('status'), priority = url.searchParams.get('priority'), search = url.searchParams.get('search'), subject = url.searchParams.get('subjectId');
          if (state && ['pendiente','completada'].includes(state)) {filters.push('t.status=?'); params.push(state);} else if (state) return json(res,400,{error:'Filtro de estado inválido.'});
          if (priority && ['alta','media','baja'].includes(priority)) {filters.push('t.priority=?'); params.push(priority);} else if (priority) return json(res,400,{error:'Filtro de prioridad inválido.'});
          if (subject) {if (!/^\d+$/.test(subject)) return json(res,400,{error:'Materia inválida.'}); filters.push('t.subject_id=?'); params.push(Number(subject));}
          if (search) {if (search.length > 100) return json(res,400,{error:'Búsqueda demasiado larga.'}); filters.push("LOWER(t.title) LIKE ? ESCAPE '\\'"); params.push(`%${search.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`);}
          const statement = fullTasks + (filters.length?' AND '+filters.join(' AND '):'') + " ORDER BY CASE t.status WHEN 'pendiente' THEN 0 ELSE 1 END, t.due_date ASC, t.id DESC LIMIT 500";
          const tasks = db.prepare(statement).all(...params).map(t => ({...t,overdue:isOverdue(t)}));
          return json(res,200,{tasks});
        }
        if (req.method === 'POST') {
          const data = await readBody(req), errors = validateTask(data);
          if (errors.length) return json(res,422,{error:errors.join(' ')});
          if (!getSubject.get(data.subjectId,user.id)) return json(res,422,{error:'La materia seleccionada no pertenece a tu cuenta.'});
          const taskId = db.prepare('INSERT INTO tasks(user_id,subject_id,title,notes,due_date,priority,status) VALUES(?,?,?,?,?,?,?)').run(user.id,data.subjectId,data.title.trim(),(data.notes||'').trim(),data.dueDate,data.priority,data.status||'pendiente').lastInsertRowid;
          const task = db.prepare(fullTasks+' AND t.id=?').get(user.id,Number(taskId));
          return json(res,201,{task:{...task,overdue:isOverdue(task)}});
        }
      }
      const matched = pathname.match(/^\/api\/tasks\/(\d+)$/);
      if (matched) {
        const id = Number(matched[1]);
        if (!Number.isSafeInteger(id)) return json(res,404,{error:'Tarea no encontrada.'});
        const oldTask = findTask.get(id,user.id);
        if (!oldTask) return json(res,404,{error:'Tarea no encontrada.'});
        if (req.method === 'GET') { const task=db.prepare(fullTasks+' AND t.id=?').get(user.id,id); return json(res,200,{task:{...task,overdue:isOverdue(task)}}); }
        if (req.method === 'DELETE') {db.prepare('DELETE FROM tasks WHERE id=? AND user_id=?').run(id,user.id);return json(res,200,{message:'Tarea eliminada.'});}
        if (req.method === 'PATCH') {
          const incoming = await readBody(req);
          const fields = ['title','subjectId','dueDate','priority','notes','status'];
          if (!Object.keys(incoming).length || Object.keys(incoming).some(k=>!fields.includes(k))) return json(res,422,{error:'Actualización sin campos válidos.'});
          const data = {title:oldTask.title,subjectId:oldTask.subject_id,dueDate:oldTask.due_date,priority:oldTask.priority,notes:oldTask.notes,status:oldTask.status,...incoming};
          const errors = validateTask(data);
          if (errors.length) return json(res,422,{error:errors.join(' ')});
          if (!getSubject.get(data.subjectId,user.id)) return json(res,422,{error:'Materia no autorizada.'});
          db.prepare(`UPDATE tasks SET subject_id=?,title=?,notes=?,due_date=?,priority=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`).run(data.subjectId,data.title.trim(),data.notes.trim(),data.dueDate,data.priority,data.status,id,user.id);
          const task=db.prepare(fullTasks+' AND t.id=?').get(user.id,id);
          return json(res,200,{task:{...task,overdue:isOverdue(task)}});
        }
      }
      return json(res,405,{error:'Método o ruta no disponible.'});
    } catch (err) {
      console.error('[UniTask]',err.message);
      if (!res.headersSent && !res.destroyed) json(res,err.status || 500,{error:err.status ? err.message : 'Error interno del servidor.'});
    }
  });
  return {server,db,close:()=>db.close()};
}
if (require.main === module) {
  const port = Number(process.env.PORT||3000);
  const {server} = createApplication();
  server.listen(port,'0.0.0.0',()=>console.log(`UniTask disponible en http://localhost:${port}`));
}
module.exports = {createApplication,passwordHash,verifyPassword};

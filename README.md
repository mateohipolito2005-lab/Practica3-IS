# ✦ UniTask · Gestor de tareas universitarias

Proyecto de Ingeniería de Software Moderna - Práctica 3 (SDLC colaborativo + IA).

## Requisitos
- **Node.js 22.13+** (incluye el módulo `node:sqlite`; puede mostrar aviso experimental en Node 22).
- No requiere instalar bibliotecas externas.

## Ejecutar
```bash
cd unitask
npm start
```
Visita http://localhost:3000. Registra una cuenta, crea materias y tareas. El archivo de datos se guarda en `unitask/data/unitask.sqlite` (ignorado por Git).

## Comprobar
```bash
npm run check
npm test
npm run test:coverage
```

## Funciones
- Registro, inicio y cierre de sesión con contraseñas saladas mediante `scrypt`.
- Datos separados por estudiante, sesiones con cookies HttpOnly/SameSite Strict.
- Crear materias; crear, editar, marcar y borrar tareas; notas, fecha, prioridad.
- Búsqueda y filtros por materia, estado y prioridad.
- Indicadores totales, pendientes, completadas y vencidas; zona America/Guayaquil.
- Interfaz adaptable para computadora y teléfono.

## API REST
`POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET/POST /api/subjects`, `GET/POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/{id}`, `GET /api/stats`, `GET /health`.

Especificación OpenAPI en `../documentacion/openapi.yaml`.

## Despliegue
1. Opción local/Docker: `docker compose up --build` (requiere Docker).
2. Opción pública: subir el repositorio a GitHub y conectar un servicio compatible con Docker y **volumen persistente** (por ejemplo Render con disco en plan compatible). `render.yaml` es un ejemplo, NO prueba que ya esté publicado.
3. Configurar `NODE_ENV=production`, `DB_PATH=/app/data/unitask.sqlite` y `PUBLIC_ORIGIN=https://dominio-real`.
4. Confirmar HTTPS, persistencia tras reinicio, salud (`/health`) y controles de acceso.

⚠️ No usar un despliegue gratuito con almacenamiento efímero como repositorio de datos permanente: la base SQLite puede perderse al reiniciar. Para un uso más amplio conviene una base de datos gestionada, copias de seguridad y una auditoría de seguridad adicional.

## Evidencia del equipo
Los cuatro estudiantes deben crear ramas, commits y Pull Requests reales. Los prompts, revisiones y capturas deben registrar acciones realizadas, no generarse retrospectivamente como evidencia ficticia.

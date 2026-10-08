# Cómo contribuir a UniTask

1. Cada integrante clona el repositorio y crea una rama `feature/nombre-funcionalidad` desde `develop`.
2. Revisa el issue asignado, desarrolla un cambio pequeño y documenta si recibió ayuda de IA.
3. Para todo cambio, ejecuta `npm run check` y `npm run test:coverage`.
4. Usa nombres `camelCase` en JavaScript, archivos en minúsculas y mensajes de commit explicativos (`feat: ...`, `fix: ...`, `test: ...`).
5. Haz `git push` a tu propia rama y abre un Pull Request hacia `develop`. Adjunta captura, prompt y pruebas.
6. Solicita revisión a otro integrante. Registra comentarios del revisor humano y de IA sin presentar sugerencias automáticas como hechos comprobados.
7. Solo integra la rama después de la revisión humana y de CI verde.
8. No subas contraseñas, datos personales reales, `.env`, ni la base SQLite a GitHub o IA pública.

## Distribución propuesta (equipo de 4)
- Integrante 1: pantalla de autenticación y pruebas de acceso.
- Integrante 2: alta/edición/eliminación de tareas y validaciones.
- Integrante 3: materias, filtros y estadísticas.
- Integrante 4: interfaz adaptable, tests, CI y despliegue.

> El ZIP es un punto de partida generado por IA. Los commits y Pull Requests reales deben ejecutarse desde las cuentas del equipo; no se simula su historial.

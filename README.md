# Votaciones SENA

Aplicación web local basada en el prototipo HTML entregado, convertida a Bootstrap con backend en Flask.
También puede guardar los votos en Firebase Firestore para publicar el frontend como enlace público sin depender del backend local.

## Ejecutar

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python backend\app.py
```

Luego abre:

```text
http://127.0.0.1:5000
```

## Pantallas

- Votación: selección de jornada, tarjetón, revisión y confirmación en `frontend/index.html`.
- Sistema: gestión de candidatos, resultados y reportes en `frontend/admin.html`.
- Acceso administrativo local: formulario de clave en `frontend/admin-login.html`.

## Notas

- La votación no requiere inicio de sesión.
- Los candidatos empiezan en cero votos.
- Cada voto se guarda con ID autoincremental en `backend/data/votes.json`.
- Si configuras Firebase en `frontend/js/firebase-config.js`, cada voto se guarda en la colección `votos` de Firestore.
- El reporte PDF se descarga desde `/api/reports/pdf` cuando se usa Flask.
- La administración usa clave de acceso.

## Firebase

1. Crea un proyecto en Firebase Console.
2. Activa Firestore Database.
3. Registra una app web y copia la configuración.
4. Pega los valores en `frontend/js/firebase-config.js`.
5. Publica la carpeta `frontend` con Firebase Hosting.

Cuando `firebase-config.js` tiene `apiKey`, `projectId` y `appId`, el frontend usa Firestore para:

- guardar votos en `votos`;
- consultar resultados desde `votos`;
- consultar reportes desde `votos`.

La administración de candidatos todavía usa Flask. Para un enlace público sencillo, los candidatos se leen desde `frontend/data/candidates.json`.

# Votaciones SENA

Aplicación web local basada en el prototipo HTML entregado, convertida a Bootstrap con backend en Flask.

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

- Inicio: selección de jornada.
- Votar: tarjetón con candidatos.
- Revisión: confirmación previa del voto.
- Confirmación: comprobante del voto registrado.
- Administración: gestión de candidatos protegida con clave.
- Resultados: monitor de resultados para administración.
- Reportes: tabla compacta y exportación PDF/CSV para administración.
- Ayuda, privacidad, términos y transparencia.

## Notas

- La votación no requiere inicio de sesión.
- Los candidatos empiezan en cero votos.
- Cada voto se guarda con ID autoincremental en `backend/data/votes.json`.
- El reporte PDF se descarga desde `/api/reports/pdf`.
- La administración usa clave de acceso.

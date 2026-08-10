# Requerimientos del proyecto

## Funcionales

- Seleccionar la jornada de votacion: Diurna, Mixta o Virtual.
- Votar sin inicio de sesion.
- Mostrar tarjeton con candidatos y opcion de voto en blanco.
- Revisar la seleccion antes de confirmar el voto.
- Registrar un voto desde el frontend hacia el backend con ID autoincremental.
- Mostrar comprobante de confirmacion.
- Separar resultados y reportes del flujo de aprendices.
- Consultar resultados consolidados por candidato desde el apartado administrativo.
- Visualizar participacion por jornada y modalidad desde administración.
- Consultar reportes en tabla, filtrar por jornada, paginar y exportar CSV/PDF desde administración.
- Navegar a apartados de ayuda, privacidad, terminos y transparencia.

## Tecnicos

- Backend en Python con Flask.
- Frontend en HTML, Bootstrap 5, CSS y JavaScript.
- CSS separado en `frontend/css/styles.css`.
- Dependencias Python declaradas en `requirements.txt`.
- Datos de votos persistidos localmente en `backend/data/votes.json` con estructura de registros.
- Logo local en `frontend/assets/logo-sena.png`.

## Estructura

```text
backend/
  app.py
  data_store.py
  data/
frontend/
  index.html
  votar.html
  resultados.html
  reportes.html
  css/styles.css
  js/app.js
requirements.txt
```

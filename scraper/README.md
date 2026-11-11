# STJ Sonora Mini-Scraper (Cloud Microservice)

Microservicio ligero e independiente para consultar de forma centralizada el portal del Supremo Tribunal de Justicia del Estado de Sonora (STJ Sonora) y despachar notificaciones push a través de Expo.

Diseñado para desplegarse de inmediato en cualquier plataforma en la nube (Render, Railway, Fly.io, Cloud Run o VPS con Docker).

## Endpoints

- `GET /health`: Estado del servicio.
- `POST /api/scrape-case`: Consulta individual de un expediente judicial.
- `POST /api/scrape-batch`: Consulta por lotes con retraso automático de 1,200 ms entre llamadas para evitar bloqueos por IP.
- `POST /api/push`: Pasarela para enviar alertas a la app móvil y smartwatch mediante Expo Push API.

## Ejecución Local
```bash
npm install
npm run dev
```

## Despliegue con Docker
```bash
docker build -t stj-miniscraper .
docker run -p 3000:3000 stj-miniscraper
```

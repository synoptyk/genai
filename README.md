# Gen AI (Standalone)

Proyecto empresarial 360 autocontenido en esta carpeta.

## Requisito
- Node.js 18+

## Instalacion
Desde la raiz de este proyecto:

```bash
npm run install:all
```

## Desarrollo
Backend + Frontend:

```bash
npm run dev
```

Backend + Frontend + Mobile:

```bash
npm run dev:all
```

## Produccion (backend)

```bash
npm start
```

## Build frontend

```bash
npm run build:client
```

## Docker (portable)

1. Copia variables:

```bash
cp .env.example .env
```

2. Levanta todo (Mongo + API + Frontend):

```bash
npm run docker:up
```

3. Logs en vivo:

```bash
npm run docker:logs
```

4. Detener:

```bash
npm run docker:down
```

## Estructura
- `server/`: API y logica de negocio
- `client/`: aplicacion web React
- `mobile/`: aplicacion mobile Expo

## Principio de aislamiento
- No requiere carpetas hermanas del workspace.
- No usa rutas absolutas de maquina para ejecutar.
- Toda la operacion se realiza desde la raiz de `Gen AI`.

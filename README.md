# Research Room

Mesa de trabajo multi-modelo para investigación asistida por IA. Permite trabajar con dos modelos de lenguaje en paralelo mientras construís un documento compartido en tiempo real.

## Stack

- **Next.js 15** (App Router)
- **Prisma** + **Neon** (PostgreSQL)
- **NextAuth** (Google OAuth)
- **OpenRouter** (acceso a modelos de terceros vía OAuth PKCE)
- **Google Drive API** (importar/exportar documentos)
- SSE para streaming de respuestas

## Requisitos

- Node.js 18+
- Cuenta en [Neon](https://neon.tech) con una base de datos PostgreSQL
- Credenciales de Google OAuth (para auth + Drive)
- Cuenta en OpenRouter (opcional, para modelos adicionales)

## Setup

```bash
npm install
cp .env.example .env
# Completar las variables en .env
npx prisma migrate deploy
npm run dev
```

## Variables de entorno

Ver `.env.example` para la lista completa. Las principales:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | URL de conexión a Neon |
| `NEXTAUTH_SECRET` | Secret para NextAuth |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth de Google |
| `OPENROUTER_CLIENT_ID` / `OPENROUTER_CLIENT_SECRET` | OAuth de OpenRouter |

## Estructura

```
src/
  app/          # Rutas y API routes (Next.js App Router)
  components/   # Componentes React
  lib/          # Utilidades, Prisma client, i18n
prisma/
  schema.prisma
  migrations/
```

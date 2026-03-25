# Live CMS Example

A small React + Express example site with:

- a split homepage layout with public text on the left
- an admin login on the right
- a tiny CMS for adding and deleting homepage lines
- automatic live updates across open tabs via Server-Sent Events

## Local development

1. Install dependencies:

   ```bash
   npm install
   npm --prefix client install
   ```

2. Start the client and server together:

   ```bash
   npm run dev
   ```

3. Open `http://localhost:5173`

The demo login is `admin / admin` by default. Override it with environment variables in a local `.env` file if needed.

## Production build

```bash
npm install
npm --prefix client install
npm run build
npm start
```

The Express server serves the built React app from `client/dist`.

## Environment variables

Copy `.env.example` to `.env` for local or server configuration.

- `PORT`
- `ADMIN_USER`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

## Deployment notes

- Keep `.env` only on the server and out of git.
- The content lives in `server/data/content.json`.
- If multiple browser tabs are open, published changes are pushed automatically through `/api/stream`.

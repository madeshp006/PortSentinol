# PortSentinel Real Internal Scan Build

This build includes:

- React + Vite web app
- Express + MongoDB backend
- JWT auth
- real queued TCP port scanning for authorized internal targets
- polling-based live progress updates
- saved scan history, alerts, schedules, and admin overview
- scope validation for localhost, private IPv4, and `.local` hosts

## What "real" means in this build

The backend performs **real TCP connectivity checks** against the target and the selected ports. It is intended for:

- your own server
- devices you administer on the same Wi-Fi / LAN
- localhost or `.local` hosts you control

It does **not** scan arbitrary public internet IPs in this build.

## Project structure

- `src/` → React web app
- `server/` → Node.js backend

## Frontend setup

Create a root `.env` file:

```env
VITE_API_BASE_URL=/api
```

Then run:

```bash
npm install
npm run dev
```

## Backend setup

Create `server/.env` using `server/.env.example`.

Example:

```env
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/portsentinel?retryWrites=true&w=majority
JWT_SECRET=change-this-to-a-long-random-string
INTERNAL_SCANNER_MODE=local
# INTERNAL_SCANNER_ENDPOINT=http://your-approved-internal-agent/scan
# INTERNAL_SCANNER_API_KEY=change-me
```

Then run:

```bash
cd server
npm install
npm run dev
```

## Local run

Use two terminals.

### Terminal 1
```bash
cd server
npm run dev
```

### Terminal 2
```bash
npm run dev
```

If Vite uses `5174`, update `CLIENT_ORIGIN` in `server/.env` and restart the backend.

## URLs

- Web app: `http://localhost:5173` or `http://localhost:5174`
- Backend health: `http://localhost:5000/api/health`

## How scans work

- `Quick Scan` → scans a curated set of common TCP ports
- `Deep Scan` → scans TCP ports `1-1024`
- `Custom Scan` → scans a comma-separated list or a range like `22,80,443` or `1-512`

The backend creates a queued job, performs the TCP checks, stores the results in MongoDB, and the client polls `GET /api/scans/:id` for progress.

## Safe target scope

This build only allows:

- `localhost`
- `127.0.0.1`
- private IPv4 ranges (`10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`)
- `.local` hostnames

## Main routes

- `POST /api/scan/start`
- `GET /api/scans`
- `GET /api/scans/:id`
- `POST /api/scans/:id/cancel`
- `GET /api/alerts`
- `GET /api/schedules`
- `GET /api/admin/overview`

## Mobile app note

The Flutter mobile client should point to this backend:

- Android emulator: `http://10.0.2.2:5000/api`
- real phone on same Wi-Fi: `http://YOUR_PC_IP:5000/api`

The backend already listens on `0.0.0.0` for LAN access.

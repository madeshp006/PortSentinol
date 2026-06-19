# PortSentinel Deployment Guide

This document outlines the steps needed to deploy the PortSentinel application to production using **Render** for the backend, **Aiven** for the PostgreSQL database, and **Vercel** for the frontend.

---

## Architecture Overview

PortSentinel has three primary components:
1. **Frontend (Vite + React)**: A client-side Single Page Application (SPA). This will be deployed to **Vercel**.
2. **Backend (Express + Socket.IO)**: A stateful Node.js application that handles persistent WebSocket connections, API requests, and background offline status checks. This will be deployed to **Render**.
3. **Database (PostgreSQL)**: Hosted on **Aiven** and connected to the backend server via Prisma.

```
+------------------------------+
|       Vercel Frontend        |
|    (React / client-side)     |
+--------------+---------------+
               |
        HTTP & WebSockets
               |
               v
+--------------+---------------+
|        Express Backend       |  <--- polling/agent connections
|         (Render Host)        |
+--------------+---------------+
               |
          Prisma ORM
               v
+--------------+---------------+
|        Aiven Database        |
|     (Managed PostgreSQL)     |
+------------------------------+
```

---

## Phase 1: Database Setup on Aiven

1. Log in or sign up at [Aiven](https://aiven.io/).
2. Create a new service:
   - **Service Type**: PostgreSQL
   - **Cloud Provider & Region**: Choose your preferred provider (e.g., AWS, GCP) and a region close to your Render deployment.
   - **Plan**: Select the free tier or a hobby plan based on your needs.
3. Once the database status changes to **Running**, locate the **Connection Information** tab.
4. Copy the **Service URI** (this is your connection string). It will look similar to this:
   `postgres://avnadmin:YOUR_PASSWORD@YOUR_HOST:YOUR_PORT/defaultdb?sslmode=require`
   > [!IMPORTANT]
   > Keep this URI secure. It will be used as the `DATABASE_URL` in the Render backend environment variables.

---

## Phase 2: Deploying the Backend on Render

Since the backend requires persistent WebSockets and background interval tasks (to monitor agent statuses), it must be hosted on a persistent platform rather than serverless functions.

### Step-by-Step Backend Setup
1. Log in to [Render](https://render.com/).
2. Click **New +** > **Web Service**.
3. Connect your GitHub repository containing the PortSentinel codebase.
4. Configure the Web Service settings:
   - **Name**: `portsentinel-backend` (or your preferred name)
   - **Region**: Choose a region close to your Aiven database for minimal latency.
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npx prisma generate`
   - **Start Command**: `npx prisma db push && npm start`
5. Click **Advanced** to add **Environment Variables**:
   - `PORT`: `5000` (Render will automatically bind it)
   - `DATABASE_URL`: *Your Aiven PostgreSQL Service URI*
   - `JWT_SECRET`: *A secure random string*
   - `JWT_REFRESH_SECRET`: *Another secure random string*
   - `CLIENT_ORIGIN`: *Your Vercel deployment URL* (e.g. `https://portsentinel.vercel.app`, you can update this once the Vercel site is deployed)
   - `INTERNAL_SCANNER_MODE`: `local`
   - `RESEND_API_KEY`: *Your Resend Key (Optional, for email notifications)*
   - `MAIL_FROM`: `PortSentinel <onboarding@resend.dev>`
6. Deploy the Web Service. Render will build the app, run the Prisma migration schema against Aiven, and start your Express server.
7. Note down your public backend URL provided by Render (e.g., `https://portsentinel-backend.onrender.com`).

---

## Phase 3: Deploying the Frontend on Vercel

Vite creates static assets that Vercel serves globally. We have added a [vercel.json](./client/vercel.json) configuration in the `client` directory to route all clean URL requests (like `/dashboard`) back to `index.html` to support the client-side React Router.

### Setup Instructions
1. Go to the [Vercel Dashboard](https://vercel.com/) and click **Add New** > **Project**.
2. Select your GitHub repository.
3. Configure the Project Settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Under **Environment Variables**, add:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: *Your deployed Render Backend API URL* (e.g., `https://portsentinel-backend.onrender.com/api` - **make sure to append `/api` at the end!**)
5. Click **Deploy**.

Once deployment is complete, Vercel will provide your live website URL (e.g., `https://portsentinel.vercel.app`).
**Remember to go back to your Render Web Service Environment Variables and update `CLIENT_ORIGIN` to match your new Vercel URL.**

---

## Phase 4: Connecting the Scanning Agent

If you are using PortSentinel's scanning agent to scan local networks:
1. Log in to your deployed frontend website.
2. Navigate to the **Agents** tab.
3. Download the agent executable or script bundle.
4. When configuring the agent locally, edit the agent's config or `.env` file to point to your new deployed Render API:
   - `PORT`: `5000` (or the port your backend runs on)
   - `BACKEND_URL`: *Your deployed Render backend URL* (e.g., `https://portsentinel-backend.onrender.com`)
   - `API_KEY`: *The API key generated in the dashboard for this agent*

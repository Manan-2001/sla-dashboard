# SLA Monitoring Dashboard

A full-stack SLA monitoring application for tracking service availability, response times, incidents, SLA rules, and monitoring notifications.

Built as a Full Stack Developer take-home assignment using **Next.js**, **Cloudflare Workers**, and **Cloudflare D1**.

## Live Demo

**Frontend:** https://sla-monitoring.netlify.app

**Backend API:** https://sla-monitoring-worker.sla-monitoring-dashboard.workers.dev

---

## Features

### Dashboard

* Overall service health
* Service availability
* Average response time
* Incident summary
* Recent service checks
* Recent incidents
* 24-hour monitoring summary

### Service Management

* View monitored services
* Add services
* Edit services
* Enable/disable monitoring
* Delete services
* Manually trigger service checks
* Track service status

### SLA Management

* Configure SLA target percentage
* Configure response-time threshold
* Configure evaluation period
* View current SLA configuration
* Update SLA rules

### Incident Management

* Track service failures
* View active and resolved incidents
* Automatically create incidents for failed checks
* Automatically resolve incidents after service recovery

### Notifications

* Dashboard notifications for incidents
* Pending, sent, and failed states
* Mark notifications as sent/failed
* Retry failed notifications

### Authentication

* Admin login
* Session-based authentication
* Protected API endpoints
* Admin/viewer roles

### Automated Monitoring

* Cloudflare Worker scheduled monitoring
* Services are checked automatically every 5 minutes
* SLA checks and incidents are stored in Cloudflare D1

---

## Tech Stack

### Frontend

* Next.js 16
* React
* TypeScript
* CSS
* Netlify

### Backend

* Cloudflare Workers
* TypeScript
* Wrangler

### Database

* Cloudflare D1
* SQLite

### Development Tools

* Git
* GitHub
* Postman
* VS Code

---

## Architecture

```text
                    ┌──────────────────────┐
                    │      Netlify         │
                    │   Next.js Frontend   │
                    └──────────┬───────────┘
                               │
                               │ REST API
                               ▼
                    ┌──────────────────────┐
                    │  Cloudflare Worker   │
                    │    Backend API       │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Cloudflare D1      │
                    │      Database        │
                    └──────────────────────┘
                               ▲
                               │
                    ┌──────────┴───────────┐
                    │   Scheduled Worker   │
                    │      Every 5 min     │
                    └──────────────────────┘
```

---

## Project Structure

```text
sla-monitoring-dashboard/
│
├── app/
│   ├── dashboard/
│   │   ├── incidents/
│   │   ├── notifications/
│   │   ├── services/
│   │   ├── sla/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   └── login/
│       └── page.tsx
│
├── lib/
│   ├── api.ts
│   └── auth.ts
│
├── worker/
│   ├── migrations/
│   ├── src/
│   ├── wrangler.jsonc
│   └── package.json
│
├── public/
│
├── .env.example
├── .gitignore
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## API Endpoints

### Authentication

| Method | Endpoint           | Description             |
| ------ | ------------------ | ----------------------- |
| POST   | `/api/auth/login`  | Admin login             |
| GET    | `/api/auth/me`     | Get authenticated admin |
| POST   | `/api/auth/logout` | Logout                  |

### Services

| Method | Endpoint                  | Description            |
| ------ | ------------------------- | ---------------------- |
| GET    | `/api/services`           | Get all services       |
| GET    | `/api/services/:id`       | Get service            |
| POST   | `/api/services`           | Create service         |
| PUT    | `/api/services/:id`       | Update service         |
| DELETE | `/api/services/:id`       | Delete service         |
| POST   | `/api/services/:id/check` | Manually check service |

### SLA

| Method | Endpoint                     | Description     |
| ------ | ---------------------------- | --------------- |
| GET    | `/api/services/:id/sla`      | Get SLA summary |
| GET    | `/api/services/:id/sla-rule` | Get SLA rule    |
| POST   | `/api/services/:id/sla-rule` | Create SLA rule |
| PUT    | `/api/services/:id/sla-rule` | Update SLA rule |

### Incidents

| Method | Endpoint             | Description   |
| ------ | -------------------- | ------------- |
| GET    | `/api/incidents`     | Get incidents |
| GET    | `/api/incidents/:id` | Get incident  |

### Notifications

| Method | Endpoint                 | Description                |
| ------ | ------------------------ | -------------------------- |
| GET    | `/api/notifications`     | Get notifications          |
| GET    | `/api/notifications/:id` | Get notification           |
| PUT    | `/api/notifications/:id` | Update notification status |

### Dashboard

| Method | Endpoint                 | Description                  |
| ------ | ------------------------ | ---------------------------- |
| GET    | `/api/dashboard/summary` | Dashboard monitoring summary |

---

## Database

The application uses Cloudflare D1 with the following main tables:

* `admins`
* `sessions`
* `services`
* `sla_checks`
* `sla_rules`
* `incidents`
* `notifications`

The database schema is maintained through SQL migrations inside:

```text
worker/migrations/
```

---

## Local Development

### Prerequisites

* Node.js 20+
* npm
* Cloudflare account
* Wrangler CLI

### Install frontend dependencies

```bash
npm install
```

### Start Next.js

```bash
npm run dev
```

The frontend will run at:

```text
http://localhost:3000
```

### Start the Worker

Open another terminal:

```bash
cd worker
npm install
npm run dev
```

The Worker will run locally on:

```text
http://localhost:8787
```

---

## Environment Variables

Create `.env.local` for local development:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8787
```

For production:

```env
NEXT_PUBLIC_API_BASE_URL=https://sla-monitoring-worker.sla-monitoring-dashboard.workers.dev
```

Do not commit `.env.local` or `.env.production`.

---

## Worker Deployment

From the `worker` directory:

```bash
npx wrangler deploy
```

Database migrations can be applied using:

```bash
npx wrangler d1 migrations apply sla-monitoring-db --remote
```

---

## Frontend Deployment

The Next.js frontend is deployed on Netlify.

Production environment variable:

```text
NEXT_PUBLIC_API_BASE_URL
```

Set it to the deployed Cloudflare Worker URL.

---

## Monitoring Logic

Enabled services are periodically checked by the Cloudflare Worker.

Each check records:

* Service
* Timestamp
* HTTP status
* Response time
* Success/failure
* Error information

Failed checks can create incidents.

When a previously failed service recovers, the corresponding incident is resolved and a recovery notification is generated.

The scheduled monitoring job runs every **5 minutes**.

---

## SLA Configuration

The dashboard supports configurable:

* SLA target percentage
* Response-time limit
* Evaluation period

The default SLA availability target is **99.9%**.

---

## Authentication

Authentication uses:

* Admin credentials
* SHA-256 password hashing
* D1-backed sessions
* Bearer tokens
* Protected API routes

Authentication tokens are stored client-side and sent to protected API endpoints through the `Authorization` header.

---

## Deployment

### Frontend

Netlify:

https://sla-monitoring.netlify.app

### Backend

Cloudflare Workers:

https://sla-monitoring-worker.sla-monitoring-dashboard.workers.dev

---

## Author

**Manan Jain**

Full Stack Developer

Built as part of a Full Stack Developer take-home assignment.

# Prionex CRM Frontend

Modern React-based frontend application for the Prionex CRM system, built with TypeScript, Vite, and React Query.

## 🚀 Tech Stack

- **React 19** - Latest React with concurrent features
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **TanStack Query (React Query)** - Server state management
- **Zustand** - Client state management
- **React Router 7** - Routing
- **Tailwind CSS 4** - Utility-first CSS
- **i18next** - Internationalization (en, uk)
- **Radix UI** - Accessible component primitives
- **React Hook Form** - Form management
- **Zod** - Schema validation
- **Sonner** - Toast notifications
- **Vitest** - Unit testing

## 📋 Prerequisites

- Node.js 18+ and npm
- Backend API running (see backend README)

## 🛠️ Setup

1. **Clone the repository**
   ```bash
   git clone ssh://git@git.crm-prionex.com:2222/CRM/fe-prionex.git
   cd fe-prionex
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set your API base URL:
   ```env
   VITE_API_BASE_URL=http://localhost:8000
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3000`

## 📁 Project Structure

```
fe-prionex/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/              # Base UI components (Button, Input, etc.)
│   │   ├── layout/          # Layout components (Sidebar, Header)
│   │   └── forms/           # Form components
│   ├── features/            # Feature-based modules
│   │   ├── auth/            # Authentication
│   │   ├── users/           # User management
│   │   ├── roles/           # Role management
│   │   ├── projects/        # Project management
│   │   ├── clients/         # Client management
│   │   ├── tags/            # Tag management
│   │   ├── sms/             # SMS templates
│   │   ├── imports/         # Data import
│   │   ├── report/          # Reports dashboard
│   │   ├── payments/        # Payment management
│   │   ├── audit/           # Audit logs
│   │   ├── calls/           # Call operations
│   │   ├── departments/     # Department management
│   │   └── sellers/         # Seller management
│   ├── pages/               # Page components
│   ├── routes/              # Route configuration
│   ├── lib/                 # Utilities and helpers
│   ├── constants/           # Application constants
│   └── stores/              # Zustand stores
├── public/                  # Static assets
└── tests/                   # Test files
```

## 🧪 Testing

### Unit Tests
```bash
npm run test
```

### Run Tests Once
```bash
npm run test:run
```

## 🏗️ Build

### Development Build
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

## 🐳 Docker Deployment

### Development (with hot reload)
```bash
# Build and start
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f frontend

# Stop
docker-compose down
```

The app will be available at `http://localhost:3000` with hot reload enabled.

### Server Deployment

| Environment | Host | Port | Public name | State |
|---|---|---|---|---|
| Legacy stand (this table used to call it "Pre-production") | 72.62.17.132 | 8080 | `dev.crm-prionex.online` | live; deployed by the legacy GitHub CD and untouched by the Forgejo migration (NFR5). It is **not** on s1 — measured by Story 4.1 |
| DEV stand | s1 · 185.185.49.127 | 8082 | `crm.dev.crm-prionex.online` | live; deployed by `.forgejo/workflows/deploy-dev.yml`. Its own vhost/TLS is still an open external ask |
| PRE-PROD stand | s1 · 185.185.49.127 | 8083 | `crm.preprod.crm-prionex.online` | live; deployed by `.forgejo/workflows/deploy-preprod.yml` (port allocations: `.env.stand.example`) |
| PRODUCTION — legacy | s2 · 175.110.122.17 | 8080 | `crm-prionex.online` | **live, serves users.** Never a Forgejo deploy target, and stays that way until the traffic switch (Story 6.9) |
| PRODUCTION — new | s10 · 192.168.122.11, via jump `62.112.10.55` | decided by Story 6.10 | `crm.prod.crm-prionex.online` — **temporary** | not built yet. The name was pointed at the hypervisor on 2026-08-26 (`A → 62.112.10.55`, TTL 14400), but 🔴 **it resolves and refuses the connection** — 80/443 there answer `refused`, there is no web front yet. Route, port, vhost and certificate are Story 6.10's — see [`docs/migration-decisions.md#d43`](docs/migration-decisions.md#d43) §8 |

Two productions exist in parallel until the traffic switch: users are served by s2, while s10 is
brought up and validated under its own temporary name. The API hostname for the new production is
**not** derivable from the frontend one — two naming conventions are live at once, and the wrong
guess builds a green image that is dead in the browser. See `#d43` §4.

```bash
# Build production image
docker build -f Dockerfile.prod -t fe-prionex .

# Deploy via docker-compose.server.yml (from api-prionex/)
docker compose -f docker-compose.server.yml up -d fe-prionex
```

**Note:** `VITE_API_BASE_URL` must be set at build time. Use `.env` or pass via `docker-compose` environment.

## 📝 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run typecheck` - Type check without emitting
- `npm run test` - Run tests in watch mode
- `npm run test:run` - Run tests once
- `npm run test:coverage` - Run tests with coverage

## 🎨 Features

### Implemented
- User authentication (login, logout, session management)
- User management (CRUD operations)
- Role management (CRUD, permissions)
- Project management (CRUD)
- Client management
- Tag management (assign, remove, bulk operations)
- SMS templates
- Data import (CSV upload)
- Reports dashboard (KPIs, operator performance)
- Payment management
- Scoring configuration
- Audit logs
- Call operations (dialer integration)
- Department & seller management
- Internationalization (i18n): English, Ukrainian, Russian
- Toast notifications, error boundaries, responsive design

### Architecture Highlights
- **Feature-based organization** - Code organized by domain
- **Type-safe API layer** - Full TypeScript coverage
- **React Query caching** - Efficient server state management
- **Error boundaries** - Graceful error handling
- **Accessible components** - Built with Radix UI
- **Form validation** - Zod schemas with React Hook Form

## 🔐 Environment Variables

See `.env.example` for all available environment variables.

Required:
- `VITE_API_BASE_URL` - Backend API base URL

## 📚 Key Concepts

### State Management
- **Server State**: React Query (TanStack Query)
- **Client State**: Zustand (auth state)
- **Form State**: React Hook Form

### Error Handling
- Global error boundary catches React errors
- Consistent error display with `ErrorState` component
- Toast notifications for mutation feedback
- Centralized error utilities in `lib/errors.ts`

### API Integration
- Axios-based API client with interceptors
- Automatic token refresh on 401 errors
- Request/response interceptors for auth

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## 📄 License

Proprietary - CRM Prionex

## 🔗 Related

- [Backend API Documentation](../api-prionex/README.md)
- [Design Patterns](DESIGN_PATTERNS.md)

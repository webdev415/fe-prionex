# Prionex CRM Frontend

Modern React-based frontend application for the Prionex CRM system, built with TypeScript, Vite, and React Query.

## 🚀 Tech Stack

- **React 19** - Latest React with concurrent features
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **TanStack Query (React Query)** - Server state management
- **Zustand** - Client state management
- **React Router** - Routing
- **Tailwind CSS** - Utility-first CSS
- **Radix UI** - Accessible component primitives
- **React Hook Form** - Form management
- **Zod** - Schema validation
- **Sonner** - Toast notifications
- **Vitest** - Unit testing
- **Playwright** - E2E testing

## 📋 Prerequisites

- Node.js 18+ and npm
- Backend API running (see backend README)

## 🛠️ Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
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
│   │   └── projects/        # Project management
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

### E2E Tests
```bash
npm run test:e2e
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

### Production
```bash
# Build and start
docker-compose -f docker-compose.prod.yml up --build -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f frontend

# Stop
docker-compose -f docker-compose.prod.yml down
```

The app will be available at `http://localhost:80` (or your configured port).

**Environment Variables:**
- Set `VITE_API_BASE_URL` in `.env` file or pass via environment:
  ```bash
  VITE_API_BASE_URL=http://your-api-url:8000 docker-compose -f docker-compose.prod.yml up -d
  ```

**Note:** For production, the build process happens inside the Docker container, so environment variables must be set at build time. You can use a `.env` file or pass them via `docker-compose` environment section.

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
- `npm run test:e2e` - Run E2E tests

## 🎨 Features

### Implemented
- ✅ User authentication (login, logout, session management)
- ✅ User management (CRUD operations)
- ✅ Role management (CRUD, permissions)
- ✅ Project management (CRUD)
- ✅ Toast notifications
- ✅ Error boundaries
- ✅ Consistent error handling
- ✅ Loading states
- ✅ Responsive design
- ✅ Internationalization (i18n)

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

[Your License Here]

## 🔗 Related

- [Backend API Documentation](../api-prionex/README.md)
- [Design System Documentation](../prionex-docs/docs/design/)

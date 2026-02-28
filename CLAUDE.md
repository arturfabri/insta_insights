# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Insta Insights** is a Vite + React + TypeScript web application with Supabase as the backend. The project combines a modern frontend build setup with a serverless backend for authentication, database, file storage, and edge functions.

## Tech Stack

- **Frontend**: React 18+ with TypeScript
- **Build Tool**: Vite (fast development and production builds)
- **Styling**: [CSS Modules/Tailwind/Styled Components - to be determined]
- **Backend**: Supabase (PostgreSQL database, Auth, Storage, Edge Functions)
- **Type Safety**: TypeScript throughout

## Project Structure

```
insta_insights/
├── src/
│   ├── components/        # Reusable React components
│   ├── pages/            # Page-level components (if using routing)
│   ├── hooks/            # Custom React hooks (especially for Supabase)
│   ├── lib/
│   │   ├── supabase.ts   # Supabase client initialization
│   │   └── utils.ts      # Utility functions
│   ├── types/            # TypeScript type definitions
│   ├── App.tsx           # Root component
│   └── main.tsx          # Entry point
├── supabase/             # Supabase configuration
│   ├── functions/        # Edge functions
│   └── migrations/       # Database migrations
├── public/               # Static assets
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies and scripts
```

## Development Workflow

### Install Dependencies
```bash
npm install
# or yarn install / pnpm install
```

### Development Server
```bash
npm run dev
# Starts Vite dev server (typically http://localhost:5173)
```

### Build for Production
```bash
npm run build
# Creates optimized production build in dist/
```

### Preview Production Build Locally
```bash
npm run preview
# Serves the dist/ folder locally to test production build
```

### Type Checking
```bash
npx tsc --noEmit
# Check for TypeScript errors without emitting files
```

## Supabase Integration

### Client Setup
- All Supabase client initialization should be in `src/lib/supabase.ts`
- Create a singleton instance of `supabaseClient` to avoid multiple instances
- Import and use this client throughout the app for database queries, auth, and storage

### Authentication
- Use Supabase Auth for user management (email/password, OAuth, etc.)
- Store auth state in React context or state management (consider using Supabase's `useAuth()` pattern)
- Protected routes should check `user` from `supabase.auth.getSession()`

### Database Queries
- Use Supabase's PostgREST client for CRUD operations
- Example pattern: `supabaseClient.from('table_name').select('*').eq('id', value)`
- Always define TypeScript types for table rows in `src/types/`
- Use `.single()` for queries that return one row, `.data` for multiple rows

### File Storage
- Supabase Storage buckets are configured in the dashboard
- Use `supabaseClient.storage.from('bucket_name')` to access buckets
- Generate signed URLs for private files with expiration time
- Store public file URLs directly; they're accessible without auth

### Edge Functions
- Located in `supabase/functions/`
- Deploy with `supabase functions deploy function_name`
- Use for server-side logic (webhooks, scheduled tasks, sensitive operations)
- Test locally with `supabase functions serve`

### Database Schema
- Define schema using SQL migrations in `supabase/migrations/`
- Run migrations with `supabase db push`
- Always include row-level security (RLS) policies for tables
- Document table structure and relationships

## Key Patterns and Conventions

### Component Structure
- Use functional components with hooks
- Place related components together (component + styles)
- Extract reusable logic into custom hooks
- Keep component files focused on one responsibility

### Data Fetching
- Use `useEffect` with Supabase client for data fetching
- Handle loading and error states explicitly
- Consider creating custom hooks for common queries (e.g., `useAuth()`, `useUserProfile()`)

### TypeScript
- Define types for all API responses and database tables
- Use `interface` for Supabase table schemas
- Create a `types/database.ts` file for all database-related types
- Avoid `any` type; use `unknown` or proper typing

### Environment Variables
- Store Supabase URL and Anon Key in `.env.local`
- Never commit `.env.local` to version control
- Create `.env.example` with template for required variables
- Access via `import.meta.env.VITE_*` (Vite prefix convention)

## Testing Setup
[To be configured - consider Jest/Vitest for unit tests, React Testing Library for component tests]

## Linting and Formatting
[To be configured - consider ESLint and Prettier]

## Deployment

### Frontend
- Build with `npm run build`
- Deploy `dist/` folder to:
  - Vercel (recommended, integrates well with Vite)
  - Netlify
  - Supabase Hosting

### Environment Variables in Production
- Set Supabase `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in hosting platform
- Never expose private Supabase key; use public anon key in frontend

### Edge Functions
- Deploy with `supabase functions deploy`
- Can be triggered from frontend or used as webhooks

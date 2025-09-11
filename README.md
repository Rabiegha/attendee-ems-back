# Attendee EMS Backend

Multi-tenant Event Management System backend built with NestJS, PostgreSQL, JWT authentication, and RBAC using CASL.

## Features

- **Multi-tenant Architecture**: Organization-scoped data isolation
- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control (RBAC)**: Fine-grained permissions using CASL
- **PostgreSQL Database**: Robust relational database with Sequelize ORM
- **RESTful API**: Clean API design with proper HTTP status codes
- **Comprehensive Testing**: Unit and E2E tests included
- **Error Handling**: Centralized error handling with RFC7807-style responses

## Quick Start

### Prerequisites

- Node.js (v18+)
- PostgreSQL (v12+)
- npm or yarn

### Installation

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials and JWT secret
```

3. Set up the database:
```bash
# Run migrations
npm run db:migrate

# Seed demo data
npm run db:seed
```

4. Start the development server:
```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`

## Demo Credentials

After running the seeders, you can login with:
- **Email**: `admin@acme.test`
- **Password**: `Admin#12345`

## API Endpoints

### Authentication
- `POST /v1/auth/login` - Login with email/password

### Users
- `GET /v1/users` - List users (requires `users.read` permission)
- `POST /v1/users` - Create user (requires `users.create` permission)

### Organizations
- `GET /v1/organizations/me` - Get current user's organization (requires `organizations.read` permission)

### Roles & Permissions
- `GET /v1/roles` - List roles (requires `roles.read` permission)
- `GET /v1/permissions` - List permissions (requires `permissions.read` permission)

## Database Schema

The system uses a multi-tenant architecture with the following main entities:

- **Organizations**: Tenant isolation
- **Users**: Scoped to organizations with email uniqueness per org
- **Roles**: Organization-specific roles (e.g., org_admin, staff)
- **Permissions**: Fine-grained permissions (e.g., users.read, users.create)
- **RolePermissions**: Many-to-many relationship between roles and permissions

## Scripts

- `npm run start:dev` - Start development server
- `npm run build` - Build for production
- `npm run start:prod` - Start production server
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run E2E tests
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed demo data
- `npm run db:migrate:undo` - Rollback last migration
- `npm run db:seed:undo` - Rollback all seeds

## Environment Variables

Required environment variables:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/attendee_ems
JWT_SECRET=your-super-secret-jwt-key-here-change-in-production
JWT_EXPIRES_IN=900s
NODE_ENV=development
PORT=3000
```

## Testing

Run the test suite:

```bash
# Unit tests
npm run test

# E2E tests (requires database setup)
npm run test:e2e

# Test coverage
npm run test:cov
```

## Architecture

### Multi-tenancy
- All data is scoped by `org_id`
- JWT tokens contain organization context
- Guards enforce organization-level data isolation

### Authentication & Authorization
- JWT-based authentication with configurable expiration
- RBAC using CASL for fine-grained permissions
- Organization-scoped permissions and roles

### Error Handling
- Global exception filter with RFC7807-style error responses
- Request logging with unique request IDs
- Structured error responses with proper HTTP status codes

## Development

The codebase follows NestJS best practices:

- **Modular architecture**: Feature-based modules
- **Dependency injection**: Leveraging NestJS DI container
- **Validation**: DTO validation using class-validator
- **Guards**: JWT authentication and permission guards
- **Middleware**: Request logging and CORS handling

## License

This project is licensed under the UNLICENSED license.

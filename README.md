# Employee Utilization Dashboard

A React application for tracking employee utilization with Azure AD Single Sign-On (SSO) authentication and TanStack Query for data management.

## Features

- React with Vite
- React Bootstrap for UI components
- React Router v6 for navigation
- Recharts for data visualization
- Azure AD SSO integration
- TanStack Query for data fetching and caching
- Protected routes

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up Azure AD:
   - Go to [Azure Portal](https://portal.azure.com)
   - Navigate to Azure Active Directory > App registrations
   - Create a new registration
   - Set redirect URI to `http://localhost:5173` (for development)
   - Copy your Application (client) ID and Directory (tenant) ID
   - Create a `.env` file with your Azure AD credentials:

```env
VITE_AZURE_CLIENT_ID=your-azure-client-id
VITE_AZURE_TENANT_ID=your-azure-tenant-id
VITE_API_BASE_URL=http://localhost:3000/api
```

3. Start the development server:
```bash
npm run dev
```

## Azure AD SSO Implementation

This app uses Microsoft Identity Platform (MSAL) for Azure AD authentication. Users can:
- Sign in with their Microsoft work/school account
- Access protected routes only when authenticated
- View their profile information from Azure AD
- Sign out securely

## TanStack Query Integration

The app uses TanStack Query for:
- **Data Fetching**: Automatic caching and background updates
- **Mutations**: Optimistic updates and cache invalidation
- **Error Handling**: Built-in error states and retry logic
- **Loading States**: Automatic loading indicators
- **DevTools**: Query debugging and monitoring

### Key Features:
- **Automatic Caching**: Data is cached for 5 minutes by default
- **Background Refetching**: Data stays fresh automatically
- **Optimistic Updates**: UI updates immediately, then syncs with server
- **Error Recovery**: Automatic retry on network failures
- **Query Invalidation**: Cache updates when data changes

## Azure AD Configuration Steps

1. **Register Application**:
   - Azure Portal → Azure Active Directory → App registrations → New registration
   - Name: "Employee Utilization Dashboard"
   - Supported account types: "Accounts in this organizational directory only"
   - Redirect URI: Web → `http://localhost:5173`

2. **Configure Authentication**:
   - Authentication → Add platform → Single-page application
   - Redirect URIs: `http://localhost:5173`
   - Implicit grant: Access tokens, ID tokens

3. **API Permissions**:
   - API permissions → Add permission → Microsoft Graph
   - Delegated permissions → User.Read (for basic profile)

4. **Environment Variables**:
   - Copy Application (client) ID to `VITE_AZURE_CLIENT_ID`
   - Copy Directory (tenant) ID to `VITE_AZURE_TENANT_ID`

## API Integration

The app is configured to work with a REST API. Set up your backend API and configure the `VITE_API_BASE_URL` environment variable.

### Available API Endpoints:
- `GET /api/employees` - List employees with filters
- `GET /api/employees/:id` - Get employee details
- `POST /api/employees` - Create new employee
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee
- `GET /api/dashboard/summary` - Dashboard summary data

## Production Deployment

For production, update the redirect URI in Azure AD to your production domain and set the environment variables accordingly.

# Vercel Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub/GitLab/Bitbucket**: Your code should be in a Git repository
3. **Environment Variables**: Prepare your environment variables

## Environment Variables Setup

### Required Environment Variables

You need to set these environment variables in your Vercel project:

```env
VITE_AZURE_CLIENT_ID=your_azure_client_id
VITE_AZURE_TENANT_ID=your_azure_tenant_id
VITE_TEAMUP_API_KEY=your_teamup_api_key
VITE_TEAMUP_CALENDAR_KEY=your_teamup_calendar_key
```

### Azure AD Configuration for Production

1. **Update Redirect URI**: In your Azure AD app registration, add your Vercel domain:
   - Go to Azure Portal → Azure Active Directory → App registrations
   - Select your app
   - Authentication → Add platform → Single-page application
   - Add your Vercel domain: `https://your-app-name.vercel.app`

## Deployment Steps

### Option 1: Deploy via Vercel Dashboard

1. **Connect Repository**:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your Git repository
   - Select the repository containing this project

2. **Configure Project**:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Set Environment Variables**:
   - In the project settings, go to "Environment Variables"
   - Add each of the required environment variables listed above
   - Make sure to set them for "Production", "Preview", and "Development"

4. **Deploy**:
   - Click "Deploy"
   - Vercel will automatically build and deploy your app

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```

4. **Set Environment Variables**:
   ```bash
   vercel env add VITE_AZURE_CLIENT_ID
   vercel env add VITE_AZURE_TENANT_ID
   vercel env add VITE_TEAMUP_API_KEY
   vercel env add VITE_TEAMUP_CALENDAR_KEY
   ```

## Post-Deployment

### Verify Deployment

1. **Check Build Logs**: Ensure the build completed successfully
2. **Test Authentication**: Try signing in with Azure AD
3. **Test API Calls**: Verify TeamUp data is loading correctly
4. **Check Environment Variables**: Ensure all variables are accessible

### Custom Domain (Optional)

1. **Add Custom Domain**:
   - Go to your Vercel project settings
   - Domains → Add Domain
   - Follow the DNS configuration instructions

2. **Update Azure AD**:
   - Add your custom domain to Azure AD redirect URIs
   - Update the redirect URI in your app registration

## Troubleshooting

### Common Issues

1. **Environment Variables Not Loading**:
   - Ensure all variables have the `VITE_` prefix
   - Check that variables are set for all environments (Production, Preview, Development)

2. **Azure AD Authentication Fails**:
   - Verify redirect URI is correct in Azure AD
   - Check that the domain is added to allowed redirect URIs

3. **TeamUp API Errors**:
   - Verify API key and calendar key are correct
   - Check that the calendar key is valid and accessible

4. **Build Failures**:
   - Check build logs in Vercel dashboard
   - Ensure all dependencies are properly installed
   - Verify Node.js version compatibility

### Support

- **Vercel Documentation**: [vercel.com/docs](https://vercel.com/docs)
- **Azure AD Documentation**: [docs.microsoft.com/azure/active-directory](https://docs.microsoft.com/azure/active-directory)
- **TeamUp API Documentation**: [teamup.com/api](https://teamup.com/api) 
import { MsalProvider } from '@azure/msal-react'
import { PublicClientApplication } from '@azure/msal-browser'

// MSAL configuration
const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  }
}



// Create MSAL instance
const msalInstance = new PublicClientApplication(msalConfig)

function AuthProvider({ children }) {
  return (
    <MsalProvider instance={msalInstance}>
      {children}
    </MsalProvider>
  )
}

export default AuthProvider 
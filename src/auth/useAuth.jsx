import { useMsal, useIsAuthenticated, useAccount } from '@azure/msal-react'
import { useMemo } from 'react'

export function useAuth() {
  const { instance, accounts } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const account = useAccount(accounts[0] || {})

  const auth = useMemo(() => ({
    isAuthenticated,
    isLoading: false, // MSAL handles loading internally
    user: account ? {
      name: account.name,
      email: account.username,
      id: account.localAccountId
    } : null,
    login: async () => {
      try {
        await instance.loginPopup({
          scopes: ['User.Read'],
          prompt: 'select_account'
        })
      } catch (error) {
        console.error('Login failed:', error)
      }
    },
    logout: async () => {
      try {
        await instance.logoutPopup({
          postLogoutRedirectUri: window.location.origin
        })
      } catch (error) {
        console.error('Logout failed:', error)
      }
    },
    getToken: async () => {
      try {
        const response = await instance.acquireTokenSilent({
          scopes: ['User.Read'],
          account: account
        })
        return response.accessToken
      } catch (error) {
        console.error('Token acquisition failed:', error)
        return null
      }
    },
    error: null
  }), [instance, account, isAuthenticated])

  return auth
} 
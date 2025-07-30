import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth'

// Base API configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
const TEAMUP_API_KEY = import.meta.env.VITE_TEAMUP_API_KEY
const TEAMUP_CALENDAR_KEY = import.meta.env.VITE_TEAMUP_CALENDAR_KEY

// Helper function to make authenticated API calls
async function fetchWithAuth(url, options = {}) {
  const { getToken } = useAuth()
  const token = await getToken()
  
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// Helper function to make TeamUp API calls
async function fetchTeamUpData(url) {
  const response = await fetch(`https://api.teamup.com${url}`, {
    headers: {
      'Teamup-Token': TEAMUP_API_KEY,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`TeamUp API Error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// Custom hook for GET requests
export function useApiQuery(key, url, options = {}) {
  // Check if this is a TeamUp API call
  const isTeamUpCall = url.startsWith('/teamup/')
  
  return useQuery({
    queryKey: key,
    queryFn: () => isTeamUpCall ? fetchTeamUpData(url.replace('/teamup/', '/')) : fetchWithAuth(url),
    ...options,
  })
}

// Custom hook for POST requests
export function useApiMutation(url, options = {}) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data) => fetchWithAuth(url, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: (data, variables, context) => {
      // Invalidate and refetch relevant queries
      if (options.invalidateQueries) {
        options.invalidateQueries.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey })
        })
      }
      options.onSuccess?.(data, variables, context)
    },
    ...options,
  })
}

// Custom hook for PUT requests
export function useApiPut(url, options = {}) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data) => fetchWithAuth(url, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    onSuccess: (data, variables, context) => {
      if (options.invalidateQueries) {
        options.invalidateQueries.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey })
        })
      }
      options.onSuccess?.(data, variables, context)
    },
    ...options,
  })
}

// Custom hook for DELETE requests
export function useApiDelete(url, options = {}) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: () => fetchWithAuth(url, {
      method: 'DELETE',
    }),
    onSuccess: (data, variables, context) => {
      if (options.invalidateQueries) {
        options.invalidateQueries.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey })
        })
      }
      options.onSuccess?.(data, variables, context)
    },
    ...options,
  })
} 
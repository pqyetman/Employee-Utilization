import { useApiQuery } from '../hooks/useApi'

// Hook to fetch employee utilization data
export function useEmployeeUtilization(employeeId, dateRange) {
  const queryString = new URLSearchParams(dateRange).toString()
  const url = `/employees/${employeeId}/utilization${queryString ? `?${queryString}` : ''}`
  
  return useApiQuery(
    ['employee-utilization', employeeId, dateRange],
    url,
    {
      enabled: !!employeeId,
      staleTime: 1 * 60 * 1000, // 1 minute
    }
  )
}

// Hook to fetch dashboard summary data
export function useDashboardSummary() {
  return useApiQuery(
    ['dashboard-summary'],
    '/dashboard/summary',
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    }
  )
} 
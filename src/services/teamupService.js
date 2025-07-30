import { useApiQuery } from '../hooks/useApi'

const TEAMUP_API_KEY = import.meta.env.VITE_TEAMUP_API_KEY
const TEAMUP_CALENDAR_KEY = import.meta.env.VITE_TEAMUP_CALENDAR_KEY
const TEAMUP_BASE_URL = 'https://api.teamup.com'

// List of employees to exclude from calculations
const EXCLUDED_EMPLOYEES = [
  'Bill Ahern',
  'Harry Cannon', 
  'Matt Mokracek',
  'Paul Yetman'
]

// List of employees to exclude from field, office, and overtime statistics
const EXCLUDED_FROM_UTILIZATION = [
  'Jennifer Lengyel',
  'Liz Quinn',
  'Linda Torok'
]

// Helper function to make TeamUp API calls
async function fetchTeamUpData(url) {
  const response = await fetch(`${TEAMUP_BASE_URL}${url}`, {
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

// Helper function to format date for API
function formatDate(date) {
  return date.toISOString().split('T')[0]
}

// Helper function to check if date is weekend
function isWeekend(date) {
  const day = new Date(date).getDay()
  return day === 0 || day === 6 // Sunday = 0, Saturday = 6
}

// Helper function to get all dates between start and end
function getDatesBetween(startDate, endDate) {
  const dates = []
  const current = new Date(startDate)
  const end = new Date(endDate)
  
  while (current <= end) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }
  
  return dates
}

// Calculate utilization for a single employee
function calculateEmployeeUtilization(events, startDate, endDate, employeeName = null, creationDate = null) {
  const dates = getDatesBetween(startDate, endDate)
  const utilization = {
    totalDays: dates.length,
    weekdays: 0,
    weekends: 0,
    categories: {
      field: { weekdays: 0, weekends: 0 },
      office: { weekdays: 0, weekends: 0 },
      vacation: { weekdays: 0, weekends: 0 },
      'work from home': { weekdays: 0, weekends: 0 },
      sick: { weekdays: 0, weekends: 0 },
      overtime: { weekdays: 0, weekends: 0 },
      unknown: { weekdays: 0, weekends: 0 }
    }
  }

  // Check if employee should be excluded from unknown days tracking
  const excludeFromUnknownDays = employeeName && EXCLUDED_FROM_UTILIZATION.includes(employeeName)



  // Initialize weekdays as unknown, weekends as 0 (we don't track unknown weekends)
  let excludedBeforeCreation = 0
  dates.forEach(date => {
    const isWeekendDay = isWeekend(date)
    
    // Skip dates before creation date for all calculations
    const isBeforeCreation = creationDate && date < new Date(creationDate)
    
    // Only count days after the employee's creation date
    if (!isBeforeCreation) {
      if (isWeekendDay) {
        utilization.weekends++
        // Don't initialize weekends as unknown - we only care about weekday utilization
      } else {
        utilization.weekdays++
        // Only count unknown days for employees who should be tracked
        if (!excludeFromUnknownDays) {
          utilization.categories.unknown.weekdays++
        }
      }
    } else {
      // Track excluded days for debugging
      if (!excludeFromUnknownDays) {
        excludedBeforeCreation++
      }
    }
  })
  


  // Group events by date to handle overlapping events
  const eventsByDate = {}
  
  events.forEach(event => {
    const eventDates = getDatesBetween(event.start_dt, event.end_dt)
    const status = event.custom?.status?.[0] || 'unknown'
    
    eventDates.forEach(date => {
      // Only count dates within our range
      if (date >= new Date(startDate) && date <= new Date(endDate)) {
        const dateStr = formatDate(date)
        if (!eventsByDate[dateStr]) {
          eventsByDate[dateStr] = []
        }
        eventsByDate[dateStr].push(status)
      }
    })
  })

  // Process events by date, handling overlaps
  Object.keys(eventsByDate).forEach(dateStr => {
    const date = new Date(dateStr)
    const isWeekendDay = isWeekend(date)
    const statuses = eventsByDate[dateStr]
    
    // Skip events before the employee's creation date
    const isBeforeCreation = creationDate && date < new Date(creationDate)
    if (isBeforeCreation) {
      return
    }
    
    // Get unique statuses for this date
    const uniqueStatuses = [...new Set(statuses)]
    const statusCount = uniqueStatuses.length
    
    if (isWeekendDay) {
      // Weekend events go to overtime category
      utilization.categories.overtime.weekends++
    } else {
      // Remove from unknown weekdays, but don't go below 0
      // Only remove unknown days for employees who should be tracked
      if (!excludeFromUnknownDays && utilization.categories.unknown.weekdays > 0) {
        utilization.categories.unknown.weekdays--
      }
      
      // Distribute the day evenly among unique statuses
      const dayFraction = 1 / statusCount
      
      uniqueStatuses.forEach(status => {
        if (utilization.categories[status]) {
          utilization.categories[status].weekdays += dayFraction
        } else {
          // Handle any new status types by adding them dynamically
          utilization.categories[status] = { weekdays: 0, weekends: 0 }
          utilization.categories[status].weekdays = dayFraction
        }
      })
    }
  })

  // Ensure unknown days is never negative
  utilization.categories.unknown.weekdays = Math.max(0, utilization.categories.unknown.weekdays)

  // Validate that all weekday categories add up to total weekdays
  const totalWeekdayCategories = 
    (utilization.categories.field?.weekdays || 0) +
    (utilization.categories.office?.weekdays || 0) +
    (utilization.categories['work from home']?.weekdays || 0) +
    (utilization.categories.vacation?.weekdays || 0) +
    (utilization.categories.sick?.weekdays || 0) +
    (utilization.categories.unknown?.weekdays || 0)

  const difference = Math.abs(totalWeekdayCategories - utilization.weekdays)
  
  // Create validation info object
  const validationInfo = {
    isValid: difference <= 0.01,
    difference: difference,
    totalWeekdayCategories: totalWeekdayCategories,
    expectedWeekdays: utilization.weekdays,
    categoryBreakdown: {
      field: utilization.categories.field?.weekdays || 0,
      office: utilization.categories.office?.weekdays || 0,
      'work from home': utilization.categories['work from home']?.weekdays || 0,
      vacation: utilization.categories.vacation?.weekdays || 0,
      sick: utilization.categories.sick?.weekdays || 0,
      unknown: utilization.categories.unknown?.weekdays || 0
    }
  }

  return { utilization, validationInfo }
}

// Hook to fetch subcalendars (employees)
export function useSubcalendars() {
  return useApiQuery(
    ['teamup-subcalendars'],
    `/teamup/${TEAMUP_CALENDAR_KEY}/subcalendars`,
    {
      staleTime: 10 * 60 * 1000, // 10 minutes
    }
  )
}

// Hook to fetch events for all employees
export function useAllEvents(startDate, endDate, enabled = true) {
  const start = formatDate(startDate)
  const end = formatDate(endDate)
  
  return useApiQuery(
    ['teamup-events', start, end],
    `/teamup/${TEAMUP_CALENDAR_KEY}/events?startDate=${start}&endDate=${end}`,
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      enabled: enabled && !!startDate && !!endDate,
    }
  )
}

// Hook to fetch events for specific employees
export function useEmployeeEvents(employeeIds, startDate, endDate) {
  const start = formatDate(startDate)
  const end = formatDate(endDate)
  const ids = employeeIds.join(',')
  
  return useApiQuery(
    ['teamup-employee-events', employeeIds, start, end],
    `/teamup/${TEAMUP_CALENDAR_KEY}/events?startDate=${start}&endDate=${end}&subcalendarId[]=${ids}`,
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      enabled: !!startDate && !!endDate && employeeIds.length > 0,
    }
  )
}

// Hook to get utilization data for all employees
export function useAllEmployeesUtilization(startDate, endDate, enabled = true) {
  const { data: subcalendars } = useSubcalendars()
  const { data: events } = useAllEvents(startDate, endDate, enabled)
  
  if (!subcalendars || !events) {
    return { data: null, isLoading: true, error: null }
  }

  // Filter out non-employee subcalendars and excluded employees
  const employees = subcalendars.subcalendars.filter(
    sub => !['Future Work', 'Holidays'].includes(sub.name) && !EXCLUDED_EMPLOYEES.includes(sub.name)
  )



  const utilizationData = employees.map(employee => {
    const employeeEvents = events.events.filter(event =>
      event.subcalendar_ids.includes(employee.id)
    )
    
    // Try different possible creation date field names
    const creationDate = employee.creation_dt 
    const { utilization, validationInfo } = calculateEmployeeUtilization(employeeEvents, startDate, endDate, employee.name, creationDate)
    
    // Check if employee should be excluded from utilization statistics
    const isExcludedFromUtilization = EXCLUDED_FROM_UTILIZATION.includes(employee.name)
    
    // Calculate separate utilization percentages
    let weekdayUtilized, weekendUtilized
    
    if (isExcludedFromUtilization) {
      // For excluded employees, only count work from home as utilized
      weekdayUtilized = utilization.categories['work from home']?.weekdays || 0
      weekendUtilized = 0 // No overtime for these employees
    } else {
      // For regular employees, count field, office, and work from home
      weekdayUtilized = utilization.categories.field.weekdays + utilization.categories.office.weekdays + (utilization.categories['work from home']?.weekdays || 0)
      weekendUtilized = utilization.categories.overtime.weekends
    }
    
    const weekdayTotal = utilization.weekdays
    const weekdayUtilizationPercentage = weekdayTotal > 0 ? (weekdayUtilized / weekdayTotal * 100).toFixed(1) : '0.0'
    
    const weekendTotal = utilization.weekends
    const weekendUtilizationPercentage = weekendTotal > 0 ? (weekendUtilized / weekendTotal * 100).toFixed(1) : '0.0'
    
    return {
      employee,
      utilization,
      isExcludedFromUtilization,
      weekdayUtilized,
      weekdayTotal,
      weekdayUtilizationPercentage,
      weekendUtilized,
      weekendTotal,
      weekendUtilizationPercentage,
      // Legacy total for backward compatibility
      totalUtilized: weekdayUtilized + weekendUtilized,
      utilizationPercentage: ((weekdayUtilized + weekendUtilized) / utilization.totalDays * 100).toFixed(1)
    }
  })

  return {
    data: utilizationData,
    isLoading: false,
    error: null
  }
}

// Hook to get utilization data for specific employees
export function useEmployeesUtilization(employeeIds, startDate, endDate) {
  const { data: subcalendars } = useSubcalendars()
  const { data: events } = useEmployeeEvents(employeeIds, startDate, endDate)
  
  if (!subcalendars || !events) {
    return { data: null, isLoading: true, error: null }
  }

  const employees = subcalendars.subcalendars.filter(
    sub => employeeIds.includes(sub.id) && !EXCLUDED_EMPLOYEES.includes(sub.name)
  )

  const utilizationData = employees.map(employee => {
    const employeeEvents = events.events.filter(event =>
      event.subcalendar_ids.includes(employee.id)
    )
    
    // Try different possible creation date field names
    const creationDate = employee.created || employee.creation_date || employee.created_at || employee.creationDate
    const { utilization, validationInfo } = calculateEmployeeUtilization(employeeEvents, startDate, endDate, employee.name, creationDate)
    
    // Check if employee should be excluded from utilization statistics
    const isExcludedFromUtilization = EXCLUDED_FROM_UTILIZATION.includes(employee.name)
    
    // Calculate separate utilization percentages
    let weekdayUtilized, weekendUtilized
    
    if (isExcludedFromUtilization) {
      // For excluded employees, only count work from home as utilized
      weekdayUtilized = utilization.categories['work from home']?.weekdays || 0
      weekendUtilized = 0 // No overtime for these employees
    } else {
      // For regular employees, count field, office, and work from home
      weekdayUtilized = utilization.categories.field.weekdays + utilization.categories.office.weekdays + (utilization.categories['work from home']?.weekdays || 0)
      weekendUtilized = utilization.categories.overtime.weekends
    }
    
    const weekdayTotal = utilization.weekdays
    const weekdayUtilizationPercentage = weekdayTotal > 0 ? (weekdayUtilized / weekdayTotal * 100).toFixed(1) : '0.0'
    
    const weekendTotal = utilization.weekends
    const weekendUtilizationPercentage = weekendTotal > 0 ? (weekendUtilized / weekendTotal * 100).toFixed(1) : '0.0'
    
    return {
      employee,
      utilization,
      validationInfo,
      isExcludedFromUtilization,
      weekdayUtilized,
      weekdayTotal,
      weekdayUtilizationPercentage,
      weekendUtilized,
      weekendTotal,
      weekendUtilizationPercentage,
      // Legacy total for backward compatibility
      totalUtilized: weekdayUtilized + weekendUtilized,
      utilizationPercentage: ((weekdayUtilized + weekendUtilized) / utilization.totalDays * 100).toFixed(1)
    }
  })

  return {
    data: utilizationData,
    isLoading: false,
    error: null
  }
} 
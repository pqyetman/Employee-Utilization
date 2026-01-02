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
  // Use local date components to avoid timezone shifts
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper function to check if date is weekend
function isWeekend(date) {
  const day = new Date(date).getDay()
  return day === 0 || day === 6 // Sunday = 0, Saturday = 6
}

// Helper function to get all dates between start and end
function getDatesBetween(startDate, endDate) {
  const dates = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  // Normalize to dates (midnight) for comparison to include all calendar dates the event touches
  const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  
  const current = new Date(startDateOnly)
  
  while (current <= endDateOnly) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }
  
  return dates
}

// Helper function to normalize status values to handle variations
function normalizeStatus(status) {
  if (!status || typeof status !== 'string') return 'unknown'
  
  // Normalize: lowercase, trim, replace underscores and hyphens with spaces, normalize multiple spaces
  let normalized = status.toLowerCase().trim()
    .replace(/_/g, ' ') // Replace underscores with spaces
    .replace(/-/g, ' ') // Replace hyphens with spaces
    .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
  
  // Handle common abbreviations/variations
  const statusMap = {
    'wfh': 'work from home',
    'work from home': 'work from home',
    'field': 'field',
    'office': 'office',
    'vacation': 'vacation',
    'sick': 'sick',
    'overtime': 'overtime',
    'holiday': 'holiday'
  }
  
  return statusMap[normalized] || normalized
}

// Calculate utilization for a single employee
function calculateEmployeeUtilization(events, startDate, endDate, employeeName = null, creationDate = null, holidayEvents = []) {
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
      holiday: { weekdays: 0, weekends: 0 },
      unknown: { weekdays: 0, weekends: 0 }
    }
  }

  // Check if employee should be excluded from unknown days tracking
  const excludeFromUnknownDays = employeeName && EXCLUDED_FROM_UTILIZATION.includes(employeeName)

  // Track which specific dates are in each category
  const categoryDates = {
    field: new Set(),
    office: new Set(),
    vacation: new Set(),
    'work from home': new Set(),
    sick: new Set(),
    overtime: new Set(),
    holiday: new Set(),
    unknown: new Set()
  }

  // Track dates with non-field/office events on holidays (for warnings)
  const holidayWarnings = []

  // Normalize start and end dates to midnight local time for consistent comparison
  const normalizedStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  const normalizedEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
  normalizedEnd.setHours(23, 59, 59, 999) // Include the entire end date

  // Build set of holiday dates (excluding "Holiday Party")
  const holidayDates = new Set()
  holidayEvents.forEach(event => {
    const eventTitle = event.title || ''
    if (eventTitle.toLowerCase().includes('holiday party')) {
      return // Skip Holiday Party
    }
    
    const eventDates = getDatesBetween(event.start_dt, event.end_dt)
    eventDates.forEach(date => {
      const normalizedEventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      if (normalizedEventDate >= normalizedStart && normalizedEventDate <= normalizedEnd) {
        const dateStr = formatDate(date)
        holidayDates.add(dateStr)
      }
    })
  })

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
          categoryDates.unknown.add(formatDate(date))
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
    // Skip "Tech on Call" events - they should not count towards utilization
    const eventTitle = event.title || ''
    if (eventTitle.toLowerCase().includes('tech on call')) {
      return // Skip this event entirely
    }
    
    const rawStatus = event.custom?.status?.[0] || 'unknown'
    const status = normalizeStatus(rawStatus)
    const eventDates = getDatesBetween(event.start_dt, event.end_dt)
    
    eventDates.forEach(date => {
      // Normalize event date for comparison
      const normalizedEventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      
      // Only count dates within our range using normalized dates
      if (normalizedEventDate >= normalizedStart && normalizedEventDate <= normalizedEnd) {
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
    const date = new Date(dateStr + 'T00:00:00') // Parse as local date to avoid timezone issues
    const isWeekendDay = isWeekend(date)
    const isHoliday = holidayDates.has(dateStr)
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
      // Check if vacation is present - vacation should not count as overtime
      const hasVacation = uniqueStatuses.includes('vacation')
      
      if (hasVacation) {
        // Vacation on weekend - count as vacation, not overtime
        // Remove from unknown if applicable
        if (!excludeFromUnknownDays && utilization.categories.unknown.weekdays > 0) {
          utilization.categories.unknown.weekdays--
          categoryDates.unknown.delete(dateStr)
        }
        
        // Count as vacation (weekends) - if multiple statuses, split the day
        const dayFraction = 1 / statusCount
        uniqueStatuses.forEach(status => {
          if (status === 'vacation') {
            utilization.categories.vacation.weekends += dayFraction
            categoryDates.vacation.add(dateStr)
          }
          // Other statuses on weekend with vacation are ignored (only vacation counts)
        })
      } else {
        // No vacation - weekend events go to overtime category
        utilization.categories.overtime.weekends++
        categoryDates.overtime.add(dateStr)
      }
    } else {
      // If it's a holiday AND has other events
      if (isHoliday && statusCount > 0) {
        // Check if vacation is present - vacation on holiday should count as holiday, not vacation
        const hasVacation = uniqueStatuses.includes('vacation')
        
        if (hasVacation) {
          // Vacation on holiday - count as holiday, ignore vacation
          // Count as holiday (ignore the vacation status)
          utilization.categories.holiday.weekdays += 1
          categoryDates.holiday.add(dateStr)
          // Remove from unknown AFTER adding to holiday
          if (!excludeFromUnknownDays) {
            categoryDates.unknown.delete(dateStr)
          }
        } else {
          // Check if any status is "field" or "office"
          const hasFieldOrOffice = uniqueStatuses.some(status => status === 'field' || status === 'office')
          
          if (hasFieldOrOffice) {
            // Count as overtime (working on holiday with field/office)
            utilization.categories.overtime.weekdays += 1
            categoryDates.overtime.add(dateStr)
            // Remove from unknown AFTER adding to overtime
            if (!excludeFromUnknownDays) {
              categoryDates.unknown.delete(dateStr)
            }
          } else {
            // Non-field/office event on holiday - don't count it, leave as unknown, but track for warning
            // Don't remove from unknown - we're not counting this day
            holidayWarnings.push({
              date: dateStr,
              statuses: uniqueStatuses
            })
            
            // Don't add to any category - it stays as unknown
          }
        }
      } else if (isHoliday) {
        // Holiday only - count as holiday
        utilization.categories.holiday.weekdays += 1
        categoryDates.holiday.add(dateStr)
        // Remove from unknown AFTER adding to holiday
        if (!excludeFromUnknownDays) {
          categoryDates.unknown.delete(dateStr)
        }
      } else if (statusCount > 0) {
        // Regular event processing
        const dayFraction = 1 / statusCount
        
        uniqueStatuses.forEach(status => {
          // Track the date in this category
          if (categoryDates[status]) {
            categoryDates[status].add(dateStr)
          } else {
            // Handle any new status types by adding them dynamically
            categoryDates[status] = new Set()
            categoryDates[status].add(dateStr)
          }
          
          if (utilization.categories[status]) {
            utilization.categories[status].weekdays += dayFraction
          } else {
            // Handle any new status types by adding them dynamically
            utilization.categories[status] = { weekdays: 0, weekends: 0 }
            utilization.categories[status].weekdays = dayFraction
          }
        })
        
        // Remove from unknown AFTER adding to the appropriate category
        if (!excludeFromUnknownDays) {
          categoryDates.unknown.delete(dateStr)
        }
      }
    }
  })

  // Process holidays that don't have any employee events
  holidayDates.forEach(dateStr => {
    const date = new Date(dateStr + 'T00:00:00')
    const isWeekendDay = isWeekend(date)
    const isBeforeCreation = creationDate && date < new Date(creationDate)
    
    if (isBeforeCreation || isWeekendDay) {
      return
    }
    
    // Only add if not already processed (no employee events on this date)
    if (!eventsByDate[dateStr]) {
      // Add as holiday (only if not already counted as overtime)
      if (!categoryDates.overtime.has(dateStr) && !categoryDates.holiday.has(dateStr)) {
        utilization.categories.holiday.weekdays += 1
        categoryDates.holiday.add(dateStr)
        // Remove from unknown AFTER adding to holiday
        if (!excludeFromUnknownDays) {
          categoryDates.unknown.delete(dateStr)
        }
      }
    }
  })

  // Ensure unknown days is never negative
  utilization.categories.unknown.weekdays = Math.max(0, utilization.categories.unknown.weekdays)

  // Build set of all dates that have been assigned to any category (including unknown)
  const assignedDates = new Set()
  Object.keys(categoryDates).forEach(category => {
    categoryDates[category].forEach(dateStr => {
      assignedDates.add(dateStr)
    })
  })

  // Also add dates from holiday warnings (these are intentionally not counted)
  holidayWarnings.forEach(warning => {
    assignedDates.add(warning.date)
  })

  // Find expected weekday dates that aren't assigned to any category
  const unaccountedDates = []
  dates.forEach(date => {
    const isWeekendDay = isWeekend(date)
    const isBeforeCreation = creationDate && date < new Date(creationDate)
    
    if (!isBeforeCreation && !isWeekendDay) {
      const dateStr = formatDate(date)
      // Check if this date is in any category (including unknown)
      // If not, it's unaccounted for
      if (!assignedDates.has(dateStr)) {
        unaccountedDates.push(dateStr)
        // Add to unknown category dates
        categoryDates.unknown.add(dateStr)
      }
    }
  })

  // Ensure the unknown count matches the actual number of dates in the Set
  utilization.categories.unknown.weekdays = categoryDates.unknown.size

  // Validate that all weekday categories add up to total weekdays
  const totalWeekdayCategories = 
    (utilization.categories.field?.weekdays || 0) +
    (utilization.categories.office?.weekdays || 0) +
    (utilization.categories['work from home']?.weekdays || 0) +
    (utilization.categories.vacation?.weekdays || 0) +
    (utilization.categories.sick?.weekdays || 0) +
    (utilization.categories.holiday?.weekdays || 0) +
    (utilization.categories.overtime?.weekdays || 0) +
    (utilization.categories.unknown?.weekdays || 0)

  const difference = Math.abs(totalWeekdayCategories - utilization.weekdays)
  
  // Create validation info object
  const validationInfo = {
    isValid: difference <= 0.01,
    difference: difference,
    totalWeekdayCategories: totalWeekdayCategories,
    expectedWeekdays: utilization.weekdays,
    unaccountedDates: unaccountedDates.sort(),
    categoryBreakdown: {
      field: utilization.categories.field?.weekdays || 0,
      office: utilization.categories.office?.weekdays || 0,
      'work from home': utilization.categories['work from home']?.weekdays || 0,
      vacation: utilization.categories.vacation?.weekdays || 0,
      sick: utilization.categories.sick?.weekdays || 0,
      holiday: utilization.categories.holiday?.weekdays || 0,
      unknown: utilization.categories.unknown?.weekdays || 0
    }
  }

  // Convert Sets to sorted arrays
  const categoryDatesArrays = {}
  Object.keys(categoryDates).forEach(category => {
    categoryDatesArrays[category] = Array.from(categoryDates[category]).sort()
  })

  // Combine unknown dates from categoryDates with unaccounted dates
  // Unaccounted dates are weekdays that weren't assigned to any category
  const allUnknownDates = new Set(categoryDatesArrays.unknown)
  unaccountedDates.forEach(dateStr => {
    allUnknownDates.add(dateStr)
  })

  return { 
    utilization, 
    validationInfo, 
    unknownDates: Array.from(allUnknownDates).sort(),
    categoryDates: categoryDatesArrays,
    holidayWarnings: holidayWarnings.sort((a, b) => a.date.localeCompare(b.date))
  }
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

  // Find Holidays subcalendar
  const holidaysSubcalendar = subcalendars.subcalendars.find(
    sub => sub.name === 'Holidays'
  )
  
  // Get holiday events (excluding "Holiday Party")
  const holidayEvents = holidaysSubcalendar 
    ? events.events.filter(event => 
        event.subcalendar_ids.includes(holidaysSubcalendar.id) &&
        !(event.title || '').toLowerCase().includes('holiday party')
      )
    : []

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
    const { utilization, validationInfo, unknownDates, categoryDates, holidayWarnings } = calculateEmployeeUtilization(employeeEvents, startDate, endDate, employee.name, creationDate, holidayEvents)
    
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
      utilizationPercentage: ((weekdayUtilized + weekendUtilized) / utilization.totalDays * 100).toFixed(1),
      unknownDates,
      validationInfo,
      categoryDates,
      holidayWarnings
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
  const { data: allEvents } = useAllEvents(startDate, endDate, true)
  
  if (!subcalendars || !events) {
    return { data: null, isLoading: true, error: null }
  }

  // Find Holidays subcalendar
  const holidaysSubcalendar = subcalendars.subcalendars.find(
    sub => sub.name === 'Holidays'
  )
  
  // Get holiday events from allEvents (excluding "Holiday Party")
  const holidayEvents = holidaysSubcalendar && allEvents
    ? allEvents.events.filter(event => 
        event.subcalendar_ids.includes(holidaysSubcalendar.id) &&
        !(event.title || '').toLowerCase().includes('holiday party')
      )
    : []

  const employees = subcalendars.subcalendars.filter(
    sub => employeeIds.includes(sub.id) && !EXCLUDED_EMPLOYEES.includes(sub.name)
  )

  const utilizationData = employees.map(employee => {
    const employeeEvents = events.events.filter(event =>
      event.subcalendar_ids.includes(employee.id)
    )
    
    // Try different possible creation date field names
    const creationDate = employee.created || employee.creation_date || employee.created_at || employee.creationDate
    const { utilization, validationInfo, unknownDates, categoryDates, holidayWarnings } = calculateEmployeeUtilization(employeeEvents, startDate, endDate, employee.name, creationDate, holidayEvents)
    
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
      utilizationPercentage: ((weekdayUtilized + weekendUtilized) / utilization.totalDays * 100).toFixed(1),
      unknownDates,
      categoryDates,
      holidayWarnings
    }
  })

  return {
    data: utilizationData,
    isLoading: false,
    error: null
  }
} 
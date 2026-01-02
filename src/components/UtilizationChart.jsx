import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Card, Form, Row, Col, Badge, Spinner, Alert } from 'react-bootstrap'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useSubcalendars, useAllEmployeesUtilization } from '../services/teamupService'

const COLORS = {
  field: '#8884d8',
  office: '#82ca9d',
  vacation: '#ffc658',
  overtime: '#ff7300',
  unknown: '#d3d3d3',
  'work from home': '#9c88ff',
  sick: '#ff6b9d',
  holiday: '#ffc658' // Same color as vacation since they're combined in charts
}

// Helper function to format dates for tooltip
const formatDatesForTooltip = (dates) => {
  if (!dates || dates.length === 0) return 'No dates'
  return dates.map(d => {
    const date = new Date(d + 'T00:00:00')
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }).join('\n')
}

// List of employees to exclude from selection and calculations
const EXCLUDED_EMPLOYEES = [
  'Bill Ahern',
  'Harry Cannon', 
  'Matt Mokracek',
  'Paul Yetman'
]

function UtilizationChart() {
  const [selectedEmployees, setSelectedEmployees] = useState([])
  const hasInitialized = useRef(false)
  const previousSelection = useRef([])
  const prevShowWarningsOnly = useRef(false)
  const [dateRange, setDateRange] = useState(30)
  // Set default custom dates to current month
  const today = new Date()
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  
  const [customStartDate, setCustomStartDate] = useState(firstDayOfMonth.toISOString().split('T')[0])
  const [customEndDate, setCustomEndDate] = useState(lastDayOfMonth.toISOString().split('T')[0])
  const [localStartDate, setLocalStartDate] = useState(firstDayOfMonth.toISOString().split('T')[0])
  const [localEndDate, setLocalEndDate] = useState(lastDayOfMonth.toISOString().split('T')[0])
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [showWarningsOnly, setShowWarningsOnly] = useState(false)
  
  // Calculate date range with memoization
  const { startDate, endDate } = useMemo(() => {
    let start, end
    
    if (dateRange === 'custom') {
      // Parse date strings as local dates to avoid timezone issues
      if (customStartDate) {
        const [year, month, day] = customStartDate.split('-').map(Number)
        start = new Date(year, month - 1, day)
      } else {
        start = new Date()
      }
      if (customEndDate) {
        const [year, month, day] = customEndDate.split('-').map(Number)
        end = new Date(year, month - 1, day)
      } else {
        end = new Date()
      }
    } else if (dateRange === 'year-back') {
      // One year back from today
      end = new Date()
      start = new Date()
      start.setFullYear(start.getFullYear() - 1)
    } else if (dateRange === 'year-forward') {
      // One year forward from today
      start = new Date()
      end = new Date()
      end.setFullYear(end.getFullYear() + 1)
    } else {
      // Standard relative date range
      end = new Date()
      start = new Date()
      start.setDate(start.getDate() - dateRange)
    }
    
    return { startDate: start, endDate: end }
  }, [dateRange, customStartDate, customEndDate])
  
  // Validate custom dates with memoization
  const isValidCustomRange = useMemo(() => {
    return dateRange !== 'custom' || (customStartDate && customEndDate)
  }, [dateRange, customStartDate, customEndDate])
  
  const { data: subcalendars, isLoading: subcalendarsLoading } = useSubcalendars()
  const { data: utilizationData, isLoading: utilizationLoading, error } = useAllEmployeesUtilization(startDate, endDate)
  
  const isLoading = subcalendarsLoading || utilizationLoading

  // Filter out non-employee subcalendars and excluded employees
  const employees = useMemo(() => {
    return subcalendars?.subcalendars?.filter(
      sub => !['Future Work', 'Holidays'].includes(sub.name) && !EXCLUDED_EMPLOYEES.includes(sub.name)
    ) || []
  }, [subcalendars])

  // Initialize selectedEmployees with all employees when employees are first loaded
  useEffect(() => {
    if (employees.length > 0 && !hasInitialized.current) {
      setSelectedEmployees(employees.map(emp => emp.id))
      hasInitialized.current = true
    }
  }, [employees])

  // Auto-select employees with warnings when filter is enabled
  useEffect(() => {
    if (!utilizationData || !utilizationData.length) return

    // Only act when showWarningsOnly actually changes
    if (showWarningsOnly && !prevShowWarningsOnly.current) {
      // Store current selection before filtering
      setSelectedEmployees(current => {
        if (previousSelection.current.length === 0 && current.length > 0) {
          previousSelection.current = [...current]
        }
        
        // Find all employees with warnings
        const employeesWithWarnings = utilizationData
          .filter(item => {
            const hasValidationWarning = item.validationInfo && !item.validationInfo.isValid
            const hasHolidayWarning = item.holidayWarnings && item.holidayWarnings.length > 0
            return hasValidationWarning || hasHolidayWarning
          })
          .map(item => item.employee.id)
        
        // Only update if the selection would change
        if (employeesWithWarnings.length > 0) {
          return employeesWithWarnings
        }
        return current
      })
    } else if (!showWarningsOnly && prevShowWarningsOnly.current) {
      // Restore previous selection when filter is disabled
      if (previousSelection.current.length > 0) {
        setSelectedEmployees(previousSelection.current)
        previousSelection.current = []
      }
    }
    
    prevShowWarningsOnly.current = showWarningsOnly
  }, [showWarningsOnly, utilizationData])

  // Sorting function
  const sortData = (data, key, direction) => {
    if (!data) return data
    
    return [...data].sort((a, b) => {
      let aValue, bValue
      
      switch (key) {
        case 'employee':
          aValue = a.employee.name.toLowerCase()
          bValue = b.employee.name.toLowerCase()
          break
        case 'weekdayUtilization':
          aValue = parseFloat(a.weekdayUtilizationPercentage)
          bValue = parseFloat(b.weekdayUtilizationPercentage)
          break
        case 'weekendOvertime':
          aValue = parseFloat(a.weekendUtilizationPercentage)
          bValue = parseFloat(b.weekendUtilizationPercentage)
          break
        case 'fieldDays':
          aValue = a.utilization.categories.field.weekdays
          bValue = b.utilization.categories.field.weekdays
          break
        case 'officeDays':
          aValue = a.utilization.categories.office.weekdays
          bValue = b.utilization.categories.office.weekdays
          break
        case 'workFromHomeDays':
          aValue = a.utilization.categories['work from home']?.weekdays || 0
          bValue = b.utilization.categories['work from home']?.weekdays || 0
          break
        case 'vacationDays':
          aValue = a.utilization.categories.vacation.weekdays
          bValue = b.utilization.categories.vacation.weekdays
          break
        case 'sickDays':
          aValue = a.utilization.categories.sick?.weekdays || 0
          bValue = b.utilization.categories.sick?.weekdays || 0
          break
        case 'overtimeDays':
          aValue = a.utilization.categories.overtime.weekends
          bValue = b.utilization.categories.overtime.weekends
          break
        case 'unknownDays':
          aValue = a.utilization.categories.unknown.weekdays
          bValue = b.utilization.categories.unknown.weekdays
          break
        case 'holidayDays':
          aValue = a.utilization.categories.holiday?.weekdays || 0
          bValue = b.utilization.categories.holiday?.weekdays || 0
          break
        default:
          return 0
      }
      
      if (aValue < bValue) return direction === 'asc' ? -1 : 1
      if (aValue > bValue) return direction === 'asc' ? 1 : -1
      return 0
    })
  }

  // Handle sort click
  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  // Get sort indicator
  const getSortIndicator = (key) => {
    return ''
  }

  // All hooks must be called before any conditional returns
  // Filter utilization data based on selected employees
  const filteredData = useMemo(() => {
    if (selectedEmployees.length === 0) {
      return []
    }
    return utilizationData?.filter(item => selectedEmployees.includes(item.employee.id)) || []
  }, [selectedEmployees, utilizationData])

  // Prepare data for charts function (must be defined before useMemo hooks)
  const prepareChartData = (data) => {
    if (!data || data.length === 0) return []

    // Calculate total days in range (sum of all employees' totalDays)
    const totalDaysInRange = data.reduce((sum, item) => {
      return sum + (item.utilization?.totalDays || 0)
    }, 0)

    const aggregated = {
      field: { weekdays: 0, weekends: 0 },
      office: { weekdays: 0, weekends: 0 },
      vacation: { weekdays: 0, weekends: 0 },
      'work from home': { weekdays: 0, weekends: 0 },
      sick: { weekdays: 0, weekends: 0 },
      overtime: { weekdays: 0, weekends: 0 },
      unknown: { weekdays: 0, weekends: 0 }
    }

    // Collect all unknown dates from all employees
    const allUnknownDates = new Set()
    data.forEach(item => {
      // Try unknownDates first, then fallback to categoryDates.unknown
      const dates = item.unknownDates || item.categoryDates?.unknown || []
      if (Array.isArray(dates)) {
        dates.forEach(dateStr => {
          if (dateStr) {
            allUnknownDates.add(dateStr)
          }
        })
      }
    })

    data.forEach(item => {
      if (item.utilization && item.utilization.categories) {
        Object.keys(item.utilization.categories).forEach(category => {
          const categoryData = item.utilization.categories[category]
          if (categoryData && typeof categoryData.weekdays === 'number' && typeof categoryData.weekends === 'number') {
            if (category === 'holiday') {
              // Combine holiday with vacation for charts
              aggregated.vacation.weekdays += categoryData.weekdays
              aggregated.vacation.weekends += categoryData.weekends
            } else if (aggregated[category]) {
              aggregated[category].weekdays += categoryData.weekdays
              aggregated[category].weekends += categoryData.weekends
            } else {
              // Handle unknown categories
              aggregated.unknown.weekdays += categoryData.weekdays
              aggregated.unknown.weekends += categoryData.weekends
            }
          }
        })
      }
    })

    // Build chart data with all categories as distinct items
    const chartData = [
      {
        name: 'Field',
        weekdays: aggregated.field.weekdays,
        weekends: aggregated.field.weekends,
        total: aggregated.field.weekdays + aggregated.field.weekends,
        color: COLORS.field
      },
      {
        name: 'Office',
        weekdays: aggregated.office.weekdays,
        weekends: aggregated.office.weekends,
        total: aggregated.office.weekdays + aggregated.office.weekends,
        color: COLORS.office
      },
      {
        name: 'Work From Home',
        weekdays: aggregated['work from home'].weekdays,
        weekends: aggregated['work from home'].weekends,
        total: aggregated['work from home'].weekdays + aggregated['work from home'].weekends,
        color: COLORS['work from home']
      },
      {
        name: 'Overtime',
        weekdays: aggregated.overtime.weekdays,
        weekends: aggregated.overtime.weekends,
        total: aggregated.overtime.weekdays + aggregated.overtime.weekends,
        color: COLORS.overtime
      },
      {
        name: 'Vacation',
        weekdays: aggregated.vacation.weekdays,
        weekends: aggregated.vacation.weekends,
        total: aggregated.vacation.weekdays + aggregated.vacation.weekends,
        color: COLORS.vacation
      },
      {
        name: 'Sick',
        weekdays: aggregated.sick.weekdays,
        weekends: aggregated.sick.weekends,
        total: aggregated.sick.weekdays + aggregated.sick.weekends,
        color: COLORS.sick
      },
      {
        name: 'Unknown',
        weekdays: aggregated.unknown.weekdays,
        weekends: 0, // Unknown only tracks weekdays, weekends should always be 0
        total: aggregated.unknown.weekdays, // Only count weekdays for unknown
        color: COLORS.unknown,
        unknownDates: Array.from(allUnknownDates).sort() // Store unknown dates for tooltip
      }
    ].filter(item => {
      // Keep Unknown even if total is 0, if there are unknown dates
      if (item.name === 'Unknown' && item.unknownDates && item.unknownDates.length > 0) {
        return true
      }
      return item.total > 0
    })

    // Calculate percentages against total days in range
    return chartData.map(item => ({
      ...item,
      percentage: totalDaysInRange > 0 ? (item.total / totalDaysInRange * 100) : 0
    }))
  }

  // Filter by warnings if enabled, then sort the filtered data
  const sortedData = useMemo(() => {
    let dataToSort = filteredData
    
    // Filter to show only employees with warnings if enabled
    if (showWarningsOnly) {
      dataToSort = filteredData.filter(item => {
        const hasValidationWarning = item.validationInfo && !item.validationInfo.isValid
        const hasHolidayWarning = item.holidayWarnings && item.holidayWarnings.length > 0
        return hasValidationWarning || hasHolidayWarning
      })
    }
    
    return sortData(dataToSort, sortConfig.key, sortConfig.direction)
  }, [filteredData, sortConfig.key, sortConfig.direction, showWarningsOnly])

  // Prepare data for charts
  const chartData = useMemo(() => {
    return prepareChartData(filteredData)
  }, [filteredData])





  const handleEmployeeChange = useCallback((employeeId) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    )
  }, [])

  const handleSelectAll = useCallback(() => {
    if (employees && employees.length > 0) {
      setSelectedEmployees(employees.map(emp => emp.id))
    }
  }, [employees])

  const handleClearAll = useCallback(() => {
    setSelectedEmployees([])
  }, [])

  const handleDateRangeChange = useCallback((e) => {
    setDateRange(e.target.value)
  }, [])

  const handleStartDateChange = useCallback((e) => {
    // Update local state for visual feedback
    setLocalStartDate(e.target.value)
  }, [])

  const handleStartDateKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
    }
  }, [])

  const handleStartDateBlur = useCallback((e) => {
    e.preventDefault()
  }, [])

  const handleEndDateChange = useCallback((e) => {
    // Update local state for visual feedback
    setLocalEndDate(e.target.value)
  }, [])

  const handleEndDateKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
    }
  }, [])

  const handleEndDateBlur = useCallback((e) => {
    e.preventDefault()
  }, [])

  const handleApplyDates = useCallback(() => {
    // Apply the local dates to the main state
    setCustomStartDate(localStartDate)
    setCustomEndDate(localEndDate)
  }, [localStartDate, localEndDate])

  // Now we can have conditional returns after all hooks are called
  if (isLoading) {
    return (
      <Card>
        <Card.Body className="text-center">
          <Spinner animation="border" />
          <p className="mt-2">Loading utilization data...</p>
        </Card.Body>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="danger">
        <Alert.Heading>Error Loading Data</Alert.Heading>
        <p>{error.message}</p>
      </Alert>
    )
  }

  // Show message for invalid custom dates
  if (dateRange === 'custom' && !isValidCustomRange) {
    return (
      <Card>
        <Card.Body className="text-center">
          <Alert variant="warning">
            Please select both start and end dates for custom range
          </Alert>
        </Card.Body>
      </Card>
    )
  }

  return (
    <Card>
      <Card.Header>
        <h5 className="mb-0">Employee Utilization Dashboard</h5>
      </Card.Header>
      <Card.Body>
        {/* Controls */}
        <div>
          <Row className="mb-4">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Date Range</Form.Label>
                <Form.Select
                  value={dateRange}
                  onChange={handleDateRangeChange}
                >
                  <option value={7}>Last 7 days</option>
                  <option value={14}>Last 14 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={60}>Last 60 days</option>
                  <option value={90}>Last 90 days</option>
                  <option value="year-back">Last year</option>
                  <option value="year-forward">Next year</option>
                  <option value="custom">Custom dates</option>
                </Form.Select>
              </Form.Group>
              
              {/* Custom Date Inputs */}
              {dateRange === 'custom' && (
                <>
                  <Row className="mt-2">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Start Date</Form.Label>
                        <Form.Control
                          type="date"
                          value={localStartDate}
                          onChange={handleStartDateChange}
                          onKeyDown={handleStartDateKeyDown}
                          onBlur={handleStartDateBlur}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>End Date</Form.Label>
                        <Form.Control
                          type="date"
                          value={localEndDate}
                          onChange={handleEndDateChange}
                          onKeyDown={handleEndDateKeyDown}
                          onBlur={handleEndDateBlur}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Row className="mt-2">
                    <Col>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleApplyDates}
                        disabled={!localStartDate || !localEndDate}
                      >
                        Apply Date Range
                      </button>
                    </Col>
                  </Row>
                </>
              )}
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Employee Filter</Form.Label>
                <div className="d-flex gap-2">
                  <button 
                    type="button" 
                    className="btn btn-outline-primary btn-sm"
                    onClick={handleSelectAll}
                  >
                    Select All
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-outline-secondary btn-sm"
                    onClick={handleClearAll}
                  >
                    Clear All
                  </button>
                </div>
              </Form.Group>
            </Col>
          </Row>
          <Row className="mb-3">
            <Col md={6}>
              <Form.Check
                type="checkbox"
                id="show-warnings-only"
                label="Show only employees with warnings"
                checked={showWarningsOnly}
                onChange={(e) => setShowWarningsOnly(e.target.checked)}
              />
            </Col>
          </Row>
        </div>

        {/* Employee Selection */}
        <Row className="mb-4">
          <Col>
            <Form.Group>
              <Form.Label>Employees</Form.Label>
              <div className="d-flex flex-wrap gap-2">
                {employees.map(employee => (
                  <Form.Check
                    key={employee.id}
                    type="checkbox"
                    id={`employee-${employee.id}`}
                    label={employee.name}
                    checked={selectedEmployees.includes(employee.id)}
                    onChange={() => handleEmployeeChange(employee.id)}
                    className="me-3"
                  />
                ))}
              </div>
            </Form.Group>
          </Col>
        </Row>

        {/* Date Range Display */}
        <Row className="mb-4">
          <Col>
            <p className="text-muted">
              {dateRange === 'custom' && (!customStartDate || !customEndDate) ? (
                'Please select both start and end dates for custom range'
              ) : (
                <>
                  Showing data from {startDate.toLocaleDateString()} to {endDate.toLocaleDateString()}
                  <span className="ms-2">
                    ({Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))} days)
                  </span>
                  {selectedEmployees.length > 0 && (
                    <span className="ms-2">
                      • {selectedEmployees.length} employee{selectedEmployees.length !== 1 ? 's' : ''} selected
                    </span>
                  )}
                </>
              )}
            </p>
          </Col>
        </Row>

        {/* Charts */}
        {selectedEmployees.length === 0 ? (
          <div className="text-center py-5">
            <p className="text-muted fs-5">Select One or More Employees For Data</p>
          </div>
        ) : chartData.length > 0 ? (
          <Row>
            <Col md={6}>
              <h6 
                title="Percentages are calculated against the total number of days in the selected date range across all selected employees. Working categories include field work, office time, work from home, and overtime. Non-working categories include vacation, sick, and unknown days."
                style={{ cursor: 'help' }}
              >
                Utilization Breakdown
              </h6>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name} ${percentage.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="total"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length > 0) {
                        const data = payload[0].payload
                        const dates = data.unknownDates
                        const isUnknown = data.name === 'Unknown'
                        return (
                          <div className="bg-white border rounded p-2 shadow" style={{ maxWidth: '300px', zIndex: 1000 }}>
                            <p className="mb-1"><strong>{data.name}</strong></p>
                            <p className="mb-0">{data.total} days ({data.percentage.toFixed(1)}%)</p>
                            {isUnknown && dates && dates.length > 0 && (
                              <div className="mt-2 pt-2 border-top">
                                <p className="mb-1 small"><strong>Unknown Dates ({dates.length}):</strong></p>
                                <div className="small" style={{ maxHeight: '200px', overflowY: 'auto', whiteSpace: 'nowrap' }}>
                                  {dates.map(dateStr => {
                                    const date = new Date(dateStr + 'T00:00:00')
                                    return (
                                      <div key={dateStr} style={{ marginBottom: '2px' }}>
                                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                            {isUnknown && (!dates || dates.length === 0) && (
                              <div className="mt-2 pt-2 border-top">
                                <p className="mb-0 small text-muted">No unknown dates available</p>
                              </div>
                            )}
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Col>
            <Col md={6}>
              <h6>Weekday vs Weekend Breakdown</h6>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length > 0) {
                        // Find the data entry for this label
                        const dataEntry = chartData.find(item => item.name === label)
                        const dates = dataEntry?.unknownDates
                        const isUnknown = label === 'Unknown'
                        return (
                          <div className="bg-white border rounded p-2 shadow" style={{ maxWidth: '300px', zIndex: 1000 }}>
                            <p className="mb-1"><strong>{label}</strong></p>
                            {payload.map((entry, index) => (
                              <p key={index} className="mb-0" style={{ color: entry.color }}>
                                {entry.name}: {entry.value}
                              </p>
                            ))}
                            {isUnknown && dates && dates.length > 0 && (
                              <div className="mt-2 pt-2 border-top">
                                <p className="mb-1 small"><strong>Unknown Dates ({dates.length}):</strong></p>
                                <div className="small" style={{ maxHeight: '200px', overflowY: 'auto', whiteSpace: 'nowrap' }}>
                                  {dates.map(dateStr => {
                                    const date = new Date(dateStr + 'T00:00:00')
                                    return (
                                      <div key={dateStr} style={{ marginBottom: '2px' }}>
                                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                            {isUnknown && (!dates || dates.length === 0) && (
                              <div className="mt-2 pt-2 border-top">
                                <p className="mb-0 small text-muted">No unknown dates available</p>
                              </div>
                            )}
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend />
                  <Bar dataKey="weekdays" fill="#82ca9d" name="Weekdays" />
                  <Bar dataKey="weekends" fill="#ff7300" name="Weekends" />
                </BarChart>
              </ResponsiveContainer>
            </Col>
          </Row>
        ) : (
          <div className="text-center py-4">
            <p className="text-muted">No utilization data available for the selected criteria</p>
          </div>
        )}

        {/* Employee Details */}
        {selectedEmployees.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-muted">Select One or More Employees For Data</p>
          </div>
        ) : sortedData && sortedData.length > 0 ? (
          <Row className="mt-4">
            <Col>
              <h6>Employee Details</h6>
              <div className="table-responsive">
                <table className="table table-sm" style={{ tableLayout: 'auto', width: '100%' }}>
                  <thead>
                    <tr>
                      <th 
                        onClick={() => handleSort('employee')}
                        style={{ cursor: 'pointer', userSelect: 'none', minWidth: '150px' }}
                        className="sortable-header"
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <span className="text-start" style={{ whiteSpace: 'nowrap' }}>Employee</span>
                          <span style={{ 
                            fontSize: '14px', 
                            color: sortConfig.key === 'employee' ? '#007bff' : '#6c757d',
                            fontWeight: sortConfig.key === 'employee' ? 'bold' : 'normal',
                            marginLeft: '8px'
                          }}>{getSortIndicator('employee')}</span>
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('weekdayUtilization')}
                        style={{ cursor: 'pointer', userSelect: 'none', minWidth: '120px' }}
                        className="sortable-header"
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <span className="text-start" style={{ whiteSpace: 'nowrap' }}>Weekday Utilization</span>
                          <span style={{ 
                            fontSize: '14px', 
                            color: sortConfig.key === 'weekdayUtilization' ? '#007bff' : '#6c757d',
                            fontWeight: sortConfig.key === 'weekdayUtilization' ? 'bold' : 'normal',
                            marginLeft: '8px'
                          }}>{getSortIndicator('weekdayUtilization')}</span>
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('weekendOvertime')}
                        style={{ cursor: 'pointer', userSelect: 'none', minWidth: '120px' }}
                        className="sortable-header"
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <span className="text-start" style={{ whiteSpace: 'nowrap' }}>Weekend Overtime</span>
                          <span style={{ 
                            fontSize: '14px', 
                            color: sortConfig.key === 'weekendOvertime' ? '#007bff' : '#6c757d',
                            fontWeight: sortConfig.key === 'weekendOvertime' ? 'bold' : 'normal',
                            marginLeft: '8px'
                          }}>{getSortIndicator('weekendOvertime')}</span>
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('fieldDays')}
                        style={{ cursor: 'pointer', userSelect: 'none', minWidth: '100px' }}
                        className="sortable-header"
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <span className="text-start" style={{ whiteSpace: 'nowrap' }}>Field Days</span>
                          <span style={{ 
                            fontSize: '14px', 
                            color: sortConfig.key === 'fieldDays' ? '#007bff' : '#6c757d',
                            fontWeight: sortConfig.key === 'fieldDays' ? 'bold' : 'normal',
                            marginLeft: '8px'
                          }}>{getSortIndicator('fieldDays')}</span>
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('officeDays')}
                        style={{ cursor: 'pointer', userSelect: 'none', minWidth: '100px' }}
                        className="sortable-header"
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <span className="text-start" style={{ whiteSpace: 'nowrap' }}>Office Days</span>
                          <span style={{ 
                            fontSize: '14px', 
                            color: sortConfig.key === 'officeDays' ? '#007bff' : '#6c757d',
                            fontWeight: sortConfig.key === 'officeDays' ? 'bold' : 'normal',
                            marginLeft: '8px'
                          }}>{getSortIndicator('officeDays')}</span>
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('workFromHomeDays')}
                        style={{ cursor: 'pointer', userSelect: 'none', minWidth: '120px' }}
                        className="sortable-header"
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <span className="text-start" style={{ whiteSpace: 'nowrap' }}>Work From Home</span>
                          <span style={{ 
                            fontSize: '14px', 
                            color: sortConfig.key === 'workFromHomeDays' ? '#007bff' : '#6c757d',
                            fontWeight: sortConfig.key === 'workFromHomeDays' ? 'bold' : 'normal',
                            marginLeft: '8px'
                          }}>{getSortIndicator('workFromHomeDays')}</span>
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('vacationDays')}
                        style={{ cursor: 'pointer', userSelect: 'none', minWidth: '100px' }}
                        className="sortable-header"
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <span className="text-start" style={{ whiteSpace: 'nowrap' }}>Vacation Days</span>
                          <span style={{ 
                            fontSize: '14px', 
                            color: sortConfig.key === 'vacationDays' ? '#007bff' : '#6c757d',
                            fontWeight: sortConfig.key === 'vacationDays' ? 'bold' : 'normal',
                            marginLeft: '8px'
                          }}>{getSortIndicator('vacationDays')}</span>
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('sickDays')}
                        style={{ cursor: 'pointer', userSelect: 'none', minWidth: '100px' }}
                        className="sortable-header"
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <span className="text-start" style={{ whiteSpace: 'nowrap' }}>Sick Days</span>
                          <span style={{ 
                            fontSize: '14px', 
                            color: sortConfig.key === 'sickDays' ? '#007bff' : '#6c757d',
                            fontWeight: sortConfig.key === 'sickDays' ? 'bold' : 'normal',
                            marginLeft: '8px'
                          }}>{getSortIndicator('sickDays')}</span>
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('holidayDays')}
                        style={{ cursor: 'pointer', userSelect: 'none', minWidth: '100px' }}
                        className="sortable-header"
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <span className="text-start" style={{ whiteSpace: 'nowrap' }}>Holiday Days</span>
                          <span style={{ 
                            fontSize: '14px', 
                            color: sortConfig.key === 'holidayDays' ? '#007bff' : '#6c757d',
                            fontWeight: sortConfig.key === 'holidayDays' ? 'bold' : 'normal',
                            marginLeft: '8px'
                          }}>{getSortIndicator('holidayDays')}</span>
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('overtimeDays')}
                        style={{ cursor: 'pointer', userSelect: 'none', minWidth: '100px' }}
                        className="sortable-header"
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <span className="text-start" style={{ whiteSpace: 'nowrap' }}>Overtime Days</span>
                          <span style={{ 
                            fontSize: '14px', 
                            color: sortConfig.key === 'overtimeDays' ? '#007bff' : '#6c757d',
                            fontWeight: sortConfig.key === 'overtimeDays' ? 'bold' : 'normal',
                            marginLeft: '8px'
                          }}>{getSortIndicator('overtimeDays')}</span>
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('unknownDays')}
                        style={{ cursor: 'pointer', userSelect: 'none', width: '200px' }}
                        className="sortable-header"
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <span className="text-start" style={{ whiteSpace: 'nowrap' }}>Unknown</span>
                          <span style={{ 
                            fontSize: '14px', 
                            color: sortConfig.key === 'unknownDays' ? '#007bff' : '#6c757d',
                            fontWeight: sortConfig.key === 'unknownDays' ? 'bold' : 'normal',
                            marginLeft: '8px'
                          }}>{getSortIndicator('unknownDays')}</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedData.map(item => (
                      <tr key={item.employee.id} className={item.isExcludedFromUtilization ? 'table-secondary' : ''}>
                        <td>
                          <div className="d-flex align-items-center">
                            <span>{item.employee.name}</span>
                            {item.validationInfo && !item.validationInfo.isValid && (
                              <span 
                                className="ms-2 text-warning" 
                                title={`Validation Error: Categories don't add up to total weekdays
                                
Expected: ${item.validationInfo.expectedWeekdays} weekdays
Actual: ${item.validationInfo.totalWeekdayCategories.toFixed(2)} days
Difference: ${item.validationInfo.difference.toFixed(2)} days

Breakdown:
• Field: ${item.validationInfo.categoryBreakdown.field} days
• Office: ${item.validationInfo.categoryBreakdown.office} days
• Work From Home: ${item.validationInfo.categoryBreakdown['work from home']} days
• Vacation: ${item.validationInfo.categoryBreakdown.vacation} days
• Holiday: ${item.validationInfo.categoryBreakdown.holiday} days
• Sick: ${item.validationInfo.categoryBreakdown.sick} days
• Unknown: ${item.validationInfo.categoryBreakdown.unknown} days${item.validationInfo.unaccountedDates && item.validationInfo.unaccountedDates.length > 0 ? `

Unaccounted Dates (${item.validationInfo.unaccountedDates.length}):
${item.validationInfo.unaccountedDates.map(dateStr => {
                                  const date = new Date(dateStr + 'T00:00:00')
                                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                }).join('\n')}` : ''}`}
                                style={{ cursor: 'help' }}
                              >
                                ⚠️
                              </span>
                            )}
                            {item.holidayWarnings && item.holidayWarnings.length > 0 && (
                              <span 
                                className="ms-2 text-danger" 
                                title={`Holiday Warning: Non-field/office events found on holidays (not counted):
                                
${item.holidayWarnings.map(warning => {
                                  const date = new Date(warning.date + 'T00:00:00')
                                  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}: ${warning.statuses.join(', ')}`
                                }).join('\n')}`}
                                style={{ cursor: 'help' }}
                              >
                                🚫
                              </span>
                            )}
                          </div>
                          {item.isExcludedFromUtilization && (
                            <small className="text-muted d-block">(Admin/Support)</small>
                          )}
                        </td>
                        <td>
                          <Badge bg={item.weekdayUtilizationPercentage > 80 ? 'success' : item.weekdayUtilizationPercentage > 60 ? 'warning' : 'danger'}>
                            {item.weekdayUtilizationPercentage}%
                          </Badge>
                          <small className="text-muted d-block">
                            ({item.weekdayUtilized}/{item.weekdayTotal} days)
                          </small>
                        </td>
                        <td>
                          <Badge bg={item.weekendUtilizationPercentage > 0 ? 'info' : 'secondary'}>
                            {item.weekendUtilizationPercentage}%
                          </Badge>
                          <small className="text-muted d-block">
                            ({item.weekendUtilized}/{item.weekendTotal} days)
                          </small>
                        </td>
                        <td>
                          {item.isExcludedFromUtilization ? (
                            <span className="text-muted">N/A</span>
                          ) : (
                            <span
                              title={item.categoryDates?.field && item.categoryDates.field.length > 0
                                ? `Field days:\n${formatDatesForTooltip(item.categoryDates.field)}`
                                : 'No field days'
                              }
                              style={{ cursor: item.categoryDates?.field && item.categoryDates.field.length > 0 ? 'help' : 'default' }}
                            >
                              {item.utilization.categories.field.weekdays}
                            </span>
                          )}
                        </td>
                        <td>
                          {item.isExcludedFromUtilization ? (
                            <span className="text-muted">N/A</span>
                          ) : (
                            <span
                              title={item.categoryDates?.office && item.categoryDates.office.length > 0
                                ? `Office days:\n${formatDatesForTooltip(item.categoryDates.office)}`
                                : 'No office days'
                              }
                              style={{ cursor: item.categoryDates?.office && item.categoryDates.office.length > 0 ? 'help' : 'default' }}
                            >
                              {item.utilization.categories.office.weekdays}
                            </span>
                          )}
                        </td>
                        <td>
                          <span
                            title={item.categoryDates?.['work from home'] && item.categoryDates['work from home'].length > 0
                              ? `Work from home days:\n${formatDatesForTooltip(item.categoryDates['work from home'])}`
                              : 'No work from home days'
                            }
                            style={{ cursor: item.categoryDates?.['work from home'] && item.categoryDates['work from home'].length > 0 ? 'help' : 'default' }}
                          >
                            {item.utilization.categories['work from home']?.weekdays || 0}
                          </span>
                        </td>
                        <td>
                          <span
                            title={item.categoryDates?.vacation && item.categoryDates.vacation.length > 0
                              ? `Vacation days:\n${formatDatesForTooltip(item.categoryDates.vacation)}`
                              : 'No vacation days'
                            }
                            style={{ cursor: item.categoryDates?.vacation && item.categoryDates.vacation.length > 0 ? 'help' : 'default' }}
                          >
                            {item.utilization.categories.vacation.weekdays}
                          </span>
                        </td>
                        <td>
                          <span
                            title={item.categoryDates?.sick && item.categoryDates.sick.length > 0
                              ? `Sick days:\n${formatDatesForTooltip(item.categoryDates.sick)}`
                              : 'No sick days'
                            }
                            style={{ cursor: item.categoryDates?.sick && item.categoryDates.sick.length > 0 ? 'help' : 'default' }}
                          >
                            {item.utilization.categories.sick.weekdays || 0}
                          </span>
                        </td>
                        <td>
                          <span
                            title={item.categoryDates?.holiday && item.categoryDates.holiday.length > 0
                              ? `Holiday days:\n${formatDatesForTooltip(item.categoryDates.holiday)}`
                              : 'No holiday days'
                            }
                            style={{ cursor: item.categoryDates?.holiday && item.categoryDates.holiday.length > 0 ? 'help' : 'default' }}
                          >
                            {item.utilization.categories.holiday?.weekdays || 0}
                          </span>
                        </td>
                        <td>
                          {item.isExcludedFromUtilization ? (
                            <span className="text-muted">N/A</span>
                          ) : (
                            <span
                              title={item.categoryDates?.overtime && item.categoryDates.overtime.length > 0
                                ? `Overtime days:\n${formatDatesForTooltip(item.categoryDates.overtime)}`
                                : 'No overtime days'
                              }
                              style={{ cursor: item.categoryDates?.overtime && item.categoryDates.overtime.length > 0 ? 'help' : 'default' }}
                            >
                              {item.utilization.categories.overtime.weekends}
                            </span>
                          )}
                        </td>
                        <td>
                          {item.isExcludedFromUtilization ? (
                            <span className="text-muted">N/A</span>
                          ) : (
                            <span
                              title={item.unknownDates && item.unknownDates.length > 0 
                                ? `Unknown dates:\n${formatDatesForTooltip(item.unknownDates)}`
                                : 'No unknown days'
                              }
                              style={{ cursor: item.unknownDates && item.unknownDates.length > 0 ? 'help' : 'default' }}
                            >
                              {item.utilization.categories.unknown.weekdays}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Col>
          </Row>
        ) : (
          <div className="text-center py-4">
            <p className="text-muted">
              {showWarningsOnly 
                ? 'No employees with warnings found for the selected criteria'
                : 'No employee data available for the selected criteria'}
            </p>
          </div>
        )}
      </Card.Body>
    </Card>
  )
}

export default UtilizationChart 
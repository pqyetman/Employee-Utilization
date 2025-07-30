import { useState, useMemo, useCallback } from 'react'
import { Card, Form, Row, Col, Badge, Spinner, Alert } from 'react-bootstrap'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useSubcalendars, useAllEmployeesUtilization } from '../services/teamupService'

const COLORS = {
  field: '#8884d8',
  office: '#82ca9d',
  vacation: '#ffc658',
  overtime: '#ff7300',
  unknown: '#d3d3d3'
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
  
  // Calculate date range with memoization
  const { startDate, endDate } = useMemo(() => {
    let start, end
    
    if (dateRange === 'custom') {
      // Use custom dates
      start = customStartDate ? new Date(customStartDate) : new Date()
      end = customEndDate ? new Date(customEndDate) : new Date()
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
    return selectedEmployees.length > 0 
      ? utilizationData?.filter(item => selectedEmployees.includes(item.employee.id))
      : utilizationData
  }, [selectedEmployees, utilizationData])

  // Prepare data for charts function (must be defined before useMemo hooks)
  const prepareChartData = (data) => {
    if (!data || data.length === 0) return []

    const aggregated = {
      field: { weekdays: 0, weekends: 0 },
      office: { weekdays: 0, weekends: 0 },
      vacation: { weekdays: 0, weekends: 0 },
      overtime: { weekdays: 0, weekends: 0 },
      unknown: { weekdays: 0, weekends: 0 }
    }

    data.forEach(item => {
      if (item.utilization && item.utilization.categories) {
        Object.keys(item.utilization.categories).forEach(category => {
          const categoryData = item.utilization.categories[category]
          if (categoryData && typeof categoryData.weekdays === 'number' && typeof categoryData.weekends === 'number') {
            if (aggregated[category]) {
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

    return Object.keys(aggregated).map(category => ({
      name: category.charAt(0).toUpperCase() + category.slice(1),
      weekdays: aggregated[category].weekdays,
      weekends: aggregated[category].weekends,
      total: aggregated[category].weekdays + aggregated[category].weekends,
      color: COLORS[category]
    })).filter(item => item.total > 0)
  }

  // Sort the filtered data
  const sortedData = useMemo(() => {
    return sortData(filteredData, sortConfig.key, sortConfig.direction)
  }, [filteredData, sortConfig.key, sortConfig.direction])

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
        {chartData.length > 0 ? (
          <Row>
            <Col md={6}>
              <h6>Utilization Breakdown</h6>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="total"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
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
                  <Tooltip />
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
        {sortedData && sortedData.length > 0 && (
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
• Sick: ${item.validationInfo.categoryBreakdown.sick} days
• Unknown: ${item.validationInfo.categoryBreakdown.unknown} days`}
                                style={{ cursor: 'help' }}
                              >
                                ⚠️
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
                            item.utilization.categories.field.weekdays
                          )}
                        </td>
                        <td>
                          {item.isExcludedFromUtilization ? (
                            <span className="text-muted">N/A</span>
                          ) : (
                            item.utilization.categories.office.weekdays
                          )}
                        </td>
                        <td>{item.utilization.categories['work from home']?.weekdays || 0}</td>
                        <td>{item.utilization.categories.vacation.weekdays}</td>
                        <td>{item.utilization.categories.sick.weekdays || 0}</td>
                        <td>
                          {item.isExcludedFromUtilization ? (
                            <span className="text-muted">N/A</span>
                          ) : (
                            item.utilization.categories.overtime.weekends
                          )}
                        </td>
                        <td>
                          {item.isExcludedFromUtilization ? (
                            <span className="text-muted">N/A</span>
                          ) : (
                            item.utilization.categories.unknown.weekdays
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Col>
          </Row>
        )}
      </Card.Body>
    </Card>
  )
}

export default UtilizationChart 
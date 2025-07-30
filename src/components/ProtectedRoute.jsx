import { useAuth } from '../auth/useAuth'
import { Navigate, useLocation } from 'react-router-dom'
import { Spinner } from 'react-bootstrap'
import { useMsal } from '@azure/msal-react'

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  const { inProgress } = useMsal()
  const location = useLocation()

  if (inProgress !== 'none') {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

export default ProtectedRoute 
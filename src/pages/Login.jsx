import { useAuth } from '../auth/useAuth'
import { Navigate, useLocation } from 'react-router-dom'
import { Container, Row, Col, Card, Button } from 'react-bootstrap'
import { useMsal } from '@azure/msal-react'

function Login() {
  const { login, isAuthenticated } = useAuth()
  const { inProgress } = useMsal()
  const location = useLocation()

  const from = location.state?.from?.pathname || '/'

  if (inProgress !== 'none') {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div>Loading...</div>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  const handleLogin = () => {
    login()
  }

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col md={6} lg={4}>
          <Card>
            <Card.Header className="text-center">
              <h4>Employee Utilization</h4>
            </Card.Header>
            <Card.Body className="text-center">
              <p className="mb-4">Sign in with your Microsoft account</p>
              <Button 
                variant="primary" 
                size="lg" 
                onClick={handleLogin}
                className="w-100"
              >
                <i className="bi bi-microsoft me-2"></i>
                Sign in with Microsoft
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  )
}

export default Login 
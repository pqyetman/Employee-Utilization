import { Container, Row, Col, Card } from 'react-bootstrap'
import { useAuth } from '../auth/useAuth'
import UtilizationChart from '../components/UtilizationChart'

function Home() {
  const { user } = useAuth()

  return (
    <Container className="py-4">
      <Row>
        <Col>
          <h1>Employee Utilization Dashboard</h1>
          {user && (
            <p className="text-muted mb-4">
              Welcome back, {user.name || user.email}!
            </p>
          )}
          
          <UtilizationChart />
        </Col>
      </Row>
    </Container>
  )
}

export default Home 
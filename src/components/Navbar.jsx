import { Navbar, Nav, Container, Button, NavDropdown } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

function Navigation() {
  const { isAuthenticated, user, logout, login } = useAuth()

  return (
    <Navbar bg="dark" variant="dark" expand="lg">
      <Container>
        <Navbar.Brand as={Link} to="/">Employee Utilization</Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
          </Nav>
          <Nav>
            {isAuthenticated ? (
              <NavDropdown 
                title={user?.name || user?.email || 'User'} 
                id="basic-nav-dropdown"
                align="end"
              >
                <NavDropdown.Item as={Link} to="/profile">Profile</NavDropdown.Item>
                <NavDropdown.Divider />
                <NavDropdown.Item onClick={logout}>
                  Sign Out
                </NavDropdown.Item>
              </NavDropdown>
            ) : (
              <Button variant="outline-light" size="sm" onClick={login}>Sign In</Button>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  )
}

export default Navigation 
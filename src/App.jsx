import { Routes, Route } from 'react-router-dom'
import Navigation from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import './App.css'

function App() {
  return (
    <div className="App">
      <Navigation />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        } />
      </Routes>
    </div>
  )
}

export default App

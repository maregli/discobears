import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from 'contexts/AuthContext';
import FestivalMap from './components/FestivalMap';
import FestivalDetailPage from './pages/FestivalDetailPage';
import AddFestivalForm from './components/AddFestivalForm';
import AdminPanel from './pages/AdminPanel';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<FestivalMap />} />
          <Route path="/festival/:festivalId" element={<FestivalDetailPage />} />
          <Route path="/submit-festival" element={<AddFestivalForm />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

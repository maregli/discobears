import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from 'contexts/AuthContext';
import { FestivalsProvider } from 'contexts/FestivalsContext';
import FestivalMap from './components/FestivalMap';
import AddFestivalForm from './components/AddFestivalForm';
import AdminPanel from './pages/AdminPanel';

function App() {
  return (
    <AuthProvider>
      <FestivalsProvider>
        <Router>
          <Routes>
            <Route path="/" element={<FestivalMap />} />
            <Route path="/submit-festival" element={<AddFestivalForm />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </Router>
      </FestivalsProvider>
    </AuthProvider>
  );
}

export default App;

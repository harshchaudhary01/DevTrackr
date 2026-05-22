import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Overview from './pages/Overview';
import Repositories from './pages/Repositories';
import AIInsights from './pages/AIInsights';

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/dashboard" element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route index element={<Overview />} />
          <Route path="repositories" element={<Repositories />} />
          <Route path="analytics" element={<Overview />} />
          <Route path="ai-insights" element={<AIInsights />} />
          <Route path="contributors" element={<Overview />} />
          <Route path="settings" element={<Overview />} />
        </Route>
      </Route>

      <Route path="*" element={<div className="min-h-screen flex items-center justify-center">Page not found</div>} />
    </Routes>
  );
};

export default App;

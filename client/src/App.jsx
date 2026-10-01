import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import RequireAuth from './components/RequireAuth.jsx';
import LandingPage from './pages/Landing.jsx';
import DashboardPage from './pages/Dashboard.jsx';
import DiscoverPage from './pages/Discover.jsx';
import WorkflowPage from './pages/Workflow.jsx';
import AnalyticsPage from './pages/Analytics.jsx';
import AccountPage from './pages/Account.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/discover"
        element={
          <RequireAuth>
            <DiscoverPage />
          </RequireAuth>
        }
      />
      <Route
        path="/workflow"
        element={
          <RequireAuth>
            <WorkflowPage />
          </RequireAuth>
        }
      />
      <Route
        path="/analytics"
        element={
          <RequireAuth>
            <AnalyticsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/account"
        element={
          <RequireAuth>
            <AccountPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}


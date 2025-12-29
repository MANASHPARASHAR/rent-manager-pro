
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import PropertyManagement from './components/PropertyManagement';
import PropertyTypeManager from './components/PropertyTypeManager';
import PropertyDetails from './components/PropertyDetails';
import RentCollection from './components/RentCollection';
import Reports from './components/Reports';
import UserManagement from './components/UserManagement';
import Login from './components/Login';
import { useRentalStore, RentalProvider } from './store/useRentalStore';

const AppContent: React.FC = () => {
  const store = useRentalStore();
  
  if (!store.user) {
    return <Login />;
  }

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/properties" element={<PropertyManagement />} />
          <Route path="/properties/:id" element={<PropertyDetails />} />
          <Route path="/collection" element={<RentCollection />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/types" element={<PropertyTypeManager />} />
          <Route path="/team" element={<UserManagement />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

const App: React.FC = () => {
  return (
    <RentalProvider>
      <AppContent />
    </RentalProvider>
  );
};

export default App;

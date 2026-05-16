
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
import AdminInsights from './components/AdminInsights';
import ExpenseManagement from './components/ExpenseManagement';
import NotificationHistory from './components/NotificationHistory';
import Login from './components/Login';
import { useRentalStore, RentalProvider } from './store/useRentalStore';

const AppContent: React.FC = () => {
  const store = useRentalStore();
  
  if (store.isBooting) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Initializing Session...</p>
      </div>
    );
  }
  
  if (!store.user) {
    if (store.firebaseUser) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mb-6">
            <div className="w-8 h-8 rounded-full bg-red-500 animate-pulse" />
          </div>
          <h2 className="text-white font-black text-xl uppercase tracking-widest mb-2">Access Denied</h2>
          <p className="text-slate-400 font-bold max-w-sm mb-8">
            Your account ({store.firebaseUser.email}) is authenticated but not authorized to access this console. 
            Please contact the administrator.
          </p>
          <button 
            onClick={() => store.logout()}
            className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-black uppercase tracking-widest hover:bg-white/10 transition-all"
          >
            Sign Out
          </button>
        </div>
      );
    }
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
          <Route path="/expenses" element={<ExpenseManagement />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/insights" element={<AdminInsights />} />
          <Route path="/types" element={<PropertyTypeManager />} />
          <Route path="/team" element={<UserManagement />} />
          <Route path="/notifications" element={<NotificationHistory />} />
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

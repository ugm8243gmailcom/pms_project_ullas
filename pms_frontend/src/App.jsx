import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth, ProtectedRoute } from './context/AuthContext';
import Navbar from './components/Navbar';

import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import AdminDashboard from './pages/AdminDashboard';
import BasicSettings from './pages/BasicSettings';
import AdvancedSettings from './pages/AdvancedSettings';

import ManagerDashboard from './pages/ManagerDashboard';
import ProjectsHub from './pages/ProjectsHub';
import WorkflowsHub from './pages/WorkflowsHub';
import TasksHub from './pages/TasksHub';

import EmployeeDashboard from './pages/EmployeeDashboard';
import EmployeeTasks from './pages/EmployeeTasks';
import Homepage from './pages/Homepage';

// Dynamic Role-based Dashboard Router
const DynamicDashboard = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'admin' || user.role === 'owner') {
    return <AdminDashboard />;
  }
  if (user.role === 'project_manager') {
    return <ManagerDashboard />;
  }
  return <EmployeeDashboard />;
};

function AppRoutes() {
  const { user } = useAuth();
  const location = useLocation();
  const isLandingPage = location.pathname === '/';

  return (
    <>
      {!isLandingPage && (
        <div className="dashboard-video-container">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="dashboard-bg-video"
          >
            <source src="/Landspace.mp4" type="video/mp4" />
            <source src="/Landscape.mp4" type="video/mp4" />
          </video>
        </div>
      )}
      {user && !isLandingPage && <Navbar />}
      <main style={{ minHeight: isLandingPage ? '100vh' : 'calc(100vh - 68px)', position: 'relative', zIndex: 1 }}>
        <Routes>
          {/* Landing Page of Frontend */}
          <Route path="/" element={<Homepage />} />

          {/* Public Auth */}
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" replace />} />
          <Route path="/onboarding" element={!user ? <Login /> : <Navigate to="/dashboard" replace />} />

          {/* Dynamic Unified Dashboard */}
          <Route path="/dashboard" element={<ProtectedRoute><DynamicDashboard /></ProtectedRoute>} />

          {/* Admin Routes */}
          <Route path="/basic-settings" element={<ProtectedRoute allowedRoles={['admin', 'owner']}><BasicSettings /></ProtectedRoute>} />
          <Route path="/advanced-settings" element={<ProtectedRoute allowedRoles={['admin', 'owner']}><AdvancedSettings /></ProtectedRoute>} />

          {/* Project Manager Routes */}
          <Route path="/projects" element={<ProtectedRoute allowedRoles={['project_manager', 'admin', 'owner']}><ProjectsHub /></ProtectedRoute>} />
          <Route path="/workflows" element={<ProtectedRoute allowedRoles={['project_manager', 'admin', 'owner']}><WorkflowsHub /></ProtectedRoute>} />
          <Route path="/tasks-management" element={<ProtectedRoute allowedRoles={['project_manager', 'admin', 'owner']}><TasksHub /></ProtectedRoute>} />
          {/* Backwards-compatibility route for /kanban */}
          <Route path="/kanban" element={<ProtectedRoute allowedRoles={['project_manager', 'admin', 'owner']}><WorkflowsHub /></ProtectedRoute>} />

          {/* Employee Routes */}
          <Route path="/tasks" element={<ProtectedRoute><EmployeeTasks /></ProtectedRoute>} />

          {/* Fallback Catch-All */}
          <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { SocketProvider } from './socket/SocketContext';
import { NotificationProvider } from './context/NotificationContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DoctorsListPage } from './pages/DoctorsListPage';
import { DoctorDetailPage } from './pages/DoctorDetailPage';
import { MyAppointmentsPage } from './pages/MyAppointmentsPage';
import { DoctorPanelPage } from './pages/DoctorPanelPage';
import { AdminPanelPage } from './pages/AdminPanelPage';
import { NotFoundPage } from './pages/NotFoundPage';

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/doktorlar" replace />} />
        <Route path="/giris" element={<LoginPage />} />
        <Route path="/kayit" element={<RegisterPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/doktorlar" element={<DoctorsListPage />} />
          <Route path="/doktorlar/:id" element={<DoctorDetailPage />} />
        </Route>

        <Route element={<ProtectedRoute roles={['patient', 'doctor']} />}>
          <Route path="/randevularim" element={<MyAppointmentsPage />} />
        </Route>

        <Route element={<ProtectedRoute roles={['doctor']} />}>
          <Route path="/doktor-paneli" element={<DoctorPanelPage />} />
        </Route>

        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="/admin" element={<AdminPanelPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <AppRoutes />
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

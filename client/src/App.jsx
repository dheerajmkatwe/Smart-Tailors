import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import api from './api/axios';
import { Toaster, toast } from 'react-hot-toast';
import Dashboard from './pages/Dashboard';
import NewOrder from './pages/NewOrder';
import CustomerSearch from './pages/CustomerSearch';
import OrderHistory from './pages/OrderHistory';
import BillPreview from './pages/BillPreview';
import Analytics from './pages/Analytics';
import Login from './pages/Login';
import Register from './pages/Register';
import WorkerDashboard from './pages/WorkerDashboard';
import Profits from './pages/Profits';
import Alterations from './pages/Alterations';
import EditOrder from './pages/EditOrder';
import BoutiqueSettings from './pages/BoutiqueSettings';
import SuperAdmin from './pages/SuperAdmin';
import TrackOrder from './pages/TrackOrder';
import './index.css';
import { useRegisterSW } from 'virtual:pwa-register/react';
import useOfflineSync from './hooks/useOfflineSync';
import { WifiOff, RefreshCw } from 'lucide-react';

function OfflineBannerWrapper({ isOnline, isSyncing, syncOfflineOrders }) {
  const [show, setShow] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!isOnline) {
      setShow(true);
      const timer = setTimeout(() => setShow(false), 2000);
      return () => clearTimeout(timer);
    } else {
      setShow(false);
    }
  }, [location.pathname, isOnline]);

  if (!show || isOnline) return null;

  return (
    <div className="offline-banner">
      <WifiOff size={16} />
      <span>Offline</span>
      <button onClick={syncOfflineOrders} disabled={isSyncing} className="sync-btn">
        <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
        {isSyncing ? 'Syncing...' : 'Sync'}
      </button>
    </div>
  );
}

export default function App() {
  const [sidebarOpen, useState_sidebarOpen] = useState(false);
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem('tailor_auth');
    try { return saved ? JSON.parse(saved) : null; } catch { return null; }
  });
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const { isOnline, isSyncing, syncOfflineOrders } = useOfflineSync();

  useEffect(() => {
    if (!auth || !isOnline) return;

    const checkStatus = () => {
      api.get('/auth/premium-status')
        .then(res => {
          // If subscription/trial has expired, force logout immediately
          if (res.data.isPremiumActive === false) {
            localStorage.removeItem('tailor_auth');
            setAuth(null);
            toast.error('🔒 Free trial has expired! Please log in to renew your subscription.', { duration: 5000 });
            return;
          }

          const updated = { 
            ...auth, 
            isPremiumActive: res.data.isPremiumActive, 
            subscription_type: res.data.subscription_type,
            created_at: res.data.created_at || auth.created_at,
            subscription_expires_at: res.data.subscription_expires_at || auth.subscription_expires_at
          };
          const changed =
            auth.isPremiumActive !== updated.isPremiumActive ||
            auth.subscription_type !== updated.subscription_type ||
            auth.created_at !== updated.created_at ||
            auth.subscription_expires_at !== updated.subscription_expires_at;
          if (changed) {
            localStorage.setItem('tailor_auth', JSON.stringify(updated));
            setAuth(updated);
          }
        })
        .catch(err => {
          console.error('Failed to sync premium status:', err);
          if (err.response && err.response.status === 404) {
            localStorage.removeItem('tailor_auth');
            setAuth(null);
            toast.error('Session expired or shop account deleted. Please log in again.');
          }
        });
    };

    // Run check immediately on load
    checkStatus();

    // Periodically check every 10 seconds to auto-detect trial expiry while logged in
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, [auth?.tenant_id, isOnline]);

  const isAdmin = auth?.role === 'Admin';
  const toggleSidebar = () => useState_sidebarOpen(!sidebarOpen);
  const closeSidebar = () => useState_sidebarOpen(false);

  return (
    <BrowserRouter>
      <Toaster 
        position={window.innerWidth <= 768 ? "bottom-center" : "top-right"} 
        toastOptions={{ 
          duration: 3500,
          style: {
            background: '#FAF7F2',
            color: '#4A101C',
            fontFamily: '"Outfit", "Inter", sans-serif',
            fontSize: '13.5px',
            fontWeight: '600',
            border: '1px solid #D4AF37',
            borderRadius: '12px',
            boxShadow: '0 8px 30px rgba(106,30,46,0.12)',
            padding: '12px 18px',
            letterSpacing: '0.02em',
          },
          success: {
            iconTheme: {
              primary: '#2E7D32',
              secondary: '#FAF7F2',
            },
            style: {
              border: '1px solid rgba(46, 125, 50, 0.3)',
            }
          },
          error: {
            iconTheme: {
              primary: '#B71C1C',
              secondary: '#FAF7F2',
            },
            style: {
              border: '1px solid rgba(183, 28, 28, 0.3)',
            }
          }
        }} 
      />
      <Routes>
        {/* SuperAdmin Control Panel Route */}
        <Route path="/developerhubhai" element={<SuperAdmin />} />

        {/* Public Customer Order Tracker — no login required */}
        <Route path="/track/:orderId" element={<TrackOrder />} />

        {/* Regular application routing wrapped in catch-all wildcard */}
        <Route path="/*" element={
          !auth ? (
            <Routes>
              <Route path="/register" element={<Register />} />
              <Route path="*" element={<Login setAuth={setAuth} />} />
            </Routes>
          ) : (
            <div className={`app-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
              <OfflineBannerWrapper isOnline={isOnline} isSyncing={isSyncing} syncOfflineOrders={syncOfflineOrders} />
              <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} auth={auth} setAuth={setAuth} />

              {/* Mobile Overlay */}
              {sidebarOpen && <div className="mobile-overlay" onClick={closeSidebar}></div>}

              <main className="main-content">
                <Routes>
                  <Route path="/" element={isAdmin ? <Dashboard onMenuClick={toggleSidebar} auth={auth} /> : <WorkerDashboard onMenuClick={toggleSidebar} auth={auth} />} />
                  <Route path="/new-order" element={<NewOrder onMenuClick={toggleSidebar} auth={auth} />} />
                  <Route path="/customer/:id" element={<CustomerSearch onMenuClick={toggleSidebar} auth={auth} />} />

                  {isAdmin && (
                    <>
                      <Route path="/search" element={<CustomerSearch onMenuClick={toggleSidebar} auth={auth} />} />
                      <Route path="/orders" element={<OrderHistory onMenuClick={toggleSidebar} />} />
                      <Route path="/bill/:orderId" element={<BillPreview onMenuClick={toggleSidebar} />} />
                      <Route path="/edit-order/:orderId" element={<EditOrder onMenuClick={toggleSidebar} />} />
                      <Route path="/analytics" element={<Analytics onMenuClick={toggleSidebar} />} />
                      <Route path="/profits" element={<Profits onMenuClick={toggleSidebar} />} />
                      <Route path="/alterations" element={<Alterations onMenuClick={toggleSidebar} />} />
                      <Route path="/settings" element={<BoutiqueSettings onMenuClick={toggleSidebar} />} />
                    </>
                  )}

                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </main>
            </div>
          )
        } />
      </Routes>
    </BrowserRouter>
  );
}

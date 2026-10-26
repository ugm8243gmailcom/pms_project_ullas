import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { apiCall, authApi, rbacApi } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [permissions, setPermissions] = useState(() => {
    try {
      const savedPerms = localStorage.getItem('permissions');
      return savedPerms ? JSON.parse(savedPerms) : [];
    } catch {
      return [];
    }
  });

  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Normalizes role representation across frontend components
  const normalizeRoleName = (role) => {
    if (!role) return 'employee';
    const r = role.toLowerCase().replace(/[\s-]/g, '_');
    if (r === 'pm' || r === 'manager' || r === 'projectmanager') return 'project_manager';
    if (r === 'administrator' || r === 'superadmin') return 'admin';
    return r;
  };

  // Fetch dynamic permissions assigned to the current user's role
  const fetchMyPermissions = useCallback(async () => {
    try {
      const permData = await rbacApi.getMyPermissions();
      const perms = permData?.permissions || [];
      setPermissions(perms);
      localStorage.setItem('permissions', JSON.stringify(perms));
    } catch (err) {
      // Admin / Owner default fallback if offline
      if (user?.role === 'admin' || user?.role === 'owner') {
        setPermissions(['*']);
      }
    }
  }, [user?.role]);

  // Fetch unread notifications for badge counts
  const fetchUnreadNotifications = useCallback(async () => {
    if (!token || !user) return;
    try {
      const data = await apiCall('/notifications/unread-count');
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Quiet fail if network/unauth
    }
  }, [token, user]);

  // Session verification on initial application load
  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      const savedToken = localStorage.getItem('token');
      if (!savedToken) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const userData = await authApi.getMe();
        if (isMounted) {
          const normalized = {
            ...userData,
            role: normalizeRoleName(userData.role),
          };
          setUser(normalized);
          localStorage.setItem('user', JSON.stringify(normalized));
          await fetchMyPermissions();
        }
      } catch (err) {
        // If 401 Unauthorized or invalid token, clear invalid session
        if (err.message?.includes('401') || err.message?.includes('Unauthorized') || err.message?.includes('token')) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('permissions');
          if (isMounted) {
            setToken(null);
            setUser(null);
            setPermissions([]);
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    verifySession();

    // Listen for custom global session expiry events
    const handleSessionExpired = () => {
      logout();
    };
    window.addEventListener('waymark:auth-session-expired', handleSessionExpired);

    return () => {
      isMounted = false;
      window.removeEventListener('waymark:auth-session-expired', handleSessionExpired);
    };
  }, []);

  // Periodic notification polling
  useEffect(() => {
    if (token && user) {
      fetchUnreadNotifications();
      const interval = setInterval(fetchUnreadNotifications, 30000); // 30s
      return () => clearInterval(interval);
    }
  }, [token, user?.id, fetchUnreadNotifications]);

  // Login action handler
  const login = (authData) => {
    const accessToken = authData.accessToken || authData.access_token;
    const rawUser = authData.user || {};
    const normalizedUser = {
      ...rawUser,
      role: normalizeRoleName(rawUser.role),
    };

    localStorage.setItem('token', accessToken);
    localStorage.setItem('user', JSON.stringify(normalizedUser));

    setToken(accessToken);
    setUser(normalizedUser);

    // Initial permissions load
    fetchMyPermissions();
    fetchUnreadNotifications();
  };

  // Logout action handler
  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Best-effort server notification
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('permissions');
      setToken(null);
      setUser(null);
      setPermissions([]);
      setUnreadCount(0);
    }
  };

  // Update authenticated user profile fields
  const updateUser = (updates) => {
    const updated = {
      ...user,
      ...updates,
      ...(updates.role && { role: normalizeRoleName(updates.role) }),
    };
    setUser(updated);
    localStorage.setItem('user', JSON.stringify(updated));
  };

  // Role verification helper (supports array or single role string)
  const hasRole = (allowedRoles) => {
    if (!user) return false;
    const currentRole = normalizeRoleName(user.role);
    if (currentRole === 'admin' || currentRole === 'owner') return true; // Superuser privileges

    const rolesList = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    const normalizedRoles = rolesList.map(r => normalizeRoleName(r));
    return normalizedRoles.includes(currentRole);
  };

  // Permission verification helper
  const hasPermission = (permissionSlug) => {
    if (!user) return false;
    const currentRole = normalizeRoleName(user.role);
    if (currentRole === 'admin' || currentRole === 'owner') return true; // Full access
    if (permissions.includes('*')) return true;
    return permissions.includes(permissionSlug);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        permissions,
        unreadCount,
        loading,
        login,
        logout,
        updateUser,
        hasRole,
        hasPermission,
        refreshNotifications: fetchUnreadNotifications,
        refreshPermissions: fetchMyPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook to consume the AuthContext state and methods.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Role & Authentication Protected Route Component.
 * - Redirects unauthenticated visitors to /login with target return location.
 * - Restricts unauthorized users from administrative or manager-only paths.
 */
export const ProtectedRoute = ({ children, allowedRoles = [], requiredPermission = null }) => {
  const { user, token, loading, hasRole, hasPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
        <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-white/70 border-2 border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]">
          <div className="w-10 h-10 border-4 border-sky-400 border-t-slate-900 rounded-full animate-spin" />
          <p className="font-space font-bold text-slate-900 text-sm tracking-wide">
            Authenticating WAYMARK Session...
          </p>
        </div>
      </div>
    );
  }

  // Not logged in -> Redirect to login page
  if (!user || !token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role Gate Enforcement
  if (allowedRoles && allowedRoles.length > 0) {
    if (!hasRole(allowedRoles)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Permission Gate Enforcement
  if (requiredPermission) {
    if (!hasPermission(requiredPermission)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

/**
 * Inline Role Guard component for conditional UI elements (buttons, links, sections).
 */
export const RoleGuard = ({ children, allowedRoles = [], fallback = null }) => {
  const { hasRole } = useAuth();
  if (!hasRole(allowedRoles)) {
    return fallback;
  }
  return children;
};

/**
 * Centralized API Client & Service Methods for WAYMARK.
 * Handles automatic JWT Bearer token injection, tenant context headers,
 * uniform error handling, and typed domain API wrappers for Auth & RBAC.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || (
  import.meta.env.PROD 
    ? 'https://proman-aura-backend-362935833196.asia-south1.run.app/api/v1' 
    : '/api/v1'
);

/**
 * Universal fetch wrapper with Bearer token injection and JSON serialization.
 * @param {string} endpoint - API path relative to BASE_URL (e.g. '/auth/login')
 * @param {RequestInit} options - Standard fetch options
 * @returns {Promise<any>} Parsed response data
 */
export async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const isFormData = options.body instanceof FormData;
  
  const headers = {
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...options.headers,
  };

  let body = options.body;
  if (body && !isFormData && typeof body === 'object') {
    body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    body,
  });

  if (response.status === 204) {
    return null;
  }

  // Handle Token Expiry / Unauthorized Access
  if (response.status === 401 && !endpoint.includes('/auth/login')) {
    // Notify application of session invalidation
    window.dispatchEvent(new CustomEvent('waymark:auth-session-expired'));
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const detail = errorData.detail 
      || errorData.message 
      || (errorData.details && Array.isArray(errorData.details) && errorData.details.map(d => d.instruction || d.msg).join('; '))
      || `API request failed (${response.status})`;
    throw new Error(detail);
  }

  // Handle blob/file responses (e.g. CSV exports, reports)
  const contentType = response.headers.get('content-type');
  if (contentType && (contentType.includes('text/csv') || contentType.includes('application/octet-stream'))) {
    return response.blob();
  }

  return response.json();
}

/**
 * Domain-specific Auth API methods
 */
export const authApi = {
  /**
   * Unified login with email & password
   */
  login: (credentials) => apiCall('/auth/login', {
    method: 'POST',
    body: credentials,
  }),

  /**
   * Create a new organization workspace and send 6-digit OTP to Admin email
   */
  signupWorkspace: (payload) => apiCall('/auth/signup', {
    method: 'POST',
    body: payload,
  }),

  /**
   * Verify 6-digit OTP code to activate workspace & administrator
   */
  verifyOtp: (payload) => apiCall('/auth/verify-otp', {
    method: 'POST',
    body: payload,
  }),

  /**
   * Resend a fresh 6-digit OTP code to user email
   */
  resendOtp: (email) => apiCall('/auth/resend-otp', {
    method: 'POST',
    body: { email },
  }),

  /**
   * Introspect current authenticated user session
   */
  getMe: () => apiCall('/auth/me'),

  /**
   * Invalidate current user session
   */
  logout: () => apiCall('/auth/logout', {
    method: 'POST',
  }),
};

/**
 * Domain-specific RBAC & Multi-Tenant Directory API methods
 */
export const rbacApi = {
  /**
   * Introspect dynamic permissions for currently logged-in user
   */
  getMyPermissions: () => apiCall('/rbac/my-permissions'),

  /**
   * Get organization staff / teammates (respects strict Admin Invisibility)
   */
  getStaff: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiCall(`/rbac/staff${query ? `?${query}` : ''}`);
  },

  /**
   * Retrieve all tenant-scoped roles
   */
  getRoles: () => apiCall('/rbac/roles'),

  /**
   * Retrieve all system & tenant permissions
   */
  getPermissions: () => apiCall('/rbac/permissions'),

  /**
   * Assign or revoke role permission mappings
   */
  assignRolePermission: (assignment) => apiCall('/rbac/assignments', {
    method: 'POST',
    body: assignment,
  }),
};

export { BASE_URL };

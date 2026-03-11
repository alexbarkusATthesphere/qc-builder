// =============================================================================
// FILEPATH: src/environments/environment.ts
// =============================================================================
// Environment configuration for development
// =============================================================================
// MSAL Configuration for Microsoft Entra ID (Azure AD) SSO
//
// SETUP: Copy values from your qc-builder.env file:
//   - Application_CLIENT_ID  → msal.auth.clientId
//   - AUTHORITY_URL          → msal.auth.authority
//   - REDIRECT_URI_DEV       → msal.auth.redirectUri
// =============================================================================

export const environment = {
  production: false,

  // ===========================================================================
  // API Configuration
  // ===========================================================================
  api: {
    /** Base URL for the QC Builder API backend */
    baseUrl: `${window.location.protocol}//${window.location.hostname}:8000`,

    /** API version prefix */
    v1Prefix: '/api/v1',

    /** Full API v1 URL */
    get v1Url(): string {
      return `${this.baseUrl}${this.v1Prefix}`;
    },
  },

  // ===========================================================================
  // Feature Flags
  // ===========================================================================
  features: {
    /** Use mock data instead of API (for offline development) */
    useMockData: false,

    /** Enable debug logging for API calls */
    debugApi: true,

    /** Enable workflow editor feature (Phase 5+) */
    enableWorkflows: false,

    /** Enable chart visualizations (Gantt, Waterfall) */
    enableCharts: true,
  },

  // ===========================================================================
  // Microsoft Entra ID (Azure AD) SSO Configuration
  // ===========================================================================
  msal: {
    /**
     * Set to true to bypass real MSAL authentication and use mock auth.
     * Useful for local development without Azure connectivity.
     */
    useMockAuth: false,

    auth: {
      /** Application (client) ID from Azure Portal - from qc-builder.env Application_CLIENT_ID */
      clientId: 'YOUR_CLIENT_ID',

      /**
       * Authority URL - from qc-builder.env AUTHORITY_URL
       * Format: https://login.microsoftonline.com/{DIRECTORY_TENANT_ID}
       */
      authority: 'https://login.microsoftonline.com/f2c1e847-5bd2-4ba2-b5e4-b529a645f31a',

      /** Redirect URI after login - from qc-builder.env REDIRECT_URI_DEV */
      redirectUri: `${window.location.origin}/auth-callback`,

      /** Redirect URI after logout */
      postLogoutRedirectUri: window.location.origin,

      /** Navigate to the requested URL after login */
      navigateToLoginRequestUrl: true,
    },

    cache: {
      /**
       * Where to store auth state:
       * - 'sessionStorage': Cleared when browser tab closes (more secure)
       * - 'localStorage': Persists across sessions
       */
      cacheLocation: 'sessionStorage' as const,

      /** Set to true for IE11 or Edge legacy support */
      storeAuthStateInCookie: false,
    },

    /** Scopes requested during login */
    loginScopes: ['openid', 'profile', 'email', 'User.Read'],

    /** Scopes for API calls (if calling Microsoft Graph) */
    apiScopes: ['User.Read'],
  },

  // ===========================================================================
  // Domain & Authorization Configuration
  // ===========================================================================
  auth: {
    /**
     * Allowed email domains for Pass 1 validation.
     * Users must have an email from one of these domains.
     */
    allowedEmailDomains: ['thesphere.com', 'msg.com'],

    /**
     * API endpoint for Pass 2 role verification.
     * Backend should return { roles: string[] } or 403/404 if no access.
     */
    roleVerificationEndpoint: '/api/v1/users/verify-role',

    /**
     * Set to true to skip real role verification API call.
     * When true, uses mockUserRoles below.
     */
    useMockRoleVerification: true,

    /**
     * Mock roles to assign during development.
     * Only used when useMockRoleVerification is true.
     * Options: 'admin' | 'manager' | 'member' | 'viewer'
     */
    mockUserRoles: ['admin'] as string[],
  },

  // ===========================================================================
  // Mock User Configuration (Development Only)
  // ===========================================================================
  mockUser: {
    id: 'dev-user-001',
    email: 'developer@msg.com',
    displayName: 'Development User',
    roles: ['admin'],
  },
};
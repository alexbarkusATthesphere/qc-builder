// =============================================================================
// FILEPATH: src/environments/environment.prod.ts
// =============================================================================
// Environment configuration for production
// =============================================================================
// IMPORTANT: In production, sensitive values should be injected at build time
// via CI/CD pipeline environment variables, NOT hardcoded here.
//
// Azure DevOps / GitHub Actions example:
//   Replace placeholders during build with actual values from Key Vault
// =============================================================================

export const environment = {
  production: true,

  // ===========================================================================
  // API Configuration
  // ===========================================================================
  api: {
    /** Base URL for the QC Builder API backend (relative for same-origin) */
    baseUrl: '/api',

    /** API version prefix */
    v1Prefix: '/v1',

    /** Full API v1 URL */
    get v1Url(): string {
      return `${this.baseUrl}${this.v1Prefix}`;
    },
  },

  // ===========================================================================
  // Feature Flags
  // ===========================================================================
  features: {
    /** Use mock data instead of API */
    useMockData: false,

    /** Enable debug logging for API calls */
    debugApi: false,

    /** Enable workflow editor feature */
    enableWorkflows: false,

    /** Enable chart visualizations (Gantt, Waterfall) */
    enableCharts: true,
  },

  // ===========================================================================
  // Microsoft Entra ID (Azure AD) SSO Configuration
  // ===========================================================================
  msal: {
    /** NEVER use mock auth in production */
    useMockAuth: false,

    auth: {
      /** Injected at build time from CI/CD pipeline */
      clientId: '${AZURE_CLIENT_ID}',
      authority: '${AZURE_AUTHORITY}',
      redirectUri: '${AZURE_REDIRECT_URI}',
      postLogoutRedirectUri: '${AZURE_POST_LOGOUT_REDIRECT_URI}',
      navigateToLoginRequestUrl: true,
    },

    cache: {
      cacheLocation: 'sessionStorage' as const,
      storeAuthStateInCookie: false,
    },

    loginScopes: ['openid', 'profile', 'email', 'User.Read'],
    apiScopes: ['User.Read'],
  },

  // ===========================================================================
  // Domain & Authorization Configuration
  // ===========================================================================
  auth: {
    allowedEmailDomains: ['thesphere.com', 'msg.com'],
    roleVerificationEndpoint: '/api/v1/users/verify-role',

    /** NEVER use mock role verification in production */
    useMockRoleVerification: false,
    mockUserRoles: [],
  },

  // ===========================================================================
  // Mock User - Disabled in Production
  // ===========================================================================
  mockUser: null,
};
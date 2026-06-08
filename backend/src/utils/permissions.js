/**
 * Centralized Role-Based Access Control (RBAC) Mapping
 * This file defines the permissions schema for the application.
 */

const ROLES = {
    ADMIN: 'Admin',
    OFFICE: 'Büro',
    PROJECT_MANAGER: 'Projektleiter',
    GROUP_LEADER: 'Gruppenleiter',
    WORKER: 'Worker',
    SUBCONTRACTOR: 'Subcontractor'
};

// Maps a specific permission key to an array of allowed roles.
const PERMISSIONS = {
    // --- System & Settings ---
    MANAGE_API_KEYS: [ROLES.ADMIN],
    MANAGE_ROLES: [ROLES.ADMIN],

    // --- Users & Roles ---
    VIEW_USERS: [ROLES.ADMIN, ROLES.OFFICE, ROLES.PROJECT_MANAGER, ROLES.GROUP_LEADER, ROLES.WORKER],
    MANAGE_USERS: [ROLES.ADMIN, ROLES.OFFICE],

    // --- Core CRM Entities (Categories, Subcontractors, Customers) ---
    VIEW_CATEGORIES: [ROLES.ADMIN, ROLES.OFFICE],
    MANAGE_CATEGORIES: [ROLES.ADMIN, ROLES.OFFICE],

    VIEW_SUBCONTRACTORS: [ROLES.ADMIN, ROLES.OFFICE, ROLES.PROJECT_MANAGER, ROLES.GROUP_LEADER],
    MANAGE_SUBCONTRACTORS: [ROLES.ADMIN, ROLES.OFFICE, ROLES.PROJECT_MANAGER],
    
    VIEW_CUSTOMERS: [ROLES.ADMIN, ROLES.OFFICE, ROLES.PROJECT_MANAGER],
    MANAGE_CUSTOMERS: [ROLES.ADMIN, ROLES.OFFICE, ROLES.PROJECT_MANAGER],

    // --- Projects & Tasks ---
    VIEW_PROJECTS: [ROLES.ADMIN, ROLES.OFFICE, ROLES.PROJECT_MANAGER, ROLES.GROUP_LEADER, ROLES.WORKER, ROLES.SUBCONTRACTOR],
    MANAGE_PROJECTS: [ROLES.ADMIN, ROLES.OFFICE, ROLES.PROJECT_MANAGER],

    VIEW_TASKS: [ROLES.ADMIN, ROLES.OFFICE, ROLES.PROJECT_MANAGER, ROLES.GROUP_LEADER, ROLES.WORKER, ROLES.SUBCONTRACTOR],
    MANAGE_TASKS: [ROLES.ADMIN, ROLES.OFFICE, ROLES.PROJECT_MANAGER, ROLES.GROUP_LEADER], // Group leaders can manage tasks

    // --- Communications (Inquiries, Support, Email) ---
    VIEW_INQUIRIES: [ROLES.ADMIN, ROLES.OFFICE],
    MANAGE_INQUIRIES: [ROLES.ADMIN, ROLES.OFFICE],

    VIEW_SUPPORT: [ROLES.ADMIN, ROLES.OFFICE],
    MANAGE_SUPPORT: [ROLES.ADMIN, ROLES.OFFICE],

    VIEW_EMAILS: [ROLES.ADMIN, ROLES.OFFICE, ROLES.PROJECT_MANAGER, ROLES.GROUP_LEADER, ROLES.WORKER], // All roles might need to see assigned emails
    MANAGE_EMAIL_ACCOUNTS: [ROLES.ADMIN, ROLES.OFFICE], // Only admins/büro can map routes/create accounts

    // --- Notes ---
    VIEW_NOTES: [ROLES.ADMIN, ROLES.OFFICE, ROLES.PROJECT_MANAGER, ROLES.GROUP_LEADER, ROLES.WORKER, ROLES.SUBCONTRACTOR],
    MANAGE_NOTES: [ROLES.ADMIN, ROLES.OFFICE, ROLES.PROJECT_MANAGER, ROLES.GROUP_LEADER, ROLES.WORKER, ROLES.SUBCONTRACTOR] // Usually everyone can leave notes
};

/**
 * Checks if a user has a specific permission based on their role.
 * @param {Object} user - The user object (must contain a .role property or .role.name).
 * @param {string} permission - The permission key (e.g., 'MANAGE_USERS').
 * @returns {boolean}
 */
const hasPermission = (user, permission) => {
    if (!user || !user.role) return false;

    // Handle both string roles and object roles (user.role.name)
    const userRole = typeof user.role === 'string' ? user.role : user.role.name;
    if (!userRole) return false;

    // Admin always has all permissions (safety net)
    if (userRole === ROLES.ADMIN) return true;

    const allowedRoles = PERMISSIONS[permission];
    
    if (!allowedRoles) {
        console.warn(`Permission mapping for '${permission}' not found.`);
        return false;
    }

    // Role names are case-sensitive here, but we could normalize if needed
    return allowedRoles.includes(userRole);
};

module.exports = {
    ROLES,
    PERMISSIONS,
    hasPermission
};

namespace Sona.Server.Models.Commons
{
    public class ConstantDefaults
    {

        //MSGRAPH
        //max return quantity in user search by 34Id
        public const int MSGRAPH_RETURN_QUANTITY = 50; //many (more than half) get filtered out after search due to Email field empty/null (in AAD labeled "Mail"). When setting to '50' about 15 results are returned as non-null/empty Mail field per testing..

        //EntraID (Azure AD) - migrated from Ping Federate ~9/2025
        public const string ENTRAID_CLAIMS_USER_PRINCIPAL_NAME = "preferred_username";
        public const string ENTRAID_CLAIMS_USER_FIRST_NAME = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname";
        public const string ENTRAID_CLAIMS_USER_LAST_NAME = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname";
        public const string ENTRAID_CLAIMS_USER_EMAIL = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress";

        //MESSAGING - approved template keys (content lives in the MessageTemplates table)
        public const string MESSAGE_TEMPLATE_KEY_READY = "ready-to-be-seen";

    }

    /// <summary>
    /// AppUser.Role values — string constants, kept in parity with the
    /// UserRole TS union in @sona/shared (docs/tasks/08 design decision 3).
    /// </summary>
    public static class UserRoles
    {
        /// <summary>Sona/HCA internal; no org; sees everything; only role that creates organizations.</summary>
        public const string SystemAdmin = "system_admin";

        /// <summary>Manages users/sites/departments/providers within own org; org-wide access implied.</summary>
        public const string OrgAdmin = "org_admin";

        /// <summary>Sends notifications, sees patients only; department-scoped via UserDepartmentAccess.</summary>
        public const string Staff = "staff";

        /// <summary>Authenticated but not yet provisioned — pending approval, sees nothing.</summary>
        public const string Unassigned = "unassigned";
    }
}

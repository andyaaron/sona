namespace Sona.Api.Models.Commons
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

    }

    //enum for access levels - MUST MATCH DATABASE ID VALUES
    public enum AccessLevels
    {
        Unassigned = 1, //default for new users
        Standard = 2, //lowest level of access, must be provisioned in app for this elevation from Unassigned?
    }
}

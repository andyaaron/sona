using Sona.Server.Models.Commons;
using System.Security.Claims;

namespace Sona.Server.Models.Util;

public interface ICurrentUserService
{
    Task<CurrentUserDto?> GetCurrentUserAsync();
}

public class CurrentUserDto
{
    public string? Hca34Id { get; set; }
    public string? DisplayName { get; set; }
    public string? Email { get; set; }

    /// <summary>One of UserRoles (system_admin, org_admin, staff, unassigned).</summary>
    public string Role { get; set; } = UserRoles.Unassigned;

    /// <summary>Tenant — null for system_admin/unassigned.</summary>
    public Guid? OrganizationId { get; set; }

    public string? OrganizationName { get; set; }

    /// <summary>UserDepartmentAccess scoping rows; only populated for staff.</summary>
    public List<Guid> DepartmentIds { get; set; } = new();

    /// <summary>Names for DepartmentIds — staff cannot call the org endpoints, so the header's department picker reads these.</summary>
    public List<DepartmentRefDto> Departments { get; set; } = new();

    /// <summary>Informational MSGraph department string, not authorization data.</summary>
    public string? Department { get; set; } = "unknown";
}

public class DepartmentRefDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
}

public class CurrentUserService : ICurrentUserService
{
    // Reads "preferred_username" and "name" claims from HttpContext.User
    // Splits preferred_username on '@' to extract the HCA 3-4 ID
    // Caches the result for the lifetime of the scoped request
    private readonly IAppUserUtil _appUserUtil;
    private readonly IHttpContextAccessor _httpContext;
    private readonly ILogger<CurrentUserService> _logger;

    private CurrentUserDto? _cachedUser;
    private bool _userLoaded;

    public CurrentUserService(
    IHttpContextAccessor httpContext,
    IAppUserUtil appUserUtil,
    ILogger<CurrentUserService> logger
)
    {
        _httpContext = httpContext;
        _appUserUtil = appUserUtil;
        _logger = logger;
    }

    public Task<CurrentUserDto?> GetCurrentUserAsync()
    {
        if (_userLoaded)
            return Task.FromResult(_cachedUser);

        _userLoaded = true;

        try
        {
            var userClaims = _httpContext.HttpContext?.User;
            _logger.LogInformation("userClaims: {userClaims}", userClaims);

            if (userClaims == null)
            {
                _logger.LogError("User claims in HttpContext came back null");
                return Task.FromResult<CurrentUserDto?>(null);
            }

            var emailClaim = userClaims.FindFirstValue(ConstantDefaults.ENTRAID_CLAIMS_USER_PRINCIPAL_NAME);
            if (emailClaim == null)
            {
                _logger.LogError("preferred_username claim came back null");
                return Task.FromResult<CurrentUserDto?>(null);
            }

            var hca34id = emailClaim.Split('@')[0].ToUpper();

            _logger.LogInformation("Authenticated user resolved: {Hca34Id}", hca34id);


            //KJS - include database info
            var role = UserRoles.Unassigned;
            Guid? organizationId = null;
            string? organizationName = null;
            var departmentIds = new List<Guid>();
            var departments = new List<DepartmentRefDto>();
            var department = "unknown";

            //default claims from context, to be overridden by db table
            var displayName = userClaims.FindFirstValue("name");

            if (hca34id != null)
            {

                try
                {
                    var dbUser = _appUserUtil.GetAppUser(hca34id).Result;

                    //KJS - if we have a db record, override the claims with the db values
                    //for brand new users this gets triggered before the OnTokenValidated event, so the db record is not yet created, so we have to check for null
                    if (dbUser != null)
                    {
                        //override email with the one they actually use instead of @hca.corpad.net
                        emailClaim = dbUser.Email ?? emailClaim;

                        //role + tenant scoping (server-side authorization data)
                        role = dbUser.Role;
                        organizationId = dbUser.OrganizationId;
                        organizationName = dbUser.Organization?.Name;
                        departmentIds = dbUser.DepartmentAccess.Select(a => a.DepartmentId).ToList();
                        departments = dbUser.DepartmentAccess
                            .Where(a => a.Department != null && a.Department.IsActive)
                            .Select(a => new DepartmentRefDto { Id = a.DepartmentId, Name = a.Department!.Name })
                            .OrderBy(d => d.Name)
                            .ToList();

                        //department
                        department = dbUser.EmpDept ?? "unknown";

                        //override Name to be first-first for once
                        displayName = dbUser.FirstName + " " + dbUser.LastName;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Exception in GetCurrentUserService->GetCurrentUserAsync(): {ex}");
                }
            }

            _cachedUser = new CurrentUserDto
            {
                Hca34Id = hca34id,
                DisplayName = displayName,
                Email = emailClaim, //from claim or overridden by db @hcahealthcare version
                Role = role,
                OrganizationId = organizationId,
                OrganizationName = organizationName,
                DepartmentIds = departmentIds,
                Departments = departments,
                Department = department
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception resolving current user");
        }

        return Task.FromResult(_cachedUser);
    }
}
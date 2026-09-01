using Microsoft.AspNetCore.Authorization;
using Sona.Server.Models.Commons;
using Sona.Server.Models.Util;

namespace Sona.Server.Models.Auth;

/// <summary>
/// Policy names for role-based authorization. All role/scope checks are
/// server-side (docs/compliance.md) — client role checks are UX only.
/// </summary>
public static class Policies
{
    /// <summary>system_admin only.</summary>
    public const string SystemAdmin = "SystemAdmin";

    /// <summary>org_admin (system_admin passes too).</summary>
    public const string OrgAdmin = "OrgAdmin";

    /// <summary>Any provisioned role — blocks unassigned users.</summary>
    public const string AssignedUser = "AssignedUser";

    public static void AddRolePolicies(this AuthorizationOptions options)
    {
        options.AddPolicy(SystemAdmin, p => p
            .RequireAuthenticatedUser()
            .AddRequirements(new RoleRequirement(UserRoles.SystemAdmin)));

        options.AddPolicy(OrgAdmin, p => p
            .RequireAuthenticatedUser()
            .AddRequirements(new RoleRequirement(UserRoles.SystemAdmin, UserRoles.OrgAdmin)));

        options.AddPolicy(AssignedUser, p => p
            .RequireAuthenticatedUser()
            .AddRequirements(new RoleRequirement(UserRoles.SystemAdmin, UserRoles.OrgAdmin, UserRoles.Staff)));
    }
}

public class RoleRequirement : IAuthorizationRequirement
{
    public IReadOnlyCollection<string> AllowedRoles { get; }

    public RoleRequirement(params string[] allowedRoles)
    {
        AllowedRoles = allowedRoles;
    }
}

/// <summary>Resolves the caller's AppUser.Role via ICurrentUserService (db-backed, not claims).</summary>
public class RoleRequirementHandler : AuthorizationHandler<RoleRequirement>
{
    private readonly ICurrentUserService _currentUserService;

    public RoleRequirementHandler(ICurrentUserService currentUserService)
    {
        _currentUserService = currentUserService;
    }

    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, RoleRequirement requirement)
    {
        var user = await _currentUserService.GetCurrentUserAsync();
        if (user != null && requirement.AllowedRoles.Contains(user.Role))
            context.Succeed(requirement);
    }
}

namespace Sona.Server.Data.DbModels;

/// <summary>
/// Scopes a staff user to the departments they may act in (a float nurse gets
/// multiple rows). Only meaningful for role "staff" — org_admin has org-wide
/// access implied and needs no rows.
/// </summary>
public class UserDepartmentAccess : EntityBase
{
    public int AppUserId { get; set; }

    public AppUser? AppUser { get; set; }

    public Guid DepartmentId { get; set; }

    public Department? Department { get; set; }
}

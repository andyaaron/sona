using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

using Sona.Api.Data;

namespace Sona.Api.Data.DbModels;

public class AppUser
{
    [Key]
    public int Id { get; set; }
    public string? HCAID { get; set; }
    public string? DisplayName { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Email { get; set; }
    public string? EmpDept { get; set; }

    public DateTime? LastLogin { get; set; }

    /// <summary>
    /// AccessLevelId is the FK for the AccessLevels Table. 
    /// This links AppUsers from the AppUsers table with their corresponding AccessLevel inside the AccessLevels table
    /// </summary>
    public int? AccessLevelId { get; set; }
    //public bool? IsDarkMode { get; set; }
    //public bool? IsManagerOverride { get; set; }

    public DateTime InDate { get; set; }
    public DateTime ModDate { get; set; }

    //public string? ManagerHCAID { get; set; }

    [ForeignKey("AccessLevelId")]
    public virtual AccessLevel? GetAccessLevel { get; set; }
}

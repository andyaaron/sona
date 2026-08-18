using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Sona.Api.Data;

namespace Sona.Api.Data.DbModels;

public class AccessLevel
{
    [Key]
    public int Id { get; set; }

    public string LevelName { get; set; } = null!;

    public string Description { get; set; } = null!;
}
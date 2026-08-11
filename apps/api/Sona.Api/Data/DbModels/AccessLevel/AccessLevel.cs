using Sona.Api.Data;

namespace Sona.Api.Data.DbModels;

public class AccessLevel : EntityBase
{
    public string LevelName { get; set; } = null!;

    public string Description { get; set; } = null!;
}
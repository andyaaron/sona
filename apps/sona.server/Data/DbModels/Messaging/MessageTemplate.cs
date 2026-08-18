using Sona.Api.Data;

namespace Sona.Api.Data.DbModels;

/// <summary>
/// Approved outbound message texts. The PHI review gate: content is reviewed
/// once here, and send paths may only pick from this table — never accept
/// caller-supplied free text. See docs/compliance.md.
/// </summary>
public class MessageTemplate : EntityBase
{
    public required string Key { get; set; }

    public required string Body { get; set; }

    public bool IsActive { get; set; } = true;
}

using Sona.Api.Data;
using Sona.Api.Features.Users;

namespace Sona.Api.Features.Imports;

/// <summary>Audit record for one flat-file patient import: which file, who, outcome.</summary>
public class ImportBatch : EntityBase
{
    public required string FileName { get; set; }

    public Guid UploadedByUserId { get; set; }
    public AppUser? UploadedByUser { get; set; }

    /// <summary>One of: processing, completed, failed.</summary>
    public required string Status { get; set; }

    public int RowsTotal { get; set; }

    public int RowsImported { get; set; }

    public int RowsFailed { get; set; }
}

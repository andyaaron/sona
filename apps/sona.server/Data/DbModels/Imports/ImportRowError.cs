using Sona.Api.Data;

namespace Sona.Api.Data.DbModels;

/// <summary>A single failed row within an import batch.</summary>
public class ImportRowError : EntityBase
{
    public Guid ImportBatchId { get; set; }
    public ImportBatch? ImportBatch { get; set; }

    public int RowNumber { get; set; }

    /// <summary>
    /// Validation text only (e.g. "invalid phone format"). Never write raw row
    /// contents here — import rows contain PHI and error tables get read and
    /// exported casually. See docs/compliance.md.
    /// </summary>
    public required string ErrorMessage { get; set; }
}

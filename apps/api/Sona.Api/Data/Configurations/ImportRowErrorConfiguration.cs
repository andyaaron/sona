using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sona.Api.Features.Imports;

namespace Sona.Api.Data.Configurations;

public class ImportRowErrorConfiguration : IEntityTypeConfiguration<ImportRowError>
{
    public void Configure(EntityTypeBuilder<ImportRowError> builder)
    {
        builder.ToTable("ImportRowErrors");

        // Cascade is intentional: errors are meaningless without their batch.
        builder.HasOne(e => e.ImportBatch)
            .WithMany()
            .HasForeignKey(e => e.ImportBatchId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property(e => e.ErrorMessage).HasMaxLength(500);
    }
}

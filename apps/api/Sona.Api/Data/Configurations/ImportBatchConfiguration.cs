using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sona.Api.Features.Imports;

namespace Sona.Api.Data.Configurations;

public class ImportBatchConfiguration : IEntityTypeConfiguration<ImportBatch>
{
    public void Configure(EntityTypeBuilder<ImportBatch> builder)
    {
        builder.ToTable("ImportBatches");

        builder.HasOne(b => b.UploadedByUser)
            .WithMany()
            .HasForeignKey(b => b.UploadedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(b => b.FileName).HasMaxLength(260);
        builder.Property(b => b.Status).HasMaxLength(20);
    }
}

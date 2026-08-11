using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sona.Api.Features.Messaging;

namespace Sona.Api.Data.Configurations;

public class MessageTemplateConfiguration : IEntityTypeConfiguration<MessageTemplate>
{
    // Fixed values only: migration seed data must be deterministic.
    private static readonly Guid ReadyToBeSeenId = new("019907e0-0000-7000-8000-000000000001");
    private static readonly DateTime SeedDate = new(2026, 8, 11, 0, 0, 0, DateTimeKind.Utc);

    public void Configure(EntityTypeBuilder<MessageTemplate> builder)
    {
        builder.ToTable("MessageTemplates");

        builder.Property(t => t.Key).HasMaxLength(100);
        builder.HasIndex(t => t.Key).IsUnique();

        builder.Property(t => t.Body).HasMaxLength(1000);

        builder.HasData(new
        {
            Id = ReadyToBeSeenId,
            Key = "ready-to-be-seen",
            Body = "You're ready to be seen. Please come to the front desk.",
            IsActive = true,
            CreateDate = SeedDate,
            ModDate = SeedDate,
        });
    }
}

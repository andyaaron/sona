using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Sona.Server.Data;

/// <summary>
/// Used only by `dotnet ef` design-time tooling (migrations add/remove/script).
/// Program.cs pulls the real connection string from Key Vault via DefaultAzureCredential,
/// which fails on machines without Azure credentials — migrations never connect, so a
/// placeholder connection string is sufficient here.
/// </summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer("Server=localhost;Database=SonaDesignTime;Trusted_Connection=True;TrustServerCertificate=True")
            .Options;

        return new ApplicationDbContext(options);
    }
}

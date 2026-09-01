using Microsoft.EntityFrameworkCore;
using Sona.Server.Data;
using Sona.Server.Data.DbModels;
using Sona.Server.Models.Commons;
using Sona.Server.Models.Util;

namespace Sona.Server.Models.Local;

/// <summary>
/// Personal-machine ("Local" environment) support. Nothing here may ever run outside
/// ASPNETCORE_ENVIRONMENT=Local — every entry point is called from an isLocal branch
/// in Program.cs. See docs/getting-started.md § "Running locally without Azure".
/// </summary>
public static class LocalDevMode
{
    /// <summary>
    /// Local mode targets a disposable local SQL Server only. Refuse to start if the
    /// connection string looks like Azure SQL — a Local run has stub auth, so pointing
    /// it at the shared dev database would bypass every real access control.
    /// </summary>
    public static void EnsureNotAzure(string connectionString)
    {
        if (connectionString.Contains("database.windows.net", StringComparison.OrdinalIgnoreCase)
            || connectionString.Contains("Authentication=Active Directory", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "Local mode refuses to start: ConnectionStrings:DefaultConnection points at Azure SQL "
                + "(contains 'database.windows.net' or 'Authentication=Active Directory'). Local mode uses "
                + "stub authentication and must only target a disposable local SQL Server — see "
                + "apps/sona.server/appsettings.Local.example.json.");
        }
    }

    /// <summary>
    /// Idempotent Local-only seed: guarantees the approved "ready-to-be-seen" template row
    /// exists (the migration seeds it; this covers databases built before it) so the notify
    /// flow can be exercised on an empty local database.
    /// </summary>
    public static async Task SeedAsync(IServiceProvider services, CancellationToken cancellationToken = default)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger(nameof(LocalDevMode));

        var templateExists = await db.MessageTemplates
            .AnyAsync(t => t.Key == ConstantDefaults.MESSAGE_TEMPLATE_KEY_READY, cancellationToken);

        if (!templateExists)
        {
            db.MessageTemplates.Add(new MessageTemplate
            {
                Key = ConstantDefaults.MESSAGE_TEMPLATE_KEY_READY,
                Body = "You're ready to be seen. Please come to the front desk.",
                IsActive = true,
            });
            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Local seed: added the '{TemplateKey}' message template.",
                ConstantDefaults.MESSAGE_TEMPLATE_KEY_READY);
        }
    }
}

/// <summary>
/// Local stand-in for the OIDC OnTokenValidated hook: runs the same JIT provisioning
/// (IAppUserUtil.CheckAndSetEmployee) once per process on the first authenticated request,
/// then promotes the freshly-created stub user to system_admin so a brand-new local
/// database is usable without hand-editing rows. Both steps are idempotent.
/// </summary>
public class LocalDevJitUserMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<LocalDevJitUserMiddleware> _logger;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private bool _provisioned;

    public LocalDevJitUserMiddleware(RequestDelegate next, ILogger<LocalDevJitUserMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!_provisioned && context.User?.Identity?.IsAuthenticated == true)
        {
            await _gate.WaitAsync(context.RequestAborted);
            try
            {
                if (!_provisioned)
                {
                    await ProvisionAsync(context);
                    _provisioned = true;
                }
            }
            finally
            {
                _gate.Release();
            }
        }

        await _next(context);
    }

    private async Task ProvisionAsync(HttpContext context)
    {
        try
        {
            var appUserUtil = context.RequestServices.GetRequiredService<IAppUserUtil>();
            var hca34Id = await appUserUtil.CheckAndSetEmployee(context.User);

            if (string.IsNullOrWhiteSpace(hca34Id))
                return;

            var db = context.RequestServices.GetRequiredService<ApplicationDbContext>();
            var user = await db.AppUsers.FirstOrDefaultAsync(u => u.HCAID == hca34Id, context.RequestAborted);

            // Only ever promotes the pending-approval placeholder, so a role deliberately
            // set through the UI (e.g. to test staff scoping) survives a restart.
            if (user != null && user.Role == UserRoles.Unassigned)
            {
                user.Role = UserRoles.SystemAdmin;
                user.ModDate = DateTime.Now;
                await db.SaveChangesAsync(context.RequestAborted);
                _logger.LogInformation("Local seed: promoted {Hca34Id} to {Role}.", hca34Id, UserRoles.SystemAdmin);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Local JIT user provisioning failed.");
        }
    }
}

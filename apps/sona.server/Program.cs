using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.EntityFrameworkCore;
using Microsoft.Identity.Web;
using Microsoft.Identity.Web.UI;
using Serilog;
using Serilog.Events;
using Serilog.Sinks.MSSqlServer;
using Sona.Server.Data;
using Sona.Server.Models.Auth;
using Sona.Server.Models.Local;
using Sona.Server.Models.Util;

var builder = WebApplication.CreateBuilder(args);

// "Local" is the personal-machine profile (docs/tasks/13): no Key Vault, no Entra, local
// SQL Server. Every branch below is gated on this flag, so any other environment name
// keeps the exact Azure code path it has always had.
var isLocal = builder.Environment.IsEnvironment(LocalDevAuthDefaults.LocalEnvironmentName);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

#region Keyvault data pull + Database Context

string connectionString;

if (isLocal)
{
    connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException(
            "Local mode requires ConnectionStrings:DefaultConnection in appsettings.Local.json "
            + "(copy apps/sona.server/appsettings.Local.example.json).");

    LocalDevMode.EnsureNotAzure(connectionString);
}
else
{
    var keyVaultUri = builder.Configuration["Keyvault:_keyvaultURI"];
    var keyVaultClient = new SecretClient(new Uri(keyVaultUri), new DefaultAzureCredential());

    connectionString = keyVaultClient.GetSecret("DefaultConnection").Value.Value;
}

//SERILOG
#region SERILOG

// The MSSqlServer sink needs the AppLogs table on a reachable server — console only in Local.
Log.Logger = isLocal
? new LoggerConfiguration()
.WriteTo.Console()
.CreateLogger()
: new LoggerConfiguration()
.WriteTo
.MSSqlServer(
    connectionString: connectionString,
    restrictedToMinimumLevel: LogEventLevel.Warning,
    sinkOptions: new MSSqlServerSinkOptions { TableName = "AppLogs" }
    )
.WriteTo.Console()
.CreateLogger();
builder.Host.UseSerilog();

#endregion


builder.Services.AddDbContext<ApplicationDbContext>(options => options.UseSqlServer(connectionString));
#endregion

#region setup Authentication middleware
builder.Services.AddControllersWithViews().AddMicrosoftIdentityUI();
builder.Services.AddRazorPages();

if (isLocal)
{
    // Stub scheme: nobody can reach the HCA tenant from a personal machine. Roles still
    // resolve from AppUsers.Role, so authorization policies are exercised for real.
    builder.Services.AddAuthentication(LocalDevAuthDefaults.AuthenticationScheme)
        .AddScheme<LocalDevAuthOptions, LocalDevAuthHandler>(
            LocalDevAuthDefaults.AuthenticationScheme,
            options => builder.Configuration.GetSection(LocalDevAuthDefaults.ConfigSection).Bind(options));
}
else
{
    builder.Services.AddAuthentication(OpenIdConnectDefaults.AuthenticationScheme)
        .AddMicrosoftIdentityWebApp(options =>
        {
            builder.Configuration.Bind("AzureAd", options);

            options.Events = new OpenIdConnectEvents
            {
                OnRedirectToIdentityProvider = context =>
                {
                    // Return 401 for API calls instead of redirecting to login
                    if (context.Request.Path.StartsWithSegments("/api")
                        || context.Request.Headers["X-Requested-With"] == "XMLHttpRequest")
                    {
                        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                        context.HandleResponse();
                    }

                    return Task.CompletedTask;
                },
            };
        });
}
#endregion

#region AppUser Service - update user or create new user in db
// OIDC-only: in Local there is no token to validate, so LocalDevJitUserMiddleware runs
// CheckAndSetEmployee on the first authenticated request instead.
if (!isLocal)
{
    builder.Services.PostConfigure<OpenIdConnectOptions>(OpenIdConnectDefaults.AuthenticationScheme, options =>
    {
        options.Events ??= new OpenIdConnectEvents();
        //azureAdConfigSection.Bind(options);
        options.Events.OnTokenValidated = async context =>
        {
            IAppUserUtil appUserUtil = context.HttpContext.RequestServices.GetRequiredService<IAppUserUtil>();

            //This util method will pull the claims and check if:
            //1. it's a brand new user, in which case it will provision them in the AppUser table
            //2. Specific claims (or MSGraph info it pulls for more details) have changed.  If so it may update that info in the AppUser table
            //3. update the lastLogin stamp for the user to datetime.now.
            await appUserUtil.CheckAndSetEmployee(context.Principal);
        };
    });
}
#endregion


// Setup antiforgery & authorization
builder.Services.AddAntiforgery(options => options.HeaderName = "X-XSRF-TOKEN");
builder.Services.AddAuthorization(options => options.AddRolePolicies());
builder.Services.AddScoped<Microsoft.AspNetCore.Authorization.IAuthorizationHandler, Sona.Server.Models.Auth.RoleRequirementHandler>();

// Register services
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddHttpContextAccessor();

builder.Services.AddSingleton<IMSGraphHelper, MSGraphHelper>();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<IAppUserUtil, AppUserUtil>();

// Message dispatch — SMS is real via Webex Connect (Task 07); push stays a stub until Enhancement 2.
// Named client fixes the new-HttpClient-per-call socket exhaustion; singleton util so the
// Key Vault service key is fetched once per process (lazily, on first send).
builder.Services.AddHttpClient(WebexConnectUtil.HttpClientName, client =>
{
    var baseApiUrl = builder.Configuration["WebexConnect:baseApiUrl"];
    if (!string.IsNullOrWhiteSpace(baseApiUrl))
    {
        // Trailing slash so the relative "v2/messages" combines with any path in baseApiUrl.
        client.BaseAddress = new Uri(baseApiUrl.TrimEnd('/') + "/");
    }
    client.Timeout = TimeSpan.FromSeconds(10);
});
builder.Services.AddSingleton<IWebexConnectUtil, WebexConnectUtil>();
builder.Services.AddSingleton<Sona.Server.Models.Messaging.ISmsSender, Sona.Server.Models.Messaging.WebexSmsSender>();
builder.Services.AddSingleton<Sona.Server.Models.Messaging.IPushSender, Sona.Server.Models.Messaging.LoggingStubPushSender>();

// CORS — allow the Vite dev server during development
builder.Services.AddCors(options =>
{
    options.AddPolicy("DevCors", policy =>
    {
        policy.WithOrigins("https://localhost:5173", "http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});


var app = builder.Build();

if (isLocal)
{
    await LocalDevMode.SeedAsync(app.Services);
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment() || isLocal)
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseRouting();

if (app.Environment.IsDevelopment() || isLocal)
{
    app.UseCors("DevCors");
}

app.UseAuthentication();

if (isLocal)
{
    // Stands in for the OIDC OnTokenValidated JIT provisioning hook.
    app.UseMiddleware<LocalDevJitUserMiddleware>();
}

app.UseAuthorization();
app.UseAntiforgery();

// Provide XSRF token to the client via cookie
app.Use((context, next) =>
{
    var antiforgery = context.RequestServices.GetRequiredService<IAntiforgery>();
    var tokens = antiforgery.GetAndStoreTokens(context);
    context.Response.Cookies.Append("XSRF-TOKEN", tokens.RequestToken!,
        new CookieOptions { HttpOnly = false });
    return next(context);
});

app.MapControllers();
app.MapRazorPages();
app.MapFallbackToFile("index.html");

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}

using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Microsoft.EntityFrameworkCore;
using Serilog;
using Serilog.Events;
using Serilog.Sinks.MSSqlServer;
using Sona.Api.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();


#region Keyvault data pull + Database Context

var keyVaultUri = builder.Configuration["Keyvault:_keyvaultURI"];
var keyVaultClient = new SecretClient(new Uri(keyVaultUri), new DefaultAzureCredential());

var connectionString = keyVaultClient.GetSecret("DefaultConnection").Value.Value;

//SERILOG
#region SERILOG

Log.Logger = new LoggerConfiguration()
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




var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}

using Microsoft.EntityFrameworkCore;
using Sona.Api.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddDbContext<SonaDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("Sona")));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.Run();

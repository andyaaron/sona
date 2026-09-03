using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Sona.Server.Models.Opie;

namespace Sona.Server.Controllers;

/// <summary>
/// Read-only window onto the external Opie_data schedule (docs/opie-odbc-integration.md).
/// Opie has no notion of Sona's organizations, so the only gate is an assigned role.
/// Responses are PHI: nothing from them is ever logged here — only counts and the date.
/// </summary>
[Authorize(Policy = Sona.Server.Models.Auth.Policies.AssignedUser)]
[Route("api/opie")]
[ApiController]
public class OpieController : Controller
{
    private readonly IOpieScheduleRepository _opie;
    private readonly ILogger<OpieController> _logger;

    public OpieController(IOpieScheduleRepository opie, ILogger<OpieController> logger)
    {
        _opie = opie;
        _logger = logger;
    }

    // GET: /api/opie/schedule?date=2026-09-03 — defaults to today (server local date)
    [HttpGet("schedule")]
    public async Task<IActionResult> GetSchedule([FromQuery] string? date, CancellationToken cancellationToken)
    {
        DateOnly scheduleDate;
        if (string.IsNullOrWhiteSpace(date))
        {
            scheduleDate = DateOnly.FromDateTime(DateTime.Now);
        }
        else if (!DateOnly.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out scheduleDate))
        {
            return BadRequest(new { error = "date must be YYYY-MM-DD." });
        }

        if (!_opie.IsConfigured)
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "opie-not-configured" });

        try
        {
            var patients = await _opie.GetScheduleAsync(scheduleDate, cancellationToken);
            _logger.LogInformation("Opie schedule for {ScheduleDate}: {PatientCount} patients", scheduleDate, patients.Count);
            return Ok(patients);
        }
        catch (Exception ex) when (ex is SqlException or InvalidOperationException or ArgumentException)
        {
            // Connection/login/query failures — the exception carries server details, never row data.
            _logger.LogError(ex, "Opie schedule lookup failed for {ScheduleDate}", scheduleDate);
            return StatusCode(StatusCodes.Status502BadGateway, new { error = "opie-unavailable" });
        }
    }
}

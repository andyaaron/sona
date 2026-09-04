using System.Data;
using System.Globalization;
using Microsoft.Data.SqlClient;

namespace Sona.Server.Models.Opie;

/// <summary>
/// Connection settings for Opie_data, the external practice-management SQL Server Sona reads
/// from (docs/opie-odbc-integration.md). Null connection string = integration not configured;
/// the API still starts and the endpoint answers 503 opie-not-configured.
/// </summary>
public sealed class OpieOptions
{
    public const string ConnectionStringName = "OpieConnection";

    /// <summary>Configuration key binding the Opie_data source to one Sona organization (Opie has no org concept).</summary>
    public const string OrganizationIdKey = "Opie:OrganizationId";

    /// <summary>
    /// Opie's shared staff/internal placeholder "patient" (LUNCH, meetings, out-of-office are
    /// booked against it). Listed on the day sheet as an internal block — redacted to its
    /// comment, never a real identity, never notifiable.
    /// </summary>
    public const string PlaceholderPatientId = "-9999";

    public string? ConnectionString { get; }

    /// <summary>
    /// The Sona organization whose clinic Opie_data belongs to. Only that org's users (and
    /// system_admin) may read the schedule or notify from it; everyone else gets 404.
    /// Null = unbound, and the integration reports itself as not configured.
    /// </summary>
    public Guid? OrganizationId { get; }

    public OpieOptions(string? connectionString, Guid? organizationId)
    {
        ConnectionString = string.IsNullOrWhiteSpace(connectionString) ? null : connectionString;
        OrganizationId = organizationId;
    }

    /// <summary>True once both the connection and the org binding are present.</summary>
    public bool IsConfigured => ConnectionString != null && OrganizationId != null;

    /// <summary>Tenant gate: the caller's org must be the bound org, or the caller is system_admin.</summary>
    public bool AllowsAccess(string role, Guid? callerOrganizationId) =>
        OrganizationId != null
        && (role == Sona.Server.Models.Commons.UserRoles.SystemAdmin || callerOrganizationId == OrganizationId);
}

// Read DTOs describing Opie's schema. Every field is PHI — internal use only, never logged.
public sealed record OpieAppointment(string? StartTime, string? EndTime, string? Details);

public sealed record OpiePhoneNumber(string? Number, string? Extension, string? Country);

public sealed record OpieScheduledPatient(
    string OpiePatientId,
    string? LastName,
    string? FirstName,
    string? MiddleName,
    string? NickName,
    string? EmailAddress,
    string? Comment,
    string? PrimaryPractitioner,
    string? LanguagePref,
    IReadOnlyList<OpieAppointment> Appointments,
    IReadOnlyList<OpiePhoneNumber> PhoneNumbers);

public interface IOpieScheduleRepository
{
    bool IsConfigured { get; }

    /// <summary>Patients with a tblPatientSchedule row starting on <paramref name="date"/>, with their phones and that day's appointments.</summary>
    Task<IReadOnlyList<OpieScheduledPatient>> GetScheduleAsync(DateOnly date, CancellationToken cancellationToken = default);
}

/// <summary>
/// Raw Microsoft.Data.SqlClient reads against Opie_data. Deliberately NOT an EF Core DbContext:
/// Opie's schema is not ours to migrate, and a second DbContext would make every
/// <c>dotnet ef</c> command in docs/getting-started.md demand a <c>--context</c> flag.
/// Read-only by construction — there is no write path here and must never be one.
/// </summary>
public sealed class OpieScheduleRepository : IOpieScheduleRepository
{
    // Three narrow queries instead of one fan-out join (a patient × N phones × M appointments
    // would repeat demographics N×M times). All share the same @date predicate.
    private const string ScheduledPatientIds = """
        SELECT s.fldPatientSchedulePatientID
        FROM dbo.tblPatientSchedule s
        WHERE CAST(s.fldPatientScheduleStartTime AS DATE) = @date
        """;

    private const string PatientsSql = $"""
        SELECT
            p.fldPatientID,
            p.fldPatientLastName,
            p.fldPatientFirstName,
            p.fldPatientMiddleName,
            p.fldPatientNickName,
            p.fldPatientEmailAddress,
            p.fldPatientComment,
            p.fldPatientPrimaryPractitioner,
            p.fldcmbLanguagePref
        FROM dbo.tblPatients p
        WHERE p.fldPatientID IN ({ScheduledPatientIds})
        ORDER BY p.fldPatientLastName, p.fldPatientFirstName
        """;

    private const string ScheduleSql = """
        SELECT
            s.fldPatientSchedulePatientID,
            s.fldPatientScheduleStartTime,
            s.fldPatientScheduleEndTime,
            s.fldPatientScheduleDetails
        FROM dbo.tblPatientSchedule s
        WHERE CAST(s.fldPatientScheduleStartTime AS DATE) = @date
        ORDER BY s.fldPatientScheduleStartTime
        """;

    private const string PhonesSql = $"""
        SELECT
            ph.fldPatientPhoneNumberPatientID,
            ph.fldPatientPhoneNumber,
            ph.fldPatientPhoneNumberExtension,
            ph.fldPatientPhoneNumberCountry
        FROM dbo.tblPatientPhoneNumbers ph
        WHERE ph.fldPatientPhoneNumberPatientID IN ({ScheduledPatientIds})
        """;

    private readonly string? _connectionString;

    public OpieScheduleRepository(OpieOptions options)
    {
        _connectionString = options.ConnectionString;
    }

    public bool IsConfigured => _connectionString != null;

    public async Task<IReadOnlyList<OpieScheduledPatient>> GetScheduleAsync(DateOnly date, CancellationToken cancellationToken = default)
    {
        if (_connectionString == null)
            throw new InvalidOperationException("Opie_data is not configured (ConnectionStrings:OpieConnection).");

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        var appointments = new Dictionary<string, List<OpieAppointment>>();
        await foreach (var reader in QueryAsync(connection, ScheduleSql, date, cancellationToken))
        {
            var patientId = ReadKey(reader, 0, keepPlaceholder: true);
            if (patientId == null)
                continue;
            GetOrAdd(appointments, patientId).Add(new OpieAppointment(ReadDateTime(reader, 1), ReadDateTime(reader, 2), ReadString(reader, 3)));
        }

        // Phone rows for the placeholder are dropped at the source: nothing may ever dial the shared row.
        var phones = new Dictionary<string, List<OpiePhoneNumber>>();
        await foreach (var reader in QueryAsync(connection, PhonesSql, date, cancellationToken))
        {
            var patientId = ReadKey(reader, 0, keepPlaceholder: false);
            if (patientId == null)
                continue;
            GetOrAdd(phones, patientId).Add(new OpiePhoneNumber(ReadString(reader, 1), ReadString(reader, 2), ReadString(reader, 3)));
        }

        var patients = new List<OpieScheduledPatient>();
        var placeholderSeen = false;
        await foreach (var reader in QueryAsync(connection, PatientsSql, date, cancellationToken))
        {
            var patientId = ReadKey(reader, 0, keepPlaceholder: true);
            if (patientId == null)
                continue;
            IReadOnlyList<OpieAppointment> patientAppointments = appointments.TryGetValue(patientId, out var a) ? a : Array.Empty<OpieAppointment>();

            if (patientId == OpieOptions.PlaceholderPatientId)
            {
                // Internal block: the label lives on each schedule row (fldPatientScheduleDetails).
                // Nothing from the shared tblPatients row survives — whatever staff have typed into
                // its name/contact/comment columns over the years is not an identity.
                placeholderSeen = true;
                patients.Add(InternalBlock(patientAppointments));
                continue;
            }

            patients.Add(new OpieScheduledPatient(
                OpiePatientId: patientId,
                LastName: ReadString(reader, 1),
                FirstName: ReadString(reader, 2),
                MiddleName: ReadString(reader, 3),
                NickName: ReadString(reader, 4),
                EmailAddress: ReadString(reader, 5),
                Comment: ReadString(reader, 6),
                PrimaryPractitioner: ReadString(reader, 7),
                LanguagePref: ReadString(reader, 8),
                Appointments: patientAppointments,
                PhoneNumbers: phones.TryGetValue(patientId, out var ph) ? ph : Array.Empty<OpiePhoneNumber>()));
        }

        // Blocks booked against -9999 without a tblPatients row for it still occupy time on the sheet.
        if (!placeholderSeen && appointments.TryGetValue(OpieOptions.PlaceholderPatientId, out var orphanBlocks))
            patients.Add(InternalBlock(orphanBlocks));

        return patients;
    }

    private static OpieScheduledPatient InternalBlock(IReadOnlyList<OpieAppointment> blocks) =>
        new(
            OpiePatientId: OpieOptions.PlaceholderPatientId,
            LastName: null,
            FirstName: null,
            MiddleName: null,
            NickName: null,
            EmailAddress: null,
            Comment: null,
            PrimaryPractitioner: null,
            LanguagePref: null,
            Appointments: blocks,
            PhoneNumbers: Array.Empty<OpiePhoneNumber>());

    private static async IAsyncEnumerable<SqlDataReader> QueryAsync(
        SqlConnection connection,
        string sql,
        DateOnly date,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.CommandTimeout = 30;
        command.Parameters.Add(new SqlParameter("@date", SqlDbType.Date) { Value = date.ToDateTime(TimeOnly.MinValue) });

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
            yield return reader;
    }

    private static List<T> GetOrAdd<T>(Dictionary<string, List<T>> map, string key)
    {
        if (!map.TryGetValue(key, out var list))
        {
            list = new List<T>();
            map[key] = list;
        }
        return list;
    }

    // Opie's column types are not under our control (fldPatientID may be int or char), so the
    // readers are type-agnostic: keys and strings round-trip through their invariant string form.
    // `keepPlaceholder` decides whether the -9999 internal-block key is a usable key for this
    // query (schedule + patient rows: yes; phone rows: never).
    private static string? ReadKey(SqlDataReader reader, int ordinal, bool keepPlaceholder)
    {
        if (reader.IsDBNull(ordinal))
            return null;
        var text = Convert.ToString(reader.GetValue(ordinal), CultureInfo.InvariantCulture)?.Trim();
        if (string.IsNullOrEmpty(text))
            return null;
        return !keepPlaceholder && text == OpieOptions.PlaceholderPatientId ? null : text;
    }

    private static string? ReadString(SqlDataReader reader, int ordinal)
    {
        if (reader.IsDBNull(ordinal))
            return null;
        // Trim: legacy schemas use padded char(n) columns.
        var text = Convert.ToString(reader.GetValue(ordinal), CultureInfo.InvariantCulture)?.Trim();
        return string.IsNullOrEmpty(text) ? null : text;
    }

    private static string? ReadDateTime(SqlDataReader reader, int ordinal)
    {
        if (reader.IsDBNull(ordinal))
            return null;
        var value = reader.GetValue(ordinal);
        return value switch
        {
            DateTime dt => dt.ToString("O", CultureInfo.InvariantCulture),
            DateTimeOffset dto => dto.ToString("O", CultureInfo.InvariantCulture),
            _ => Convert.ToString(value, CultureInfo.InvariantCulture),
        };
    }
}

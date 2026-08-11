using Microsoft.EntityFrameworkCore;
using Sona.Api.Data.DbModels;

namespace Sona.Api.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
               
        }

        public DbSet<AppLog> AppLogs { get; set; }
    }
}

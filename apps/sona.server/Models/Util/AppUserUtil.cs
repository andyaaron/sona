using Sona.Api.Data;
using Sona.Api.Data.DbModels;
using Sona.Api.Models.Commons;
using Sona.Api.Data;
using Sona.Api.Data.DbModels;
using System.Security.Claims;

namespace Sona.Api.Models.Util
{

    public interface IAppUserUtil
    {
        Task<AppUser> GetAppUser(string HCAID);

        /// <summary>
        /// check if user exists given 34Id
        /// </summary>
        /// <param name="_34ID"></param>
        /// <returns></returns>
        Task<bool> AppUserExist(string _34ID);


        /// <summary>
        /// For initial login OnTokenValidated in Program.cs
        /// will add new AppUser if they haven't logged in before.
        /// </summary>
        /// <param name="httpContext"></param>
        /// <returns></returns>
        Task<string?> CheckAndSetEmployee(ClaimsPrincipal? httpContext);

        /// <summary>
        /// IF the appUser does not already exist, will add it, otherwise skips
        /// </summary>
        /// <param name="appUser"></param>
        /// <returns>nothing</returns>
        Task AddAppUser(AppUser appUser);


        /// <summary>
        /// Given AppUser data, will update corresponding entry
        /// </summary>
        /// <param name="appUser"></param>
        /// <returns></returns>
        Task UpdateAppUser(AppUser appUser);

        /// <summary>
        /// given the appuser id, will update the LastLogin timestamp to datetime now
        /// </summary>
        /// <param name="appUserId"></param>
        /// <returns></returns>
        Task UpdateUserLastLogin(int appUserId);

    }

    public class AppUserUtil : IAppUserUtil
    {
        private readonly ApplicationDbContext _db;
        private readonly ILogger<AppUserUtil> _logger;
        private readonly IMSGraphHelper _msGraph;

        public AppUserUtil(ApplicationDbContext db, ILogger<AppUserUtil> logger, IMSGraphHelper msGraph)
        {
            _db = db;
            _logger = logger;
            _msGraph = msGraph;
        }
        public Task<AppUser> GetAppUser(string HCAID)
        {
            try
            {
                //return Task.FromResult(_db.AppUsers.First(m => m.HCAID == HCAID));
                return Task.FromResult(_db.AppUsers.Where(m => m.HCAID == HCAID).FirstOrDefault());
            }
            catch
            {

                _logger.LogWarning($"GetAppUser with HCAID: {HCAID} threw an exception - user does not exist? Returning empty user ");
                return Task.FromResult(new AppUser());
            }
        }


        //Add New User or update manager/employee number 
        //used by program.cs at the OnTokenValidated step on the auth process.
        //This method also will update LastLogin
        public async Task<string?> CheckAndSetEmployee(ClaimsPrincipal? httpContext)
        {
            string? hca34Id = null;

            try
            {
                var corpadEmail = httpContext?.FindFirstValue(ConstantDefaults.ENTRAID_CLAIMS_USER_PRINCIPAL_NAME); //34Id@hca.corpad.net

                hca34Id = corpadEmail?.Split('@')[0].ToUpper(); //force upper case, 34Id only

                var email = httpContext?.FindFirstValue(ConstantDefaults.ENTRAID_CLAIMS_USER_EMAIL);//first.last@hcahealthcare.com

                //check if they're already in db
                var isUserExistsInDb = AppUserExist(hca34Id).Result;
                AppUser? user = null;

                ////manager34Id will be populated from msgraph - later will check to see if different than current manager and update if necessary (user changing departments, which happens often)
                //string? manager34Id = null;
                //var managerGraphUser = _msGraph.GetUserManager(corpadEmail).Result; //hca34 = unsplit 34@hca.corpad.net address
                //                                                                    //
                //if (managerGraphUser != null)
                //{
                //    if (managerGraphUser.Mail != null) //check if any valid data came back
                //    {
                //        manager34Id = managerGraphUser.UserPrincipalName.Split('@')[0].ToUpper(); //pull 34Id of manager
                //    }
                //}

                if (!isUserExistsInDb)
                {
                    var fName = httpContext?.FindFirstValue(ConstantDefaults.ENTRAID_CLAIMS_USER_FIRST_NAME);
                    var lName = httpContext?.FindFirstValue(ConstantDefaults.ENTRAID_CLAIMS_USER_LAST_NAME);

                    //Add Basic AppUser Data
                    user = new AppUser
                    {
                        HCAID = hca34Id?.ToUpper(),
                        DisplayName = $"{lName} {fName}",
                        FirstName = fName,
                        LastName = lName,
                        Email = email,
                        //EmpDept - will be populated later via msgraph

                        LastLogin = DateTime.Now,
                        AccessLevelId = (int)AccessLevels.Standard,
                        //IsDarkMode = false,
                        //IsManagerOverride = false,
                        InDate = DateTime.Now,
                        ModDate = DateTime.Now,
                        //ManagerHCAID <-Will get this later from msGraph
                        //IsAutoAccessElevationDisabled = false, //not implemented, left here in case it comes up
                    };

                    //-------
                    //Pull New User Department from MSGRAPH - Department is not in entraID optional claims (see token configuration in app registration)
                    //
                    var userDetails = _msGraph.GetUserDetails(hca34Id).Result;
                    var userD = userDetails.FirstOrDefault();

                    if (userD != null)
                        user.EmpDept = userD.Department;


                    //-----------------------------
                    //Pull Manager info via MSGraph

                    //KJS - commented manager info here in this region, above and also further down
                    //currently no known plan to implement any manager functionality in Pyra
                    #region MANAGER_INFO_PULL - DISABLED?

                    //try
                    //{

                    //    if (managerGraphUser != null)
                    //    {
                    //        if (managerGraphUser.Mail != null) //check if any valid data came back
                    //        {


                    //            //prep logged in user's manager34ID field (if new user)
                    //            user.ManagerHCAID = manager34Id.ToUpper();

                    //            //Proactive manager account setup - If manager not already in AppUsers then add them and set them as a manager
                    //            if (!AppUserExist(manager34Id).Result)
                    //            {
                    //                //need to pull Department of Manager, which doesn't come by default so get user details
                    //                var managerUserDetails = _msGraph.GetUserDetails(manager34Id).Result;
                    //                var mgr = managerUserDetails.FirstOrDefault();

                    //                AppUser managerUser = new AppUser();

                    //                managerUser.AccessLevelId = (int)AccessLevels.Standard; //Managers are also considered standard?
                    //                managerUser.DisplayName = mgr?.DisplayName;
                    //                managerUser.HCAID = manager34Id.ToUpper();
                    //                managerUser.FirstName = mgr?.GivenName;
                    //                managerUser.LastName = mgr?.Surname;
                    //                managerUser.Email = mgr?.Mail;
                    //                managerUser.EmpDept = mgr?.Department;
                    //                //Pull in user's managers Kronos number
                    //                //LEGACY dogwood - retired 2025
                    //                //managerUser.EmployeeNumber = _kronosHelper.GetKronosEmployeeNumber(managerUser.HCAID).Result.ToString();
                    //                //managerUser.EmployeeNumber = GetOracleEmployeeNumber(managerUser.HCAID).Result;
                    //                managerUser.IsDarkMode = false;
                    //                managerUser.ModDate = DateTime.Now;
                    //                managerUser.InDate = DateTime.Now;
                    //                managerUser.LastLogin = null;
                    //                //managerUser.IsManagerOverride = false;


                    //                //AddAppUser will only add them if they don't already exist.
                    //                AddAppUser(managerUser).Wait();
                    //            }
                    //        }
                    //    }

                    //}
                    //catch (Exception ex)
                    //{
                    //    _logger.LogError($"Exception retrieving Manager info in EntraID RouteAttribute New Employee section: {ex}");
                    //}
                    #endregion MANAGER_INFO_PULL

                    //--------------------------
                    //NOW ADD THE LOGGED IN USER
                    AddAppUser(user).Wait();
                }
                else //user already exists
                {
                    //no extra data needed, we'll be pulling the user later to update last login and manager if needed
                }


                //---------------------------------------------------------
                //at this point whether new user or not they are in the db - now check for manager changes and update last login

                //pull the user from AppUser table (whether new user or not, in order to update the last Login stamp on their entry and update manager if needed)
                var thisUser = GetAppUser(hca34Id).Result;


                if (thisUser != null)
                {
                    ////Now check whether manager has changed vs current listed manager - if so, update (unless current user's flag isManagerOverride is set)
                    //if (manager34Id != null)
                    //{
                    //    //ignore if manager override
                    //    if (thisUser.IsManagerOverride != true) //null or false
                    //    {
                    //        //check if not the same
                    //        if (thisUser.ManagerHCAID != manager34Id)
                    //        {

                    //            _logger.LogWarning($"User's manager is different than current listed manager - user: {thisUser.DisplayName} , 34ID: {thisUser.HCAID}, listed manager: {thisUser.ManagerHCAID}, manager34id found via msgraph: {manager34Id} ");

                    //            thisUser.ManagerHCAID = manager34Id;
                    //            await UpdateAppUser(thisUser);
                    //        }
                    //    }
                    //}

                    //set lastLogin for user
                    await UpdateUserLastLogin(thisUser.Id);



                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error checking and setting new AppUser: {ex.Message}");
            }

            return hca34Id;
        }


        public Task<bool> AppUserExist(string _34ID)
        {
            return Task.FromResult(_db.AppUsers.Any(m => m.HCAID == _34ID));
        }



        public async Task AddAppUser(AppUser appUser)
        {
            if (appUser.Id == 0)
            {
                var exist = await AppUserExist(appUser.HCAID ?? "");
                if (!exist)
                {
                    _db.AppUsers.Add(appUser);
                    await _db.SaveChangesAsync();
                }

            }
        }


        public Task UpdateAppUser(AppUser appUser)
        {
            try
            {
                _db.AppUsers.Update(appUser);
                _db.SaveChanges();
            }
            catch (Exception ex)
            {
                _logger.LogError($"error updating appUser with Id: {appUser.Id}, exception: {ex}");
            }

            return Task.CompletedTask;

        }

        public async Task UpdateUserLastLogin(int appUserId)
        {
            var userToUpdate = _db.AppUsers.Where(m => m.Id == appUserId).FirstOrDefault();
            if (userToUpdate != null)
            {
                userToUpdate.LastLogin = DateTime.Now;

                _db.AppUsers.Update(userToUpdate);
                await _db.SaveChangesAsync();
            }
        }
    }
}

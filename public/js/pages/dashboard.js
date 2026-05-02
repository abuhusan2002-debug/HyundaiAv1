document.addEventListener("DOMContentLoaded", async () => {
  const {
    ensureAuthenticated,
    activateNav,
    bindLogout,
    apiRequest,
    showMessage
  } = window.AppCommon;

  const authed = await ensureAuthenticated();
  if (!authed) {
    return;
  }

  activateNav();
  bindLogout();

  try {
    const response = await apiRequest("/api/admin/dashboard/stats");
    const stats = response.data || {};

    document.getElementById("customersCount").textContent = stats.customersCount ?? 0;
    document.getElementById("customerCarsCount").textContent = stats.customerCarsCount ?? 0;
    document.getElementById("showroomCarsCount").textContent = stats.showroomCarsCount ?? 0;
    document.getElementById("techniciansCount").textContent = stats.techniciansCount ?? 0;
    document.getElementById("sparePartsCount").textContent = stats.sparePartsCount ?? 0;
    document.getElementById("maintenanceRequestsCount").textContent =
      stats.maintenanceRequestsCount ?? 0;
  } catch (error) {
    showMessage(error.message, "error");
  }
});

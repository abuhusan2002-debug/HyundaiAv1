document.addEventListener("DOMContentLoaded", async () => {
  const { ensureUserAuthenticated, activateNav, bindLogout, apiRequest, showMessage, escapeHtml } =
    window.UserCommon;

  const customer = await ensureUserAuthenticated();
  if (!customer) {
    return;
  }

  activateNav();
  bindLogout();

  const welcomeName = document.getElementById("welcomeName");
  if (welcomeName) {
    welcomeName.textContent = customer.fullName || "";
  }

  try {
    const response = await apiRequest("/api/user/home/summary");
    const data = response.data || {};
    const counts = data.counts || {};

    document.getElementById("homeCarsCount").textContent = counts.myCars ?? 0;
    document.getElementById("homeMaintenanceCount").textContent = counts.maintenanceRequests ?? 0;
    document.getElementById("homeCentersCount").textContent = counts.serviceCenters ?? 0;
    document.getElementById("homePartsCount").textContent = counts.spareParts ?? 0;

    const models = Array.isArray(data.carModels) ? data.carModels : [];
    const modelsContainer = document.getElementById("homeModels");
    if (modelsContainer) {
      if (!models.length) {
        modelsContainer.innerHTML = '<span class="muted">لا توجد مركبات مرتبطة بالحساب حالياً.</span>';
      } else {
        modelsContainer.innerHTML = models
          .map((model) => `<span class="model-chip">${escapeHtml(model)}</span>`)
          .join("");
      }
    }
  } catch (error) {
    showMessage(error.message, "error");
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  const { ensureUserAuthenticated, activateNav, bindLogout, apiRequest, showMessage, escapeHtml } =
    window.UserCommon;

  const customer = await ensureUserAuthenticated();
  if (!customer) {
    return;
  }

  activateNav();
  bindLogout();

  const listContainer = document.getElementById("serviceCentersList");
  const form = document.getElementById("serviceCenterSearchForm");
  const input = document.getElementById("serviceCenterSearchInput");

  async function loadCenters() {
    try {
      const q = String(input.value || "").trim();
      const query = q ? `?q=${encodeURIComponent(q)}` : "";
      const response = await apiRequest(`/api/user/service-centers${query}`);
      const centers = response.data || [];

      if (!centers.length) {
        listContainer.innerHTML = '<p class="empty-state">لا توجد مراكز خدمة مطابقة للبحث.</p>';
        return;
      }

      listContainer.innerHTML = centers
        .map(
          (center) => `
          <article class="service-card">
            <div class="service-card-head">
              <h3>${escapeHtml(center.fullName || "-")}</h3>
              <span class="service-rating">${escapeHtml(center.rating ?? "-")} ★</span>
            </div>
            <p><strong>التخصص:</strong> ${escapeHtml(center.specialty || "-")}</p>
            <p><strong>العنوان:</strong> ${escapeHtml(center.address || "-")}</p>
            <p><strong>الجوال:</strong> ${escapeHtml(center.mobile || "-")}</p>
            <p><strong>واتس آب:</strong> ${escapeHtml(center.whatsapp || "-")}</p>
            <p><strong>البريد الإلكتروني:</strong> ${escapeHtml(center.email || "-")}</p>
          </article>
        `
        )
        .join("");
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await loadCenters();
  });

  await loadCenters();
});

document.addEventListener("DOMContentLoaded", async () => {
  const { ensureUserAuthenticated, activateNav, bindLogout, apiRequest, showMessage, escapeHtml } =
    window.UserCommon;

  const customer = await ensureUserAuthenticated();
  if (!customer) {
    return;
  }

  activateNav();
  bindLogout();

  const cardsContainer = document.getElementById("sparePartsCards");
  const modelList = document.getElementById("sparePartsModels");
  const searchForm = document.getElementById("sparePartSearchForm");
  const searchInput = document.getElementById("sparePartSearchInput");
  const categorySelect = document.getElementById("sparePartCategory");

  async function loadParts() {
    try {
      const q = String(searchInput.value || "").trim();
      const category = String(categorySelect.value || "").trim();
      const query = new URLSearchParams();
      if (q) {
        query.set("q", q);
      }
      if (category && category !== "all") {
        query.set("category", category);
      }

      const suffix = query.toString() ? `?${query.toString()}` : "";
      const response = await apiRequest(`/api/user/spare-parts${suffix}`);
      const data = response.data || {};
      const parts = data.parts || [];
      const categories = data.categories || [];
      const models = data.carModels || [];

      if (categorySelect.options.length <= 1) {
        categories.forEach((item) => {
          const option = document.createElement("option");
          option.value = item;
          option.textContent = item;
          categorySelect.appendChild(option);
        });
      }

      if (!models.length) {
        modelList.innerHTML = '<span class="muted">لا توجد مركبات مرتبطة بحسابك حالياً.</span>';
      } else {
        modelList.innerHTML = models
          .map((model) => `<span class="model-chip">${escapeHtml(model)}</span>`)
          .join("");
      }

      if (!parts.length) {
        cardsContainer.innerHTML =
          '<p class="empty-state">لا توجد قطع غيار متوافقة مع مركباتك حسب البحث الحالي.</p>';
        return;
      }

      cardsContainer.innerHTML = parts
        .map(
          (part) => `
          <article class="part-card">
            <div class="part-card-head">
              <span class="part-status ${part.stock > 0 ? "ok" : "pending"}">${escapeHtml(part.availability)}</span>
              <span class="part-number">${escapeHtml(part.partNumber || "-")}</span>
            </div>
            <h3>${escapeHtml(part.name || "-")}</h3>
            <p class="muted">${escapeHtml(part.category || "-")} - ${escapeHtml(part.origin || "-")}</p>
            <p class="part-price">${escapeHtml(part.price || 0)} ${escapeHtml(part.currency || "")}</p>
            <p class="muted">الموديلات المتوافقة: ${escapeHtml((part.compatibleList || []).join("، ") || "-")}</p>
          </article>
        `
        )
        .join("");
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await loadParts();
  });

  categorySelect.addEventListener("change", async () => {
    await loadParts();
  });

  await loadParts();
});

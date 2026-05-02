document.addEventListener("DOMContentLoaded", async () => {
  const { ensureUserAuthenticated, activateNav, bindLogout, apiRequest, showMessage, clearMessage, escapeHtml } =
    window.UserCommon;

  const customer = await ensureUserAuthenticated();
  if (!customer) {
    return;
  }

  activateNav();
  bindLogout();

  const formPanel = document.getElementById("maintenanceFormPanel");
  const openFormBtn = document.getElementById("openMaintenanceFormBtn");
  const closeFormBtn = document.getElementById("closeMaintenanceFormBtn");

  const openArchiveBtn = document.getElementById("openMaintenanceArchiveBtn");
  const closeArchiveBtn = document.getElementById("closeMaintenanceArchiveBtn");
  const archiveModal = document.getElementById("maintenanceArchiveModal");
  const archiveListContainer = document.getElementById("maintenanceArchiveList");

  const cancelModal = document.getElementById("maintenanceCancelModal");
  const cancelForm = document.getElementById("maintenanceCancelForm");
  const cancelRequestIdInput = document.getElementById("cancelRequestId");
  const cancelReasonInput = document.getElementById("cancelReason");
  const closeCancelBtn = document.getElementById("closeMaintenanceCancelBtn");

  const form = document.getElementById("maintenanceRequestForm");
  const carsSelect = document.getElementById("maintenanceCar");
  const techniciansSelect = document.getElementById("maintenanceTechnician");
  const activeListContainer = document.getElementById("maintenanceRequestsList");

  let cars = [];
  let technicians = [];
  let requests = [];
  let archivedRequestsCount = 0;

  if (form?.preferredDate) {
    form.preferredDate.min = new Date().toISOString().slice(0, 10);
  }

  function parseDate(value) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  }

  function formatDate(value) {
    const parsed = parseDate(value);
    return parsed ? parsed.toLocaleDateString("ar-SY") : "-";
  }

  function getStartOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  function getArchiveReferenceDate(item) {
    return parseDate(item.appointmentDate) || parseDate(item.preferredDate);
  }

  function isArchived(item, startOfToday) {
    if (item.status === "ملغى") {
      return true;
    }

    const referenceDate = getArchiveReferenceDate(item);
    return Boolean(referenceDate && referenceDate < startOfToday);
  }

  function canCancelRequest(item, startOfToday) {
    if (item.status !== "مقبول") {
      return false;
    }

    const appointmentDate = parseDate(item.appointmentDate);
    if (!appointmentDate) {
      return false;
    }

    return appointmentDate >= startOfToday;
  }

  function splitRequestsByArchive(inputRequests) {
    const startOfToday = getStartOfToday();
    const active = [];
    const archived = [];

    inputRequests.forEach((item) => {
      if (isArchived(item, startOfToday)) {
        archived.push(item);
      } else {
        active.push(item);
      }
    });

    archived.sort((left, right) => {
      const leftDate = getArchiveReferenceDate(left)?.getTime() || 0;
      const rightDate = getArchiveReferenceDate(right)?.getTime() || 0;
      return rightDate - leftDate;
    });

    return { active, archived };
  }

  function toggleForm(visible) {
    if (!formPanel) {
      return;
    }

    formPanel.style.display = visible ? "block" : "none";
    if (visible) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function toggleArchiveModal(visible) {
    if (!archiveModal) {
      return;
    }

    archiveModal.style.display = visible ? "flex" : "none";
  }

  function toggleCancelModal(visible, requestId = "") {
    if (!cancelModal || !cancelForm) {
      return;
    }

    cancelModal.style.display = visible ? "flex" : "none";
    cancelRequestIdInput.value = visible ? requestId : "";

    if (!visible) {
      cancelForm.reset();
    }
  }

  function updateArchiveButton() {
    if (!openArchiveBtn) {
      return;
    }

    if (archivedRequestsCount > 0) {
      openArchiveBtn.textContent = `سجل طلبات الصيانة (${archivedRequestsCount})`;
      return;
    }

    openArchiveBtn.textContent = "سجل طلبات الصيانة";
  }

  function renderCarsOptions() {
    if (!carsSelect) {
      return;
    }

    carsSelect.innerHTML = '<option value="">اختر مركبة</option>';

    cars.forEach((car) => {
      const option = document.createElement("option");
      option.value = car._id;
      option.textContent = `${car.carName} ${car.modelYear} - ${car.vin}`;
      carsSelect.appendChild(option);
    });

    if (cars.length === 0) {
      showMessage("لا يمكنك إنشاء طلب صيانة قبل إضافة مركبة إلى حسابك.", "error");
    }
  }

  function renderTechniciansOptions() {
    if (!techniciansSelect) {
      return;
    }

    techniciansSelect.innerHTML = '<option value="">اختر الفني</option>';

    technicians.forEach((technician) => {
      const option = document.createElement("option");
      option.value = technician._id;
      option.textContent = `${technician.fullName || "-"} - ${technician.specialty || "-"}`;
      techniciansSelect.appendChild(option);
    });
  }

  function updateFormAvailability() {
    const hasCars = cars.length > 0;
    const hasTechnicians = technicians.length > 0;

    if (openFormBtn) {
      openFormBtn.disabled = !(hasCars && hasTechnicians);
    }

    if (!hasCars) {
      showMessage("لا يمكنك إنشاء طلب صيانة قبل إضافة مركبة إلى حسابك.", "error");
      return;
    }

    /*if (!hasTechnicians) {
      showMessage("لا يوجد فنيون متاحون حالياً. يرجى المحاولة لاحقاً.", "error");
    }*/
  }

  function statusBadge(status) {
    if (status === "مقبول") {
      return "ok";
    }
    if (status === "مرفوض") {
      return "rejected";
    }
    if (status === "ملغى") {
      return "cancelled";
    }
    return "pending";
  }

  function priorityBadge(priority) {
    if (priority === "عالية") {
      return "high";
    }
    if (priority === "منخفضة") {
      return "low";
    }
    return "medium";
  }

  function renderRequests(inputRequests, container, options = {}) {
    const { archived = false } = options;

    if (!container) {
      return;
    }

    if (!inputRequests.length) {
      container.innerHTML = archived
        ? '<p class="empty-state">لا توجد طلبات صيانة منتهية في الأرشيف حالياً.</p>'
        : '<p class="empty-state">لا توجد طلبات صيانة حالياً.</p>';
      return;
    }

    const startOfToday = getStartOfToday();

    container.innerHTML = inputRequests
      .map((item) => {
        const preferredDate = formatDate(item.preferredDate);
        const appointmentDate = item.appointmentDate ? formatDate(item.appointmentDate) : null;
        const cancelledAt = item.canceledAt ? formatDate(item.canceledAt) : null;
        const carText = item.customerCar
          ? `${item.customerCar.carName || "-"} ${item.customerCar.modelYear || ""} - ${item.customerCar.vin || ""}`
          : "-";
        const technicianText = item.technician
          ? `${item.technician.fullName || "-"} - ${item.technician.specialty || "-"}`
          : "-";
        const canCancel = !archived && canCancelRequest(item, startOfToday);

        return `
          <article class="maintenance-card status-${statusBadge(item.status)}${archived ? " is-archived" : ""}">
            <div class="maintenance-card-head">
              <div class="maintenance-badges">
                <span class="badge status ${statusBadge(item.status)}">${escapeHtml(item.status)}</span>
                <span class="badge priority ${priorityBadge(item.priority)}">${escapeHtml(item.priority)}</span>
              </div>
              <h3>${escapeHtml(item.requestType)}</h3>
            </div>
            <p class="muted">${escapeHtml(carText)}</p>
            <p class="muted"><strong>الفني المختار:</strong> ${escapeHtml(technicianText)}</p>
            <p>${escapeHtml(item.description || "-")}</p>
            <p class="muted">التاريخ المفضل: ${escapeHtml(preferredDate)}</p>
            ${
              appointmentDate
                ? `<p class="maintenance-result ok">موعدك المحدد: ${escapeHtml(appointmentDate)}</p>`
                : ""
            }
            ${
              item.status === "مرفوض" && item.rejectionReason
                ? `<p class="maintenance-result rejected">سبب الرفض: ${escapeHtml(item.rejectionReason)}</p>`
                : ""
            }
            ${
              item.status === "ملغى" && item.cancellationReason
                ? `<p class="maintenance-result cancelled">سبب الإلغاء: ${escapeHtml(item.cancellationReason)}</p>`
                : ""
            }
            ${
              item.status === "ملغى" && cancelledAt
                ? `<p class="muted">تاريخ الإلغاء: ${escapeHtml(cancelledAt)}</p>`
                : ""
            }
            ${
              canCancel
                ? `<div class="actions"><button class="btn btn-sm btn-danger" data-action="cancel" data-id="${item._id}">إلغاء الموعد</button></div>`
                : ""
            }
            ${
              archived
                ? '<p class="maintenance-archived-note">تمت أرشفة هذا الطلب لانتهاء تاريخه أو إلغائه.</p>'
                : ""
            }
          </article>
        `;
      })
      .join("");
  }

  async function loadCars() {
    const response = await apiRequest("/api/user/my-cars");
    cars = response.data || [];
    renderCarsOptions();
    updateFormAvailability();
  }

  async function loadTechnicians() {
    const response = await apiRequest("/api/user/service-centers");
    technicians = response.data || [];
    renderTechniciansOptions();
    updateFormAvailability();
  }

  async function loadRequests() {
    const response = await apiRequest("/api/user/maintenance-requests");
    requests = response.data || [];

    const { active, archived } = splitRequestsByArchive(requests);
    archivedRequestsCount = archived.length;

    renderRequests(active, activeListContainer, { archived: false });
    renderRequests(archived, archiveListContainer, { archived: true });
    updateArchiveButton();
  }

  openFormBtn?.addEventListener("click", () => {
    clearMessage();
    toggleForm(true);
  });

  closeFormBtn?.addEventListener("click", () => {
    form.reset();
    if (techniciansSelect) {
      techniciansSelect.value = "";
    }
    toggleForm(false);
  });

  openArchiveBtn?.addEventListener("click", () => {
    clearMessage();
    toggleArchiveModal(true);
  });

  closeArchiveBtn?.addEventListener("click", () => {
    toggleArchiveModal(false);
  });

  activeListContainer?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action='cancel']");
    if (!button) {
      return;
    }

    const requestId = button.getAttribute("data-id");
    if (!requestId) {
      return;
    }

    clearMessage();
    toggleCancelModal(true, requestId);
  });

  closeCancelBtn?.addEventListener("click", () => {
    toggleCancelModal(false);
  });

  archiveModal?.addEventListener("click", (event) => {
    if (event.target === archiveModal) {
      toggleArchiveModal(false);
    }
  });

  cancelModal?.addEventListener("click", (event) => {
    if (event.target === cancelModal) {
      toggleCancelModal(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (archiveModal?.style.display === "flex") {
      toggleArchiveModal(false);
    }

    if (cancelModal?.style.display === "flex") {
      toggleCancelModal(false);
    }
  });

  cancelForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    const requestId = String(cancelRequestIdInput.value || "").trim();
    const reason = String(cancelReasonInput.value || "").trim();

    if (!requestId) {
      showMessage("تعذر تحديد طلب الصيانة المطلوب إلغاؤه.", "error");
      return;
    }

    if (!reason) {
      showMessage("يرجى كتابة سبب الإلغاء قبل المتابعة.", "error");
      return;
    }

    try {
      const response = await apiRequest(`/api/user/maintenance-requests/${requestId}/cancel`, {
        method: "PUT",
        body: JSON.stringify({ reason })
      });

      showMessage(response.message || "تم إلغاء طلب الصيانة بنجاح.");
      toggleCancelModal(false);
      await loadRequests();
    } catch (error) {
      showMessage(error.message, "error");
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    const payload = {
      customerCar: form.customerCar.value,
      technician: form.technician.value,
      requestType: form.requestType.value,
      priority: form.priority.value,
      preferredDate: form.preferredDate.value,
      description: form.description.value
    };

    const hasEmpty = Object.values(payload).some((value) => !String(value || "").trim());
    if (hasEmpty) {
      showMessage("لا يمكن ترك الحقول المطلوبة فارغة.", "error");
      return;
    }

    try {
      const response = await apiRequest("/api/user/maintenance-requests", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      showMessage(response.message || "تم إرسال طلب الصيانة بنجاح.");
      form.reset();
      toggleForm(false);
      await loadRequests();
    } catch (error) {
      showMessage(error.message, "error");
    }
  });

  await loadCars();
  await loadTechnicians();
  await loadRequests();
});

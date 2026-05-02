document.addEventListener("DOMContentLoaded", async () => {
  const {
    ensureAuthenticated,
    activateNav,
    bindLogout,
    apiRequest,
    showMessage,
    clearMessage,
    escapeHtml
  } = window.AppCommon;

  const authed = await ensureAuthenticated();
  if (!authed) {
    return;
  }

  activateNav();
  bindLogout();

  const listContainer = document.getElementById("adminMaintenanceRequestsList");
  const archiveListContainer = document.getElementById("adminMaintenanceArchiveList");

  const openArchiveBtn = document.getElementById("openAdminMaintenanceArchiveBtn");
  const closeArchiveBtn = document.getElementById("closeAdminMaintenanceArchiveBtn");
  const archiveModal = document.getElementById("adminMaintenanceArchiveModal");

  const modal = document.getElementById("maintenanceReviewModal");
  const form = document.getElementById("maintenanceReviewForm");
  const reviewRequestId = document.getElementById("reviewRequestId");
  const reviewDecision = document.getElementById("reviewDecision");
  const appointmentWrap = document.getElementById("appointmentWrap");
  const appointmentDate = document.getElementById("reviewAppointmentDate");
  const rejectionWrap = document.getElementById("rejectionWrap");
  const rejectionReason = document.getElementById("reviewRejectionReason");
  const adminNote = document.getElementById("reviewAdminNote");
  const closeModalBtn = document.getElementById("closeReviewModalBtn");

  appointmentDate.min = new Date().toISOString().slice(0, 10);

  let allRequests = [];
  let activeRequests = [];
  let archivedRequests = [];

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

  function isArchived(item, startOfToday) {
    if (item.status === "ملغى") {
      return true;
    }

    if (item.status === "مقبول") {
      const appointment = parseDate(item.appointmentDate);
      if (appointment && appointment < startOfToday) {
        return true;
      }
    }

    return false;
  }

  function splitRequestsByArchive(requests) {
    const startOfToday = getStartOfToday();
    const active = [];
    const archived = [];

    requests.forEach((item) => {
      if (isArchived(item, startOfToday)) {
        archived.push(item);
      } else {
        active.push(item);
      }
    });

    archived.sort((left, right) => {
      const leftDate = parseDate(left.appointmentDate) || parseDate(left.canceledAt) || parseDate(left.createdAt);
      const rightDate =
        parseDate(right.appointmentDate) || parseDate(right.canceledAt) || parseDate(right.createdAt);
      return (rightDate?.getTime() || 0) - (leftDate?.getTime() || 0);
    });

    return { active, archived };
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

  function openModal(request, decision) {
    reviewRequestId.value = request._id;
    reviewDecision.value = decision;
    appointmentDate.value = "";
    rejectionReason.value = "";
    adminNote.value = "";
    toggleDecisionFields();
    modal.style.display = "flex";
  }

  function closeModal() {
    form.reset();
    modal.style.display = "none";
    reviewRequestId.value = "";
  }

  function toggleDecisionFields() {
    const isAccept = reviewDecision.value === "مقبول";
    appointmentWrap.style.display = isAccept ? "flex" : "none";
    rejectionWrap.style.display = isAccept ? "none" : "flex";
    appointmentDate.required = isAccept;
    rejectionReason.required = !isAccept;
  }

  function toggleArchiveModal(visible) {
    if (!archiveModal) {
      return;
    }

    archiveModal.style.display = visible ? "flex" : "none";
  }

  function updateArchiveButton() {
    if (!openArchiveBtn) {
      return;
    }

    if (archivedRequests.length > 0) {
      openArchiveBtn.textContent = `أرشيف الطلبات (${archivedRequests.length})`;
      return;
    }

    openArchiveBtn.textContent = "أرشيف الطلبات";
  }

  function renderRequests(requests, container, options = {}) {
    const { archived = false } = options;

    if (!container) {
      return;
    }

    if (!requests.length) {
      container.innerHTML = archived
        ? '<p class="empty-state">لا توجد طلبات في الأرشيف حالياً.</p>'
        : '<p class="empty-state">لا توجد طلبات صيانة نشطة حالياً.</p>';
      return;
    }

    container.innerHTML = requests
      .map((item) => {
        const created = formatDate(item.createdAt);
        const preferred = formatDate(item.preferredDate);
        const appointment = item.appointmentDate ? formatDate(item.appointmentDate) : null;
        const canceledAt = item.canceledAt ? formatDate(item.canceledAt) : null;

        const customerLabel = item.customer
          ? `${item.customer.fullName || "-"} (${item.customer.username || "-"})`
          : "-";
        const carLabel = item.customerCar
          ? `${item.customerCar.carName || "-"} ${item.customerCar.modelYear || ""}`
          : "-";
        const technicianLabel = item.technician
          ? `${item.technician.fullName || "-"} - ${item.technician.specialty || "-"}`
          : "-";
        const done = item.status !== "قيد الانتظار";

        return `
          <article class="maintenance-card status-${statusBadge(item.status)}${archived ? " is-archived" : ""}">
            <div class="maintenance-card-head">
              <div class="maintenance-badges">
                <span class="badge status ${statusBadge(item.status)}">${escapeHtml(item.status)}</span>
                <span class="badge priority ${priorityBadge(item.priority)}">${escapeHtml(item.priority)}</span>
              </div>
              <h3>${escapeHtml(item.requestType)}</h3>
            </div>
            <p><strong>العميل:</strong> ${escapeHtml(customerLabel)}</p>
            <p><strong>المركبة:</strong> ${escapeHtml(carLabel)}</p>
            <p><strong>الفني المختار:</strong> ${escapeHtml(technicianLabel)}</p>
            <p><strong>التاريخ المفضل:</strong> ${escapeHtml(preferred)}</p>
            <p><strong>تاريخ الإرسال:</strong> ${escapeHtml(created)}</p>
            <p><strong>الوصف:</strong> ${escapeHtml(item.description || "-")}</p>
            ${
              appointment
                ? `<p class="maintenance-result ok"><strong>موعد محدد:</strong> ${escapeHtml(appointment)}</p>`
                : ""
            }
            ${
              item.rejectionReason
                ? `<p class="maintenance-result rejected"><strong>سبب الرفض:</strong> ${escapeHtml(item.rejectionReason)}</p>`
                : ""
            }
            ${
              item.cancellationReason
                ? `<p class="maintenance-result cancelled"><strong>سبب الإلغاء من العميل:</strong> ${escapeHtml(item.cancellationReason)}</p>`
                : ""
            }
            ${
              item.status === "ملغى" && canceledAt
                ? `<p class="muted"><strong>تاريخ الإلغاء:</strong> ${escapeHtml(canceledAt)}</p>`
                : ""
            }
            ${
              item.adminNote
                ? `<p class="muted"><strong>ملاحظة المدير:</strong> ${escapeHtml(item.adminNote)}</p>`
                : ""
            }
            ${
              archived
                ? '<p class="maintenance-archived-note">تمت أرشفة هذا الطلب بسبب انتهاء الموعد أو إلغائه من العميل.</p>'
                : `<div class="actions">
                    <button class="btn btn-sm btn-primary" data-action="accept" data-id="${item._id}" ${
                      done ? "disabled" : ""
                    }>قبول وتحديد موعد</button>
                    <button class="btn btn-sm btn-danger" data-action="reject" data-id="${item._id}" ${
                      done ? "disabled" : ""
                    }>رفض مع سبب</button>
                  </div>`
            }
          </article>
        `;
      })
      .join("");
  }

  async function loadRequests() {
    const response = await apiRequest("/api/admin/maintenance-requests");
    allRequests = response.data || [];

    const split = splitRequestsByArchive(allRequests);
    activeRequests = split.active;
    archivedRequests = split.archived;

    renderRequests(activeRequests, listContainer, { archived: false });
    renderRequests(archivedRequests, archiveListContainer, { archived: true });
    updateArchiveButton();
  }

  listContainer.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    const id = button.getAttribute("data-id");
    const action = button.getAttribute("data-action");
    const request = activeRequests.find((item) => item._id === id);
    if (!request) {
      return;
    }

    if (action === "accept") {
      openModal(request, "مقبول");
      return;
    }

    if (action === "reject") {
      openModal(request, "مرفوض");
    }
  });

  openArchiveBtn?.addEventListener("click", () => {
    clearMessage();
    toggleArchiveModal(true);
  });

  closeArchiveBtn?.addEventListener("click", () => {
    toggleArchiveModal(false);
  });

  archiveModal?.addEventListener("click", (event) => {
    if (event.target === archiveModal) {
      toggleArchiveModal(false);
    }
  });

  closeModalBtn.addEventListener("click", closeModal);
  reviewDecision.addEventListener("change", toggleDecisionFields);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    const requestId = reviewRequestId.value;
    const payload = {
      decision: reviewDecision.value,
      appointmentDate: appointmentDate.value,
      rejectionReason: rejectionReason.value,
      adminNote: adminNote.value
    };

    try {
      const response = await apiRequest(`/api/admin/maintenance-requests/${requestId}/review`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      showMessage(response.message || "تم حفظ القرار.");
      closeModal();
      await loadRequests();
    } catch (error) {
      showMessage(error.message, "error");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (modal?.style.display === "flex") {
      closeModal();
    }

    if (archiveModal?.style.display === "flex") {
      toggleArchiveModal(false);
    }
  });

  await loadRequests();
});

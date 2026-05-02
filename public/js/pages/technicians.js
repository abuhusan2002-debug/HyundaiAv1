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

  const form = document.getElementById("technicianForm");
  const formTitle = document.getElementById("technicianFormTitle");
  const submitBtn = document.getElementById("technicianSubmitBtn");
  const cancelBtn = document.getElementById("technicianCancelEditBtn");
  const idField = document.getElementById("technicianId");
  const tableBody = document.getElementById("techniciansTableBody");

  const SYRIAN_GOVERNORATES = [
    "دمشق",
    "ريف دمشق",
    "حلب",
    "حماة",
    "حمص",
    "دير الزور",
    "درعا",
    "طرطوس",
    "اللاذقية",
    "الرقة",
    "الحسكة",
    "السويداء"
  ];

  const GOVERNORATE_ALIASES = {
    الاذقية: "اللاذقية"
  };

  let technicians = [];

  function normalizeGovernorateName(value) {
    const governorate = String(value || "").trim();
    return GOVERNORATE_ALIASES[governorate] || governorate;
  }

  function resetForm() {
    idField.value = "";
    form.reset();
    form.governorate.value = "";
    formTitle.textContent = "إضافة فني جديد";
    submitBtn.textContent = "إضافة الفني";
    cancelBtn.style.display = "none";
  }

  function fillForm(technician) {
    idField.value = technician._id;
    form.fullName.value = technician.fullName || "";
    form.specialty.value = technician.specialty || "";
    form.address.value = technician.address || "";
    form.governorate.value = normalizeGovernorateName(technician.governorate || "");
    form.rating.value = technician.rating ?? "";
    form.mobile.value = technician.mobile || "";
    form.whatsapp.value = technician.whatsapp || "";
    form.email.value = technician.email || "";
    form.notes.value = technician.notes || "";
    formTitle.textContent = "تعديل بيانات الفني";
    submitBtn.textContent = "حفظ التعديلات";
    cancelBtn.style.display = "inline-flex";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderRows() {
    if (!technicians.length) {
      tableBody.innerHTML = '<tr><td colspan="7" class="empty">لا يوجد فنيون مسجلون.</td></tr>';
      return;
    }

    tableBody.innerHTML = technicians
      .map(
        (tech) => `
          <tr>
            <td>${escapeHtml(tech.fullName)}</td>
            <td>${escapeHtml(tech.specialty)}</td>
            <td>${escapeHtml(tech.address)}</td>
            <td>${escapeHtml(normalizeGovernorateName(tech.governorate) || "-")}</td>
            <td>${escapeHtml(tech.rating)}</td>
            <td>${escapeHtml(tech.mobile || "-")} / ${escapeHtml(tech.whatsapp || "-")} / ${escapeHtml(
              tech.email || "-"
            )}</td>
            <td class="actions">
              <button class="btn btn-sm" data-action="edit" data-id="${tech._id}">تعديل</button>
              <button class="btn btn-sm btn-danger" data-action="delete" data-id="${tech._id}">حذف</button>
            </td>
          </tr>
        `
      )
      .join("");
  }

  async function loadTechnicians() {
    const response = await apiRequest("/api/admin/technicians");
    technicians = response.data || [];
    renderRows();
  }

  function validateForm() {
    const requiredFields = [
      form.fullName.value,
      form.specialty.value,
      form.address.value,
      form.governorate.value,
      form.rating.value
    ];

    if (requiredFields.some((item) => !String(item || "").trim())) {
      throw new Error("لا يمكن ترك الحقول المطلوبة فارغة.");
    }

    if (!SYRIAN_GOVERNORATES.includes(normalizeGovernorateName(form.governorate.value))) {
      throw new Error("يرجى اختيار محافظة سورية صحيحة.");
    }

    const rating = Number(form.rating.value);
    if (Number.isNaN(rating) || rating < 0 || rating > 5) {
      throw new Error("التقييم يجب أن يكون بين 0 و 5.");
    }

    const hasContact = Boolean(
      String(form.mobile.value || "").trim() ||
        String(form.whatsapp.value || "").trim() ||
        String(form.email.value || "").trim()
    );

    if (!hasContact) {
      throw new Error("يجب إدخال وسيلة تواصل واحدة على الأقل (جوال أو واتس آب أو بريد إلكتروني).");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    try {
      validateForm();

      const payload = {
        fullName: form.fullName.value,
        specialty: form.specialty.value,
        address: form.address.value,
        governorate: normalizeGovernorateName(form.governorate.value),
        rating: form.rating.value,
        mobile: form.mobile.value,
        whatsapp: form.whatsapp.value,
        email: form.email.value,
        notes: form.notes.value
      };

      const id = idField.value;
      const isEdit = Boolean(id);
      const url = isEdit ? `/api/admin/technicians/${id}` : "/api/admin/technicians";
      const method = isEdit ? "PUT" : "POST";

      const response = await apiRequest(url, {
        method,
        body: JSON.stringify(payload)
      });

      showMessage(response.message || "تمت العملية بنجاح.");
      resetForm();
      await loadTechnicians();
    } catch (error) {
      showMessage(error.message, "error");
    }
  });

  cancelBtn.addEventListener("click", () => {
    clearMessage();
    resetForm();
  });

  tableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    const id = button.getAttribute("data-id");
    const action = button.getAttribute("data-action");
    const technician = technicians.find((item) => item._id === id);
    if (!technician) {
      return;
    }

    if (action === "edit") {
      clearMessage();
      fillForm(technician);
      return;
    }

    if (action === "delete") {
      const confirmed = window.confirm("هل تريد حذف هذا الفني؟");
      if (!confirmed) {
        return;
      }

      try {
        const response = await apiRequest(`/api/admin/technicians/${id}`, {
          method: "DELETE"
        });

        showMessage(response.message || "تم الحذف بنجاح.");
        if (idField.value === id) {
          resetForm();
        }

        await loadTechnicians();
      } catch (error) {
        showMessage(error.message, "error");
      }
    }
  });

  resetForm();
  await loadTechnicians();
});

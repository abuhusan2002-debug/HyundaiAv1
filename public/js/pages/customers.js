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

  function normalizeGovernorate(value) {
    const trimmed = String(value || "").trim();
    return GOVERNORATE_ALIASES[trimmed] || trimmed;
  }

  function formatDate(value) {
    if (!value) {
      return "-";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "-";
    }

    return parsed.toLocaleDateString("ar-SY");
  }

  const authed = await ensureAuthenticated();
  if (!authed) {
    return;
  }

  activateNav();
  bindLogout();

  const form = document.getElementById("customerForm");
  const formTitle = document.getElementById("customerFormTitle");
  const submitBtn = document.getElementById("customerSubmitBtn");
  const cancelBtn = document.getElementById("customerCancelEditBtn");
  const idField = document.getElementById("customerId");
  const passwordField = document.getElementById("customerPassword");
  const tableBody = document.getElementById("customersTableBody");

  const detailsModal = document.getElementById("customerDetailsModal");
  const closeDetailsBtn = document.getElementById("closeCustomerDetailsBtn");
  const detailsBody = document.getElementById("customerDetailsBody");
  const detailsEditBtn = document.getElementById("customerDetailsEditBtn");
  const detailsDeleteBtn = document.getElementById("customerDetailsDeleteBtn");

  let customers = [];
  let activeDetailsCustomerId = "";

  function resetForm() {
    idField.value = "";
    form.reset();
    passwordField.required = true;
    passwordField.placeholder = "8 أحرف على الأقل";
    formTitle.textContent = "إنشاء حساب عميل جديد";
    submitBtn.textContent = "إضافة العميل";
    cancelBtn.style.display = "none";
  }

  function fillForm(customer) {
    idField.value = customer._id;
    form.fullName.value = customer.fullName || "";
    form.phone.value = customer.phone || "";
    form.password.value = "";
    passwordField.required = false;
    passwordField.placeholder = "اتركها فارغة إذا لا تريد تغيير كلمة المرور";
    form.username.value = customer.username || "";
    form.city.value = normalizeGovernorate(customer.city || "");
    form.purchaseSource.value = customer.purchaseSource || "";
    form.notes.value = customer.notes || "";
    formTitle.textContent = "تعديل بيانات العميل";
    submitBtn.textContent = "حفظ التعديلات";
    cancelBtn.style.display = "inline-flex";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function getCustomerById(id) {
    return customers.find((item) => item._id === id) || null;
  }

  function closeDetails() {
    if (!detailsModal) {
      return;
    }

    activeDetailsCustomerId = "";
    detailsModal.style.display = "none";
    detailsBody.innerHTML = "";
    detailsEditBtn.disabled = true;
    detailsDeleteBtn.disabled = true;
  }

  function openDetails(customer) {
    if (!detailsModal || !detailsBody) {
      return;
    }

    activeDetailsCustomerId = customer._id;

    detailsBody.innerHTML = `
      <ul class="customer-details-list">
        <li><strong>الاسم الكامل:</strong> ${escapeHtml(customer.fullName || "-")}</li>
        <li><strong>رقم الجوال:</strong> ${escapeHtml(customer.phone || "-")}</li>
        <li><strong>اسم المستخدم:</strong> ${escapeHtml(customer.username || "-")}</li>
        <li><strong>المحافظة:</strong> ${escapeHtml(customer.city || "-")}</li>
        <li><strong>مصدر الشراء:</strong> ${escapeHtml(customer.purchaseSource || "-")}</li>
        <li><strong>ملاحظات:</strong> ${escapeHtml(customer.notes || "لا توجد")}</li>
        <li><strong>تاريخ الإنشاء:</strong> ${escapeHtml(formatDate(customer.createdAt))}</li>
        <li><strong>آخر تحديث:</strong> ${escapeHtml(formatDate(customer.updatedAt))}</li>
      </ul>
    `;

    detailsEditBtn.disabled = false;
    detailsDeleteBtn.disabled = false;
    detailsModal.style.display = "flex";
  }

  function renderRows() {
    if (!customers.length) {
      tableBody.innerHTML = '<tr><td colspan="6" class="empty">لا يوجد عملاء حتى الآن.</td></tr>';
      return;
    }

    tableBody.innerHTML = customers
      .map(
        (customer) => `
          <tr>
            <td>${escapeHtml(customer.fullName)}</td>
            <td>${escapeHtml(customer.phone)}</td>
            <td>${escapeHtml(customer.username || "-")}</td>
            <td>${escapeHtml(customer.city)}</td>
            <td>${escapeHtml(customer.purchaseSource)}</td>
            <td class="actions">
              <button class="btn btn-sm" data-action="details" data-id="${customer._id}">التفاصيل</button>
            </td>
          </tr>
        `
      )
      .join("");
  }

  async function loadCustomers() {
    const response = await apiRequest("/api/admin/customers");
    customers = response.data || [];
    renderRows();

    if (activeDetailsCustomerId) {
      const selected = getCustomerById(activeDetailsCustomerId);
      if (selected) {
        openDetails(selected);
      } else {
        closeDetails();
      }
    }
  }

  function validateForm() {
    const fullName = String(form.fullName.value || "").trim();
    const phone = String(form.phone.value || "").trim();
    const username = String(form.username.value || "").trim().toLowerCase();
    const city = normalizeGovernorate(form.city.value);
    const purchaseSource = String(form.purchaseSource.value || "").trim();
    const password = String(form.password.value || "").trim();
    const isEdit = Boolean(idField.value);

    if (!fullName || !phone || !username || !city || !purchaseSource) {
      throw new Error("لا يمكن ترك الحقول المطلوبة فارغة.");
    }

    if (!SYRIAN_GOVERNORATES.includes(city)) {
      throw new Error("يرجى اختيار محافظة سورية صحيحة من القائمة.");
    }

    if (!["شركة هيونداي", "وكالة معتمدة"].includes(purchaseSource)) {
      throw new Error("مصدر الشراء يجب أن يكون شركة هيونداي أو وكالة معتمدة.");
    }

    if (!isEdit && !password) {
      throw new Error("كلمة المرور مطلوبة عند إنشاء الحساب.");
    }

    if (password && password.length < 8) {
      throw new Error("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
    }
  }

  async function deleteCustomerById(customerId) {
    const customer = getCustomerById(customerId);
    if (!customer) {
      return;
    }

    const confirmed = window.confirm(`هل تريد حذف العميل: ${customer.fullName}؟`);
    if (!confirmed) {
      return;
    }

    const response = await apiRequest(`/api/admin/customers/${customerId}`, {
      method: "DELETE"
    });

    showMessage(response.message || "تم الحذف بنجاح.");

    if (idField.value === customerId) {
      resetForm();
    }

    if (activeDetailsCustomerId === customerId) {
      closeDetails();
    }

    await loadCustomers();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    try {
      validateForm();

      const payload = {
        fullName: form.fullName.value,
        phone: form.phone.value,
        username: form.username.value,
        city: normalizeGovernorate(form.city.value),
        purchaseSource: form.purchaseSource.value,
        password: form.password.value,
        notes: form.notes.value
      };

      if (idField.value && !String(form.password.value || "").trim()) {
        delete payload.password;
      }

      const id = idField.value;
      const isEdit = Boolean(id);
      const url = isEdit ? `/api/admin/customers/${id}` : "/api/admin/customers";
      const method = isEdit ? "PUT" : "POST";

      const response = await apiRequest(url, {
        method,
        body: JSON.stringify(payload)
      });

      showMessage(response.message || "تمت العملية بنجاح.");
      resetForm();
      await loadCustomers();
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
    const customer = getCustomerById(id);

    if (!customer) {
      return;
    }

    if (action === "details") {
      clearMessage();
      openDetails(customer);
    }
  });

  closeDetailsBtn.addEventListener("click", closeDetails);

  detailsEditBtn.addEventListener("click", () => {
    const customer = getCustomerById(activeDetailsCustomerId);
    if (!customer) {
      return;
    }

    closeDetails();
    clearMessage();
    fillForm(customer);
  });

  detailsDeleteBtn.addEventListener("click", async () => {
    clearMessage();

    try {
      await deleteCustomerById(activeDetailsCustomerId);
    } catch (error) {
      showMessage(error.message, "error");
    }
  });

  detailsModal.addEventListener("click", (event) => {
    if (event.target === detailsModal) {
      closeDetails();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && detailsModal.style.display === "flex") {
      closeDetails();
    }
  });

  resetForm();
  await loadCustomers();
});

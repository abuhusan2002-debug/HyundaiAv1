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

  const form = document.getElementById("customerCarForm");
  const formTitle = document.getElementById("customerCarFormTitle");
  const submitBtn = document.getElementById("customerCarSubmitBtn");
  const cancelBtn = document.getElementById("customerCarCancelEditBtn");
  const idField = document.getElementById("customerCarId");
  const customerNameInput = document.getElementById("customerFullName");
  const customerPhoneInput = document.getElementById("customerPhone");
  const customerNamesList = document.getElementById("customerNamesList");
  const customerPhonesList = document.getElementById("customerPhonesList");
  const customerIdHidden = document.getElementById("customerId");
  const tableBody = document.getElementById("customerCarsTableBody");
  const emptyCustomersNotice = document.getElementById("noCustomersNotice");
  const carTypeSelect = document.getElementById("carTypeSelect");
  const carNameSelect = document.getElementById("carNameSelect");
  const carSpecPreview = document.getElementById("carSpecPreview");

  let cars = [];
  let customers = [];
  let resolvedSpec = null;
  const currentYear = new Date().getFullYear();

  const carNamesByType = {
    "سيدان": ["Elantra"],
    SUV: ["Tucson"],
    "كهربائية": ["IONIQ 5"],
    "هجينة": ["Sonata Hybrid"]
  };

  function normalizeLookup(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي")
      .replace(/[\s\-_/]+/g, "")
      .trim();
  }

  const carNameAliasMap = {
    accent: "Accent",
    اكسنت: "Accent",
    elantra: "Elantra",
    النترا: "Elantra",
    sonata: "Sonata",
    سوناتا: "Sonata",
    azera: "Azera",
    ازيرا: "Azera",
    kona: "Kona",
    كونا: "Kona",
    tucson: "Tucson",
    توسان: "Tucson",
    santafe: "Santa Fe",
    سانتافي: "Santa Fe",
    palisade: "Palisade",
    باليسيد: "Palisade",
    creta: "Creta",
    كريتا: "Creta",
    bayon: "Bayon",
    بايون: "Bayon",
    veloster: "Veloster",
    فيلوستر: "Veloster",
    staria: "Staria",
    ستاريا: "Staria",
    santacruz: "Santa Cruz",
    سانتاكروز: "Santa Cruz",
    سانتكروز: "Santa Cruz",
    ioniq5: "IONIQ 5",
    ايونيك5: "IONIQ 5",
    ايونك5: "IONIQ 5",
    ioniq6: "IONIQ 6",
    ايونيك6: "IONIQ 6",
    ايونك6: "IONIQ 6",
    konaelectric: "Kona Electric",
    sonatahybrid: "Sonata Hybrid",
    tucsonhybrid: "Tucson Hybrid",
    santafehybrid: "Santa Fe Hybrid",
    h1: "H-1"
  };

  function toCanonicalCarName(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }

    const fromAlias = carNameAliasMap[normalizeLookup(raw)];
    if (fromAlias) {
      return fromAlias;
    }

    for (const names of Object.values(carNamesByType)) {
      const matched = names.find((name) => normalizeLookup(name) === normalizeLookup(raw));
      if (matched) {
        return matched;
      }
    }

    return raw;
  }

  function renderSpecStatus(message) {
    carSpecPreview.innerHTML = `<p class="muted">${escapeHtml(message)}</p>`;
  }

  function renderSpecPreview(spec) {
    if (!spec) {
      renderSpecStatus("لم يتم إيجاد مواصفات معتمدة لهذه السيارة.");
      return;
    }

    const safetyList = Array.isArray(spec.key_safety_features) ? spec.key_safety_features : [];
    const legacyPowerMatch = String(spec.power || "").match(/\d+(\.\d+)?/);
    const powerHp =
      Number.isFinite(spec.power_hp)
        ? spec.power_hp
        : legacyPowerMatch
          ? Number(legacyPowerMatch[0])
          : null;

    carSpecPreview.innerHTML = `
      <ul>
        <li><strong>المحرك:</strong> ${escapeHtml(spec.engine || "-")}</li>
        <li><strong>القدرة (حصان):</strong> ${escapeHtml(
          Number.isFinite(powerHp) ? String(powerHp) : "-"
        )}</li>
        <li><strong>العزم (نيوتن.متر):</strong> ${escapeHtml(
          Number.isFinite(spec.torque_nm) ? String(spec.torque_nm) : "-"
        )}</li>
        <li><strong>ناقل الحركة:</strong> ${escapeHtml(spec.transmission || "-")}</li>
        <li><strong>نظام الدفع:</strong> ${escapeHtml(spec.drivetrain || "-")}</li>
        <li><strong>مصدر الطاقة:</strong> ${escapeHtml(spec.energySource || "-")}</li>
        <li><strong>الكفاءة/المدى:</strong> ${escapeHtml(spec.efficiency || "-")}</li>
        <li><strong>ميزات الأمان:</strong> ${escapeHtml(safetyList.join("، ") || "-")}</li>
      </ul>
    `;
  }

  async function refreshSpecPreview() {
    const carType = String(form.carType.value || "").trim();
    const carName = toCanonicalCarName(form.carName.value);
    const modelYear = Number(form.modelYear.value);

    resolvedSpec = null;

    if (!carType || !carName || !Number.isInteger(modelYear)) {
      renderSpecStatus("اختر نوع السيارة واسمها وسنة الموديل لعرض المواصفات المعتمدة.");
      return;
    }

    const yearValid = modelYear >= 2020 && modelYear <= currentYear;
    if (!yearValid) {
      renderSpecStatus(`سنة الموديل يجب أن تكون بين 2020 و ${currentYear}.`);
      return;
    }

    try {
      const query = new URLSearchParams({
        carType,
        carName,
        modelYear: String(modelYear)
      });
      const response = await apiRequest(`/api/admin/car-specs/resolve?${query.toString()}`);
      resolvedSpec = response.data || null;
      renderSpecPreview(resolvedSpec);
    } catch (error) {
      renderSpecStatus(error.message || "تعذر جلب المواصفات من قاعدة البيانات.");
    }
  }

  function toInputDate(dateValue) {
    if (!dateValue) {
      return "";
    }
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toISOString().slice(0, 10);
  }

  function ensureCarTypeOption(typeValue) {
    const value = String(typeValue || "").trim();
    if (!value || !carTypeSelect) {
      return;
    }

    const exists = Array.from(carTypeSelect.options).some((option) => option.value === value);
    if (exists) {
      return;
    }

    const dynamicOption = document.createElement("option");
    dynamicOption.value = value;
    dynamicOption.textContent = value;
    carTypeSelect.appendChild(dynamicOption);
  }

  function findTypeByCarName(carName) {
    const canonicalName = toCanonicalCarName(carName);
    if (!canonicalName) {
      return "";
    }

    const matchedType = Object.entries(carNamesByType).find(([, names]) =>
      names.some((name) => normalizeLookup(name) === normalizeLookup(canonicalName))
    );

    return matchedType ? matchedType[0] : "";
  }

  function setCarNameOptions(typeValue, selectedName = "") {
    const type = String(typeValue || "").trim();
    const selectedCanonical = toCanonicalCarName(selectedName);

    carNameSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = type ? "اختر اسم السيارة" : "اختر نوع السيارة أولاً";
    carNameSelect.appendChild(placeholder);

    if (!type) {
      carNameSelect.value = "";
      carNameSelect.disabled = true;
      return;
    }

    const names = carNamesByType[type] || [];
    names.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      carNameSelect.appendChild(option);
    });

    if (selectedCanonical && !names.includes(selectedCanonical)) {
      const customOption = document.createElement("option");
      customOption.value = selectedCanonical;
      customOption.textContent = selectedCanonical;
      carNameSelect.appendChild(customOption);
    }

    carNameSelect.disabled = false;
    carNameSelect.value = selectedCanonical || "";
  }

  function resetForm() {
    idField.value = "";
    form.reset();
    form.modelYear.max = String(currentYear);
    setCarNameOptions("");
    customerIdHidden.value = "";
    resolvedSpec = null;
    renderSpecStatus("اختر نوع السيارة واسمها وسنة الموديل لعرض المواصفات المعتمدة.");
    formTitle.textContent = "إضافة سيارة لعميل";
    submitBtn.textContent = "إضافة السيارة";
    cancelBtn.style.display = "none";
  }

  function normalizeName(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizePhone(value) {
    return String(value || "").replace(/\s+/g, "").trim();
  }

  function resolveCustomerFromIdentity(name, phone) {
    const normalizedName = normalizeName(name);
    const normalizedPhone = normalizePhone(phone);

    if (!normalizedName || !normalizedPhone) {
      return {
        customer: null,
        error: "يرجى إدخال الاسم الثلاثي ورقم الجوال للعميل."
      };
    }

    const matches = customers.filter(
      (customer) =>
        normalizeName(customer.fullName) === normalizedName &&
        normalizePhone(customer.phone) === normalizedPhone
    );

    if (matches.length === 1) {
      return { customer: matches[0], error: null };
    }

    if (matches.length > 1) {
      return {
        customer: null,
        error: "يوجد أكثر من حساب بنفس البيانات المدخلة. يرجى مراجعة حسابات العملاء."
      };
    }

    return {
      customer: null,
      error: "لا يوجد عميل مطابق للاسم الثلاثي ورقم الجوال."
    };
  }

  function tryAutoFillByNameOrPhone() {
    const normalizedName = normalizeName(customerNameInput.value);
    const normalizedPhone = normalizePhone(customerPhoneInput.value);

    if (normalizedName && !normalizedPhone) {
      const byName = customers.filter(
        (customer) => normalizeName(customer.fullName) === normalizedName
      );
      if (byName.length === 1) {
        customerPhoneInput.value = byName[0].phone;
      }
      return;
    }

    if (!normalizedName && normalizedPhone) {
      const byPhone = customers.filter(
        (customer) => normalizePhone(customer.phone) === normalizedPhone
      );
      if (byPhone.length === 1) {
        customerNameInput.value = byPhone[0].fullName;
      }
    }
  }

  function syncCustomerReferenceFromInputs(strict = false) {
    tryAutoFillByNameOrPhone();

    const result = resolveCustomerFromIdentity(customerNameInput.value, customerPhoneInput.value);
    customerIdHidden.value = result.customer ? result.customer._id : "";

    if (!strict && !customerNameInput.value.trim() && !customerPhoneInput.value.trim()) {
      return { customer: null, error: null };
    }

    return result;
  }

  function fillForm(car) {
    idField.value = car._id;
    customerNameInput.value = car.customer?.fullName || "";
    customerPhoneInput.value = car.customer?.phone || "";
    customerIdHidden.value = car.customer?._id || "";

    const resolvedCarName = toCanonicalCarName(car.carName);
    const resolvedCarType = car.carType || findTypeByCarName(resolvedCarName);

    ensureCarTypeOption(resolvedCarType);
    form.carType.value = resolvedCarType || "";
    setCarNameOptions(resolvedCarType, resolvedCarName);

    form.modelYear.value = car.modelYear || "";
    form.vin.value = car.vin || "";
    form.color.value = car.color || "";
    form.purchaseDate.value = toInputDate(car.purchaseDate);
    form.price.value = car.price ?? "";
    form.currency.value = car.currency || "";
    form.warrantyUntil.value = toInputDate(car.warrantyUntil);
    form.notes.value = car.notes || "";
    resolvedSpec = car.specSnapshot || null;
    renderSpecPreview(resolvedSpec);

    formTitle.textContent = "تعديل سيارة عميل";
    submitBtn.textContent = "حفظ التعديلات";
    cancelBtn.style.display = "inline-flex";
    window.scrollTo({ top: 0, behavior: "smooth" });
    refreshSpecPreview();
  }

  function renderCustomerOptions() {
    customerNamesList.innerHTML = "";
    customerPhonesList.innerHTML = "";

    customers.forEach((customer) => {
      const nameOption = document.createElement("option");
      nameOption.value = customer.fullName;
      customerNamesList.appendChild(nameOption);

      const phoneOption = document.createElement("option");
      phoneOption.value = customer.phone;
      customerPhonesList.appendChild(phoneOption);
    });

    const disabled = customers.length === 0;
    customerNameInput.disabled = disabled;
    customerPhoneInput.disabled = disabled;
    submitBtn.disabled = disabled;
    emptyCustomersNotice.style.display = disabled ? "block" : "none";
  }

  function renderRows() {
    if (!cars.length) {
      tableBody.innerHTML = '<tr><td colspan="8" class="empty">لا توجد سيارات عملاء مضافة.</td></tr>';
      return;
    }

    tableBody.innerHTML = cars
      .map((car) => {
        const purchaseDate = car.purchaseDate
          ? new Date(car.purchaseDate).toLocaleDateString("ar-SY")
          : "-";
        const canonicalName = toCanonicalCarName(car.carName);

        return `
          <tr>
            <td>${escapeHtml(car.customer?.fullName || "-")}</td>
            <td>${escapeHtml(car.carType || "-")}</td>
            <td>${escapeHtml(canonicalName || "-")}</td>
            <td>${escapeHtml(car.modelYear)}</td>
            <td>${escapeHtml(car.vin)}</td>
            <td>${escapeHtml(car.price)} ${escapeHtml(car.currency)}</td>
            <td>${escapeHtml(purchaseDate)}</td>
            <td class="actions">
              <button class="btn btn-sm" data-action="edit" data-id="${car._id}">تعديل</button>
              <button class="btn btn-sm btn-danger" data-action="delete" data-id="${car._id}">حذف</button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  async function loadCustomers() {
    const response = await apiRequest("/api/admin/customers/options");
    customers = response.data || [];
    renderCustomerOptions();
  }

  async function loadCars() {
    const response = await apiRequest("/api/admin/customer-cars");
    cars = response.data || [];
    renderRows();
  }

  function validateForm() {
    const customerName = normalizeName(customerNameInput.value);
    const customerPhone = normalizePhone(customerPhoneInput.value);
    const canonicalCarName = toCanonicalCarName(form.carName.value);

    const requiredFields = [
      customerName,
      customerPhone,
      form.carType.value,
      canonicalCarName,
      form.modelYear.value,
      form.vin.value,
      form.color.value,
      form.purchaseDate.value,
      form.price.value,
      form.currency.value
    ];

    if (requiredFields.some((item) => !String(item || "").trim())) {
      throw new Error("لا يمكن ترك الحقول المطلوبة فارغة.");
    }

    const customerResult = syncCustomerReferenceFromInputs(true);
    if (!customerResult.customer) {
      throw new Error(customerResult.error || "تعذر التحقق من العميل.");
    }

    const price = Number(form.price.value);
    const modelYear = Number(form.modelYear.value);

    if (Number.isNaN(price) || price < 0) {
      throw new Error("السعر لا يقبل قيماً سالبة.");
    }

    if (!Number.isInteger(modelYear) || modelYear < 2020 || modelYear > currentYear) {
      throw new Error(`سنة الموديل يجب أن تكون بين 2020 و ${currentYear}.`);
    }

    if (!resolvedSpec) {
      throw new Error("لا يمكن حفظ السيارة قبل جلب المواصفات المعتمدة من قاعدة البيانات.");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    try {
      validateForm();

      const payload = {
        customerId: customerIdHidden.value,
        customerFullName: normalizeName(customerNameInput.value),
        customerPhone: normalizePhone(customerPhoneInput.value),
        carType: form.carType.value,
        carName: toCanonicalCarName(form.carName.value),
        modelYear: form.modelYear.value,
        vin: form.vin.value,
        color: form.color.value,
        purchaseDate: form.purchaseDate.value,
        price: form.price.value,
        currency: form.currency.value,
        warrantyUntil: form.warrantyUntil.value,
        notes: form.notes.value
      };

      const id = idField.value;
      const isEdit = Boolean(id);
      const url = isEdit ? `/api/admin/customer-cars/${id}` : "/api/admin/customer-cars";
      const method = isEdit ? "PUT" : "POST";

      const response = await apiRequest(url, {
        method,
        body: JSON.stringify(payload)
      });

      showMessage(response.message || "تمت العملية بنجاح.");
      resetForm();
      await loadCars();
    } catch (error) {
      showMessage(error.message, "error");
    }
  });

  cancelBtn.addEventListener("click", () => {
    clearMessage();
    resetForm();
  });

  customerNameInput.addEventListener("input", () => {
    customerIdHidden.value = "";
  });

  customerPhoneInput.addEventListener("input", () => {
    customerIdHidden.value = "";
  });

  customerNameInput.addEventListener("blur", () => {
    syncCustomerReferenceFromInputs(false);
  });

  customerPhoneInput.addEventListener("blur", () => {
    syncCustomerReferenceFromInputs(false);
  });

  carTypeSelect.addEventListener("change", () => {
    setCarNameOptions(carTypeSelect.value);
    refreshSpecPreview();
  });

  carNameSelect.addEventListener("change", () => {
    refreshSpecPreview();
  });

  form.modelYear.addEventListener("input", () => {
    refreshSpecPreview();
  });

  tableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    const id = button.getAttribute("data-id");
    const action = button.getAttribute("data-action");
    const car = cars.find((item) => item._id === id);
    if (!car) {
      return;
    }

    if (action === "edit") {
      clearMessage();
      fillForm(car);
      return;
    }

    if (action === "delete") {
      const confirmed = window.confirm("هل تريد حذف سيارة العميل؟");
      if (!confirmed) {
        return;
      }

      try {
        const response = await apiRequest(`/api/admin/customer-cars/${id}`, {
          method: "DELETE"
        });
        showMessage(response.message || "تم الحذف بنجاح.");
        if (idField.value === id) {
          resetForm();
        }
        await loadCars();
      } catch (error) {
        showMessage(error.message, "error");
      }
    }
  });

  resetForm();
  await loadCustomers();
  await loadCars();
});

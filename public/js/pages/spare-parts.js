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

  const form = document.getElementById("sparePartForm");
  const formTitle = document.getElementById("sparePartFormTitle");
  const submitBtn = document.getElementById("sparePartSubmitBtn");
  const cancelBtn = document.getElementById("sparePartCancelEditBtn");
  const idField = document.getElementById("sparePartId");
  const tableBody = document.getElementById("sparePartsTableBody");
  const currentYear = new Date().getFullYear();

  const carNameOptions = {
    "سيدان": ["Elantra", "Sonata", "Accent", "Azera"],
    SUV: ["Tucson", "Santa Fe", "Palisade", "Creta"],
    "كروس أوفر": ["Kona", "Venue", "Bayon"],
    "هاتشباك": ["i10", "i20", "Veloster"],
    "كهربائية/هجين": ["IONIQ 5", "IONIQ 6", "Kona Electric", "Santa Fe Hybrid"],
    فان: ["Staria", "H-1"],
    "بيك أب": ["Santa Cruz"]
  };

  let spareParts = [];

  function getCompatibilityLabel(part) {
    if (part.carType && part.carName && part.modelYearFrom && part.modelYearTo) {
      return `${part.carType} - ${part.carName} (${part.modelYearFrom}-${part.modelYearTo})`;
    }
    return part.compatibleModels || "-";
  }

  function populateCarNameOptions(selectedType, selectedName = "") {
    const carNameSelect = form.carName;
    const models = carNameOptions[selectedType] || [];

    carNameSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = selectedType ? "اختر" : "اختر نوع السيارة أولاً";
    carNameSelect.appendChild(placeholder);

    models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model;
      option.textContent = model;
      carNameSelect.appendChild(option);
    });

    if (selectedName) {
      const hasSelected = models.includes(selectedName);
      if (!hasSelected) {
        const customOption = document.createElement("option");
        customOption.value = selectedName;
        customOption.textContent = selectedName;
        carNameSelect.appendChild(customOption);
      }
      carNameSelect.value = selectedName;
    } else {
      carNameSelect.value = "";
    }
  }

  function resetForm() {
    idField.value = "";
    form.reset();
    form.modelYearFrom.max = String(currentYear);
    form.modelYearTo.max = String(currentYear);
    populateCarNameOptions("");
    formTitle.textContent = "إضافة قطعة غيار";
    submitBtn.textContent = "إضافة القطعة";
    cancelBtn.style.display = "none";
  }

  function fillForm(part) {
    idField.value = part._id;
    form.name.value = part.name || "";
    form.partNumber.value = part.partNumber || "";
    form.price.value = part.price ?? "";
    form.currency.value = part.currency || "";
    form.stock.value = part.stock ?? "";
    form.carType.value = part.carType || "";
    populateCarNameOptions(part.carType || "", part.carName || "");
    form.modelYearFrom.value = part.modelYearFrom ?? "";
    form.modelYearTo.value = part.modelYearTo ?? "";
    form.origin.value = part.origin || "";
    form.description.value = part.description || "";
    formTitle.textContent = "تعديل قطعة غيار";
    submitBtn.textContent = "حفظ التعديلات";
    cancelBtn.style.display = "inline-flex";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderRows() {
    if (!spareParts.length) {
      tableBody.innerHTML = '<tr><td colspan="8" class="empty">لا توجد قطع غيار مسجلة.</td></tr>';
      return;
    }

    tableBody.innerHTML = spareParts
      .map(
        (part) => `
          <tr>
            <td>${escapeHtml(part.name)}</td>
            <td>${escapeHtml(part.partNumber)}</td>
            <td>${escapeHtml(part.price)} ${escapeHtml(part.currency)}</td>
            <td>${escapeHtml(part.stock)}</td>
            <td>${escapeHtml(part.carType || "-")}</td>
            <td>${escapeHtml(part.carName || "-")}</td>
            <td>${escapeHtml(getCompatibilityLabel(part))}</td>
            <td class="actions">
              <button class="btn btn-sm" data-action="edit" data-id="${part._id}">تعديل</button>
              <button class="btn btn-sm btn-danger" data-action="delete" data-id="${part._id}">حذف</button>
            </td>
          </tr>
        `
      )
      .join("");
  }

  async function loadSpareParts() {
    const response = await apiRequest("/api/admin/spare-parts");
    spareParts = response.data || [];
    renderRows();
  }

  function validateForm() {
    const requiredFields = [
      form.name.value,
      form.partNumber.value,
      form.price.value,
      form.currency.value,
      form.stock.value,
      form.carType.value,
      form.carName.value,
      form.modelYearFrom.value,
      form.modelYearTo.value,
      form.origin.value,
      form.description.value
    ];

    if (requiredFields.some((item) => !String(item || "").trim())) {
      throw new Error("لا يمكن ترك الحقول المطلوبة فارغة.");
    }

    const price = Number(form.price.value);
    const stock = Number(form.stock.value);
    const modelYearFrom = Number(form.modelYearFrom.value);
    const modelYearTo = Number(form.modelYearTo.value);

    if (Number.isNaN(price) || price < 0 || Number.isNaN(stock) || stock < 0) {
      throw new Error("لا يمكن إدخال قيم سالبة.");
    }

    if (!Number.isInteger(stock)) {
      throw new Error("الكمية المتوفرة يجب أن تكون رقماً صحيحاً.");
    }

    const modelYearsValid =
      Number.isInteger(modelYearFrom) &&
      Number.isInteger(modelYearTo) &&
      modelYearFrom >= 2020 &&
      modelYearTo >= 2020 &&
      modelYearFrom <= currentYear &&
      modelYearTo <= currentYear;

    if (!modelYearsValid) {
      throw new Error(`سنوات الموديل يجب أن تكون بين 2020 و ${currentYear}.`);
    }

    if (modelYearFrom > modelYearTo) {
      throw new Error("سنة البداية يجب ألا تكون أكبر من سنة النهاية.");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    try {
      validateForm();

      const payload = {
        name: form.name.value,
        partNumber: form.partNumber.value,
        price: form.price.value,
        currency: form.currency.value,
        stock: form.stock.value,
        carType: form.carType.value,
        carName: form.carName.value,
        modelYearFrom: form.modelYearFrom.value,
        modelYearTo: form.modelYearTo.value,
        origin: form.origin.value,
        description: form.description.value
      };

      const id = idField.value;
      const isEdit = Boolean(id);
      const url = isEdit ? `/api/admin/spare-parts/${id}` : "/api/admin/spare-parts";
      const method = isEdit ? "PUT" : "POST";

      const response = await apiRequest(url, {
        method,
        body: JSON.stringify(payload)
      });

      showMessage(response.message || "تمت العملية بنجاح.");
      resetForm();
      await loadSpareParts();
    } catch (error) {
      showMessage(error.message, "error");
    }
  });

  cancelBtn.addEventListener("click", () => {
    clearMessage();
    resetForm();
  });

  form.carType.addEventListener("change", () => {
    populateCarNameOptions(form.carType.value);
  });

  tableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    const id = button.getAttribute("data-id");
    const action = button.getAttribute("data-action");
    const part = spareParts.find((item) => item._id === id);
    if (!part) {
      return;
    }

    if (action === "edit") {
      clearMessage();
      fillForm(part);
      return;
    }

    if (action === "delete") {
      const confirmed = window.confirm("هل تريد حذف قطعة الغيار؟");
      if (!confirmed) {
        return;
      }

      try {
        const response = await apiRequest(`/api/admin/spare-parts/${id}`, {
          method: "DELETE"
        });
        showMessage(response.message || "تم الحذف بنجاح.");
        if (idField.value === id) {
          resetForm();
        }
        await loadSpareParts();
      } catch (error) {
        showMessage(error.message, "error");
      }
    }
  });

  resetForm();
  await loadSpareParts();
});

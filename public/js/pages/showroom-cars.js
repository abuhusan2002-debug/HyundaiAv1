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

  const form = document.getElementById("showroomCarForm");
  const formTitle = document.getElementById("showroomCarFormTitle");
  const submitBtn = document.getElementById("showroomCarSubmitBtn");
  const cancelBtn = document.getElementById("showroomCarCancelEditBtn");
  const idField = document.getElementById("showroomCarId");
  const tableBody = document.getElementById("showroomCarsTableBody");
  const imagePreview = document.getElementById("showroomImagePreview");

  const currentYear = new Date().getFullYear();
  const maxImageSizeBytes = 5 * 1024 * 1024;
  const maxImagesCount = 10;

  let cars = [];
  let editingImageUrls = [];
  let stagedImageDataUrls = [];

  function normalizeImageUrls(car) {
    const imageUrls = Array.isArray(car?.imageUrls) ? car.imageUrls : [];
    const legacy = String(car?.imageUrl || "").trim();
    const all = legacy ? [...imageUrls, legacy] : imageUrls;
    return Array.from(
      new Set(
        all
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      )
    );
  }

  function renderImagePreview() {
    const cards = [];

    editingImageUrls.forEach((url, index) => {
      cards.push(`
        <div class="showroom-image-item">
          <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
            <img src="${escapeHtml(url)}" alt="صورة السيارة ${index + 1}" />
          </a>
          <button
            class="btn btn-sm btn-danger showroom-image-remove"
            type="button"
            data-remove-existing-index="${index}"
          >
            حذف
          </button>
        </div>
      `);
    });

    stagedImageDataUrls.forEach((dataUrl, index) => {
      cards.push(`
        <div class="showroom-image-item">
          <img src="${escapeHtml(dataUrl)}" alt="صورة جديدة ${index + 1}" />
          <button
            class="btn btn-sm btn-danger showroom-image-remove"
            type="button"
            data-remove-staged-index="${index}"
          >
            حذف
          </button>
        </div>
      `);
    });

    if (!cards.length) {
      imagePreview.classList.add("muted");
      imagePreview.textContent = "لا توجد صور مرفوعة.";
      return;
    }

    imagePreview.classList.remove("muted");
    imagePreview.innerHTML = `<div class="showroom-image-grid">${cards.join("")}</div>`;
  }

  function resetForm() {
    idField.value = "";
    form.reset();
    form.available.checked = true;
    formTitle.textContent = "إضافة سيارة جديدة للمعرض";
    submitBtn.textContent = "إضافة السيارة";
    cancelBtn.style.display = "none";
    editingImageUrls = [];
    stagedImageDataUrls = [];
    renderImagePreview();
  }

  function fillForm(car) {
    idField.value = car._id;
    form.name.value = car.name || "";
    form.modelYear.value = car.modelYear || "";
    form.category.value = car.category || "";
    form.price.value = car.price ?? "";
    form.currency.value = car.currency || "";
    form.quantity.value = car.quantity ?? "";
    form.description.value = car.description || "";
    form.available.checked = Boolean(car.available);
    form.imageFiles.value = "";
    editingImageUrls = normalizeImageUrls(car);
    stagedImageDataUrls = [];

    formTitle.textContent = "تعديل سيارة المعرض";
    submitBtn.textContent = "حفظ التعديلات";
    cancelBtn.style.display = "inline-flex";
    renderImagePreview();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderRows() {
    if (!cars.length) {
      tableBody.innerHTML =
        '<tr><td colspan="7" class="empty">لا توجد سيارات في المعرض حتى الآن.</td></tr>';
      return;
    }

    tableBody.innerHTML = cars
      .map((car) => {
        const imageCount = normalizeImageUrls(car).length;
        return `
          <tr>
            <td>${escapeHtml(car.name)}</td>
            <td>${escapeHtml(car.modelYear)}</td>
            <td>${escapeHtml(car.category)}</td>
            <td>${escapeHtml(car.price)} ${escapeHtml(car.currency)}</td>
            <td>${escapeHtml(car.quantity)}</td>
            <td>${car.available ? "متاح" : "غير متاح"}${imageCount ? ` (${imageCount} صور)` : ""}</td>
            <td class="actions">
              <button class="btn btn-sm" data-action="edit" data-id="${car._id}">تعديل</button>
              <button class="btn btn-sm btn-danger" data-action="delete" data-id="${car._id}">حذف</button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  async function loadCars() {
    const response = await apiRequest("/api/admin/showroom-cars");
    cars = response.data || [];
    renderRows();
  }

  function validateSelectedImage(file) {
    if (!file) {
      return;
    }

    const allowedTypes = new Set(["image/png", "image/jpeg"]);
    if (!allowedTypes.has(file.type)) {
      throw new Error("صيغة الصورة غير مدعومة. استخدم PNG أو JPG أو JPEG.");
    }

    if (file.size > maxImageSizeBytes) {
      throw new Error("حجم الصورة كبير. الحد الأقصى المسموح 5MB لكل صورة.");
    }
  }

  function validateImageDataUrls(dataUrls) {
    if (!Array.isArray(dataUrls)) {
      throw new Error("بيانات الصور غير صحيحة.");
    }

    const invalid = dataUrls.find((item) => !/^data:image\/(png|jpeg|jpg);base64,/i.test(item));
    if (invalid) {
      throw new Error("صيغة الصورة غير مدعومة. استخدم PNG أو JPG أو JPEG.");
    }
  }

  function validateForm() {
    const requiredFields = [
      form.name.value,
      form.modelYear.value,
      form.category.value,
      form.price.value,
      form.currency.value,
      form.quantity.value,
      form.description.value
    ];

    if (requiredFields.some((item) => !String(item || "").trim())) {
      throw new Error("لا يمكن ترك الحقول المطلوبة فارغة.");
    }

    const price = Number(form.price.value);
    const quantity = Number(form.quantity.value);
    const modelYear = Number(form.modelYear.value);

    if (Number.isNaN(price) || price < 0 || Number.isNaN(quantity) || quantity < 0) {
      throw new Error("لا يمكن إدخال قيم سالبة.");
    }

    if (!Number.isInteger(modelYear) || modelYear < 2020 || modelYear > currentYear) {
      throw new Error(`سنة الموديل يجب أن تكون بين 2020 و ${currentYear}.`);
    }

    const totalImages = editingImageUrls.length + stagedImageDataUrls.length;
    if (totalImages > maxImagesCount) {
      throw new Error(`لا يمكن رفع أكثر من ${maxImagesCount} صور لكل سيارة.`);
    }

    validateImageDataUrls(stagedImageDataUrls);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("تعذر قراءة ملف الصورة."));
      reader.readAsDataURL(file);
    });
  }

  async function addSelectedFiles(files) {
    const incomingFiles = Array.from(files || []);
    if (!incomingFiles.length) {
      return;
    }

    for (const file of incomingFiles) {
      validateSelectedImage(file);
    }

    const nextTotalCount = editingImageUrls.length + stagedImageDataUrls.length + incomingFiles.length;
    if (nextTotalCount > maxImagesCount) {
      throw new Error(`لا يمكن رفع أكثر من ${maxImagesCount} صور لكل سيارة.`);
    }

    const dataUrls = [];
    for (const file of incomingFiles) {
      dataUrls.push(await readFileAsDataUrl(file));
    }

    stagedImageDataUrls = [...stagedImageDataUrls, ...dataUrls];
  }

  form.imageFiles.addEventListener("change", async () => {
    clearMessage();
    try {
      await addSelectedFiles(form.imageFiles.files);
      form.imageFiles.value = "";
      renderImagePreview();
    } catch (error) {
      form.imageFiles.value = "";
      showMessage(error.message, "error");
    }
  });

  imagePreview.addEventListener("click", (event) => {
    const removeExisting = event.target.closest("[data-remove-existing-index]");
    if (removeExisting) {
      const index = Number(removeExisting.getAttribute("data-remove-existing-index"));
      if (Number.isInteger(index) && index >= 0) {
        editingImageUrls = editingImageUrls.filter((_, i) => i !== index);
        renderImagePreview();
      }
      return;
    }

    const removeStaged = event.target.closest("[data-remove-staged-index]");
    if (removeStaged) {
      const index = Number(removeStaged.getAttribute("data-remove-staged-index"));
      if (Number.isInteger(index) && index >= 0) {
        stagedImageDataUrls = stagedImageDataUrls.filter((_, i) => i !== index);
        renderImagePreview();
      }
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    try {
      validateForm();

      const payload = {
        name: form.name.value,
        modelYear: form.modelYear.value,
        category: form.category.value,
        price: form.price.value,
        currency: form.currency.value,
        quantity: form.quantity.value,
        description: form.description.value,
        available: form.available.checked,
        existingImageUrls: editingImageUrls,
        imageDataUrls: stagedImageDataUrls
      };

      const id = idField.value;
      const isEdit = Boolean(id);
      const url = isEdit ? `/api/admin/showroom-cars/${id}` : "/api/admin/showroom-cars";
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
      const confirmed = window.confirm("هل تريد حذف سيارة المعرض؟");
      if (!confirmed) {
        return;
      }

      try {
        const response = await apiRequest(`/api/admin/showroom-cars/${id}`, {
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
  await loadCars();
});

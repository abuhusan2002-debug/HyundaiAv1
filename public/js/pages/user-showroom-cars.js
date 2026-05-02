document.addEventListener("DOMContentLoaded", async () => {
  const { ensureUserAuthenticated, activateNav, bindLogout, apiRequest, showMessage, escapeHtml } =
    window.UserCommon;

  const customer = await ensureUserAuthenticated();
  if (!customer) {
    return;
  }

  activateNav();
  bindLogout();

  const searchForm = document.getElementById("showroomSearchForm");
  const searchInput = document.getElementById("showroomSearchInput");
  const categorySelect = document.getElementById("showroomCategory");
  const grid = document.getElementById("showroomCarsGrid");

  const galleryModal = document.getElementById("showroomGalleryModal");
  const galleryTitle = document.getElementById("showroomGalleryTitle");
  const galleryImage = document.getElementById("showroomGalleryImage");
  const galleryCounter = document.getElementById("showroomGalleryCounter");
  const galleryThumbs = document.getElementById("showroomGalleryThumbs");
  const galleryCloseBtn = document.getElementById("showroomGalleryCloseBtn");
  const galleryPrevBtn = document.getElementById("showroomGalleryPrevBtn");
  const galleryNextBtn = document.getElementById("showroomGalleryNextBtn");

  let galleryImages = [];
  let galleryTitleText = "";
  let galleryIndex = 0;

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

  function renderGallery() {
    if (!galleryImages.length) {
      galleryImage.removeAttribute("src");
      galleryImage.alt = "لا توجد صور";
      galleryCounter.textContent = "لا توجد صور";
      galleryThumbs.innerHTML = "";
      return;
    }

    const safeIndex = ((galleryIndex % galleryImages.length) + galleryImages.length) % galleryImages.length;
    galleryIndex = safeIndex;

    galleryImage.src = galleryImages[safeIndex];
    galleryImage.alt = `${galleryTitleText} - صورة ${safeIndex + 1}`;
    galleryCounter.textContent = `الصورة ${safeIndex + 1} من ${galleryImages.length}`;

    galleryThumbs.innerHTML = galleryImages
      .map(
        (url, index) => `
          <button
            type="button"
            class="showroom-gallery-thumb ${index === safeIndex ? "active" : ""}"
            data-gallery-index="${index}"
          >
            <img src="${escapeHtml(url)}" alt="صورة مصغرة ${index + 1}" />
          </button>
        `
      )
      .join("");
  }

  function openGallery(title, images, startIndex = 0) {
    galleryTitleText = String(title || "صور السيارة");
    galleryImages = Array.isArray(images) ? images.filter(Boolean) : [];
    galleryIndex = Number.isInteger(startIndex) ? startIndex : 0;
    galleryTitle.textContent = galleryTitleText;
    galleryModal.style.display = "flex";
    renderGallery();
  }

  function closeGallery() {
    galleryModal.style.display = "none";
    galleryImages = [];
    galleryIndex = 0;
    galleryTitleText = "";
    galleryThumbs.innerHTML = "";
  }

  function renderCards(cars) {
    if (!cars.length) {
      grid.innerHTML =
        '<p class="empty-state">لا توجد سيارات متاحة في المعرض حالياً حسب البحث الحالي.</p>';
      return;
    }

    grid.innerHTML = cars
      .map((car) => {
        const images = normalizeImageUrls(car);
        const firstImage = images[0] || "";
        const imageHtml = firstImage
          ? `<img src="${escapeHtml(firstImage)}" alt="${escapeHtml(car.name)}" />`
          : '<div class="showroom-card-placeholder">Hyundai</div>';
        const galleryButtonHtml = images.length
          ? `<button class="btn btn-sm showroom-gallery-open-btn" type="button" data-gallery-car-id="${car._id}">عرض الصور (${images.length})</button>`
          : "";

        const imageContainerAttrs = images.length ? `data-gallery-car-id="${car._id}"` : "";

        return `
          <article class="showroom-user-card">
            <div class="showroom-card-image" ${imageContainerAttrs}>${imageHtml}</div>
            <div class="showroom-card-body">
              <div class="showroom-card-head">
                <h3>${escapeHtml(car.name || "-")}</h3>
                <span>${escapeHtml(car.modelYear || "-")}</span>
              </div>
              <p class="muted">${escapeHtml(car.category || "-")}</p>
              <p class="showroom-price">${escapeHtml(car.price || 0)} ${escapeHtml(car.currency || "")}</p>
              <p class="muted">الكمية المتاحة: ${escapeHtml(car.quantity ?? 0)}</p>
              <p>${escapeHtml(car.description || "-")}</p>
              ${galleryButtonHtml}
            </div>
          </article>
        `;
      })
      .join("");
  }

  let lastRenderedCars = [];

  async function loadCars() {
    try {
      const query = new URLSearchParams();
      const q = String(searchInput.value || "").trim();
      const category = String(categorySelect.value || "").trim();

      if (q) {
        query.set("q", q);
      }
      if (category && category !== "all") {
        query.set("category", category);
      }

      const suffix = query.toString() ? `?${query.toString()}` : "";
      const response = await apiRequest(`/api/user/showroom-cars${suffix}`);
      const data = response.data || {};
      const cars = Array.isArray(data.cars) ? data.cars : [];
      const categories = Array.isArray(data.categories) ? data.categories : [];

      if (categorySelect.options.length <= 1) {
        categories.forEach((item) => {
          const option = document.createElement("option");
          option.value = item;
          option.textContent = item;
          categorySelect.appendChild(option);
        });
      }

      lastRenderedCars = cars;
      renderCards(cars);
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await loadCars();
  });

  categorySelect.addEventListener("change", async () => {
    await loadCars();
  });

  grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-gallery-car-id]");
    if (!button) {
      return;
    }

    const carId = button.getAttribute("data-gallery-car-id");
    const car = lastRenderedCars.find((item) => item._id === carId);
    if (!car) {
      return;
    }

    const images = normalizeImageUrls(car);
    if (!images.length) {
      return;
    }

    openGallery(car.name || "صور السيارة", images, 0);
  });

  galleryCloseBtn.addEventListener("click", closeGallery);
  galleryModal.addEventListener("click", (event) => {
    if (event.target === galleryModal) {
      closeGallery();
    }
  });

  galleryPrevBtn.addEventListener("click", () => {
    galleryIndex -= 1;
    renderGallery();
  });

  galleryNextBtn.addEventListener("click", () => {
    galleryIndex += 1;
    renderGallery();
  });

  galleryThumbs.addEventListener("click", (event) => {
    const thumb = event.target.closest("[data-gallery-index]");
    if (!thumb) {
      return;
    }
    const index = Number(thumb.getAttribute("data-gallery-index"));
    if (!Number.isInteger(index)) {
      return;
    }
    galleryIndex = index;
    renderGallery();
  });

  document.addEventListener("keydown", (event) => {
    if (galleryModal.style.display !== "flex") {
      return;
    }
    if (event.key === "Escape") {
      closeGallery();
      return;
    }
    if (event.key === "ArrowLeft") {
      galleryIndex -= 1;
      renderGallery();
      return;
    }
    if (event.key === "ArrowRight") {
      galleryIndex += 1;
      renderGallery();
    }
  });

  await loadCars();
});

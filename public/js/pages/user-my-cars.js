document.addEventListener("DOMContentLoaded", async () => {
  const { ensureUserAuthenticated, activateNav, bindLogout, apiRequest, showMessage, escapeHtml } =
    window.UserCommon;

  const customer = await ensureUserAuthenticated();
  if (!customer) {
    return;
  }

  activateNav();
  bindLogout();

  const customerName = document.getElementById("myCarsCustomerName");
  if (customerName) {
    customerName.textContent = customer.fullName || "";
  }

  const listContainer = document.getElementById("myCarsList");

  function buildSpecs(specSnapshot) {
    const spec = specSnapshot || {};
    const safetyList = Array.isArray(spec.key_safety_features) ? spec.key_safety_features : [];
    const legacyPowerMatch = String(spec.power || "").match(/\d+(\.\d+)?/);

    const powerHp = Number.isFinite(spec.power_hp)
      ? spec.power_hp
      : legacyPowerMatch
        ? Number(legacyPowerMatch[0])
        : null;

    return [
      { label: "المحرك", value: spec.engine },
      {
        label: "القدرة (حصان)",
        value: Number.isFinite(powerHp) ? String(powerHp) : ""
      },
      {
        label: "العزم (نيوتن.متر)",
        value: Number.isFinite(spec.torque_nm) ? String(spec.torque_nm) : ""
      },
      { label: "ناقل الحركة", value: spec.transmission },
      { label: "نظام الدفع", value: spec.drivetrain },
      { label: "مصدر الطاقة", value: spec.energySource },
      { label: "الكفاءة/المدى", value: spec.efficiency },
      { label: "ميزات الأمان", value: safetyList.join("، ") }
    ].filter((item) => String(item.value || "").trim());
  }

  function renderCars(cars) {
    if (!cars.length) {
      listContainer.innerHTML = '<p class="empty-state">لا توجد مركبات مسجلة في حسابك حالياً.</p>';
      return;
    }

    listContainer.innerHTML = cars
      .map((car, index) => {
        const purchaseDate = car.purchaseDate
          ? new Date(car.purchaseDate).toLocaleDateString("ar-SY")
          : "-";

        const specItems = buildSpecs(car.specSnapshot);
        const hasSpecs = specItems.length > 0;
        const panelId = `carSpecPanel-${index}`;

        return `
          <article class="my-car-card">
            <div class="my-car-head">
              <h3>${escapeHtml(car.carName || "-")}</h3>
              <span>${escapeHtml(car.modelYear || "-")}</span>
            </div>

            <ul class="my-car-main-list">
              <li><strong>نوع السيارة:</strong> ${escapeHtml(car.carType || "-")}</li>
              <li><strong>VIN:</strong> ${escapeHtml(car.vin || "-")}</li>
              <li><strong>اللون:</strong> ${escapeHtml(car.color || "-")}</li>
              <li><strong>السعر:</strong> ${escapeHtml(car.price || 0)} ${escapeHtml(car.currency || "")}</li>
              <li><strong>تاريخ الشراء:</strong> ${escapeHtml(purchaseDate)}</li>
            </ul>

            <div class="my-car-actions">
              <button
                type="button"
                class="btn btn-sm my-car-spec-toggle"
                data-action="toggle-specs"
                data-target="${panelId}"
                aria-expanded="false"
                ${hasSpecs ? "" : "disabled"}
              >
                مواصفات السيارة
              </button>
            </div>

            <section id="${panelId}" class="my-car-spec-panel" hidden>
              <h4>مواصفات السيارة</h4>
              ${
                hasSpecs
                  ? `<ul class="my-car-spec-list">
                      ${specItems
                        .map(
                          (item) =>
                            `<li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}</li>`
                        )
                        .join("")}
                    </ul>`
                  : '<p class="muted">لا توجد مواصفات محفوظة لهذه السيارة حالياً.</p>'
              }
            </section>
          </article>
        `;
      })
      .join("");
  }

  listContainer?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action='toggle-specs']");
    if (!button || button.disabled) {
      return;
    }

    const panelId = button.getAttribute("data-target");
    const panel = document.getElementById(panelId);
    if (!panel) {
      return;
    }

    const isExpanded = button.getAttribute("aria-expanded") === "true";
    const nextExpanded = !isExpanded;

    panel.hidden = !nextExpanded;
    button.setAttribute("aria-expanded", String(nextExpanded));
    button.textContent = nextExpanded ? "إخفاء المواصفات" : "مواصفات السيارة";

    const card = button.closest(".my-car-card");
    if (card) {
      card.classList.toggle("specs-open", nextExpanded);
    }
  });

  try {
    const response = await apiRequest("/api/user/my-cars");
    renderCars(response.data || []);
  } catch (error) {
    showMessage(error.message, "error");
  }
});

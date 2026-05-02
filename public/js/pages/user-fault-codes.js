document.addEventListener("DOMContentLoaded", async () => {
  const { ensureUserAuthenticated, activateNav, bindLogout, apiRequest, showMessage, clearMessage, escapeHtml } =
    window.UserCommon;

  const customer = await ensureUserAuthenticated();
  if (!customer) {
    return;
  }

  activateNav();
  bindLogout();

  const form = document.getElementById("faultCodeSearchForm");
  const input = document.getElementById("faultCodeQuery");
  const hint = document.getElementById("faultCodeHint");
  const exactContainer = document.getElementById("faultCodeExactResult");
  const suggestionsContainer = document.getElementById("faultCodeSuggestions");

  function severityClass(value) {
    if (value === "عال") {
      return "high";
    }
    if (value === "منخفض") {
      return "low";
    }
    return "medium";
  }

  function renderCodeCard(codeItem, highlight = false) {
    const causes = (codeItem.possibleCauses || [])
      .map((cause) => `<li>${escapeHtml(cause)}</li>`)
      .join("");
    const fixes = (codeItem.suggestedFixes || [])
      .map((fix) => `<li>${escapeHtml(fix)}</li>`)
      .join("");

    return `
      <article class="fault-card ${highlight ? "exact" : ""}">
        <div class="fault-card-head">
          <div>
            <strong>${escapeHtml(codeItem.code)}</strong>
            <h3>${escapeHtml(codeItem.title)}</h3>
          </div>
          <span class="badge priority ${severityClass(codeItem.severity)}">${escapeHtml(
            codeItem.severity
          )}</span>
        </div>
        <p class="muted">النظام: ${escapeHtml(codeItem.system)}</p>
        <p>${escapeHtml(codeItem.description)}</p>
        <div class="fault-columns">
          <div>
            <h4>الأسباب المحتملة</h4>
            <ul>${causes || "<li>-</li>"}</ul>
          </div>
          <div>
            <h4>الحلول المقترحة</h4>
            <ul>${fixes || "<li>-</li>"}</ul>
          </div>
        </div>
        ${codeItem.notes ? `<p class="muted">ملاحظة: ${escapeHtml(codeItem.notes)}</p>` : ""}
      </article>
    `;
  }

  function renderResults(data) {
    const exact = data.exact || null;
    const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
    hint.textContent = data.message || "";

    if (exact) {
      exactContainer.innerHTML = renderCodeCard(exact, true);
    } else {
      exactContainer.innerHTML = "";
    }

    const secondary = suggestions.filter((item) => !exact || item.code !== exact.code);

    if (!secondary.length) {
      suggestionsContainer.innerHTML = exact
        ? ""
        : '<p class="empty-state">لا توجد نتائج مطابقة.</p>';
      return;
    }

    suggestionsContainer.innerHTML = secondary.map((item) => renderCodeCard(item)).join("");
  }

  async function loadCodes(query = "") {
    try {
      const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
      const response = await apiRequest(`/api/user/trouble-codes${suffix}`);
      renderResults(response.data || {});
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();
    const query = String(input.value || "").trim().toUpperCase();
    await loadCodes(query);
  });

  await loadCodes();
});

document.addEventListener("DOMContentLoaded", async () => {
  const {
    ensureUserAuthenticated,
    activateNav,
    bindLogout,
    apiRequest,
    showMessage,
    clearMessage,
    escapeHtml
  } = window.UserCommon;

  const customer = await ensureUserAuthenticated();
  if (!customer) {
    return;
  }

  activateNav();
  bindLogout();

  const form = document.getElementById("smartDiagnosisForm");
  const symptomsInput = document.getElementById("smartDiagnosisSymptoms");
  const submitBtn = document.getElementById("smartDiagnosisSubmitBtn");

  const resultCard = document.getElementById("smartDiagnosisResultCard");
  const resultStatus = document.getElementById("smartDiagnosisResultStatus");
  const resultText = document.getElementById("smartDiagnosisResultText");

  const openHistoryBtn = document.getElementById("openSmartDiagnosisHistoryBtn");
  const closeHistoryBtn = document.getElementById("closeSmartDiagnosisHistoryBtn");
  const historyModal = document.getElementById("smartDiagnosisHistoryModal");
  const historyList = document.getElementById("smartDiagnosisHistoryList");

  function formatDate(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "-";
    }
    return parsed.toLocaleString("ar-SY");
  }

  function getStatusView(status) {
    if (status === "accepted") {
      return { label: "مقبول", className: "ok" };
    }
    if (status === "rejected") {
      return { label: "مرفوض", className: "rejected" };
    }
    if (status === "clarification") {
      return { label: "توضيح مطلوب", className: "pending" };
    }
    return { label: "خطأ", className: "cancelled" };
  }

  function renderResult(status, text) {
    const view = getStatusView(status);
    resultCard.style.display = "block";
    resultStatus.textContent = view.label;
    resultStatus.className = `badge status ${view.className}`;
    resultText.innerHTML = escapeHtml(text || "-").replace(/\n/g, "<br>");
  }

  function toggleHistoryModal(visible) {
    if (!historyModal) {
      return;
    }
    historyModal.style.display = visible ? "flex" : "none";
  }

  function renderHistoryRows(items) {
    if (!historyList) {
      return;
    }

    if (!items.length) {
      historyList.innerHTML = '<p class="empty-state">لا يوجد سجل محادثات حتى الآن.</p>';
      return;
    }

    historyList.innerHTML = items
      .map((item) => {
        const statusView = getStatusView(item.status);
        return `
          <article class="smart-history-item">
            <div class="smart-history-head">
              <span class="badge status ${statusView.className}">${escapeHtml(statusView.label)}</span>
              <span class="muted">${escapeHtml(formatDate(item.createdAt))}</span>
            </div>
            <p><strong>السؤال:</strong> ${escapeHtml(item.question || "-")}</p>
            <p><strong>الرد:</strong> ${escapeHtml(item.response || "-")}</p>
          </article>
        `;
      })
      .join("");
  }

  async function loadHistory() {
    const response = await apiRequest("/api/user/smart-diagnosis/history?limit=30");
    renderHistoryRows(response.data || []);
  }

  openHistoryBtn?.addEventListener("click", async () => {
    clearMessage();
    try {
      await loadHistory();
      toggleHistoryModal(true);
    } catch (error) {
      showMessage(error.message, "error");
    }
  });

  closeHistoryBtn?.addEventListener("click", () => {
    toggleHistoryModal(false);
  });

  historyModal?.addEventListener("click", (event) => {
    if (event.target === historyModal) {
      toggleHistoryModal(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && historyModal?.style.display === "flex") {
      toggleHistoryModal(false);
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    const question = String(symptomsInput?.value || "").trim();
    if (!question) {
      showMessage("يرجى كتابة وصف واضح للمشكلة قبل التحليل.", "error");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "جاري التحليل...";

    try {
      const response = await apiRequest("/api/user/smart-diagnosis", {
        method: "POST",
        body: JSON.stringify({ question })
      });

      renderResult("accepted", response?.data?.answer || "تم استلام الرد.");
      showMessage("تم تنفيذ التشخيص بنجاح.");
      await loadHistory();
    } catch (error) {
      const errorText = error.message || "تعذر تنفيذ التشخيص الذكي حالياً.";
      renderResult("rejected", errorText);
      showMessage(errorText, "error");
      await loadHistory().catch(() => {});
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "تحليل";
    }
  });
});

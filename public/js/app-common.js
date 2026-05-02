(function initAppCommon() {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showMessage(text, type = "success") {
    const box = document.getElementById("flashMessage");
    if (!box) {
      alert(text);
      return;
    }

    box.className = `flash flash-${type === "error" ? "error" : "success"}`;
    box.textContent = text;
    box.style.display = "block";
  }

  function clearMessage() {
    const box = document.getElementById("flashMessage");
    if (!box) {
      return;
    }
    box.style.display = "none";
    box.textContent = "";
  }

  async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch (error) {
      payload = {};
    }

    if (!response.ok) {
      const message = payload.message || "حدث خطأ غير متوقع.";
      throw new Error(message);
    }

    return payload;
  }

  async function ensureAuthenticated() {
    try {
      await apiRequest("/api/auth/me");
      return true;
    } catch (error) {
      window.location.href = "/login";
      return false;
    }
  }

  async function logout() {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch (error) {
      // ignore
    }
    window.location.href = "/login";
  }

  function activateNav() {
    const links = document.querySelectorAll("[data-nav]");
    const current = window.location.pathname;
    links.forEach((link) => {
      if (link.getAttribute("href") === current) {
        link.classList.add("active");
      }
    });
  }

  function bindLogout() {
    const btn = document.getElementById("logoutBtn");
    if (!btn) {
      return;
    }
    btn.addEventListener("click", logout);
  }

  window.AppCommon = {
    escapeHtml,
    showMessage,
    clearMessage,
    apiRequest,
    ensureAuthenticated,
    activateNav,
    bindLogout
  };
})();

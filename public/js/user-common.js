(function initUserCommon() {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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
      throw new Error(payload.message || "حدث خطأ غير متوقع.");
    }

    return payload;
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

  async function ensureUserAuthenticated() {
    try {
      const auth = await apiRequest("/api/auth/me");
      if (auth.role === "user") {
        return auth.customer;
      }

      if (auth.role === "admin") {
        window.location.href = "/admin/dashboard";
        return null;
      }

      window.location.href = "/login";
      return null;
    } catch (error) {
      window.location.href = "/login";
      return null;
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
    const links = document.querySelectorAll("[data-user-nav]");
    const current = window.location.pathname;
    links.forEach((link) => {
      const href = link.getAttribute("href");
      if (href === current || (href && current.startsWith(`${href}/`))) {
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

  window.UserCommon = {
    escapeHtml,
    apiRequest,
    showMessage,
    clearMessage,
    ensureUserAuthenticated,
    activateNav,
    bindLogout
  };
})();

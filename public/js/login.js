document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const flash = document.getElementById("flashMessage");

  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = String(form.username.value || "").trim();
    const password = String(form.password.value || "").trim();

    if (!username || !password) {
      flash.className = "flash flash-error";
      flash.textContent = "يرجى إدخال اسم المستخدم وكلمة المرور.";
      flash.style.display = "block";
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "تعذر تسجيل الدخول.");
      }

      window.location.href = payload.redirectTo || "/login";
    } catch (error) {
      flash.className = "flash flash-error";
      flash.textContent = error.message;
      flash.style.display = "block";
    }
  });
});

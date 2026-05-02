document.addEventListener("DOMContentLoaded", async () => {
  const { ensureUserAuthenticated, activateNav, bindLogout } = window.UserCommon;

  const customer = await ensureUserAuthenticated();
  if (!customer) {
    return;
  }

  activateNav();
  bindLogout();

  const searchInput = document.getElementById("guideSearchInput");
  const cards = Array.from(document.querySelectorAll("[data-guide-search]"));
  const emptyState = document.getElementById("guideSearchEmpty");

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/\s+/g, " ")
      .trim();
  }

  function applyGuideSearch() {
    const query = normalizeText(searchInput?.value || "");
    let visibleCount = 0;

    cards.forEach((card) => {
      const cardText = normalizeText(card.textContent);
      const isVisible = !query || cardText.includes(query);
      card.style.display = isVisible ? "" : "none";
      if (isVisible) {
        visibleCount += 1;
      }
    });

    if (emptyState) {
      emptyState.style.display = visibleCount === 0 ? "block" : "none";
    }
  }

  searchInput?.addEventListener("input", applyGuideSearch);
});

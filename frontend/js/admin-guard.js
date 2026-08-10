(async () => {
  try {
    const response = await fetch("/api/admin/session", {
      cache: "no-store",
      credentials: "same-origin",
    });
    const data = await response.json();
    if (!data.authenticated) {
      window.location.replace(`/admin-login.html?next=${encodeURIComponent(window.location.pathname)}`);
    }
  } catch {
    window.location.replace(`/admin-login.html?next=${encodeURIComponent(window.location.pathname)}`);
  }
})();

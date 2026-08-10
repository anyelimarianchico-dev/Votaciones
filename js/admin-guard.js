(async () => {
  const isFlaskOrigin = ["127.0.0.1:5000", "localhost:5000"].includes(window.location.host);
  const backendOrigin = isFlaskOrigin ? "" : "http://127.0.0.1:5000";
  if (!isFlaskOrigin) return;

  try {
    const response = await fetch(`${backendOrigin}/api/admin/session`, {
      cache: "no-store",
      credentials: "include",
    });
    const data = await response.json();
    if (!data.authenticated) {
      window.location.replace(`${backendOrigin}/admin-login.html?next=${encodeURIComponent("admin.html")}`);
    }
  } catch {
    window.location.replace(`${backendOrigin}/admin-login.html?next=${encodeURIComponent("admin.html")}`);
  }
})();

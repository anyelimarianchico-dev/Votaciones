(async () => {
  const isFlaskOrigin = ["127.0.0.1:5000", "localhost:5000"].includes(window.location.host);
  const backendOrigin = "";

  const goToVoting = () => {
    window.location.replace("index.html");
  };

  const logout = async () => {
    sessionStorage.removeItem("sena_admin_authenticated");
    sessionStorage.removeItem("sena_admin_key");
    if (isFlaskOrigin) {
      await fetch(`${backendOrigin}/api/admin/logout`, {
        method: "POST",
        credentials: "include",
      }).catch(() => null);
    }
    goToVoting();
  };

  document.addEventListener("click", (event) => {
    if (event.target.closest("#adminLogoutBtn")) {
      event.preventDefault();
      logout();
    }
  });

  if (!isFlaskOrigin) {
    if (sessionStorage.getItem("sena_admin_authenticated") !== "true") {
      window.location.replace("admin-login.html?next=admin.html");
      return;
    }
    return;
  }

  try {
    const response = await fetch(`${backendOrigin}/api/admin/session`, {
      cache: "no-store",
      credentials: "include",
    });
    const data = await response.json();
    if (!data.authenticated) {
      window.location.replace(`${backendOrigin}/admin-login.html?next=${encodeURIComponent("admin.html")}`);
      return;
    }
  } catch {
    window.location.replace(`${backendOrigin}/admin-login.html?next=${encodeURIComponent("admin.html")}`);
  }
})();

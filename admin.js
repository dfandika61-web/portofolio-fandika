(() => {
  const api = window.portfolioApi;
  const setupNotice = document.querySelector("[data-backend-setup]");
  const message = document.querySelector("[data-admin-message]");
  const loginForm = document.querySelector("[data-admin-login]");
  const dashboard = document.querySelector("[data-admin-dashboard]");
  const inviteForm = document.querySelector("[data-invite-member]");
  const inviteUrl = document.querySelector("[data-invite-url]");
  const adminName = document.querySelector("[data-admin-name]");
  const reviewMessage = document.querySelector("[data-review-message]");
  const pendingList = document.querySelector("[data-pending-writings]");

  setupNotice.hidden = false;
  setupNotice.textContent = "Data akun dan tulisan tersimpan melalui Cloudflare D1.";

  const setMessage = (element, text, state = "") => {
    element.textContent = text;
    if (state) element.dataset.state = state;
    else delete element.dataset.state;
  };

  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Tanggal tidak tersedia"
      : date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  };

  const renderWriting = (writing) => {
    const article = document.createElement("article");
    article.className = "admin-writing-card";

    const title = document.createElement("h3");
    title.textContent = writing.title;

    const meta = document.createElement("p");
    meta.className = "writing-card-meta";
    meta.textContent = `${writing.author_name} · ${formatDate(writing.created_at)}`;

    const body = document.createElement("p");
    body.className = "writing-card-body";
    body.textContent = writing.body;

    const actions = document.createElement("div");
    actions.className = "writing-actions";

    const approveButton = document.createElement("button");
    approveButton.className = "primary-button";
    approveButton.type = "button";
    approveButton.textContent = "SETUJUI & TAYANG";
    approveButton.addEventListener("click", () => updateWritingStatus(writing.id, "published"));

    const rejectButton = document.createElement("button");
    rejectButton.className = "primary-button reject-button";
    rejectButton.type = "button";
    rejectButton.textContent = "TOLAK";
    rejectButton.addEventListener("click", () => updateWritingStatus(writing.id, "rejected"));

    actions.append(approveButton, rejectButton);
    article.append(title, meta, body, actions);
    return article;
  };

  const loadPendingWritings = async () => {
    pendingList.replaceChildren();
    setMessage(reviewMessage, "Memuat antrean...");

    try {
      const { data } = await api("/writings?view=pending");
      if (!data.length) {
        setMessage(reviewMessage, "Tidak ada tulisan yang menunggu persetujuan.");
        return;
      }

      const fragment = document.createDocumentFragment();
      data.forEach((writing) => fragment.append(renderWriting(writing)));
      pendingList.replaceChildren(fragment);
      setMessage(reviewMessage, "");
    } catch (error) {
      setMessage(reviewMessage, `Antrean gagal dimuat: ${error.message}`, "error");
    }
  };

  const updateWritingStatus = async (id, status) => {
    setMessage(reviewMessage, "Menyimpan keputusan...");
    try {
      await api(`/writings/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadPendingWritings();
      setMessage(
        reviewMessage,
        status === "published" ? "Tulisan disetujui dan sudah tampil di Karya Tulis." : "Tulisan ditolak.",
        "success",
      );
    } catch (error) {
      setMessage(reviewMessage, `Status tulisan gagal diperbarui: ${error.message}`, "error");
    }
  };

  const showAdmin = async (user) => {
    if (!user) {
      loginForm.hidden = false;
      dashboard.hidden = true;
      return;
    }
    if (user.role !== "admin" || user.status !== "active") {
      try {
        await api("/session", { method: "DELETE" });
      } catch (error) {
        setMessage(message, `Akun ini bukan admin dan logout gagal: ${error.message}`, "error");
      }
      loginForm.hidden = false;
      dashboard.hidden = true;
      setMessage(message, "Akun ini tidak memiliki akses admin.", "error");
      return;
    }

    loginForm.hidden = true;
    dashboard.hidden = false;
    adminName.textContent = user.display_name || user.email;
    setMessage(message, "");
    await loadPendingWritings();
  };

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = new FormData(loginForm);
    const button = loginForm.querySelector("button[type='submit']");
    button.disabled = true;
    setMessage(message, "Memeriksa akun...");

    try {
      const result = await api("/login", {
        method: "POST",
        body: JSON.stringify({
          email: String(values.get("email")).trim(),
          password: String(values.get("password")),
        }),
      });
      await showAdmin(result.user);
    } catch (error) {
      setMessage(message, `Login gagal: ${error.message}`, "error");
    } finally {
      button.disabled = false;
    }
  });

  inviteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = new FormData(inviteForm);
    const button = inviteForm.querySelector("button[type='submit']");
    button.disabled = true;
    inviteUrl.hidden = true;
    setMessage(message, "Membuat undangan...");

    try {
      const result = await api("/invitations", {
        method: "POST",
        body: JSON.stringify({
          displayName: String(values.get("displayName")).trim(),
          email: String(values.get("email")).trim(),
        }),
      });
      inviteForm.reset();
      inviteUrl.href = result.invitationUrl;
      inviteUrl.textContent = result.invitationUrl;
      inviteUrl.hidden = false;
      setMessage(message, `${result.message} Bagikan tautan ini kepada member.`, "success");
    } catch (error) {
      setMessage(message, `Undangan gagal dibuat: ${error.message}`, "error");
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector("[data-refresh-writings]").addEventListener("click", loadPendingWritings);
  document.querySelector("[data-admin-logout]").addEventListener("click", async () => {
    try {
      await api("/session", { method: "DELETE" });
      setMessage(message, "Kamu sudah logout.");
      await showAdmin(null);
    } catch (error) {
      setMessage(message, `Logout gagal: ${error.message}`, "error");
    }
  });

  api("/session")
    .then(({ user }) => showAdmin(user))
    .catch((error) => setMessage(message, `Sesi gagal dimuat: ${error.message}`, "error"));
})();

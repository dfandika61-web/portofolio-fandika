(() => {
  const api = window.portfolioApi;
  const setupNotice = document.querySelector("[data-backend-setup]");
  const message = document.querySelector("[data-member-message]");
  const loginForm = document.querySelector("[data-member-login]");
  const passwordForm = document.querySelector("[data-member-password]");
  const workspace = document.querySelector("[data-member-workspace]");
  const writingForm = document.querySelector("[data-writing-submit]");
  const memberName = document.querySelector("[data-member-name]");
  const submissionMessage = document.querySelector("[data-submission-message]");
  const submissionList = document.querySelector("[data-member-submissions]");
  const invitationToken = new URLSearchParams(window.location.search).get("invite");

  setupNotice.hidden = false;
  setupNotice.textContent = "Login dan tulisan menggunakan API Cloudflare Workers dengan database D1.";

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

  const renderSubmission = (submission) => {
    const article = document.createElement("article");
    article.className = "member-submission-card";

    const title = document.createElement("h3");
    title.textContent = submission.title;

    const status = document.createElement("span");
    status.className = "submission-status";
    status.textContent = `${submission.status} · ${formatDate(submission.created_at)}`;

    article.append(title, status);
    return article;
  };

  const loadSubmissions = async () => {
    submissionList.replaceChildren();
    setMessage(submissionMessage, "Memuat tulisan...");

    try {
      const { data } = await api("/writings?view=mine");
      if (!data.length) {
        setMessage(submissionMessage, "Kamu belum mengirim tulisan.");
        return true;
      }

      const fragment = document.createDocumentFragment();
      data.forEach((submission) => fragment.append(renderSubmission(submission)));
      submissionList.replaceChildren(fragment);
      setMessage(submissionMessage, "");
      return true;
    } catch (error) {
      setMessage(submissionMessage, `Tulisan gagal dimuat: ${error.message}`, "error");
      return false;
    }
  };

  const showSession = async (user) => {
    if (!user) {
      loginForm.hidden = false;
      passwordForm.hidden = true;
      workspace.hidden = true;
      return;
    }
    if (user.role !== "member" || user.status !== "active") {
      try {
        await api("/session", { method: "DELETE" });
      } catch (error) {
        setMessage(message, `Akun tidak dapat digunakan dan logout gagal: ${error.message}`, "error");
      }
      loginForm.hidden = false;
      passwordForm.hidden = true;
      workspace.hidden = true;
      setMessage(message, "Akun ini tidak memiliki akses member aktif.", "error");
      return;
    }

    loginForm.hidden = true;
    passwordForm.hidden = true;
    workspace.hidden = false;
    memberName.textContent = user.display_name || user.email;
    setMessage(message, "");
    await loadSubmissions();
  };

  if (invitationToken) {
    loginForm.hidden = true;
    passwordForm.hidden = false;
    workspace.hidden = true;
    setMessage(message, "Undangan diterima. Buat kata sandi minimal 10 karakter.");
  }

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
      await showSession(result.user);
    } catch (error) {
      setMessage(message, `Login gagal: ${error.message}`, "error");
    } finally {
      button.disabled = false;
    }
  });

  passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = new FormData(passwordForm);
    const button = passwordForm.querySelector("button[type='submit']");
    button.disabled = true;
    setMessage(message, "Mengaktifkan akun...");

    try {
      const result = await api("/invitations/accept", {
        method: "POST",
        body: JSON.stringify({
          token: invitationToken,
          password: String(values.get("password")),
        }),
      });
      window.history.replaceState(null, "", window.location.pathname);
      setMessage(message, result.message, "success");
      await showSession(result.user);
    } catch (error) {
      setMessage(message, `Undangan gagal digunakan: ${error.message}`, "error");
    } finally {
      button.disabled = false;
    }
  });

  writingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = new FormData(writingForm);
    const button = writingForm.querySelector("button[type='submit']");
    button.disabled = true;
    setMessage(submissionMessage, "Mengirim tulisan...");

    try {
      await api("/writings", {
        method: "POST",
        body: JSON.stringify({
          title: String(values.get("title")).trim(),
          body: String(values.get("body")).trim(),
        }),
      });
      writingForm.reset();
      const refreshed = await loadSubmissions();
      if (refreshed) setMessage(submissionMessage, "Tulisan terkirim dan menunggu persetujuan admin.", "success");
    } catch (error) {
      setMessage(submissionMessage, `Tulisan gagal dikirim: ${error.message}`, "error");
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector("[data-member-logout]").addEventListener("click", async () => {
    try {
      await api("/session", { method: "DELETE" });
      setMessage(message, "Kamu sudah logout.");
      await showSession(null);
    } catch (error) {
      setMessage(message, `Logout gagal: ${error.message}`, "error");
    }
  });

  if (!invitationToken) {
    api("/session")
      .then(({ user }) => showSession(user))
      .catch((error) => setMessage(message, `Sesi gagal dimuat: ${error.message}`, "error"));
  }
})();

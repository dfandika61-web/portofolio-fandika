(() => {
  const list = document.querySelector("[data-public-writings]");
  const status = document.querySelector("[data-public-writings-status]");
  const api = window.portfolioApi;

  if (!list || !status) return;

  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Tanggal tidak tersedia"
      : date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  };

  const renderWriting = (writing) => {
    const article = document.createElement("article");
    article.className = "writing-feed-card";

    const title = document.createElement("h4");
    title.textContent = writing.title;

    const meta = document.createElement("p");
    meta.className = "writing-card-meta";
    meta.textContent = `${writing.author_name} · ${formatDate(writing.published_at || writing.created_at)}`;

    const body = document.createElement("p");
    body.className = "writing-card-body";
    body.textContent = writing.body;

    article.append(title, meta, body);
    return article;
  };

  api("/writings")
    .then(({ data }) => {
      if (!data.length) {
        status.textContent = "Belum ada tulisan member yang disetujui admin.";
        return;
      }

      const fragment = document.createDocumentFragment();
      data.forEach((writing) => fragment.append(renderWriting(writing)));
      list.replaceChildren(fragment);
      status.hidden = true;
    })
    .catch((error) => {
      status.textContent = `Tulisan member gagal dimuat: ${error.message}`;
    });
})();

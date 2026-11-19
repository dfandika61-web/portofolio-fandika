window.portfolioApi = async (path, options = {}) => {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`Respons server tidak valid (HTTP ${response.status}).`);
  }
  if (!response.ok) throw new Error(result.error || `Permintaan gagal (HTTP ${response.status}).`);
  return result;
};

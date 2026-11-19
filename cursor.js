const hasFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (hasFinePointer && !prefersReducedMotion) {
  const cursor = document.createElement("span");
  cursor.className = "site-cursor";
  cursor.setAttribute("aria-hidden", "true");
  cursor.innerHTML = "<span></span>";
  document.body.append(cursor);
  document.body.classList.add("has-site-cursor");

  const moveCursor = (event) => {
    if (event.pointerType === "touch") return;
    cursor.style.setProperty("--cursor-x", `${event.clientX}px`);
    cursor.style.setProperty("--cursor-y", `${event.clientY}px`);
    cursor.classList.add("is-visible");
  };
  const hideCursor = () => cursor.classList.remove("is-visible", "is-pressed");

  document.addEventListener("pointermove", moveCursor, { passive: true });
  document.addEventListener("pointerdown", (event) => {
    if (event.button === 0) cursor.classList.add("is-pressed");
  }, { passive: true });
  document.addEventListener("pointerup", () => cursor.classList.remove("is-pressed"), { passive: true });
  document.addEventListener("pointercancel", hideCursor, { passive: true });
  document.addEventListener("pointerleave", hideCursor);
  window.addEventListener("blur", hideCursor);

  document.querySelectorAll("iframe").forEach((frame) => {
    frame.addEventListener("pointerenter", hideCursor);
  });
}

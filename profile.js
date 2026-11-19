const profileStage = document.querySelector("[data-profile-stage]");
const hangingTag = profileStage?.querySelector("[data-hanging-tag]");

if (profileStage && hangingTag) {
  const restingLength = 42;
  const minLength = 26;
  let returnTimer;
  let keyboardX = 0.5;
  let keyboardY = 0.3;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const moveTag = (horizontal, vertical) => {
    const maxLength = Math.min(75, profileStage.clientHeight * 0.28);
    const length = minLength + clamp(vertical, 0, 1) * (maxLength - minLength);
    const angle = (clamp(horizontal, 0, 1) - 0.5) * 34;

    hangingTag.style.setProperty("--tag-length", `${length}px`);
    hangingTag.style.setProperty("--tag-angle", `${angle}deg`);
  };
  const returnTag = () => {
    hangingTag.classList.remove("is-following");
    hangingTag.style.setProperty("--tag-length", `${restingLength}px`);
    hangingTag.style.setProperty("--tag-angle", "0deg");
  };
  const followPointer = (event) => {
    const bounds = profileStage.getBoundingClientRect();
    const horizontal = (event.clientX - bounds.left) / bounds.width;
    const vertical = (event.clientY - bounds.top) / bounds.height;

    window.clearTimeout(returnTimer);
    hangingTag.classList.add("is-following");
    moveTag(horizontal, vertical);
  };

  profileStage.addEventListener("pointerenter", followPointer);
  profileStage.addEventListener("pointermove", followPointer);
  profileStage.addEventListener("pointerleave", () => {
    window.clearTimeout(returnTimer);
    returnTag();
  });

  profileStage.addEventListener("keydown", (event) => {
    if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(event.key)) return;

    event.preventDefault();
    window.clearTimeout(returnTimer);
    if (event.key === "ArrowLeft") keyboardX = 0;
    if (event.key === "ArrowRight") keyboardX = 1;
    if (event.key === "ArrowUp") keyboardY = 0;
    if (event.key === "ArrowDown") keyboardY = 1;

    hangingTag.classList.add("is-following");
    moveTag(keyboardX, keyboardY);
    returnTimer = window.setTimeout(returnTag, 700);
  });
}

const appState = {
  max: 9,
  collected: 0,
  customerName: "",
  customerId: "",
  phone: "",
  memberStatus: "Active",
};

let typingShakeTimer = null;
let rewardCelebrated = false;

const flipCard = document.getElementById("flipCard");
const cardStage = document.getElementById("cardStage");
const claimButton = document.getElementById("claimButton");
const claimStampButton = document.getElementById("claimStampButton");
const redeemButton = document.getElementById("redeemButton");
const refreshButton = document.getElementById("refreshButton");
const phoneNumberInput = document.getElementById("phoneNumber");
const syncStatus = document.getElementById("syncStatus");
const cardOwner = document.getElementById("cardOwner");
const cardCustomerId = document.getElementById("cardCustomerId");
const stampGrid = document.getElementById("stampGrid");
const stampCount = document.getElementById("stampCount");
const collectedCount = document.getElementById("collectedCount");
const remainingCount = document.getElementById("remainingCount");
const completeCount = document.getElementById("completeCount");
const appConfig = window.CARWASH_CONFIG || {};
const apiBaseUrl = String(appConfig.apiBaseUrl || "").replace(/\/$/, "");
const mobileCardQuery = window.matchMedia("(max-width: 720px)");

function apiUrl(path, params) {
  const basePath = `${apiBaseUrl}${path}`;

  if (!params) {
    return basePath;
  }

  const url = new URL(basePath, window.location.href);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

function buildCustomerId(value) {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18);

  return `cust-${slug || "guest"}`;
}

function resolveLookupQuery() {
  const rawPhone = phoneNumberInput.value.trim();

  if (!rawPhone) {
    return {};
  }

  if (rawPhone.toLowerCase().startsWith("cust-")) {
    return { customerId: rawPhone };
  }

  if (/^\+?[0-9][0-9\s-]*$/.test(rawPhone)) {
    return { phone: rawPhone };
  }

  return { phone: rawPhone };
}

function setSyncStatus(message) {
  syncStatus.textContent = message;
}

function triggerTypingShake() {

  phoneNumberInput.classList.remove("is-typing");

  void phoneNumberInput.offsetWidth;

  phoneNumberInput.classList.add("is-typing");

  const panel=document.querySelector(".claim-panel");

  panel.style.transform="translateY(-1px)";
  panel.style.boxShadow="0 22px 60px rgba(247,178,59,.16)";

  window.clearTimeout(typingShakeTimer);

  typingShakeTimer=window.setTimeout(()=>{

      phoneNumberInput.classList.remove("is-typing");

      panel.style.transform="";
      panel.style.boxShadow="";

  },220);

}

function syncExpandedCardState() {
  cardStage.classList.toggle("expanded", flipCard.classList.contains("flipped") && mobileCardQuery.matches);
}

function updateCardShine(event) {
  const rect = flipCard.getBoundingClientRect();

  if (!rect.width || !rect.height) {
    return;
  }

  const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
  const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));

  flipCard.style.setProperty("--shine-x", `${x.toFixed(1)}%`);
  flipCard.style.setProperty("--shine-y", `${y.toFixed(1)}%`);
  flipCard.style.setProperty("--shine-opacity", "0.42");
  flipCard.classList.add("card-ready");
}

function resetCardShine() {
  flipCard.style.setProperty("--shine-x", "50%");
  flipCard.style.setProperty("--shine-y", "40%");
  flipCard.style.setProperty("--shine-opacity", "0.16");
}

function celebrateReward() {

  confetti({
    particleCount: 120,
    spread: 90,
    origin: { y: 0.6 }
  });

  setTimeout(() => {
    confetti({
      particleCount: 80,
      angle: 60,
      spread: 60,
      origin: { x: 0 }
    });

    confetti({
      particleCount: 80,
      angle: 120,
      spread: 60,
      origin: { x: 1 }
    });
  }, 250);

}

function renderStamps() {
  stampGrid.innerHTML = "";

for (let index = 0; index < appState.max; index += 1) {

  // Last slot = Reward
  if (index === appState.max - 1) {

    const reward = document.createElement("div");

    reward.className = "reward-slot";

    if (appState.collected >= appState.max) {
      reward.classList.add("unlocked");
    }

    reward.innerHTML = `
  <img
    src="${
      appState.collected >= appState.max
        ? 'nanomist_gold.svg'
        : 'nanomist_black.svg'
    }"
    alt="Nano Mist Reward"
  >
`;

    stampGrid.appendChild(reward);

  } else {

    const circle = document.createElement("div");

    circle.className =
      index < appState.collected
        ? "stamp-circle filled"
        : "stamp-circle";

    stampGrid.appendChild(circle);

  }

}

  const remaining = Math.max(appState.max - appState.collected, 0);
  const complete = Math.round((appState.collected / appState.max) * 100);

  stampCount.textContent = String(appState.collected);
  collectedCount.textContent = String(appState.collected);
  remainingCount.textContent = String(remaining);
  completeCount.textContent = `${complete}%`;
  if (appState.collected < appState.max) {
  rewardCelebrated = false;
}
  cardOwner.textContent = appState.customerName;
  cardCustomerId.textContent = appState.customerId;
  redeemButton.disabled = appState.collected < appState.max;
  redeemButton.textContent = appState.collected >= appState.max ? "Redeem reward" : "Collect more stamps";
  flipCard.classList.add("card-ready");
}

function syncInputsFromState() {
  phoneNumberInput.value = appState.phone || appState.customerId;
}

function applyCustomer(customer) {
  if (!customer) {
    appState.phone = phoneNumberInput.value.trim();
    appState.customerName = "New Customer";
    appState.customerId = appState.phone || buildCustomerId(appState.customerName);
    appState.collected = 0;
    appState.memberStatus = "Active";
    setSyncStatus("No existing record found. Tap continue to create a new loyalty profile.");
    syncInputsFromState();
    renderStamps();
    return;
  }

  appState.customerName = customer.customerName || appState.customerName;
  appState.customerId = customer.phone || customer.customerId || buildCustomerId(appState.customerName);
  appState.phone = customer.phone || appState.phone;
  appState.collected = Number(customer.totalCollected) || 0;
  appState.max = Number(customer.totalStamps) || appState.max;
  appState.memberStatus = customer.memberStatus || "Active";
  setSyncStatus(`Loaded from Sheets: ${appState.customerName} (${appState.customerId})`);
  syncInputsFromState();
  renderStamps();
}

async function fetchConfig() {
  try {
    const response = await fetch(apiUrl("/config", { action: "config" }));
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    if (payload?.ok && payload.config?.maxStamps) {
      appState.max = Number(payload.config.maxStamps) || appState.max;
    }
  } catch (error) {
    console.warn("Config sync failed.", error);
  }
}

async function lookupCustomer() {
  const query = resolveLookupQuery();
  const identifier = query.customerId || query.phone || query.customerName;

  if (!identifier) {
    applyCustomer(null, appState.customerName);
    return null;
  }

  const params = new URLSearchParams();
  if (query.customerId) {
    params.set("customerId", query.customerId);
  }

  if (query.phone) {
    params.set("phone", query.phone);
  }

  if (query.customerName) {
    params.set("customerName", query.customerName);
  }

  try {
    setSyncStatus("Sedang mencari nama anda di sistem kami...");
    const response = await fetch(apiUrl("/customer", Object.fromEntries(params.entries())));
    const payload = await response.json();

    if (payload?.ok && payload.found && payload.customer) {
      localStorage.setItem("carwash.customerId", payload.customer.customerId || "");
      localStorage.setItem("carwash.customerName", payload.customer.customerName || "");
      localStorage.setItem("carwash.customerPhone", payload.customer.phone || "");
      applyCustomer(payload.customer);
      return payload.customer;
    }

    applyCustomer(null);
    return null;
  } catch (error) {
    console.warn("Lookup failed.", error);
    setSyncStatus("Pastikan phone no adalah tepat Eg. 0123456789. Sila hubungi kami jika anda hadapi masalah");
    return null;
  }
}

async function persistStamp(memberStatus = "Active") {
  const response = await fetch(apiUrl("/stamp"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customerName: appState.customerName,
      customerId: appState.customerId,
      phone: appState.phone,
      collected: appState.collected,
      total: appState.max,
      memberStatus,
    }),
  });

  return response.json();
}

async function claimStamp() {
  appState.phone = phoneNumberInput.value.trim();
  await lookupCustomer();
  appState.collected = Math.min(appState.collected + 1, appState.max);
  renderStamps();
  flipCard.classList.add("flipped");
  syncExpandedCardState();
  setSyncStatus("Saving stamp to the sheet...");

  try {
    await persistStamp("Active");
    localStorage.setItem("carwash.customerId", appState.customerId);
    localStorage.setItem("carwash.customerName", appState.customerName);
    localStorage.setItem("carwash.customerPhone", appState.phone);
    setSyncStatus(`Saved to Sheets for ${appState.customerName}.`);
  } catch (error) {
    console.warn("Stamp sync failed. The UI stayed in sync locally.", error);
    setSyncStatus("Stamp saved locally. Sheet sync will retry on the next update.");
  }
}

async function loadCustomerCard() {
  appState.phone = phoneNumberInput.value.trim();
  await lookupCustomer();
  flipCard.classList.remove("flipped");
  syncExpandedCardState();
}

async function redeemReward() {
  if (appState.collected < appState.max) {
    flipCard.classList.add("flipped");
    setSyncStatus("Collect all stamps before redeeming.");
    return;
  }

  setSyncStatus("Redeeming reward and updating the customer row...");

  try {
    await persistStamp("Redeemed");
    appState.memberStatus = "Redeemed";
    setSyncStatus(`Reward redeemed for ${appState.customerName}. The sheet now shows the latest status.`);
  } catch (error) {
    console.warn("Redemption sync failed.", error);
    setSyncStatus("Redemption could not sync to Sheets right now.");
  }
}

async function hydrateFromSavedCustomer() {
  const savedCustomerId = localStorage.getItem("carwash.customerId");
  const savedCustomerName = localStorage.getItem("carwash.customerName");
  const savedCustomerPhone = localStorage.getItem("carwash.customerPhone");

  if (savedCustomerPhone || savedCustomerId) {
    phoneNumberInput.value = savedCustomerPhone || savedCustomerId;
    await lookupCustomer();
    return;
  }

  renderStamps();
  setSyncStatus("Sila masukkan phone no untuk lihat JLCW card anda.");
}

flipCard.addEventListener("click", () => {

  flipCard.classList.toggle("flipped");

  syncExpandedCardState();

  if (
    flipCard.classList.contains("flipped") &&
    appState.collected >= appState.max &&
    !rewardCelebrated
  ) {

    celebrateReward();

    rewardCelebrated = true;
  }

});

flipCard.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    flipCard.classList.toggle("flipped");
    syncExpandedCardState();
  }
});

flipCard.addEventListener("pointermove", updateCardShine);
flipCard.addEventListener("pointerleave", resetCardShine);

claimButton?.addEventListener("click", loadCustomerCard);

claimStampButton?.addEventListener("click", claimStamp);

redeemButton?.addEventListener("click", redeemReward);

refreshButton?.addEventListener("click", loadCustomerCard);

phoneNumberInput.addEventListener("input", triggerTypingShake);
phoneNumberInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadCustomerCard();
  }
});

window.addEventListener("resize", syncExpandedCardState);
/* ---------- Premium Card Animation ---------- */

let shineTargetX = 50;
let shineTargetY = 40;

let shineCurrentX = 50;
let shineCurrentY = 40;

window.addEventListener("scroll", () => {

    const maxScroll =
        document.documentElement.scrollHeight -
        window.innerHeight;

    const progress =
        maxScroll <= 0 ? 0 : window.scrollY / maxScroll;

    shineTargetX = 25 + progress * 50;
    shineTargetY = 35 + progress * 20;

});

function animatePremiumCard(){

    shineCurrentX +=
        (shineTargetX-shineCurrentX)*0.08;

    shineCurrentY +=
        (shineTargetY-shineCurrentY)*0.08;

    flipCard.style.setProperty(
        "--shine-x",
        `${shineCurrentX}%`
    );

    flipCard.style.setProperty(
        "--shine-y",
        `${shineCurrentY}%`
    );

    requestAnimationFrame(
        animatePremiumCard
    );

}

animatePremiumCard();
setInterval(()=>{

    shineTargetX=
        60+
        Math.random()*30;

    shineTargetY=
        30+
        Math.random()*18;

},3500);

window.addEventListener("scroll",()=>{

    const move=
        Math.min(window.scrollY*0.03,10);

    cardStage.style.transform=
        `translateY(${move}px)`;

});

(async function initialize() {
  await fetchConfig();
  await hydrateFromSavedCustomer();
  syncExpandedCardState();
  resetCardShine();
})();

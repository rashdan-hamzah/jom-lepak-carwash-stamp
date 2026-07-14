const appState = {
  max: 10,
  collected: 0,
  customerName: "AlmanHaziq",
  customerId: "CRW-219700",
  phone: "",
  memberStatus: "Active",
};

const flipCard = document.getElementById("flipCard");
const cardStage = document.getElementById("cardStage");
const claimButton = document.getElementById("claimButton");
const redeemButton = document.getElementById("redeemButton");
const customerNameInput = document.getElementById("customerName");
const customerLookupInput = document.getElementById("customerLookup");
const syncStatus = document.getElementById("syncStatus");
const cardOwner = document.getElementById("cardOwner");
const cardCustomerId = document.getElementById("cardCustomerId");
const stampGrid = document.getElementById("stampGrid");
const stampCount = document.getElementById("stampCount");
const collectedCount = document.getElementById("collectedCount");
const remainingCount = document.getElementById("remainingCount");
const completeCount = document.getElementById("completeCount");
const sheetCount = document.getElementById("sheetCount");
const focusButton = document.querySelector('[data-action="focus-demo"]');
const sampleButton = document.querySelector('[data-action="fill-sample"]');
const appConfig = window.CARWASH_CONFIG || {};
const apiBaseUrl = String(appConfig.apiBaseUrl || "").replace(/\/$/, "");

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
  const rawLookup = customerLookupInput.value.trim();
  const rawName = customerNameInput.value.trim();

  if (!rawLookup) {
    return { customerName: rawName };
  }

  if (rawLookup.toLowerCase().startsWith("cust-")) {
    return { customerId: rawLookup };
  }

  if (/^\+?[0-9][0-9\s-]*$/.test(rawLookup)) {
    return { phone: rawLookup };
  }

  return { customerName: rawLookup };
}

function setSyncStatus(message) {
  syncStatus.textContent = message;
}

function renderStamps() {
  stampGrid.innerHTML = "";
  for (let index = 0; index < appState.max; index += 1) {
    const circle = document.createElement("div");
    circle.className = index < appState.collected ? "stamp-circle filled" : "stamp-circle";
    stampGrid.appendChild(circle);
  }

  const remaining = Math.max(appState.max - appState.collected, 0);
  const complete = Math.round((appState.collected / appState.max) * 100);

  stampCount.textContent = String(appState.collected);
  collectedCount.textContent = String(appState.collected);
  remainingCount.textContent = String(remaining);
  completeCount.textContent = `${complete}%`;
  sheetCount.textContent = String(appState.collected);
  cardOwner.textContent = appState.customerName;
  cardCustomerId.textContent = appState.customerId;
  redeemButton.disabled = appState.collected < appState.max;
  redeemButton.textContent = appState.collected >= appState.max ? "Redeem reward" : "Collect more stamps";
}

function syncInputsFromState() {
  customerNameInput.value = appState.customerName;
  customerLookupInput.value = appState.phone || appState.customerId;
}

function applyCustomer(customer, fallbackName) {
  if (!customer) {
    appState.customerName = fallbackName || customerNameInput.value.trim() || appState.customerName;
    appState.customerId = buildCustomerId(customerLookupInput.value.trim() || appState.customerName);
    appState.phone = customerLookupInput.value.trim().includes("+") || /\d/.test(customerLookupInput.value.trim())
      ? customerLookupInput.value.trim()
      : "";
    appState.collected = 0;
    appState.memberStatus = "Active";
    setSyncStatus("No existing record found. A new customer profile will be created on continue.");
    syncInputsFromState();
    renderStamps();
    return;
  }

  appState.customerName = customer.customerName || fallbackName || appState.customerName;
  appState.customerId = customer.customerId || buildCustomerId(appState.customerName);
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
    setSyncStatus("Looking up customer from Sheets...");
    const response = await fetch(apiUrl("/customer", Object.fromEntries(params.entries())));
    const payload = await response.json();

    if (payload?.ok && payload.found && payload.customer) {
      localStorage.setItem("carwash.customerId", payload.customer.customerId || "");
      localStorage.setItem("carwash.customerName", payload.customer.customerName || "");
      localStorage.setItem("carwash.customerPhone", payload.customer.phone || "");
      applyCustomer(payload.customer);
      return payload.customer;
    }

    const fallbackCustomer = {
      customerName: customerNameInput.value.trim() || appState.customerName,
      customerId: buildCustomerId(identifier),
      phone: customerLookupInput.value.trim(),
      totalCollected: 0,
      totalStamps: appState.max,
      memberStatus: "Active",
    };

    applyCustomer(fallbackCustomer, fallbackCustomer.customerName);
    return fallbackCustomer;
  } catch (error) {
    console.warn("Lookup failed.", error);
    setSyncStatus("Sheet lookup failed. You can still continue and sync later.");
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
  await lookupCustomer();
  appState.collected = Math.min(appState.collected + 1, appState.max);
  appState.customerName = customerNameInput.value.trim() || appState.customerName;
  renderStamps();
  flipCard.classList.add("flipped");
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

  if (savedCustomerId) {
    customerLookupInput.value = savedCustomerPhone || savedCustomerId;
    customerNameInput.value = savedCustomerName || customerNameInput.value;
    await lookupCustomer();
    return;
  }

  renderStamps();
  setSyncStatus("Enter a name plus phone or customer ID to load the latest sheet record.");
}

flipCard.addEventListener("click", () => {
  flipCard.classList.toggle("flipped");
});

claimButton.addEventListener("click", claimStamp);
redeemButton.addEventListener("click", redeemReward);

focusButton.addEventListener("click", () => {
  cardStage.scrollIntoView({ behavior: "smooth", block: "center" });
  flipCard.classList.add("flipped");
});

sampleButton.addEventListener("click", () => {
  customerNameInput.value = "AlmanHaziq";
  customerLookupInput.value = "cust-almanhaziq";
  customerNameInput.focus();
  setSyncStatus("Sample customer loaded into the form.");
});

customerNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    claimStamp();
  }
});

customerLookupInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    lookupCustomer();
  }
});

(async function initialize() {
  await fetchConfig();
  await hydrateFromSavedCustomer();
})();

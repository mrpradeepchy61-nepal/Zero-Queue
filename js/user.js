let notificationCount = 0;
let averageTimePerUser = 3;
let notificationShownFor = {};

/* =========================
   TOAST
========================= */
function showToast(message, type = "info") {
  const oldToast = document.querySelector(".toast");
  if (oldToast) oldToast.remove();

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerText = message;

  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 100);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 2500);
}

/* =========================
   NOTIFICATIONS PANEL
========================= */
function addNotification(message) {
  const list = document.getElementById("notificationList");
  const badge = document.getElementById("notificationBadge");

  if (!list) return;

  if (
    list.children.length === 1 &&
    list.children[0].innerText === "No notifications yet"
  ) {
    list.innerHTML = "";
  }

  const li = document.createElement("li");
  li.innerText = message;
  list.prepend(li);

  notificationCount++;

  if (badge) {
    badge.innerText = notificationCount;
    badge.style.display = "inline-block";
  }
}

function openNotifications() {
  document.getElementById("notificationDrawer").classList.add("open");

  const badge = document.getElementById("notificationBadge");
  notificationCount = 0;

  if (badge) {
    badge.innerText = "0";
    badge.style.display = "none";
  }
}

function closeNotifications() {
  document.getElementById("notificationDrawer").classList.remove("open");
}

function addNotification(message) {
  const list = document.getElementById("notificationList");
  if (!list) return;

  if (list.children.length === 1 && list.children[0].innerText === "No notifications yet") {
    list.innerHTML = "";
  }

  const li = document.createElement("li");
  li.innerText = message;
  list.prepend(li);
}

function showNotificationInfo() {
  openNotifications();
}
/* =========================
   USER INFO
========================= */
function getLoggedUser() {
  return JSON.parse(localStorage.getItem("loggedInUser"));
}

function loadLoggedUserName() {
  const user = getLoggedUser();

  if (user?.user_metadata?.name) {
    document.getElementById("loggedUserName").innerText =
      user.user_metadata.name;
  }
}

/* =========================
   LIVE STATUS - SELECTED SERVICE BASED
========================= */
async function updateLiveStatus() {
  const service = document.getElementById("service")?.value;
  const liveCurrentServing = document.getElementById("liveCurrentServing");
  const liveServingService = document.getElementById("liveServingService");

  if (!liveCurrentServing || !liveServingService) return;

  if (!service) {
    liveCurrentServing.innerText = "#0";
    liveServingService.innerText = "Select service";
    return;
  }

  const { data, error } = await db
    .from("tokens")
    .select("token_no, service")
    .eq("status", "serving")
    .eq("service", service)
    .limit(1);

  if (error) {
    console.log(error);
    return;
  }

  if (data && data.length > 0) {
    liveCurrentServing.innerText = "#" + data[0].token_no;
    liveServingService.innerText = data[0].service;
  } else {
    liveCurrentServing.innerText = "#0";
    liveServingService.innerText = service;
  }
}

/* =========================
   GENERATE TOKEN
========================= */
async function generateToken() {
  const name = document.getElementById("userName").value.trim();
  const service = document.getElementById("service").value;
  const priority = document.getElementById("priority").value;

  let priorityLevel = 3;

  if (priority === "emergency") {
    priorityLevel = 1;
  } else if (priority === "senior") {
    priorityLevel = 2;
  }

  if (!name || !service) {
    showToast("Please enter your name and select a service.", "error");
    return;
  }

  const user = getLoggedUser();

  if (!user) {
    showToast("Please login first.", "error");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1000);
    return;
  }

  // service-wise token number
  const { data: lastTokenData, error: lastError } = await db
    .from("tokens")
    .select("token_no")
    .eq("service", service)
    .order("token_no", { ascending: false })
    .limit(1);

  if (lastError) {
    console.log(lastError);
    showToast(lastError.message, "error");
    return;
  }

  const newTokenNo =
    lastTokenData && lastTokenData.length > 0
      ? lastTokenData[0].token_no + 1
      : 1;

  const { data, error } = await db
    .from("tokens")
    .insert([
      {
        name: name,
        service: service,
        token_no: newTokenNo,
        status: "waiting",
        user_id: user.id,
        user_email: user.email,
        priority: priority,
        priority_level: priorityLevel
      }
    ])
    .select()
    .single();

  if (error) {
    console.log(error);
    showToast(error.message, "error");
    return;
  }

  localStorage.setItem("tokenData", JSON.stringify(data));

  showToast(`Token #${data.token_no} generated successfully!`, "success");

  await loadMyTokens();

  setTimeout(() => {
    window.location.href = "token.html";
  }, 900);
}

/* =========================
   TOKEN PREVIEW
========================= */
async function updateTokenPreview(token) {
  if (!token) return;

  const { data: waitingTokens, error } = await db
    .from("tokens")
    .select("*")
    .eq("service", token.service)
    .eq("status", "waiting")
    .order("token_no", { ascending: true });

  if (error) {
    console.log(error);
    return;
  }

  const waitingIndex = waitingTokens.findIndex(t => t.id === token.id);

  let position = "-";
  let estimated = "-";

  if (token.status === "waiting") {
    position = waitingIndex + 1;
    estimated = position * averageTimePerUser + " min";
  } else if (token.status === "serving") {
    position = "Now Serving";
    estimated = "Now";
  } else if (token.status === "completed") {
    position = "-";
    estimated = "Completed";
  }

  document.getElementById("previewToken").innerText = "#" + token.token_no;
  document.getElementById("previewPosition").innerText = position;
  document.getElementById("previewTime").innerText = estimated;
  document.getElementById("previewStatus").innerText = token.status;

  localStorage.setItem("tokenData", JSON.stringify(token));

  checkTurnNotification(token, position);
}

/* =========================
   5 MIN BEFORE NOTIFICATION
========================= */
function checkTurnNotification(token, position) {
  if (!token || token.status !== "waiting") return;

  const estimatedTime = position * averageTimePerUser;

  if (
    estimatedTime <= 5 &&
    estimatedTime > 0 &&
    !notificationShownFor[token.id]
  ) {
    const msg = `⚡ ${token.service} → Your turn is coming soon`;

    showToast(msg, "info");
    addNotification(msg);

    notificationShownFor[token.id] = true;
  }
}

/* =========================
   MY TOKENS TABLE
========================= */
async function loadMyTokens() {
  const user = getLoggedUser();

  if (!user) return;

  const { data, error } = await db
    .from("tokens")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.log(error);
    showToast("Error loading your tokens.", "error");
    return;
  }

  const tbody = document.getElementById("myTokensTableBody");

  if (tbody) {
    tbody.innerHTML = "";

    if (!data || data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; padding:20px;">
            No tokens generated yet 🎫
          </td>
        </tr>
      `;

      document.getElementById("previewToken").innerText = "Not Generated";
      document.getElementById("previewPosition").innerText = "-";
      document.getElementById("previewTime").innerText = "-";
      document.getElementById("previewStatus").innerText = "-";
      return;
    }

    data.forEach((token, index) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${token.service}</td>
        <td class="priority-${token.priority || "normal"}">
          ${token.priority || "normal"}
        </td>
        <td>#${token.token_no}</td>
        <td class="${token.status}">${token.status}</td>
        <td>
          <button class="small-btn">View</button>
        </td>
      `;

      if (token.status === "serving") {
        tr.classList.add("highlight-token-row");
      }

      tr.addEventListener("mouseenter", () => {
        updateTokenPreview(token);
      });

      tr.querySelector(".small-btn").addEventListener("click", () => {
        viewToken(token);
      });

      tbody.appendChild(tr);
    });

    updateTokenPreview(data[0]);
  }
}

/* =========================
   NAVIGATION
========================= */
function viewToken(token) {
  localStorage.setItem("tokenData", JSON.stringify(token));
  window.location.href = "token.html";
}

function goToToken() {
  const token = localStorage.getItem("tokenData");

  if (token) {
    window.location.href = "token.html";
  } else {
    showToast("No token generated yet!", "error");
  }
}

function showNotificationInfo() {
  const section = document.getElementById("notificationSection");

  if (section) {
    section.style.display = "block";
    section.scrollIntoView({ behavior: "smooth" });
  }
}

function setUserActive(activeId) {
  document.querySelectorAll(".sidebar li").forEach(item => {
    if (!item.classList.contains("logout")) {
      item.classList.remove("active");
    }
  });

  document.getElementById(activeId).classList.add("active");
}

/* =========================
   INIT
========================= */
loadLoggedUserName();
updateLiveStatus();
loadMyTokens();

setInterval(updateLiveStatus, 2000);
setInterval(loadMyTokens, 3000);
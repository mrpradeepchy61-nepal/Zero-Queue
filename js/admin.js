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

function getAdminService() {
  const user = getLoggedUser();
  return user?.user_metadata?.service || null;
}

async function fetchQueue() {
  const adminService = getAdminService();

  let query = db
    .from("tokens")
    .select("*")
    .order("priority_level", { ascending: true })
    .order("token_no", { ascending: true });

  if (adminService) {
    query = query.eq("service", adminService);
  }

  const { data, error } = await query;

  if (error) {
    console.log(error);
    showToast("Error loading queue", "error");
    return [];
  }

  return data || [];
}

async function renderQueue() {
  const queue = await fetchQueue();

  const tbody = document.getElementById("queueTableBody");
  const historyBody = document.getElementById("historyTableBody");

  tbody.innerHTML = "";
  historyBody.innerHTML = "";

  const activeQueue = queue.filter(t => t.status !== "completed");
  const completedQueue = queue.filter(t => t.status === "completed");

  if (activeQueue.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 20px;">
          No tokens for your service 🚫
        </td>
      </tr>
    `;
  }

  activeQueue.forEach((token, index) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>#${token.token_no}</td>
      <td>${token.name}</td>
      <td>${token.service}</td>
      <td class="priority-${token.priority || "normal"}">
        ${token.priority || "normal"}
      </td>
      <td class="${token.status}">${token.status}</td>
    `;

    if (token.status === "serving") {
      tr.classList.add("serving-row");
    }

    tbody.appendChild(tr);
  });

  if (completedQueue.length === 0) {
    historyBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 20px;">
          No completed tokens yet 📭
        </td>
      </tr>
    `;
  }

  completedQueue.forEach((token, index) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>#${token.token_no}</td>
      <td>${token.name}</td>
      <td>${token.service}</td>
      <td class="priority-${token.priority || "normal"}">
        ${token.priority || "normal"}
      </td>
      <td>${token.created_at ? new Date(token.created_at).toLocaleString() : "-"}</td>
    `;

    historyBody.appendChild(tr);
  });

  const serving = queue.find(t => t.status === "serving");

  document.getElementById("currentToken").innerText =
    serving ? "#" + serving.token_no : "#0";

  document.getElementById("totalCount").innerText = queue.length;
  document.getElementById("waitingCount").innerText =
    queue.filter(t => t.status === "waiting").length;
  document.getElementById("servingCount").innerText =
    queue.filter(t => t.status === "serving").length;
  document.getElementById("completedCount").innerText =
    queue.filter(t => t.status === "completed").length;
}

async function callNext() {
  const adminService = getAdminService();

  let servingQuery = db
    .from("tokens")
    .select("*")
    .eq("status", "serving")
    .limit(1);

  if (adminService) {
    servingQuery = servingQuery.eq("service", adminService);
  }

  const { data: serving } = await servingQuery;

  if (serving && serving.length > 0) {
    showToast("Complete current token first!", "error");
    return;
  }

  let nextQuery = db
    .from("tokens")
    .select("*")
    .eq("status", "waiting")
    .order("priority_level", { ascending: true })
    .order("token_no", { ascending: true })
    .limit(1);

  if (adminService) {
    nextQuery = nextQuery.eq("service", adminService);
  }

  const { data: next, error: nextError } = await nextQuery;

  if (nextError) {
    showToast(nextError.message, "error");
    return;
  }

  if (!next || next.length === 0) {
    showToast("No waiting tokens for your service!", "error");
    return;
  }

  const { error } = await db
    .from("tokens")
    .update({ status: "serving" })
    .eq("id", next[0].id);

  if (error) {
    showToast(error.message, "error");
    return;
  }

  showToast(
    `Token #${next[0].token_no} (${next[0].priority || "normal"}) is now serving`,
    "info"
  );

  renderQueue();
}

async function completeToken() {
  const adminService = getAdminService();

  let servingQuery = db
    .from("tokens")
    .select("*")
    .eq("status", "serving")
    .limit(1);

  if (adminService) {
    servingQuery = servingQuery.eq("service", adminService);
  }

  const { data: serving } = await servingQuery;

  if (!serving || serving.length === 0) {
    showToast("No serving token for your service!", "error");
    return;
  }

  const { error } = await db
    .from("tokens")
    .update({ status: "completed" })
    .eq("id", serving[0].id);

  if (error) {
    showToast(error.message, "error");
    return;
  }

  showToast(`Token #${serving[0].token_no} completed`, "success");
  renderQueue();
}

async function resetQueue() {
  const adminService = getAdminService();

  if (!confirm("Reset all data for your service?")) return;

  let deleteQuery = db.from("tokens").delete();

  if (adminService) {
    deleteQuery = deleteQuery.eq("service", adminService);
  } else {
    deleteQuery = deleteQuery.neq("id", 0);
  }

  const { error } = await deleteQuery;

  if (error) {
    showToast(error.message, "error");
    return;
  }

  showToast("Queue reset successfully", "info");
  renderQueue();
}

function setActive(activeId) {
  document.querySelectorAll(".sidebar li").forEach(item => {
    if (!item.classList.contains("logout")) {
      item.classList.remove("active");
    }
  });

  document.getElementById(activeId).classList.add("active");
}

function updateActiveOnScroll() {
  const main = document.querySelector(".main");
  const queue = document.getElementById("queueSection");
  const history = document.getElementById("historySection");

  const scrollPosition = main.scrollTop + 180;

  if (history.offsetTop <= scrollPosition) {
    setActive("historyLink");
  } else if (queue.offsetTop <= scrollPosition) {
    setActive("queueLink");
  } else {
    setActive("dashboardLink");
  }
}

document.querySelector(".main").addEventListener("scroll", updateActiveOnScroll);

db
  .channel("admin-tokens")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "tokens"
    },
    () => {
      renderQueue();
    }
  )
  .subscribe();

loadLoggedUserName();
renderQueue();
setInterval(renderQueue, 2000);
let notificationShown = false;
let qrGenerated = false;

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

function getMyToken() {
  return JSON.parse(localStorage.getItem("tokenData"));
}

async function updateTokenPage() {
  const myToken = getMyToken();

  if (!myToken) {
    showToast("No token found. Please generate token first.", "error");

    setTimeout(() => {
      window.location.href = "user-dashboard.html";
    }, 1200);

    return;
  }

  const { data: latestToken, error } = await db
    .from("tokens")
    .select("*")
    .eq("id", myToken.id)
    .single();

  if (error) {
    console.log(error);
    showToast("Error loading token details.", "error");
    return;
  }

  const { data: waitingTokens, error: waitingError } = await db
    .from("tokens")
    .select("*")
    .eq("status", "waiting")
    .order("token_no", { ascending: true });

  if (waitingError) {
    console.log(waitingError);
    showToast("Error loading queue position.", "error");
    return;
  }

  const waitingIndex = waitingTokens.findIndex(
    token => token.id === latestToken.id
  );

  const queuePosition =
    latestToken.status === "waiting" ? waitingIndex + 1 : 0;

  let estimatedTime = 0;

  if (latestToken.status === "waiting") {
    estimatedTime = queuePosition * 3;
  }

  document.getElementById("tokenNo").innerText = "#" + latestToken.token_no;
  document.getElementById("tokenName").innerText = latestToken.name;
  document.getElementById("tokenService").innerText = latestToken.service;
  document.getElementById("tokenStatus").innerText = latestToken.status;

  document.getElementById("tokenPosition").innerText =
    latestToken.status === "waiting" ? queuePosition : "-";

  if (latestToken.status === "waiting") {
    document.getElementById("tokenTime").innerText = estimatedTime + " min";
  } else if (latestToken.status === "serving") {
    document.getElementById("tokenTime").innerText = "Now";
    document.getElementById("tokenPosition").innerText = "Now Serving";
  } else {
    document.getElementById("tokenTime").innerText = "Completed";
    document.getElementById("tokenPosition").innerText = "-";
  }

  if (
    latestToken.status === "waiting" &&
    estimatedTime <= 5 &&
    estimatedTime > 0 &&
    !notificationShown
  ) {
    showToast("⚡ Your turn is coming in 5 minutes!", "info");
    notificationShown = true;
  }

  localStorage.setItem("tokenData", JSON.stringify(latestToken));

  if (!qrGenerated) {
    new QRCode(document.getElementById("qrcode"), {
      text: `Token: #${latestToken.token_no}, Name: ${latestToken.name}, Service: ${latestToken.service}`,
      width: 150,
      height: 150
    });

    qrGenerated = true;
  }
}

updateTokenPage();
setInterval(updateTokenPage, 2000);
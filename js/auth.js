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

function toggleAdminService() {
  const role = document.getElementById("signupRole").value;
  const adminService = document.getElementById("adminService");

  if (role === "admin") {
    adminService.style.display = "block";
  } else {
    adminService.style.display = "none";
    adminService.value = "";
  }
}

async function signup() {
  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value.trim();
  const role = document.getElementById("signupRole").value;
  const adminService = document.getElementById("adminService").value;

  if (!name || !email || !password) {
    showToast("Please fill all fields.", "error");
    return;
  }

  if (role === "admin" && !adminService) {
    showToast("Please select admin service.", "error");
    return;
  }

  const { error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role,
        service: role === "admin" ? adminService : null
      }
    }
  });

  if (error) {
    showToast(error.message, "error");
    return;
  }

  showToast("Signup successful! Please login.", "success");

  setTimeout(() => {
    window.location.href = "login.html";
  }, 1200);
}

async function login() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!email || !password) {
    showToast("Please enter email and password.", "error");
    return;
  }

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showToast(error.message, "error");
    return;
  }

  const user = data.user;
  const role = user.user_metadata.role;

  localStorage.setItem("loggedInUser", JSON.stringify(user));

  showToast("Login successful!", "success");

  setTimeout(() => {
    if (role === "admin") {
      window.location.href = "admin-dashboard.html";
    } else {
      window.location.href = "user-dashboard.html";
    }
  }, 1000);
}

async function logout() {
  await db.auth.signOut();
  localStorage.removeItem("loggedInUser");
  localStorage.removeItem("tokenData");
  window.location.href = "login.html";
}

async function checkAuth(requiredRole = null) {
  const { data } = await db.auth.getUser();

  if (!data.user) {
    window.location.href = "login.html";
    return;
  }

  localStorage.setItem("loggedInUser", JSON.stringify(data.user));

  const role = data.user.user_metadata.role;

  if (requiredRole && role !== requiredRole) {
    showToast("Access denied!", "error");

    setTimeout(() => {
      if (role === "admin") {
        window.location.href = "admin-dashboard.html";
      } else {
        window.location.href = "user-dashboard.html";
      }
    }, 1000);
  }
}
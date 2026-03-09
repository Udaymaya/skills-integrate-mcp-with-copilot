document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const messageDiv = document.getElementById("message");
  const authStatus = document.getElementById("auth-status");
  const userMenuBtn = document.getElementById("user-menu-btn");
  const userMenu = document.getElementById("user-menu");
  const loginOpenBtn = document.getElementById("login-open-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const loginCancelBtn = document.getElementById("login-cancel-btn");

  let authToken = localStorage.getItem("teacherAuthToken") || "";
  let teacherName = localStorage.getItem("teacherUsername") || "";

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function getAuthHeaders() {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  }

  function isTeacherLoggedIn() {
    return Boolean(authToken);
  }

  function renderAuthState() {
    if (isTeacherLoggedIn()) {
      authStatus.textContent = `Logged in as teacher: ${teacherName}`;
      loginOpenBtn.classList.add("hidden");
      logoutBtn.classList.remove("hidden");
    } else {
      authStatus.textContent = "Viewing as student";
      loginOpenBtn.classList.remove("hidden");
      logoutBtn.classList.add("hidden");
    }
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        isTeacherLoggedIn()
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          ${
            isTeacherLoggedIn()
              ? `<button class="register-btn" data-activity="${name}">Register Student</button>`
              : ""
          }
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);
      });

      // Add event listeners to admin buttons
      document.querySelectorAll(".register-btn").forEach((button) => {
        button.addEventListener("click", handleRegister);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!isTeacherLoggedIn()) {
      showMessage("Teacher login required", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  async function handleRegister(event) {
    if (!isTeacherLoggedIn()) {
      showMessage("Teacher login required", "error");
      return;
    }

    const activity = event.target.getAttribute("data-activity");
    const email = window.prompt(`Enter student email to register for ${activity}:`);
    if (!email) {
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  }

  async function checkAuthStatus() {
    if (!authToken) {
      renderAuthState();
      return;
    }

    try {
      const response = await fetch("/auth/status", {
        headers: getAuthHeaders(),
      });
      const result = await response.json();

      if (!result.authenticated) {
        authToken = "";
        teacherName = "";
        localStorage.removeItem("teacherAuthToken");
        localStorage.removeItem("teacherUsername");
      }
    } catch (error) {
      console.error("Failed to verify auth status:", error);
    }

    renderAuthState();
  }

  userMenuBtn.addEventListener("click", () => {
    userMenu.classList.toggle("hidden");
  });

  loginOpenBtn.addEventListener("click", () => {
    loginModal.classList.remove("hidden");
    userMenu.classList.add("hidden");
  });

  loginCancelBtn.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    loginForm.reset();
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("teacher-username").value.trim();
    const password = document.getElementById("teacher-password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();
      if (!response.ok) {
        showMessage(result.detail || "Login failed", "error");
        return;
      }

      authToken = result.token;
      teacherName = result.username;
      localStorage.setItem("teacherAuthToken", authToken);
      localStorage.setItem("teacherUsername", teacherName);

      loginModal.classList.add("hidden");
      loginForm.reset();
      renderAuthState();
      fetchActivities();
      showMessage(result.message, "success");
    } catch (error) {
      showMessage("Login request failed", "error");
      console.error("Login error:", error);
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: getAuthHeaders(),
      });
    } catch (error) {
      console.error("Logout request failed:", error);
    }

    authToken = "";
    teacherName = "";
    localStorage.removeItem("teacherAuthToken");
    localStorage.removeItem("teacherUsername");
    userMenu.classList.add("hidden");
    renderAuthState();
    fetchActivities();
    showMessage("Logged out", "success");
  });

  // Initialize app
  checkAuthStatus();
  fetchActivities();
});

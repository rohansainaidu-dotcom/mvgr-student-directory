const auth = firebase.auth();
const db = firebase.database();

let selectedRole = "student";

const roleUIDs = {
  faculty: "PzPpeGXHcihHo0YsXLnaEwWAxef1",
  student: "r0FKZK82s8VHXa2I412n5WSob0m2"
};

// ---- Tab Switching ----
function showTab(tab) {
  document.getElementById("login-tab").classList.remove("active");
  document.getElementById("register-tab").classList.remove("active");
  document.getElementById(tab + "-tab").classList.add("active");

  document.getElementById("login-form").style.display = tab === "login" ? "block" : "none";
  document.getElementById("register-form").style.display = tab === "register" ? "block" : "none";
}

// ---- Role Toggle ----
function setRole(role) {
  selectedRole = role;
  document.getElementById("student-tab").classList.remove("active");
  document.getElementById("faculty-tab").classList.remove("active");
  document.getElementById(role + "-tab").classList.add("active");
}

// ---- Login ----
function login() {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errorMsg = document.getElementById("login-error");
  errorMsg.textContent = "";

  if (!email || !password) {
    errorMsg.textContent = "Please enter email and password";
    return;
  }

  auth.signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
      const uid = userCredential.user.uid;

      // Faculty check
      if (selectedRole === "faculty") {
        if (uid !== roleUIDs.faculty) {
          auth.signOut();
          errorMsg.textContent = "❌ These are not faculty credentials";
          return;
        }
        localStorage.setItem("loggedInRole", "faculty");
        localStorage.setItem("loggedInEmail", email);
        window.location.href = "index.html";
        return;
      }

      // Student login — any registered student can login
      localStorage.setItem("loggedInRole", "student");
      localStorage.setItem("loggedInEmail", email);
      window.location.href = "index.html";
    })
    .catch(() => {
      errorMsg.textContent = "❌ Invalid email or password";
    });
}

// ---- Register ----
async function register() {
  const roll = document.getElementById("reg-roll").value.trim().toUpperCase();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const confirm = document.getElementById("reg-confirm").value;
  const errorMsg = document.getElementById("register-error");
  const successMsg = document.getElementById("register-success");

  errorMsg.textContent = "";
  successMsg.textContent = "";

  // Validations
  if (!roll || !email || !password || !confirm) {
    errorMsg.textContent = "Please fill all fields";
    return;
  }

  if (password.length < 6) {
    errorMsg.textContent = "Password must be at least 6 characters";
    return;
  }

  if (password !== confirm) {
    errorMsg.textContent = "Passwords do not match";
    return;
  }

  // Check if roll number exists in database
  errorMsg.textContent = "";
  successMsg.textContent = "⏳ Checking roll number...";

  try {
     const snapshot = await db.ref("/").once("value");
const data = snapshot.val();

console.log("Database keys:", Object.keys(data));

const students = Object.entries(data)
  .filter(([key]) => key !== "roles" && key.startsWith("student_"))
  .map(([, val]) => val);
 

const matchedStudent = students.find(
  s => s.roll && s.roll.toUpperCase() === roll.toUpperCase()
);

console.log("Match found:", matchedStudent);

    if (!matchedStudent) {
      successMsg.textContent = "";
      errorMsg.textContent = "❌ Roll number not found. Contact admin if this is a mistake.";
      return;
    }

    // Roll number exists — create account
    successMsg.textContent = "⏳ Creating your account...";

    await auth.createUserWithEmailAndPassword(email, password);

    successMsg.textContent = "✅ Account created! You can now login.";
    errorMsg.textContent = "";

    // Clear form and switch to login tab after 2 seconds
    setTimeout(() => {
      document.getElementById("reg-roll").value = "";
      document.getElementById("reg-email").value = "";
      document.getElementById("reg-password").value = "";
      document.getElementById("reg-confirm").value = "";
      successMsg.textContent = "";
      showTab("login");
    }, 2000);

  } catch (error) {
    successMsg.textContent = "";
    if (error.code === "auth/email-already-in-use") {
      errorMsg.textContent = "❌ This email is already registered. Please login instead.";
    } else {
      errorMsg.textContent = "❌ Error: " + error.message;
    }
  }
}
// Show logged in user info
const role = localStorage.getItem("loggedInRole");
const email = localStorage.getItem("loggedInEmail");

if (role && email) {
  document.getElementById("user-info").textContent =
    `${role === "faculty" ? "👨‍🏫 Faculty" : "🎓 Student"}: ${email}`;
}

function logout() {
  localStorage.removeItem("loggedInRole");
  localStorage.removeItem("loggedInEmail");
  window.location.href = "login.html";
}

// ---- Firebase load students ----
let students = [];

const db = firebase.database();

db.ref("/").once("value")
  .then((snapshot) => {
    const data = snapshot.val();
    // Filter out the 'roles' node — only keep actual student objects
    students = Object.entries(data)
      .filter(([key, val]) => key !== "roles" && typeof val === "object")
      .map(([key, val]) => val);
    showCards(students, "");
  })
  .catch((error) => {
    console.error("Error loading students:", error);
  });

// ---- Highlight search match ----
function highlight(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}
function animateCount(id, target) {
  const el = document.getElementById(id);
  let current = 0;
  const step = Math.ceil(target / 40);
  const timer = setInterval(() => {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = current;
  }, 30);
}

// ---- Show Cards ----
function showCards(list, search = "") {
  const container = document.getElementById("cards-container");
  const countEl = document.getElementById("result-count");

  countEl.textContent = `Showing ${list.length} of ${students.length} students`;
   animateCount("stat-total", students.length);
   animateCount("stat-showing", list.length);

  if (list.length === 0) {
    container.innerHTML = `<p class="no-results">😕 No students found. Try a different search.</p>`;
    return;
  }

  const currentRole = localStorage.getItem("loggedInRole");

  container.innerHTML = list.map(s => {
    const initials = s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const facultyExtra = currentRole === "faculty"
      ? `<p>📞 ${s.phone || "Not added"}</p>`
      : "";

    return `
      <div class="card">
        <div class="avatar">${initials}</div>
        <h2>${highlight(s.name, search)}</h2>
        <p class="roll">${s.roll}</p>
        <span class="branch-badge badge-${s.branch}">${s.branch}</span>
        <hr class="card-divider"/>
        <p>📚 Semester ${s.sem}</p>
        <p>👥 Section ${s.section}</p>
        <p>📧 ${s.email}</p>
        ${facultyExtra}
      </div>
    `;
  }).join("");
}

// ---- Filter Logic ----
function filterStudents() {
  const search = document.getElementById("search-input").value.toLowerCase();
  const branch = document.getElementById("branch-filter").value;
  const sem    = document.getElementById("sem-filter").value;
  const sec    = document.getElementById("sec-filter").value;

  const filtered = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search)
                     || s.roll.toLowerCase().includes(search);
    const matchBranch = branch === "" || s.branch === branch;
    const matchSem    = sem === ""    || s.sem == sem;
    const matchSec    = sec === ""    || s.section === sec;
    return matchSearch && matchBranch && matchSem && matchSec;
  });

  showCards(filtered, search);
}

// ---- Clear Search ----
function clearSearch() {
  document.getElementById("search-input").value = "";
  filterStudents();
}

// ---- Event Listeners ----
document.getElementById("search-input").addEventListener("input", filterStudents);
document.getElementById("branch-filter").addEventListener("change", filterStudents);
document.getElementById("sem-filter").addEventListener("change", filterStudents);
document.getElementById("sec-filter").addEventListener("change", filterStudents);
async function runAiSearch() {
  const query = document.getElementById("ai-search-input").value.trim();
  const statusEl = document.getElementById("ai-status");
  const btn = document.getElementById("ai-btn");

  if (!query) {
    statusEl.textContent = "Please type something to search!";
    return;
  }

  // Show loading state
  btn.disabled = true;
  btn.textContent = "Thinking...";
  statusEl.textContent = "🤖 AI is understanding your query...";

  const filters = await aiSearch(query, students);

  btn.disabled = false;
  btn.textContent = "Ask AI";

  if (!filters) {
    statusEl.textContent = "❌ AI search failed. Try normal search instead.";
    return;
  }

  // Apply filters returned by AI
  const filtered = students.filter(s => {
    const matchName    = !filters.name    || s.name.toLowerCase().includes(filters.name.toLowerCase());
    const matchRoll    = !filters.roll    || s.roll.toLowerCase().includes(filters.roll.toLowerCase());
    const matchBranch  = !filters.branch  || s.branch === filters.branch;
    const matchSem     = !filters.sem     || s.sem == filters.sem;
    const matchSection = !filters.section || s.section === filters.section;
    return matchName && matchRoll && matchBranch && matchSem && matchSection;
  });

  showCards(filtered, filters.name || "");
  statusEl.textContent = `✅ AI found ${filtered.length} students matching "${query}"`;
}
// ---- Chatbot ----
function toggleChat() {
  const chatWindow = document.getElementById("chat-window");
  chatWindow.classList.toggle("open");
}

function addMessage(text, type) {
  const messages = document.getElementById("chat-messages");
  const msg = document.createElement("div");
  msg.className = `chat-msg ${type}`;
  msg.innerHTML = text;
  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;
  return msg;
}

async function sendChat() {
  const input = document.getElementById("chat-input");
  const query = input.value.trim();
  if (!query) return;

  input.value = "";
  addMessage(query, "user");

  const loadingMsg = addMessage("Thinking...", "loading");

  // Build student summary for context
  const branchCount = {};
  students.forEach(s => {
    branchCount[s.branch] = (branchCount[s.branch] || 0) + 1;
  });

  const summary = Object.entries(branchCount)
    .map(([b, c]) => `${b}: ${c} students`)
    .join(", ");

  const prompt = `You are a helpful assistant for MVGR College Student Directory.
You have access to data of ${students.length} students.
Branch breakdown: ${summary}

The user asked: "${query}"

Answer helpfully and concisely based on the student data context.
If they ask to find a specific student, search through this data: ${JSON.stringify(students.slice(0, 50))}
Keep answers short and friendly. Use bullet points if listing multiple items.`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 300,
        temperature: 0.7,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();

    loadingMsg.remove();
    addMessage(reply || "Sorry, I couldn't understand that.", "bot");

  } catch (error) {
    loadingMsg.remove();
    addMessage("Something went wrong. Please try again.", "bot");
    console.error("Chatbot error:", error);
  }
}
// ---- Announcements Generator ----

// Show announcements section only for faculty
if (localStorage.getItem("loggedInRole") === "faculty") {
  document.getElementById("announcements-section").style.display = "block";
}

async function generateAnnouncement() {
  const roughNote = document.getElementById("rough-note").value.trim();
  const btn = document.getElementById("announce-btn");
  const output = document.getElementById("announcement-output");
  const result = document.getElementById("announcement-result");

  if (!roughNote) {
    alert("Please type a rough note first!");
    return;
  }

  btn.disabled = true;
  btn.textContent = "✨ Generating...";
  output.style.display = "none";

  const prompt = `You are an official college announcement writer for MVGR College (Maharaja Vijayaram Gajapathi Raj College).

Convert this rough note into a formal, professional college announcement:
"${roughNote}"

Format it properly with:
- A clear heading
- Date: ${new Date().toDateString()}
- Formal body text
- Proper closing

Keep it concise, professional and suitable for a college notice board.`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 400,
        temperature: 0.7,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    const announcement = data?.choices?.[0]?.message?.content?.trim();

    result.textContent = announcement || "Could not generate announcement.";
    output.style.display = "block";

  } catch (error) {
    console.error("Announcement error:", error);
    result.textContent = "Something went wrong. Please try again.";
    output.style.display = "block";
  }

  btn.disabled = false;
  btn.textContent = "✨ Generate Announcement";
}

function copyAnnouncement() {
  const text = document.getElementById("announcement-result").textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector(".copy-btn");
    btn.textContent = "✅ Copied!";
    setTimeout(() => btn.textContent = "📋 Copy Announcement", 2000);
  });
}
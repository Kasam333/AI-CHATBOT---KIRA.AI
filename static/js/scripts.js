// Sidebar toggle
const sidebar = document.querySelector(".sidebar");
const main = document.querySelector(".main");

document.getElementById("toggle_sidebar").onclick = () => {
    sidebar.classList.toggle("collapsed");
    main.classList.toggle("expanded");
};


async function loadEmployeeName() {
    const employee_id = localStorage.getItem("employee_id");
    const user_id = localStorage.getItem("user_id");
    const password = localStorage.getItem("login_password"); // store it during login

    if (!employee_id || !user_id || !password) return;

    const res = await fetch("http://127.0.0.1:8000/get_employee_name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            employee_id: employee_id,
            user_id: user_id,
            password: password
        })
    });

    const data = await res.json();
    if (data.employee_name) {
        document.getElementById("profile_btn").innerText = data.employee_name;
        localStorage.setItem("employee_name", data.employee_name);
    }
}

// Load on page start
loadEmployeeName();


const chatBox = document.getElementById("chat_box");

// Get session
const role = localStorage.getItem("role");
const employee_id = localStorage.getItem("employee_id");
const user_id = localStorage.getItem("user_id");
if (!role || !employee_id || !user_id) {
    alert("Please login first!");
    window.location.href = "login.html";
}

// Add message with typing effect for bot
function addMessage(content, sender, audioUrl = null, excelUrl = null, modelName = null, imageUrl = null, animateTyping = true) {
    content = content || ""; // <<< ADD THIS LINE
    hideWelcome();
    const msg = document.createElement("div");
    msg.className = "message " + sender;

    const messageId = "msg_" + Date.now();
    msg.id = messageId;

    if (sender === "bot" && content) {
        const span = document.createElement("span");
        msg.appendChild(span);
        chatBox.appendChild(msg);
        chatBox.scrollTop = chatBox.scrollHeight;
        createActionBar(messageId, content, msg);

        if (animateTyping) {
            let i = 0;
            function typeWriter() {
                if (i < content.length) {
                    span.innerHTML += content.charAt(i);
                    i++;
                    setTimeout(typeWriter, 25);
                    chatBox.scrollTop = chatBox.scrollHeight;
                } else {
                    appendExtras();
                }
            }
            typeWriter();
        } else {
            span.innerHTML = content;
            appendExtras();
        }

        function appendExtras() {
            if (imageUrl) {
                msg.innerHTML += `<br><img src="${imageUrl}" style="max-width:150px; margin-top:8px; border-radius:8px;">`;
            }
            if (excelUrl) {
                const btn = document.createElement("a");
                btn.href = excelUrl;
                btn.target = "_blank";
                btn.innerText = "⬇ Download Report";
                btn.className = "download-btn";
                msg.appendChild(btn);
            }
            if (audioUrl) {
                const audioWrap = document.createElement("div");
                audioWrap.className = "audio-card";
                const title = document.createElement("div");
                title.className = "audio-title";
                title.innerText = "🔊 Audio Response";
                const audio = document.createElement("audio");
                audio.src = audioUrl;
                audio.controls = true;
                audio.preload = "auto";
                audioWrap.appendChild(title);
                audioWrap.appendChild(audio);
                msg.appendChild(audioWrap);
            }
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    } else {
        let html = content ? `<div>${content}</div>` : "";
        if (imageUrl) html += `<img src="${imageUrl}" style="max-width:150px; margin-top:8px; border-radius:8px;">`;
        msg.innerHTML = html;

        if (excelUrl) {
            const btn = document.createElement("a");
            btn.href = excelUrl;
            btn.target = "_blank";
            btn.innerText = "⬇ Download Report";
            btn.className = "download-btn";
            msg.appendChild(btn);
        }
        if (audioUrl) {
            const audio = document.createElement("audio");
            audio.src = audioUrl;
            audio.controls = true;
            audio.autoplay = true;
            msg.appendChild(audio);
        }
        chatBox.appendChild(msg);
        chatBox.scrollTop = chatBox.scrollHeight;

    }
}


// --- Image Upload ---
let selectedImage = null;
document.getElementById("image_upload").addEventListener("change", function () {
    selectedImage = this.files[0];
    if (!selectedImage) return;

    const queryBox = document.getElementById("query_box");
    const old = document.getElementById("preview_wrapper");
    if (old) old.remove();

    const wrap = document.createElement("div");
    wrap.id = "preview_wrapper";
    wrap.className = "preview-wrapper";

    const img = document.createElement("img");
    img.className = "preview-thumb";
    img.src = URL.createObjectURL(selectedImage);

    const cancel = document.createElement("div");
    cancel.className = "cancel-icon";
    cancel.innerHTML = "&times;";
    cancel.onclick = () => { wrap.remove(); selectedImage = null; };

    wrap.appendChild(img);
    wrap.appendChild(cancel);

    // insert above the input row
    const flexBox = document.querySelector("#query_box > div");
    queryBox.insertBefore(wrap, flexBox);
});


// --- File Upload ---
let selectedFile = null;
document.getElementById("file_upload").addEventListener("change", function () {
    selectedFile = this.files[0];
    if (!selectedFile) return;
    addMessage("📂 Selected file: " + selectedFile.name, "user");
});

function addBotThinking(content = "⏳ Processing") {
    const msg = document.createElement("div");
    msg.className = "message bot thinking-msg";

    const span = document.createElement("span");
    span.innerText = content;

    // animated dots
    const dots = document.createElement("span");
    dots.className = "thinking-dots";
    dots.innerText = "...";

    msg.appendChild(span);
    msg.appendChild(dots);

    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;

    return msg; // so we can remove it later
}

/* ---- Prevent accidental page reloads from form submissions ---- */

// Block any native form submit anywhere on the page
document.addEventListener('submit', function (e) {
    e.preventDefault();
    // useful debug: console.log('Prevented form submit', e.target);
}, true);

// Ensure every <button> defaults to type="button" (so it won't submit a form)
document.querySelectorAll('button').forEach(btn => {
    // Only set if not set (preserve explicit types)
    if (!btn.hasAttribute('type')) btn.setAttribute('type', 'button');
});

// Extra safety for dynamically created buttons (mutation observer)
const mo = new MutationObserver(mutations => {
    for (const m of mutations) {
        m.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
                if (node.tagName === 'BUTTON' && !node.hasAttribute('type')) node.setAttribute('type', 'button');
                // also check descendants
                node.querySelectorAll && node.querySelectorAll('button:not([type])').forEach(b => b.setAttribute('type', 'button'));
            }
        });
    }
});
mo.observe(document.body, { childList: true, subtree: true });


document.getElementById("send_text").onclick = async function (e) {
    e.preventDefault();
    e.stopPropagation();
    const query = document.getElementById("text_query").value.trim();
    if (!query && !selectedImage && !selectedFile) return;

    let displayText = query;

    if (currentReply) {
        const shortText = currentReply.text.length > 80 ? currentReply.text.slice(0, 77) + "..." : currentReply.text;
        displayText = `
            <div class="reply-block">Replying to: ${shortText}</div>
            <div>${query}</div>
        `;
        document.getElementById("reply_preview").style.display = "none";
        currentReply = null;
    }

    // ✅ Add user's message including image
    let userImageUrl = null;
    if (selectedImage) {
        userImageUrl = URL.createObjectURL(selectedImage);
    }
    addMessage(displayText, "user", null, null, null, userImageUrl);

    document.getElementById("text_query").value = "";

    let thinkingMsg = null;
    setTimeout(() => {
        thinkingMsg = addBotThinking();
    }, 1500);

    const prev = document.getElementById("preview_wrapper");
    if (prev) prev.remove();

    let data;
    if (selectedImage) {
        const fd = new FormData();
        fd.append("file", selectedImage);
        fd.append("query", query || "Describe this image");
        fd.append("employee_id", employee_id);
        fd.append("user_id", user_id);
        fd.append("role", role);
        const res = await fetch("http://127.0.0.1:8000/ask_image", { method: "POST", body: fd });
        data = await res.json();
    } else if (selectedFile) {
        const fd = new FormData();
        fd.append("file", selectedFile);
        fd.append("employee_id", employee_id);
        fd.append("user_id", user_id);
        fd.append("role", role);
        const res = await fetch("http://127.0.0.1:8000/ask_file", { method: "POST", body: fd });
        data = await res.json();
    } else {
        const hrms_enabled = localStorage.getItem("hrms_enabled") === "true";
        const gemini_enabled = localStorage.getItem("gemini_enabled") === "true";

        const res = await fetch("http://127.0.0.1:8000/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                query,
                employee_id,
                user_id,
                role,
                hrms_enabled,
                gemini_enabled
            }),
        });
        data = await res.json();
    }

    if (thinkingMsg) thinkingMsg.remove();

    // ✅ Bot reply (only text/audio/excel)
    addMessage(data.answer, "bot", data.audio_url, data.excel_url);

    // cleanup
    selectedImage = null;
    selectedFile = null;
    document.getElementById("image_upload").value = "";
    document.getElementById("file_upload").value = "";
};


// --- Voice Query ---
let mediaRecorder, audioChunks = [];
let voiceStatusEl = null;

document.getElementById("record").onclick = async (e) => {
    e.preventDefault();
    const employee_id = localStorage.getItem("employee_id");
    const user_id = localStorage.getItem("user_id");
    const role = localStorage.getItem("role");

    // 🎯 Helper: create or update the inline status beside message
    const showVoiceStatus = (text, colorClass) => {
        if (!voiceStatusEl) {
            // Create container beside user's bubble
            const lastUserMsg = document.querySelector(".message.user:last-child");
            if (lastUserMsg) {
                voiceStatusEl = document.createElement("span");
                voiceStatusEl.className = "voice-status";
                voiceStatusEl.innerHTML = `<span class="dot"></span><span class="text">${text}</span>`;
                lastUserMsg.appendChild(voiceStatusEl);
            }
        } else {
            // Update existing
            const textEl = voiceStatusEl.querySelector(".text");
            textEl.textContent = text;
            voiceStatusEl.className = `voice-status ${colorClass || ""}`;
        }
    };

    if (!mediaRecorder || mediaRecorder.state === "inactive") {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
            showVoiceStatus("Processing...", "processing");

            const blob = new Blob(audioChunks, { type: "audio/wav" });
            const fd = new FormData();
            fd.append("file", blob, "query.wav");
            fd.append("employee_id", employee_id);
            fd.append("user_id", user_id);
            fd.append("role", role);

            const res = await fetch("http://127.0.0.1:8000/ask_voice_to_voice", { method: "POST", body: fd });
            const data = await res.json();

            // Remove status indicator
            if (voiceStatusEl) {
                voiceStatusEl.remove();
                voiceStatusEl = null;
            }

            addMessage("🎤 " + data.query_text, "user");
            addMessage(data.answer, "bot", data.audio_url);
        };

        // 🎙 Start recording
        mediaRecorder.start();
        addMessage("🎙 Voice Input", "user");

        // wait briefly to ensure the new message exists in DOM
        setTimeout(() => showVoiceStatus("Recording...", ""), 50);
    } else {
        // 🛑 Stop recording
        mediaRecorder.stop();
        showVoiceStatus("Processing...", "processing");
    }
};


// --- Menu toggle ---
const menuBtn = document.getElementById("menu_btn"), menu = document.getElementById("menu");
menuBtn.onclick = () => menu.style.display = menu.style.display === "block" ? "none" : "block";
document.addEventListener("click", e => { if (!menu.contains(e.target) && !menuBtn.contains(e.target)) menu.style.display = "none" });

const profileBtn = document.getElementById("profile_btn");
const profileMenu = document.getElementById("profile_menu");

profileBtn.addEventListener("click", () => {
    profileMenu.style.display = profileMenu.style.display === "block" ? "none" : "block";
});

document.addEventListener("click", (e) => {
    if (!profileBtn.contains(e.target) && !profileMenu.contains(e.target)) {
        profileMenu.style.display = "none";
    }
});

// --- Logout ---
function logout() { localStorage.clear(); window.location.href = "login.html"; }
window.onload = function () {
    const name = localStorage.getItem("employee_name");
    if (name) {
        document.getElementById("welcome_text").innerText = `Hey, ${name}`;
        document.getElementById("profile_btn").innerText = name;
    } else {
        loadEmployeeName();
    }


    // const employee_id = localStorage.getItem("employee_id");
    // if (employee_id) {
    //     loadChatList(employee_id);
    // }

};

// ✅ Show employee name on hover of user icon
// ✅ Show employee name on hover of user icon
document.addEventListener("DOMContentLoaded", () => {
    const settingIcon = document.querySelector(".setting-icon");
    if (settingIcon) {
        settingIcon.title = "Settings"; // This creates the tooltip on hover
    }
});


document.addEventListener("DOMContentLoaded", () => {
    const userIcon = document.querySelector(".user-icon");
    const profileMenu = document.getElementById("profile_menu");
    const employeeName = localStorage.getItem("employee_name") || "Employee";

    // 🟣 Show employee name tooltip
    userIcon.title = employeeName;

    // 🟣 Toggle logout menu when clicking the user icon
    userIcon.addEventListener("click", (e) => {
        e.stopPropagation(); // prevent closing immediately
        profileMenu.style.display =
            profileMenu.style.display === "block" ? "none" : "block";
    });

    // 🟣 Hide menu when clicking anywhere else
    document.addEventListener("click", () => {
        profileMenu.style.display = "none";
    });
});



// --- Default assistant intro message ---
window.addEventListener("DOMContentLoaded", () => {
    const name = localStorage.getItem("employee_name") || "there";
    addMessage(
        `👋 Hello ${name}! I’m your HR assistant.\n
         I can help you with leave balance, payslips, policies, or any HR-related queries.
         What would you like to do today?`,
        "bot"
    );
});

// --- Hide welcome screen ---
function hideWelcome() {
    const welcome = document.getElementById("welcome_screen");
    if (welcome) welcome.style.display = "none";
    document.getElementById("chat_box").style.display = "flex";
}

function createActionBar(messageId, messageText, msg) {
    const wrapper = document.createElement("div");
    wrapper.className = "message-wrapper";
    msg.parentNode.replaceChild(wrapper, msg);
    wrapper.appendChild(msg);

    const actionBar = document.createElement("div");
    actionBar.className = "action-bar";

    const savedFeedback = JSON.parse(localStorage.getItem("feedback")) || {};
    const userFeedback = savedFeedback[messageId] || null;

    const likeBtn = document.createElement("img");
    likeBtn.src = "img/like.png";
    likeBtn.className = "action-icon";
    if (userFeedback === "like") likeBtn.classList.add("active");

    const dislikeBtn = document.createElement("img");
    dislikeBtn.src = "img/dislike.png";
    dislikeBtn.className = "action-icon";
    if (userFeedback === "dislike") dislikeBtn.classList.add("active");

    likeBtn.onclick = () => {
        saveFeedback(messageId, "like");
        likeBtn.classList.add("active");
        dislikeBtn.classList.remove("active");
    };
    dislikeBtn.onclick = () => {
        saveFeedback(messageId, "dislike");
        dislikeBtn.classList.add("active");
        likeBtn.classList.remove("active");
    };

    const copyBtn = document.createElement("img");
    copyBtn.src = "img/copy.png";
    copyBtn.className = "action-icon";
    copyBtn.onclick = () => {
        navigator.clipboard.writeText(messageText);
        copyBtn.classList.add("active");
        setTimeout(() => copyBtn.classList.remove("active"), 2000);
    };

    actionBar.appendChild(likeBtn);
    actionBar.appendChild(dislikeBtn);
    actionBar.appendChild(copyBtn);

    const dotsSection = document.createElement("div");
    dotsSection.className = "dots-section";

    const menuBtn = document.createElement("img");
    menuBtn.src = "img/dots.png";
    menuBtn.className = "action-icon";

    const menu = document.createElement("div");
    menu.className = "dots-menu";
    menu.innerHTML = `
        <div class="menu-item" onclick="replyMessage('${messageId}')" style="margin: 6px; background: #f1f1f1; border-radius: 5px;">Reply</div>
        <div class="menu-item" onclick="shareMessage('${messageText.replace(/'/g, "\\'")}')" style="margin: 6px; background: #f1f1f1; border-radius: 5px;">Share</div>
        <div class="menu-item" onclick="addFavourite('${messageId}')" style="margin: 6px; background: #f1f1f1; border-radius: 5px;">Add Favourite</div>
    `;
    menu.style.display = "none";

    menuBtn.onclick = (e) => {
        e.stopPropagation();
        menu.style.display = menu.style.display === "block" ? "none" : "block";
    };

    document.addEventListener("click", () => { menu.style.display = "none"; });

    dotsSection.appendChild(menuBtn);
    dotsSection.appendChild(menu);

    const container = document.createElement("div");
    container.className = "action-container";

    const innerWrapper = document.createElement("div");
    innerWrapper.className = "inner-action-wrapper";

    innerWrapper.appendChild(actionBar);
    innerWrapper.appendChild(dotsSection);

    container.appendChild(innerWrapper);

    wrapper.appendChild(container);
}

function saveFeedback(messageId, feedback) {
    const saved = JSON.parse(localStorage.getItem("feedback")) || {};
    saved[messageId] = feedback;
    localStorage.setItem("feedback", JSON.stringify(saved));
}

let currentReply = null;
function replyMessage(messageId) {
    const messageElem = document.getElementById(messageId);
    if (!messageElem) return;

    const msgText = messageElem.innerText || "";
    const shortText = msgText.length > 80 ? msgText.slice(0, 77) + "..." : msgText;

    document.getElementById("reply_preview").style.display = "block";
    document.getElementById("reply_text").textContent = shortText;
    currentReply = { id: messageId, text: msgText };
}

document.getElementById("cancel_reply").onclick = function () {
    document.getElementById("reply_preview").style.display = "none";
    currentReply = null;
};

function shareMessage(messageText) {
    if (!messageText) {
        alert("No message to share!");
        return;
    }

    const encodedText = encodeURIComponent(messageText);
    const pageUrl = encodeURIComponent(window.location.href);

    // Create overlay
    const overlay = document.createElement("div");
    overlay.className = "share-overlay";
    document.body.appendChild(overlay);

    // Create popup menu
    const popup = document.createElement("div");
    popup.className = "share-menu";
    popup.innerHTML = `
        <button class="close-share">&times;</button>
        <div class="share-title">Share Via</div>

        <!-- New custom section inside share-menu -->
        <div class="share-extra">
            <p style="margin:0; font-size:14px; color:#666;">
                You can share this instantly via your favorite platform:
            </p>
        </div>

        <div class="share-icons">
            <button class="share-btn whatsapp" title="WhatsApp">
                <i class="fab fa-whatsapp"></i>
            </button>
            <button class="share-btn telegram" title="Telegram">
                <i class="fab fa-telegram-plane"></i>
            </button>
            <button class="share-btn facebook" title="Facebook">
                <i class="fab fa-facebook-f"></i>
            </button>
            <button class="share-btn gmail" title="Gmail">
                <i class="fas fa-envelope"></i>
            </button>
            <button class="share-btn twitter" title="Twitter">
                <i class="fab fa-x-twitter"></i>
            </button>
            <button class="share-btn copy" title="Copy Text">
                <i class="fas fa-copy"></i>
            </button>
        </div>

        <!-- ✅ Footer -->
        <div class="share-footer">
            <span>Powered by <strong style="color:#6c63ff;">@KIRA.AI</strong></span>
        </div>
    `;
    document.body.appendChild(popup);

    // --- STYLE: HIGH Z-INDEX SO NOTHING HIDES IT ---
    popup.style.zIndex = "99999";
    overlay.style.zIndex = "99998";

    // --- ACTIONS ---
    const open = (url) => window.open(url, "_blank");

    popup.querySelector(".whatsapp").onclick = () =>
        open(`https://api.whatsapp.com/send?text=${encodedText}%0A${pageUrl}`);
    popup.querySelector(".telegram").onclick = () =>
        open(`https://t.me/share/url?url=${pageUrl}&text=${encodedText}`);
    popup.querySelector(".facebook").onclick = () =>
        open(`https://www.facebook.com/sharer/sharer.php?u=${pageUrl}&quote=${encodedText}`);
    popup.querySelector(".gmail").onclick = () =>
        open(`mailto:?subject=Shared Message&body=${messageText}%0A${pageUrl}`);
    popup.querySelector(".twitter").onclick = () =>
        open(`https://twitter.com/intent/tweet?text=${encodedText}%20${pageUrl}`);
    popup.querySelector(".copy").onclick = async () => {
        await navigator.clipboard.writeText(`${messageText}\n${window.location.href}`);
        showToast("Copied to clipboard!");
    };

    // --- CLOSE BUTTON / OVERLAY CLICK ---
    popup.querySelector(".close-share").onclick = () => {
        popup.remove();
        overlay.remove();
    };
    overlay.onclick = () => {
        popup.remove();
        overlay.remove();
    };
}


function showToast(message) {
    // Create toast element
    const toast = document.createElement("div");
    toast.innerText = message;
    toast.style.position = "fixed";
    toast.style.top = "20px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.background = "#ffffffff";
    toast.style.color = "#313131ff";
    toast.style.padding = "10px 20px";
    toast.style.borderRadius = "8px";
    toast.style.boxShadow = "0 4px 10px rgba(0,0,0,0.3)";
    toast.style.zIndex = "999999";
    toast.style.fontFamily = "Inter, sans-serif";
    toast.style.fontSize = "14px";
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s ease, top 0.3s ease";

    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.top = "40px";
    });

    // Remove after 2 seconds
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.top = "20px";
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}


function addFavourite(messageId) {
    alert("Added to favourites: " + messageId);
}

const textQuery = document.getElementById("text_query");
const sendBtn = document.getElementById("send_text");
// Send on Enter key press
textQuery.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault(); // Prevent default Enter behavior
        sendBtn.click();        // Trigger send button click
    }
});

function generateChatTitle(text) {
    if (!text) return "New Chat";

    // Convert to lowercase
    let t = text.toLowerCase();

    // Remove common stop words
    const stopWords = ["how", "many", "i", "you", "we", "he", "she", "it", "is", "are", "the", "of", "in", "on", "for", "a", "an", "to", "my", "your", "can", "me"];
    let words = t.split(/\s+/).filter(w => !stopWords.includes(w));

    // Take first 2–3 words
    const titleWords = words.slice(0, 3);

    // Capitalize first letters
    const title = titleWords.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

    return title || "New Chat";
}

async function loadChatList() {
    const employee_id = localStorage.getItem("employee_id");
    if (!employee_id) return;

    const res = await fetch(`http://127.0.0.1:8000/get_chats/${employee_id}`);
    const chats = await res.json();

    const chatContainer = document.getElementById("chat_list_container");
    chatContainer.innerHTML = "";

    for (const chat of [...chats].reverse()) {
        let firstMessage = "New Chat";
        try {
            const msgRes = await fetch(`http://127.0.0.1:8000/get_chat_messages/${chat.chat_id}`);
            const messages = await msgRes.json();
            const userMsg = messages.find(m => m.sender === "user");
            if (userMsg && userMsg.content) firstMessage = generateChatTitle(userMsg.content);
        } catch (err) {
            console.error("Error fetching first message:", err);
        }

        // Chat item
        const div = document.createElement("div");
        div.className = "chat-item";
        div.dataset.chatId = chat.chat_id;

        // Title
        const title = document.createElement("span");
        title.className = "chat-title";
        title.textContent = firstMessage;
        title.onclick = () => loadChatMessages(chat.chat_id);

        // ⋮ Dots menu button
        const dotsBtn = document.createElement("span");
        dotsBtn.className = "chat-dots-btn";
        dotsBtn.innerHTML = "⋮";

        // Dropdown menu (Share + Delete)
        const menu = document.createElement("div");
        menu.className = "chat-menu";
        menu.innerHTML = `
            <div class="menu-item share-option">
                <img src="img/share.png" alt="Share" style="width:20px; height:20px; margin-right:8px; vertical-align:middle;">
                Share Chat
            </div>
            <div class="menu-item delete-option">
                <img src="img/delete.png" alt="Delete" style="width:20px; height:20px; margin-right:8px; vertical-align:middle;">
                Delete Chat
            </div>
        `;
        menu.style.display = "none";

        // Toggle menu
        dotsBtn.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll(".chat-menu").forEach(m => (m.style.display = "none"));
            menu.style.display = menu.style.display === "block" ? "none" : "block";
        };

        // Hide menu when clicking outside
        document.addEventListener("click", () => (menu.style.display = "none"));

        // ✅ Share action
        menu.querySelector(".share-option").onclick = (e) => {
            e.stopPropagation();
            menu.style.display = "none";
            shareMessage(firstMessage); // use your popup function
        };

        // 🗑️ Delete action
        menu.querySelector(".delete-option").onclick = async (e) => {
            e.stopPropagation();
            menu.style.display = "none";
            showDeleteModal(chat.chat_id, div);
        };

        // Append menu and button
        const rightSection = document.createElement("div");
        rightSection.className = "chat-right-section";
        rightSection.appendChild(dotsBtn);
        rightSection.appendChild(menu);

        div.appendChild(title);
        div.appendChild(rightSection);
        chatContainer.appendChild(div);
    }
}


function showDeleteModal(chatId, chatDiv) {
    const modal = document.getElementById("delete_modal");
    modal.style.display = "flex";

    const cancelBtn = modal.querySelector(".btn-cancel");
    const deleteBtn = modal.querySelector(".btn-delete");

    cancelBtn.onclick = () => (modal.style.display = "none");

    deleteBtn.onclick = async () => {
        try {
            const res = await fetch(`http://127.0.0.1:8000/delete_chat/${chatId}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                chatDiv.remove();
                modal.style.display = "none";
                window.location.reload();
            } else {
                alert("Failed to delete chat: " + data.error);
            }
        } catch (err) {
            console.error("Error deleting chat:", err);
        }
    };
}

document.getElementById("new_chat_btn").addEventListener("click", async () => {
    const employee_id = localStorage.getItem("employee_id");
    if (!employee_id) {
        alert("Please log in first.");
        return;
    }

    try {
        const response = await fetch(`http://127.0.0.1:8000/new_chat/${employee_id}`, {
            method: "POST",
        });
        const data = await response.json();

        if (data.success) {
            const newChatId = data.chat_id;

            // ✅ Save active chat_id
            localStorage.setItem("active_chat_id", newChatId);

            // ✅ Instantly update sidebar (reload chat list)
            await loadChatList(employee_id);

            // ✅ Auto-open the newly created chat
            await loadChatMessages(newChatId);


        } else {
            console.error("Failed to create new chat:", data.error);
        }
    } catch (err) {
        console.error("Error creating new chat:", err);
    }
});




async function loadChatMessages(chatId) {
    const res = await fetch(`http://127.0.0.1:8000/get_chat_messages/${chatId}`);
    const messages = await res.json();
    console.log("Loaded messages:", messages); // <<< add this

    chatBox.innerHTML = ""; // clear existing chat
    messages.forEach(msg => {
        addMessage(msg.content, msg.sender, msg.audio_url, msg.excel_url, null, msg.image_url, false);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    loadChatList();
});

// --- Chat Search Filter ---
const searchInput = document.getElementById("chat_search");
const chatContainer = document.getElementById("chat_list_container");

searchInput.addEventListener("input", function () {
    const filter = this.value.toLowerCase().trim();
    const chats = chatContainer.querySelectorAll(".chat-item");

    chats.forEach(chat => {
        const text = chat.textContent.toLowerCase();
        chat.style.display = text.includes(filter) ? "flex" : "none";
    });
});

// --- SETTINGS MENU TOGGLE ---
const settingIcon = document.querySelector('.setting-icon');
const settingMenu = document.getElementById('setting_menu');

// Toggle settings dropdown visibility
settingIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    settingMenu.style.display = settingMenu.style.display === 'block' ? 'none' : 'block';
});

// Hide settings menu when clicking outside
document.addEventListener('click', (e) => {
    if (!settingMenu.contains(e.target) && !settingIcon.contains(e.target)) {
        settingMenu.style.display = 'none';
    }
});

// ✅ Force HRMS enabled immediately after login (default ON)
window.addEventListener("load", () => {
    const hrmsSetting = localStorage.getItem("hrms_enabled");
    const toggleHrms = document.getElementById("toggle_hrms");

    if (!hrmsSetting) {
        // if not set yet → enable it
        localStorage.setItem("hrms_enabled", "true");
        if (toggleHrms) toggleHrms.checked = true;
        console.log("HRMS Connectivity: Enabled by default (first login)");
    } else if (hrmsSetting === "true") {
        if (toggleHrms) toggleHrms.checked = true;
        console.log("HRMS Connectivity: Enabled (from saved setting)");
    }
});



// --- SAVE TOGGLES IN LOCAL STORAGE ---
const toggleHrms = document.getElementById('toggle_hrms');
const toggleGemini = document.getElementById('toggle_gemini');

// Load saved preferences (set HRMS default ON)
window.addEventListener('DOMContentLoaded', () => {
    const savedHrms = localStorage.getItem('hrms_enabled');
    const savedGemini = localStorage.getItem('gemini_enabled');

    // ✅ If HRMS setting doesn’t exist yet, default to true
    if (savedHrms === null) {
        localStorage.setItem('hrms_enabled', 'true');
        toggleHrms.checked = true;
        console.log('HRMS Connectivity: Enabled by default');
    } else {
        toggleHrms.checked = savedHrms === 'true';
    }

    // Gemini keeps normal behavior (off by default)
    toggleGemini.checked = savedGemini === 'true';
});

// Save HRMS setting
toggleHrms.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    localStorage.setItem('hrms_enabled', isEnabled);
    console.log('HRMS Connectivity:', isEnabled ? 'Enabled' : 'Disabled');
});

// Save Gemini setting
toggleGemini.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    localStorage.setItem('gemini_enabled', isEnabled);
    console.log('Gemini Response:', isEnabled ? 'Enabled' : 'Disabled');
});

async function sendQuery(query) {
    const hrmsEnabled = localStorage.getItem('hrms_enabled') === 'true';
    const geminiEnabled = localStorage.getItem('gemini_enabled') === 'true';

    const response = await fetch("http://127.0.0.1:8000/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            query: query,
            employee_id: 1,
            user_id: 1,
            role: "developer",
            hrms_enabled: hrmsEnabled,
            gemini_enabled: geminiEnabled
        })
    });

    const data = await response.json();
    console.log("Bot:", data.answer);
}


// CONFIGURATION MODAL HANDLERS
document.getElementById("config_option").onclick = async () => {
    document.getElementById("config_modal").style.display = "flex";

    const res = await fetch("http://127.0.0.1:8000/get_config");
    const data = await res.json();

    document.getElementById("odoo_url").value = data.ODOO_URL?.replace(/\/jsonrpc$/, "") || "";
    document.getElementById("odoo_db").value = data.ODOO_DB || "";
    document.getElementById("odoo_user").value = data.ODOO_USERNAME || "";
    document.getElementById("odoo_pass").value = data.ODOO_PASSWORD || "";

    // Parse PostgreSQL URL if present
    if (data.ODOO_DB_URL) {
        try {
            const match = data.ODOO_DB_URL.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
            if (match) {
                document.getElementById("pg_user").value = match[1];
                document.getElementById("pg_pass").value = match[2];
                document.getElementById("pg_host").value = match[3];
                document.getElementById("pg_port").value = match[4];
            }
        } catch (e) {
            console.error("Invalid DB URL format");
        }
    }

    // Always regenerate URL
    generateOdooDBUrl();
};

// ✅ Auto-generate PostgreSQL URL when Odoo DB name or connection inputs change
["odoo_db", "pg_user", "pg_pass", "pg_host", "pg_port"].forEach(id => {
    document.getElementById(id).addEventListener("input", generateOdooDBUrl);
});

// ✅ Function to generate Odoo DB URL dynamically
function generateOdooDBUrl() {
    const user = document.getElementById("pg_user").value || "";
    const pass = document.getElementById("pg_pass").value || "";
    const host = document.getElementById("pg_host").value || "";
    const port = document.getElementById("pg_port").value || "";
    const db = document.getElementById("odoo_db").value || ""; // ✅ use Odoo DB value directly

    const url = user && pass && host && port && db
        ? `postgresql://${user}:${pass}@${host}:${port}/${db}`
        : "";
    document.getElementById("odoo_db_url").value = url;
}

document.getElementById("cancel_config").onclick = () => {
    document.getElementById("config_modal").style.display = "none";
};

document.getElementById("save_config").onclick = async () => {
    let odoo_url = document.getElementById("odoo_url").value.trim();
    // ✅ Automatically append /jsonrpc if missing
    odoo_url = odoo_url.endsWith("/") ? odoo_url.slice(0, -1) : odoo_url;
    if (!odoo_url.endsWith("/jsonrpc")) {
        odoo_url = `${odoo_url}/jsonrpc`;
    }

    const payload = {
        ODOO_URL: odoo_url,
        ODOO_DB: document.getElementById("odoo_db").value,
        ODOO_USERNAME: document.getElementById("odoo_user").value,
        ODOO_PASSWORD: document.getElementById("odoo_pass").value,
        ODOO_DB_URL: document.getElementById("odoo_db_url").value,
    };

    await fetch("http://127.0.0.1:8000/save_config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    document.getElementById("config_modal").style.display = "none";
};

// Sidebar tab switching
document.getElementById("tab_odoo").addEventListener("click", () => {
    document.getElementById("odoo_section").style.display = "block";
    document.getElementById("postgres_section").style.display = "none";
    document.getElementById("tab_odoo").classList.add("active");
    document.getElementById("tab_postgres").classList.remove("active");
});

document.getElementById("tab_postgres").addEventListener("click", () => {
    document.getElementById("odoo_section").style.display = "none";
    document.getElementById("postgres_section").style.display = "block";
    document.getElementById("tab_postgres").classList.add("active");
    document.getElementById("tab_odoo").classList.remove("active");
});

// ✅ Role-based Configuration Visibility
window.addEventListener("DOMContentLoaded", () => {
    const roleType = localStorage.getItem("role");
    const configOption = document.getElementById("config_option");

    if (roleType && roleType.toLowerCase() !== "admin") {
        // Hide configuration option for QA, Developer, or Client
        if (configOption) configOption.style.display = "none";
    }
});

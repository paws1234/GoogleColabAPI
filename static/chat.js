const chats = [];
const chatList = document.querySelector("#chat-list");
const messagesElement = document.querySelector("#messages");
const input = document.querySelector("#prompt-input");
const form = document.querySelector("#chat-form");
const sendButton = document.querySelector("#send-button");
const errorMessage = document.querySelector("#error-message");
const appShell = document.querySelector(".app-shell");
const settingsDialog = document.querySelector("#settings-dialog");
const settingsForm = document.querySelector("#settings-form");
const apiUrlInput = document.querySelector("#api-url");
const settingsError = document.querySelector("#settings-error");

let activeChatId = null;
let sendingChatId = null;
const defaultApiUrl = appShell.dataset.defaultApiUrl;
const apiUrl = localStorage.getItem("prompt-chat-api-url") || defaultApiUrl;
apiUrlInput.value = apiUrl;

function isSending() {
  return sendingChatId !== null;
}

function activeChat() {
  return chats.find((chat) => chat.id === activeChatId);
}

function renderChatList() {
  chatList.replaceChildren();
  for (const chat of chats) {
    const button = document.createElement("button");
    button.className = `chat-item${chat.id === activeChatId ? " active" : ""}`;
    button.type = "button";
    button.textContent = chat.title;
    button.title = chat.title;
    button.addEventListener("click", () => {
      activeChatId = chat.id;
      errorMessage.hidden = true;
      renderChatList();
      renderMessages();
    });
    chatList.append(button);
  }
}

function renderMessages() {
  const chat = activeChat();
  messagesElement.replaceChildren();

  if (!chat || chat.messages.length === 0) {
    const welcome = document.createElement("div");
    welcome.className = "welcome";

    const mark = document.createElement("div");
    mark.className = "welcome-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "✳";

    const heading = document.createElement("h1");
    heading.textContent = "What would you like to explore?";

    const subtitle = document.createElement("p");
    subtitle.textContent = "Ask a question, work through an idea, or get something done.";

    const suggestions = document.createElement("div");
    suggestions.className = "suggestions";
    for (const prompt of [
      "Explain a tricky topic in simple terms",
      "Help me brainstorm a fresh idea",
      "Write a clear, thoughtful email",
      "Make a plan for a project I have in mind",
    ]) {
      const button = document.createElement("button");
      button.className = "suggestion";
      button.type = "button";
      button.textContent = prompt;
      button.addEventListener("click", () => {
        input.value = prompt;
        updateComposer();
        input.focus();
      });
      suggestions.append(button);
    }

    welcome.append(mark, heading, subtitle, suggestions);
    messagesElement.append(welcome);
    return;
  }

  for (const message of chat.messages) {
    const bubble = document.createElement("div");
    bubble.className = `message ${message.role}`;

    if (message.role === "assistant") {
      const mark = document.createElement("span");
      mark.className = "assistant-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = "✳";

      const content = document.createElement("div");
      content.className = "message-content";
      content.textContent = message.content;
      bubble.append(mark, content);
    } else {
      bubble.textContent = message.content;
    }

    messagesElement.append(bubble);
  }

  if (sendingChatId === chat.id) {
    const bubble = document.createElement("div");
    bubble.className = "message assistant";
    const mark = document.createElement("span");
    mark.className = "assistant-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "✳";
    const dots = document.createElement("span");
    dots.className = "typing";
    dots.setAttribute("aria-label", "Assistant is responding");
    dots.append(document.createElement("span"), document.createElement("span"), document.createElement("span"));
    bubble.append(mark, dots);
    messagesElement.append(bubble);
  }

  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function newChat() {
  const chat = {
    id: crypto.randomUUID(),
    title: "New chat",
    messages: [],
  };
  chats.unshift(chat);
  activeChatId = chat.id;
  errorMessage.hidden = true;
  renderChatList();
  renderMessages();
  input.focus();
}

function updateComposer() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 170)}px`;
  sendButton.disabled = isSending() || !input.value.trim();
}

async function sendMessage(text) {
  let chat = activeChat();
  if (!chat) {
    newChat();
    chat = activeChat();
  }

  chat.messages.push({ role: "user", content: text });
  if (chat.title === "New chat") {
    chat.title = text.length > 34 ? `${text.slice(0, 34)}…` : text;
  }
  const chatId = chat.id;
  errorMessage.hidden = true;
  sendingChatId = chatId;
  renderChatList();
  renderMessages();
  updateComposer();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chat.messages, api_url: apiUrl }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || `Request failed (${response.status}).`);
    }
    chat.messages.push({ role: "assistant", content: result.reply });
  } catch (error) {
    errorMessage.textContent = error.message || "Something went wrong. Please try again.";
    errorMessage.hidden = false;
  } finally {
    sendingChatId = null;
    renderChatList();
    renderMessages();
    updateComposer();
  }
}

document.querySelector("#new-chat").addEventListener("click", newChat);
document.querySelector("#mobile-new-chat").addEventListener("click", newChat);
document.querySelector("#open-settings").addEventListener("click", () => {
  apiUrlInput.value = apiUrl;
  settingsError.hidden = true;
  settingsDialog.showModal();
});
document.querySelector("#close-settings").addEventListener("click", () => settingsDialog.close());
document.querySelector("#reset-api-url").addEventListener("click", () => {
  apiUrlInput.value = defaultApiUrl;
});

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = apiUrlInput.value.trim();
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.hash) {
      throw new Error("Use an HTTP or HTTPS URL without credentials or a fragment.");
    }
    if (value.length > 2048) {
      throw new Error("The API URL must be 2048 characters or fewer.");
    }
    localStorage.setItem("prompt-chat-api-url", value);
    window.location.reload();
  } catch (error) {
    settingsError.textContent = error instanceof TypeError ? "Enter a valid API URL." : error.message;
    settingsError.hidden = false;
  }
});

input.addEventListener("input", updateComposer);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text || isSending()) return;
  input.value = "";
  updateComposer();
  sendMessage(text);
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    newChat();
  }
});

newChat();

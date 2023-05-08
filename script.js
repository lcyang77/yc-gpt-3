// 保存历史消息
let history = [];



document.getElementById("apiKeyForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const apiKey = document.getElementById("apiKey").value;
    localStorage.setItem("apiKey", apiKey);
});

document.getElementById("messageForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.getElementById("message").value;
    document.getElementById("message").value = "";
    displayMessage("user", message);

    history.push({ role: "user", content: message });

    const apiKey = localStorage.getItem("apiKey") || "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";

    setLoading(true);
    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: history,
            }),
        });
    
        if (response.ok) {
            const data = await response.json();
            const assistantMessage = data.choices[0].message.content;
            displayMessage("assistant", assistantMessage);
            history.push({ role: "assistant", content: assistantMessage });
        } else {
            const errorData = await response.json();
            displayMessage("assistant", `Error: ${errorData.error.message}`);
        }
    } catch (error) {
        displayMessage("assistant", `Error: ${error.message}`);
    } finally {
        setLoading(false);
    }
});

function displayMessage(role, message) {
const chat = document.getElementById("chat");
const messageElement = document.createElement("div");
messageElement.classList.add(role);
messageElement.textContent = message;
chat.appendChild(messageElement);
chat.scrollTop = chat.scrollHeight;
}

function setLoading(isLoading) {
const loadingElement = document.getElementById("loading");
if (isLoading) {
loadingElement.style.display = "block";
} else {
loadingElement.style.display = "none";
}
}




function displayMessage(role, message) {
    const chat = document.getElementById("chat");

    // 创建包装消息的元素
    const messageWrapper = document.createElement("div");
    messageWrapper.classList.add("message-wrapper");
    messageWrapper.classList.add(`${role}-wrapper`);

    const messageElement = document.createElement("div");
    messageElement.classList.add(role);
    messageElement.textContent = message;

    // 将消息元素添加到包装元素中
    messageWrapper.appendChild(messageElement);

    chat.appendChild(messageWrapper);
    chat.scrollTop = chat.scrollHeight;
}
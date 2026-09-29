// ============================
// 长效干扰素患者管理助手
// 第一版 正式规范结构版
// ============================

// 打开 AI 页面
function openAI() {
    const page = document.getElementById("aiPage");
    page.classList.add("active");
}

// 关闭 AI 页面
function closeAI() {
    const page = document.getElementById("aiPage");
    page.classList.remove("active");
}

// 打开症状打卡
function openCheckin() {
    const page = document.getElementById("checkinPage");
    page.classList.add("active");
}

// 关闭症状打卡
function closeCheckin() {
    const page = document.getElementById("checkinPage");
    page.classList.remove("active");
}

// ============================
// AI 问询 与 风险拦截
// ============================

// 快捷问题
function askQuestion(question) {
    document.getElementById("questionInput").value = question;
    sendQuestion();
}

// 发送问题（已接入红黄绿医疗安全规则引擎）
function sendQuestion() {
    const input = document.getElementById("questionInput");
    const question = input.value.trim();

    if (question === "") {
        return;
    }

    // 获取聊天框
    const chatBox = document.getElementById("chatBox");

    // 创建患者消息并渲染到界面
    const userMessage = document.createElement("div");
    userMessage.className = "user-message";
    userMessage.innerHTML = `
        <div>
            ${escapeHTML(question)}
        </div>
    `;
    chatBox.appendChild(userMessage);

    // 清空输入框
    input.value = "";

    // ----------------------------------------------------
    // 核心安全审查：调用规则引擎检查风险
    // ----------------------------------------------------
    const checkResult = RiskEngine.analyzeSymptoms(question);

    // 1. 如果触发红色警报
    if (checkResult.level === "RED") {
        const redSystemMessage = document.createElement("div");
        redSystemMessage.className = "ai-message";
        redSystemMessage.innerHTML = `
            <div class="avatar" style="background: #ff4d4f;">🚨</div>
            <div class="message-content" style="color: #ff4d4f; font-weight: bold; background: #fff2f0; border: 1px solid #ffccc7; border-radius: 8px; padding: 10px;">
                ${checkResult.warning}
            </div>
        `;
        chatBox.appendChild(redSystemMessage);
        
        // 自动滚动到底部并直接 return 中断，不触发后面的 AI 模拟思考
        chatBox.scrollTop = chatBox.scrollHeight;
        return; 
    }

    // 2. 如果触发黄色警告
    if (checkResult.level === "YELLOW") {
        const yellowSystemMessage = document.createElement("div");
        yellowSystemMessage.className = "ai-message";
        yellowSystemMessage.innerHTML = `
            <div class="avatar" style="background: #faad14;">⚠️</div>
            <div class="message-content" style="color: #d46b08; background: #fffbe6; border: 1px solid #ffe58f; border-radius: 8px; padding: 10px; margin-bottom: 10px;">
                ${checkResult.warning}
            </div>
        `;
        chatBox.appendChild(yellowSystemMessage);
    }

    // 3. 模拟 AI 思考（绿色状态，或黄色状态下的科普后续）
    setTimeout(function () {
        const answer = generateDemoAnswer(question);
        const aiMessage = document.createElement("div");
        aiMessage.className = "ai-message";
        aiMessage.innerHTML = `
            <div class="avatar">
                AI
            </div>
            <div class="message-content">
                ${answer}
            </div>
        `;
        chatBox.appendChild(aiMessage);

        // 自动滚动到底部
        chatBox.scrollTop = chatBox.scrollHeight;
    }, 600);
}

// ============================
// 模拟知识库回复
// ============================
function generateDemoAnswer(question) {
    const q = question.toLowerCase();

    // 发热
    if (q.includes("发烧") || q.includes("发热") || q.includes("体温")) {
        return `
            <p>干扰素治疗期间可能出现发热、寒战、乏力等流感样症状。</p>
            <p>但是否需要进一步处理，需要结合您的具体体温、持续时间、伴随症状以及近期检查结果判断。</p>
            <p><strong>请告诉我：目前体温是多少？持续多久了？是否伴有寒战、呼吸困难或其他明显不适？</strong></p>
            <p>本回答仅用于健康信息参考，不能替代医生的诊断和治疗决定。</p>
        `;
    }

    // 白细胞
    if (q.includes("白细胞") || q.includes("中性粒细胞")) {
        return `
            <p>干扰素治疗期间可能出现血液学指标变化，包括白细胞及中性粒细胞等指标下降。</p>
            <p>是否需要进一步处理，需要结合具体数值、变化趋势、患者症状以及医生制定的治疗方案综合判断。</p>
            <p>如果您愿意，可以告诉我最近一次<strong>白细胞和中性粒细胞数值</strong>，以及上一次检查结果。</p>
            <p>我可以帮助您整理指标变化，供您与医生沟通。</p>
        `;
    }

    // 乏力
    if (q.includes("乏力") || q.includes("疲劳") || q.includes("累")) {
        return `
            <p>干扰素治疗期间可能出现疲劳、乏力等症状。</p>
            <p>如果症状持续存在、明显加重，或者同时出现其他异常表现，建议及时向主管医生反馈。</p>
            <p>您可以记录症状出现的时间、严重程度以及与用药之间的关系，这些信息有助于医生判断。</p>
        `;
    }

    // 默认回答
    return `
        <p>我可以帮助您整理干扰素治疗期间的用药、症状和检查指标问题。</p>
        <p>为了更准确地了解您的情况，请尽量告诉我：</p>
        <p>① 目前正在使用的药物<br>② 出现了什么症状<br>③ 症状什么时候开始<br>④ 最近一次检查结果</p>
        <p>如果出现明显或快速加重的不适，请及时联系您的主管医生或寻求线下医疗帮助。</p>
    `;
}

// 防止用户输入 HTML
// ============================
function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// Enter 发送
// ============================
function handleEnter(event) {
    if (event.key === "Enter") {
        sendQuestion();
    }
}

// 症状打卡
// ============================
// 临时测试用的简单逻辑
function submitCheckin() {
    const temperature = document.getElementById("temperature").value;
    if (temperature === "") {
        alert("请填写今天的体温");
        return;
    }
    alert("今日记录已保存。\n\n当前版本为演示版，数据暂未连接数据库。");
    closeCheckin();
}

// 普通提示
// ============================
function showMessage(message) {
    alert(message);
}

// ============================================================
// 长效干扰素患者管理助手
// app.js - V1.1
// 与 risk-engine/rules.js 配套
// ============================================================


// ============================================================
// 一、AI 页面
// ============================================================

function openAI() {

    const page = document.getElementById("aiOverlay");

    if (!page) {
        console.error("找不到 AI 页面：#aiOverlay");
        return;
    }

    page.style.display = "block";

    const input = document.getElementById("questionInput");

    if (input) {
        setTimeout(function () {
            input.focus();
        }, 100);
    }
}


function closeAI() {

    const page = document.getElementById("aiOverlay");

    if (!page) {
        console.error("找不到 AI 页面：#aiOverlay");
        return;
    }

    page.style.display = "none";
}


// ============================================================
// 二、症状记录页面
// ============================================================

function openCheckin() {

    const page = document.getElementById("checkinOverlay");

    if (!page) {
        console.error("找不到症状记录页面：#checkinOverlay");
        return;
    }

    page.style.display = "block";
}


function closeCheckin() {

    const page = document.getElementById("checkinOverlay");

    if (!page) {
        console.error("找不到症状记录页面：#checkinOverlay");
        return;
    }

    page.style.display = "none";
}


// ============================================================
// 三、AI 快捷问题
// ============================================================

function askQuestion(question) {

    const input = document.getElementById("questionInput");

    if (!input) {
        console.error("找不到问题输入框：#questionInput");
        return;
    }

    input.value = question;

    sendQuestion();
}


// ============================================================
// 四、发送 AI 问题
// ============================================================

function sendQuestion() {

    const input = document.getElementById("questionInput");

    if (!input) {
        console.error("找不到问题输入框：#questionInput");
        return;
    }

    const question = input.value.trim();

    if (question === "") {
        return;
    }


    // --------------------------------------------------------
    // 获取聊天区域
    // --------------------------------------------------------

    const chatBox = document.getElementById("chatMessages");

    if (!chatBox) {
        console.error("找不到聊天区域：#chatMessages");
        return;
    }


    // --------------------------------------------------------
    // 1. 显示患者问题
    // --------------------------------------------------------

    const userMessage = document.createElement("div");

    userMessage.className = "chat-message user-message";

    userMessage.innerHTML = `
        <div class="message-label">
            患者
        </div>

        <div class="message-content">
            ${escapeHTML(question)}
        </div>
    `;

    chatBox.appendChild(userMessage);


    // 清空输入框

    input.value = "";


    // --------------------------------------------------------
    // 2. 调用医疗安全规则引擎
    // --------------------------------------------------------

    let checkResult = null;


    // 检查 RiskEngine 是否正常加载

    if (typeof RiskEngine === "undefined") {

        console.error("RiskEngine 未加载，请检查 risk-engine/rules.js");

        showAIMessage(
            "⚠️ 医疗安全规则引擎暂时无法加载。为了保证安全，本次暂不继续 AI 回答，请联系医生。",
            "RED"
        );

        return;
    }


    // 执行风险分析

    try {

        checkResult = RiskEngine.analyzeSymptoms(question);

    } catch (error) {

        console.error("RiskEngine 执行错误：", error);

        showAIMessage(
            "⚠️ 当前无法完成医疗安全风险检查。为了保证安全，本次暂不继续 AI 回答，请联系医生。",
            "RED"
        );

        return;
    }


    // --------------------------------------------------------
    // 3. 红色风险
    // --------------------------------------------------------

    if (checkResult.level === "RED") {

        showAIMessage(
            `
            <strong>🚨 医疗安全提示</strong>

            <p>
                ${escapeHTML(checkResult.warning)}
            </p>

            <p>
                <strong>
                    建议：${escapeHTML(checkResult.suggestAction)}
                </strong>
            </p>

            <p>
                当前情况下，AI不会继续进行普通健康问答。
            </p>
            `,
            "RED"
        );

        scrollChatToBottom();

        return;
    }


    // --------------------------------------------------------
    // 4. 黄色风险
    // --------------------------------------------------------

    if (checkResult.level === "YELLOW") {

        let questionsHTML = "";

        if (
            Array.isArray(checkResult.followUpQuestions) &&
            checkResult.followUpQuestions.length > 0
        ) {

            questionsHTML = `
                <div class="follow-up-box">

                    <strong>
                        为了进一步了解情况，请告诉我：
                    </strong>

                    <ul>
                        ${checkResult.followUpQuestions
                            .map(function (item) {
                                return `<li>${escapeHTML(item)}</li>`;
                            })
                            .join("")
                        }
                    </ul>

                </div>
            `;
        }


        showAIMessage(
            `
            <strong>⚠️ 风险提示</strong>

            <p>
                ${escapeHTML(checkResult.warning)}
            </p>

            ${questionsHTML}

            <p>
                ${escapeHTML(checkResult.suggestAction)}
            </p>

            <p>
                <small>
                    本助手仅提供健康信息整理，不能替代医生的诊断和治疗决定。
                </small>
            </p>
            `,
            "YELLOW"
        );


        /*
         * 黄色风险不直接把患者判定为“安全”。
         *
         * 当前版本先进行安全提示和关键问题询问。
         * 后续接入真实 AI 后：
         *
         * 患者回答关键问题
         * ↓
         * 风险规则重新判断
         * ↓
         * 再决定是否允许 AI 继续回答
         */

        scrollChatToBottom();

        return;
    }


    // --------------------------------------------------------
    // 5. REVIEW：未知风险
    // --------------------------------------------------------

    if (checkResult.level === "REVIEW") {

        showAIMessage(
            `
            <strong>ℹ️ 需要更多信息</strong>

            <p>
                ${escapeHTML(checkResult.warning)}
            </p>

            <p>
                为了更好地了解情况，请告诉我：
            </p>

            <ul>
                ${
                    checkResult.followUpQuestions
                        .map(function (item) {
                            return `<li>${escapeHTML(item)}</li>`;
                        })
                        .join("")
                }
            </ul>

            <p>
                当前不会把这种情况直接判断为“安全”。
            </p>
            `,
            "REVIEW"
        );

        scrollChatToBottom();

        return;
    }


    // --------------------------------------------------------
    // 6. GREEN
    // --------------------------------------------------------

    if (checkResult.level === "GREEN") {

        setTimeout(function () {

            const answer = generateDemoAnswer(question);

            showAIMessage(
                answer,
                "GREEN"
            );

            scrollChatToBottom();

        }, 600);

    }

}


// ============================================================
// 五、显示 AI 消息
// ============================================================

function showAIMessage(message, level) {

    const chatBox = document.getElementById("chatMessages");

    if (!chatBox) {
        return;
    }


    const aiMessage = document.createElement("div");

    aiMessage.className = "chat-message ai-message";


    let label = "AI健康助手";

    if (level === "RED") {
        label = "🚨 医疗安全提示";
    }

    else if (level === "YELLOW") {
        label = "⚠️ 风险提示";
    }

    else if (level === "REVIEW") {
        label = "ℹ️ 信息补充";
    }


    aiMessage.innerHTML = `

        <div class="message-label">
            ${label}
        </div>

        <div class="message-content">
            ${message}
        </div>

    `;


    chatBox.appendChild(aiMessage);
}


// ============================================================
// 六、演示版知识库回答
// ============================================================

function generateDemoAnswer(question) {

    const q = question.toLowerCase();


    // --------------------------------------------------------
    // 发热
    // --------------------------------------------------------

    if (
        q.includes("发烧") ||
        q.includes("发热") ||
        q.includes("体温")
    ) {

        return `
            <p>
                长效干扰素治疗期间，部分患者可能出现发热、寒战、乏力等流感样症状。
            </p>

            <p>
                是否需要进一步处理，需要结合具体体温、持续时间、
                伴随症状以及近期检查结果综合判断。
            </p>

            <p>
                如果您正在发热，请记录：
                <strong>体温、持续时间以及是否伴随其他症状。</strong>
            </p>

            <p>
                如症状明显加重，请及时联系主管医生或前往医疗机构。
            </p>

            <p>
                <small>
                    本回答仅用于健康信息参考，不能替代医生的诊断和治疗决定。
                </small>
            </p>
        `;
    }


    // --------------------------------------------------------
    // 白细胞 / 中性粒细胞
    // --------------------------------------------------------

    if (
        q.includes("白细胞") ||
        q.includes("中性粒细胞")
    ) {

        return `
            <p>
                长效干扰素治疗期间可能出现血液学指标变化，
                包括白细胞和中性粒细胞等指标变化。
            </p>

            <p>
                是否需要进一步处理，不能只看一个指标，
                通常还需要结合具体数值、变化趋势、症状以及医生制定的治疗方案。
            </p>

            <p>
                您可以提供最近一次和上一次的检查结果，
                我可以帮助您整理<strong>变化趋势</strong>，供您与医生沟通。
            </p>

            <p>
                <small>
                    AI不会自行决定停药、减量或改变治疗方案。
                </small>
            </p>
        `;
    }


    // --------------------------------------------------------
    // 乏力
    // --------------------------------------------------------

    if (
        q.includes("乏力") ||
        q.includes("疲劳") ||
        q.includes("累")
    ) {

        return `
            <p>
                长效干扰素治疗期间可能出现疲劳、乏力等症状。
            </p>

            <p>
                建议记录症状出现的时间、持续时间和严重程度，
                并观察是否伴随发热、食欲下降或其他异常情况。
            </p>

            <p>
                如果症状持续存在、明显加重或影响正常生活，
                建议及时向主管医生反馈。
            </p>
        `;
    }


    // --------------------------------------------------------
    // 默认回答
    // --------------------------------------------------------

    return `
        <p>
            我可以帮助您整理长效干扰素治疗期间的
            用药、症状和检查指标信息。
        </p>

        <p>
            为了更准确地了解您的情况，请尽量告诉我：
        </p>

        <p>
            ① 目前正在使用的药物<br>
            ② 出现了什么症状<br>
            ③ 症状什么时候开始<br>
            ④ 症状严重程度<br>
            ⑤ 最近一次检查结果
        </p>

        <p>
            如果出现明显或快速加重的不适，
            请及时联系您的主管医生或寻求线下医疗帮助。
        </p>
    `;
}


// ============================================================
// 七、防止 HTML 注入
// ============================================================

function escapeHTML(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}


// ============================================================
// 八、聊天框自动滚动
// ============================================================

function scrollChatToBottom() {

    const chatBox = document.getElementById("chatMessages");

    if (!chatBox) {
        return;
    }

    chatBox.scrollTop = chatBox.scrollHeight;
}


// ============================================================
// 九、Enter 发送
// ============================================================

function handleEnter(event) {

    if (event.key === "Enter") {

        event.preventDefault();

        sendQuestion();
    }
}


// ============================================================
// 十、症状打卡
// ============================================================

function submitCheckin() {

    const temperatureInput =
        document.getElementById("temperatureInput");


    if (!temperatureInput) {

        console.error(
            "找不到体温输入框：#temperatureInput"
        );

        return;
    }


    const temperature =
        temperatureInput.value.trim();


    if (temperature === "") {

        alert("请填写今天的体温");

        return;
    }


    // 获取患者选择的症状

    const symptoms =
        Array.from(
            document.querySelectorAll(
                'input[name="symptom"]:checked'
            )
        ).map(function (item) {
            return item.value;
        });


    console.log(
        "今日体温：",
        temperature
    );

    console.log(
        "今日症状：",
        symptoms
    );


    alert(
        "今日记录已保存。\n\n" +
        "当前版本为演示版，数据暂未连接数据库。"
    );


    closeCheckin();
}


// ============================================================
// 十一、普通提示
// ============================================================

function showMessage(message) {

    alert(message);
}
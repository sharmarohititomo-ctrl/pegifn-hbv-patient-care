// ============================================================
// 长效干扰素患者管理助手
// app.js - V2.1
// 前端 → Backend API → Risk Engine
// ============================================================


// ============================================================
// 一、后端 API 地址
// ============================================================

const API_BASE_URL = "http://127.0.0.1:3000";


// ============================================================
// 二、AI 页面
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
// 三、症状记录页面
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
// 四、AI 快捷问题
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
// 五、发送问题
// ============================================================

async function sendQuestion() {

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
    // 2. 显示“正在安全检查”
    // --------------------------------------------------------

    const checkingMessage = document.createElement("div");

    checkingMessage.className = "chat-message ai-message";

    checkingMessage.innerHTML = `
        <div class="message-label">
            医疗安全检查
        </div>

        <div class="message-content">
            正在进行医疗安全风险检查，请稍候……
        </div>
    `;

    chatBox.appendChild(checkingMessage);

    scrollChatToBottom();


    // --------------------------------------------------------
    // 3. 调用后端风险 API
    // --------------------------------------------------------

    let checkResult;

    try {

        const response = await fetch(
            API_BASE_URL + "/api/risk/analyze",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json; charset=utf-8"
                },

                body: JSON.stringify({
                    text: question
                })
            }
        );


        // HTTP 状态检查

        if (!response.ok) {

            throw new Error(
                "后端 API 返回 HTTP " + response.status
            );
        }


        // 读取 JSON

        const result = await response.json();


        console.log(
            "后端风险 API 返回：",
            result
        );


        if (
            !result ||
            result.success !== true ||
            !result.data
        ) {

            throw new Error(
                "后端返回的数据格式不正确"
            );
        }


        checkResult = result.data;


    } catch (error) {

        console.error(
            "调用后端风险 API 失败：",
            error
        );


        // 删除“正在检查”

        if (checkingMessage.parentNode) {
            checkingMessage.remove();
        }


        showAIMessage(
            `
            <strong>⚠️ 暂时无法完成安全检查</strong>

            <p>
                当前无法连接医疗安全风险服务。
            </p>

            <p>
                为保证安全，本次暂不继续普通 AI 健康问答。
            </p>

            <p>
                如您有明显或严重不适，请及时联系主管医生或前往医疗机构。
            </p>

            <p>
                <small>
                    技术提示：请确认后端服务
                    http://127.0.0.1:3000
                    正在运行。
                </small>
            </p>
            `,
            "RED"
        );

        scrollChatToBottom();

        return;
    }


    // --------------------------------------------------------
    // 删除“正在检查”
    // --------------------------------------------------------

    if (checkingMessage.parentNode) {
        checkingMessage.remove();
    }


    // --------------------------------------------------------
    // 输出调试信息
    // --------------------------------------------------------

    console.log(
        "========== 前端风险检查结果 =========="
    );

    console.log(
        "患者问题：",
        question
    );

    console.log(
        "风险等级：",
        checkResult.level
    );

    console.log(
        "匹配关键词：",
        checkResult.matchedKeyword
    );

    console.log(
        "是否需要医生：",
        checkResult.needDoctor
    );

    console.log(
        "是否允许 AI：",
        checkResult.allowAI
    );

    console.log(
        "是否停止 AI：",
        checkResult.stopAI
    );

    console.log(
        "======================================"
    );


    // --------------------------------------------------------
    // 4. RED：高风险
    // --------------------------------------------------------

    if (checkResult.level === "RED") {

        showAIMessage(
            `
            <strong>🚨 医疗安全提示</strong>

            <p>
                ${escapeHTML(
                    checkResult.warning ||
                    "检测到需要进一步医疗评估的高风险信号。"
                )}
            </p>

            <p>
                <strong>
                    建议：
                    ${escapeHTML(
                        checkResult.suggestAction ||
                        "请及时联系主管医生或前往医疗机构进一步评估。"
                    )}
                </strong>
            </p>

            <p>
                当前情况下，AI不会继续进行普通健康问答。
            </p>

            <p>
                <small>
                    如果症状严重或正在快速加重，请及时寻求线下医疗帮助。
                </small>
            </p>
            `,
            "RED"
        );

        scrollChatToBottom();

        return;
    }


    // --------------------------------------------------------
    // 5. YELLOW：需要进一步了解
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
                        ${
                            checkResult.followUpQuestions
                                .map(function (item) {
                                    return `
                                        <li>
                                            ${escapeHTML(item)}
                                        </li>
                                    `;
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
                ${escapeHTML(
                    checkResult.warning ||
                    "检测到需要进一步了解的症状。"
                )}
            </p>

            ${questionsHTML}

            <p>
                ${escapeHTML(
                    checkResult.suggestAction ||
                    "请继续提供相关信息，并根据需要联系医生。"
                )}
            </p>

            <p>
                <small>
                    本助手仅提供健康信息整理，
                    不能替代医生的诊断和治疗决定。
                </small>
            </p>
            `,
            "YELLOW"
        );

        scrollChatToBottom();

        return;
    }


    // --------------------------------------------------------
    // 6. REVIEW：信息不足，但允许 AI 做一般健康教育
    // --------------------------------------------------------

    if (checkResult.level === "REVIEW") {

        let questionsHTML = "";

        if (
            Array.isArray(checkResult.followUpQuestions) &&
            checkResult.followUpQuestions.length > 0
        ) {

            questionsHTML = `
                <div class="follow-up-box">

                    <strong>
                        如果方便，可以继续补充：
                    </strong>

                    <ul>
                        ${
                            checkResult.followUpQuestions
                                .map(function (item) {
                                    return `
                                        <li>
                                            ${escapeHTML(item)}
                                        </li>
                                    `;
                                })
                                .join("")
                        }
                    </ul>

                </div>
            `;
        }


        // ----------------------------------------------------
        // REVIEW 的核心安全判断
        //
        // 当前 Risk Engine：
        // allowAI = true
        // stopAI = false
        //
        // 因此允许继续进行一般健康教育。
        // ----------------------------------------------------

        if (
            checkResult.allowAI === true &&
            checkResult.stopAI !== true
        ) {

            setTimeout(function () {

                const answer =
                    generateDemoAnswer(question);

                showAIMessage(
                    `
                    <div class="review-notice">

                        <strong>ℹ️ 信息补充</strong>

                        <p>
                            当前没有检测到已经建立的高风险信号，
                            但现有信息不足以完成完整风险判断。
                        </p>

                        ${questionsHTML}

                    </div>

                    <hr>

                    <div>
                        ${answer}
                    </div>

                    <p>
                        <small>
                            本回答用于健康信息整理和健康教育，
                            不替代医生的诊断、处方或治疗决定。
                        </small>
                    </p>
                    `,
                    "REVIEW"
                );

                scrollChatToBottom();

            }, 600);

            return;
        }


        // ----------------------------------------------------
        // REVIEW 但不允许 AI
        // ----------------------------------------------------

        showAIMessage(
            `
            <strong>ℹ️ 需要进一步评估</strong>

            <p>
                ${escapeHTML(
                    checkResult.warning ||
                    "当前信息不足以判断风险等级。"
                )}
            </p>

            <p>
                为保证安全，当前暂不继续普通 AI 健康问答。
            </p>

            ${questionsHTML}

            <p>
                如有明显或持续加重的不适，请及时联系主管医生。
            </p>
            `,
            "REVIEW"
        );

        scrollChatToBottom();

        return;
    }


    // --------------------------------------------------------
    // 7. GREEN：允许继续 AI
    // --------------------------------------------------------

    if (checkResult.level === "GREEN") {

        setTimeout(function () {

            const answer =
                generateDemoAnswer(question);

            showAIMessage(
                answer,
                "GREEN"
            );

            scrollChatToBottom();

        }, 600);

        return;
    }


    // --------------------------------------------------------
    // 8. 未知风险等级
    // --------------------------------------------------------

    showAIMessage(
        `
        <strong>⚠️ 医疗安全提示</strong>

        <p>
            当前风险状态无法确认。
        </p>

        <p>
            为保证安全，本次暂不继续普通 AI 回答。
        </p>

        <p>
            请联系主管医生。
        </p>
        `,
        "RED"
    );

    scrollChatToBottom();
}


// ============================================================
// 六、显示 AI 消息
// ============================================================

function showAIMessage(message, level) {

    const chatBox =
        document.getElementById("chatMessages");

    if (!chatBox) {
        return;
    }


    const aiMessage =
        document.createElement("div");

    aiMessage.className =
        "chat-message ai-message";


    let label =
        "AI健康助手";


    if (level === "RED") {

        label =
            "🚨 医疗安全提示";

    }

    else if (level === "YELLOW") {

        label =
            "⚠️ 风险提示";

    }

    else if (level === "REVIEW") {

        label =
            "ℹ️ 信息补充";

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
// 七、演示版知识库回答
// ============================================================

function generateDemoAnswer(question) {

    const q =
        question.toLowerCase();


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
                长效干扰素治疗期间，部分患者可能出现发热、
                寒战、乏力等流感样症状。
            </p>

            <p>
                是否需要进一步处理，需要结合具体体温、
                持续时间、伴随症状以及近期检查结果综合判断。
            </p>

            <p>
                如果您正在发热，请记录：
                <strong>
                    体温、持续时间以及是否伴随其他症状。
                </strong>
            </p>

            <p>
                如症状明显加重，请及时联系主管医生
                或前往医疗机构。
            </p>

            <p>
                <small>
                    本回答仅用于健康信息参考，
                    不能替代医生的诊断和治疗决定。
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
                通常还需要结合具体数值、变化趋势、
                症状以及医生制定的治疗方案。
            </p>

            <p>
                您可以提供最近一次和上一次的检查结果，
                我可以帮助您整理
                <strong>变化趋势</strong>，
                供您与医生沟通。
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
// 八、防止 HTML 注入
// ============================================================

function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent =
        text == null ? "" : String(text);

    return div.innerHTML;
}


// ============================================================
// 九、聊天框自动滚动
// ============================================================

function scrollChatToBottom() {

    const chatBox =
        document.getElementById("chatMessages");

    if (!chatBox) {
        return;
    }

    chatBox.scrollTop =
        chatBox.scrollHeight;
}


// ============================================================
// 十、Enter 发送
// ============================================================

function handleEnter(event) {

    if (event.key === "Enter") {

        event.preventDefault();

        sendQuestion();
    }
}


// ============================================================
// 十一、症状打卡
// ============================================================

function submitCheckin() {

    const temperatureInput =
        document.getElementById(
            "temperatureInput"
        );


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
// 十二、普通提示
// ============================================================

function showMessage(message) {

    alert(message);
}


// ============================================================
// 十三、后端连接测试
// ============================================================

async function testBackendConnection() {

    try {

        const response =
            await fetch(
                API_BASE_URL + "/api/health"
            );


        if (!response.ok) {

            throw new Error(
                "HTTP " + response.status
            );
        }


        const result =
            await response.json();


        console.log(
            "后端连接测试成功：",
            result
        );


        return true;

    } catch (error) {

        console.error(
            "后端连接测试失败：",
            error
        );


        return false;
    }
}
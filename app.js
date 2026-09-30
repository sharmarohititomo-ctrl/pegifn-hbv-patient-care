// ============================================================
// 长效干扰素患者管理助手
// app.js - V3.1
//
// 前端
//   ↓
// Backend API
//   ↓
// Risk Engine
//   ↓
// RAG Knowledge Base
//   ↓
// 患者健康教育
//
// 核心安全原则：
// 1. Risk Engine 永远优先于 AI
// 2. RED：停止 AI 和 RAG
// 3. YELLOW：允许安全知识检索，但不进行个体化治疗决策
// 4. REVIEW：允许安全范围内健康教育
// 5. GREEN：允许健康教育
// 6. AI 不自行诊断
// 7. AI 不自行处方
// 8. AI 不自行决定停药、减量或改变治疗方案
// ============================================================


// ============================================================
// 一、后端 API 地址
// ============================================================

const API_BASE_URL = "http://127.0.0.1:3000";


// ============================================================
// 二、AI 页面
// ============================================================

function openAI() {

    const page =
        document.getElementById("aiOverlay");

    if (!page) {

        console.error("找不到 AI 页面：#aiOverlay");
        return;
    }

    page.style.display = "block";

    const input =
        document.getElementById("questionInput");

    if (input) {

        setTimeout(function () {

            input.focus();

        }, 100);
    }
}


function closeAI() {

    const page =
        document.getElementById("aiOverlay");

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

    const page =
        document.getElementById("checkinOverlay");

    if (!page) {

        console.error(
            "找不到症状记录页面：#checkinOverlay"
        );

        return;
    }

    page.style.display = "block";
}


function closeCheckin() {

    const page =
        document.getElementById("checkinOverlay");

    if (!page) {

        console.error(
            "找不到症状记录页面：#checkinOverlay"
        );

        return;
    }

    page.style.display = "none";
}


// ============================================================
// 四、AI 快捷问题
// ============================================================

function askQuestion(question) {

    const input =
        document.getElementById("questionInput");

    if (!input) {

        console.error(
            "找不到问题输入框：#questionInput"
        );

        return;
    }

    input.value = question;

    sendQuestion();
}


// ============================================================
// 五、发送问题
// ============================================================

async function sendQuestion() {

    const input =
        document.getElementById("questionInput");

    if (!input) {

        console.error(
            "找不到问题输入框：#questionInput"
        );

        return;
    }


    const question =
        input.value.trim();


    if (question === "") {

        return;
    }


    const chatBox =
        document.getElementById("chatMessages");

    if (!chatBox) {

        console.error(
            "找不到聊天区域：#chatMessages"
        );

        return;
    }


    // --------------------------------------------------------
    // 1. 显示患者问题
    // --------------------------------------------------------

    const userMessage =
        document.createElement("div");

    userMessage.className =
        "chat-message user-message";

    userMessage.innerHTML = `

        <div class="message-label">
            患者
        </div>

        <div class="message-content">
            ${escapeHTML(question)}
        </div>

    `;

    chatBox.appendChild(userMessage);

    input.value = "";


    // --------------------------------------------------------
    // 2. 显示安全检查
    // --------------------------------------------------------

    const checkingMessage =
        document.createElement("div");

    checkingMessage.className =
        "chat-message ai-message";

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
    // 3. 调用 Risk Engine
    // --------------------------------------------------------

    let checkResult;

    try {

        const response =
            await fetch(
                API_BASE_URL + "/api/risk/analyze",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json; charset=utf-8"
                    },

                    body:
                        JSON.stringify({
                            text: question
                        })
                }
            );


        if (!response.ok) {

            throw new Error(
                "后端风险 API 返回 HTTP " +
                response.status
            );
        }


        const result =
            await response.json();


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
                "后端风险 API 数据格式不正确"
            );
        }


        checkResult =
            result.data;


    } catch (error) {

        console.error(
            "调用后端风险 API 失败：",
            error
        );


        if (checkingMessage.parentNode) {

            checkingMessage.remove();
        }


        showAIMessage(

            `

            <strong>
                ⚠️ 暂时无法完成安全检查
            </strong>

            <p>
                当前无法连接医疗安全风险服务。
            </p>

            <p>
                为保证安全，本次暂不继续普通 AI 健康问答。
            </p>

            <p>
                如有明显或严重不适，
                请及时联系主管医生或前往医疗机构。
            </p>

            <p>
                <small>
                    技术提示：
                    请确认 Backend
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
    // 删除安全检查提示
    // --------------------------------------------------------

    if (checkingMessage.parentNode) {

        checkingMessage.remove();
    }


    // --------------------------------------------------------
    // 调试信息
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


    // ========================================================
    // 4. RED
    // ========================================================

    if (
        checkResult.level === "RED"
    ) {

        showAIMessage(

            `

            <strong>
                🚨 医疗安全提示
            </strong>

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
                当前情况下，
                AI不会继续进行普通健康问答。
            </p>

            <p>
                <small>
                    如果症状严重或正在快速加重，
                    请及时寻求线下医疗帮助。
                </small>
            </p>

            `,

            "RED"
        );

        scrollChatToBottom();

        return;
    }


    // ========================================================
    // 5. YELLOW
    //
    // 重要：
    // YELLOW 不允许个体化 AI 决策，
    // 但 Backend V2.1 允许安全知识库检索。
    // ========================================================

    if (
        checkResult.level === "YELLOW"
    ) {

        let questionsHTML = "";


        if (
            Array.isArray(
                checkResult.followUpQuestions
            ) &&
            checkResult.followUpQuestions.length > 0
        ) {

            questionsHTML = `

                <div class="follow-up-box">

                    <strong>
                        为了进一步了解情况，请告诉我：
                    </strong>

                    <ul>

                        ${
                            checkResult
                                .followUpQuestions
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
        // 先显示风险提示
        // ----------------------------------------------------

        showAIMessage(

            `

            <strong>
                ⚠️ 风险提示
            </strong>

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
                    下面仅检索知识库中的一般健康教育资料，
                    不用于判断您的具体治疗方案。
                </small>
            </p>

            `,

            "YELLOW"
        );


        scrollChatToBottom();


        // ----------------------------------------------------
        // YELLOW：
        // 允许 RAG 检索，但不允许个体化 AI 决策
        // ----------------------------------------------------

        await retrieveRAGAnswer(
            question,
            "YELLOW"
        );

        return;
    }


    // ========================================================
    // 6. REVIEW
    // ========================================================

    if (
        checkResult.level === "REVIEW"
    ) {

        let questionsHTML = "";


        if (
            Array.isArray(
                checkResult.followUpQuestions
            ) &&
            checkResult.followUpQuestions.length > 0
        ) {

            questionsHTML = `

                <div class="follow-up-box">

                    <strong>
                        如果方便，可以继续补充：
                    </strong>

                    <ul>

                        ${
                            checkResult
                                .followUpQuestions
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


        if (
            checkResult.allowAI === true &&
            checkResult.stopAI !== true
        ) {

            showAIMessage(

                `

                <div class="review-notice">

                    <strong>
                        ℹ️ 信息补充
                    </strong>

                    <p>
                        当前没有检测到已经建立的高风险信号，
                        但现有信息不足以完成完整风险判断。
                    </p>

                    ${questionsHTML}

                    <p>
                        接下来将从患者健康知识库中
                        检索一般健康教育资料。
                    </p>

                </div>

                `,

                "REVIEW"
            );


            scrollChatToBottom();


            await retrieveRAGAnswer(
                question,
                "REVIEW"
            );

            return;
        }


        showAIMessage(

            `

            <strong>
                ℹ️ 需要进一步评估
            </strong>

            <p>
                ${escapeHTML(
                    checkResult.warning ||
                    "当前信息不足以判断风险等级。"
                )}
            </p>

            ${questionsHTML}

            <p>
                如有明显或持续加重的不适，
                请及时联系主管医生。
            </p>

            `,

            "REVIEW"
        );


        scrollChatToBottom();

        return;
    }


    // ========================================================
    // 7. GREEN
    // ========================================================

    if (
        checkResult.level === "GREEN"
    ) {

        await retrieveRAGAnswer(
            question,
            "GREEN"
        );

        return;
    }


    // ========================================================
    // 8. 未知风险等级
    // ========================================================

    showAIMessage(

        `

        <strong>
            ⚠️ 医疗安全提示
        </strong>

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
// 六、真正的 RAG 检索
//
// 注意：
//
// YELLOW：
// retrievalAllowed = true
// aiAllowed = false
//
// 因此：
// 可以展示知识库资料
// 但不能让 AI 自行进行个体化治疗决策。
// ============================================================

async function retrieveRAGAnswer(
    question,
    riskLevel
) {

    const loadingMessage =
        document.createElement("div");

    loadingMessage.className =
        "chat-message ai-message";


    loadingMessage.innerHTML = `

        <div class="message-label">
            知识库检索
        </div>

        <div class="message-content">
            正在从长效干扰素患者知识库中检索相关资料……
        </div>

    `;


    const chatBox =
        document.getElementById(
            "chatMessages"
        );


    if (!chatBox) {

        console.error(
            "找不到聊天区域"
        );

        return;
    }


    chatBox.appendChild(
        loadingMessage
    );

    scrollChatToBottom();


    try {

        const response =
            await fetch(

                API_BASE_URL +
                "/api/ai/retrieve",

                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json; charset=utf-8"

                    },

                    body:
                        JSON.stringify({

                            question:
                                question

                        })

                }

            );


        if (!response.ok) {

            throw new Error(
                "RAG API 返回 HTTP " +
                response.status
            );
        }


        const result =
            await response.json();


        console.log(
            "========== RAG 检索结果 =========="
        );

        console.log(
            result
        );

        console.log(
            "=================================="
        );


        if (
            loadingMessage.parentNode
        ) {

            loadingMessage.remove();
        }


        if (
            !result ||
            result.success !== true
        ) {

            throw new Error(
                "RAG API 返回失败"
            );
        }


        // ----------------------------------------------------
        // RED 安全保护
        // ----------------------------------------------------

        if (
            result.retrievalAllowed === false &&
            result.risk &&
            result.risk.level === "RED"
        ) {

            showAIMessage(

                `

                <strong>
                    🚨 医疗安全提示
                </strong>

                <p>
                    当前情况不适合继续知识库问答。
                </p>

                <p>
                    请根据医疗安全提示及时联系主管医生，
                    必要时前往医疗机构。
                </p>

                `,

                "RED"
            );


            scrollChatToBottom();

            return;
        }


        // ----------------------------------------------------
        // 关键：
        // 判断“是否允许检索”
        //
        // 而不是判断 aiAllowed。
        //
        // 因为：
        //
        // YELLOW
        // aiAllowed = false
        // retrievalAllowed = true
        // ----------------------------------------------------

        if (
            result.retrievalAllowed !== true
        ) {

            showAIMessage(

                `

                <strong>
                    ⚠️ 暂时不能继续知识库检索
                </strong>

                <p>
                    当前情况需要进一步医疗评估。
                </p>

                <p>
                    请根据页面提示补充相关信息，
                    或联系主管医生。
                </p>

                `,

                riskLevel || "REVIEW"
            );


            scrollChatToBottom();

            return;
        }


        // ----------------------------------------------------
        // 获取知识库文档
        // ----------------------------------------------------

        const documents =
            Array.isArray(
                result.documents
            )
                ? result.documents
                : [];


        // ----------------------------------------------------
        // 没有检索结果
        // ----------------------------------------------------

        if (
            documents.length === 0
        ) {

            showAIMessage(

                `

                <strong>
                    ℹ️ 暂未找到足够的知识库资料
                </strong>

                <p>
                    当前问题暂时没有检索到足够匹配的资料。
                </p>

                <p>
                    您可以进一步描述：
                </p>

                <p>
                    ① 当前使用的治疗方案<br>
                    ② 出现的具体症状<br>
                    ③ 症状开始时间<br>
                    ④ 症状严重程度<br>
                    ⑤ 最近一次检查结果
                </p>

                <p>
                    如果涉及具体治疗调整，
                    请以主管医生的判断为准。
                </p>

                `,

                "REVIEW"
            );


            scrollChatToBottom();

            return;
        }


        // ----------------------------------------------------
        // 构建知识库回答
        // ----------------------------------------------------

        const answerHTML =
            buildRAGAnswer(
                question,
                documents,
                riskLevel,
                result
            );


        showAIMessage(

            answerHTML,

            riskLevel === "YELLOW"
                ? "YELLOW"
                : "GREEN"
        );


        scrollChatToBottom();


    } catch (error) {

        console.error(
            "RAG 检索失败：",
            error
        );


        if (
            loadingMessage.parentNode
        ) {

            loadingMessage.remove();
        }


        showAIMessage(

            `

            <strong>
                ⚠️ 暂时无法完成知识库检索
            </strong>

            <p>
                当前无法连接患者健康知识库。
            </p>

            <p>
                为保证安全，
                本次不使用未经知识库支持的医学答案。
            </p>

            <p>
                如有明显或严重不适，
                请及时联系主管医生或前往医疗机构。
            </p>

            <p>
                <small>
                    技术提示：
                    请确认 Backend 正在运行，
                    并检查 /api/ai/retrieve 接口。
                </small>
            </p>

            `,

            "REVIEW"
        );


        scrollChatToBottom();
    }
}


// ============================================================
// 七、构建 RAG 回答
// ============================================================

function buildRAGAnswer(
    question,
    documents,
    riskLevel,
    result
) {

    let html = "";


    // --------------------------------------------------------
    // 回答开头
    // --------------------------------------------------------

    html += `

        <div class="rag-answer">

            <p>
                根据当前患者健康知识库检索结果，
                与您的问题相关的信息如下：
            </p>

    `;


    // --------------------------------------------------------
    // YELLOW 特殊提示
    // --------------------------------------------------------

    if (
        riskLevel === "YELLOW"
    ) {

        html += `

            <div class="rag-yellow-notice">

                <strong>
                    ⚠️ 当前问题包含需要进一步了解的症状
                </strong>

                <p>
                    以下内容仅用于一般健康教育，
                    不代表对您当前病情的诊断，
                    也不代表具体治疗方案。
                </p>

            </div>

        `;
    }


    // --------------------------------------------------------
    // 最多展示前 5 条
    // --------------------------------------------------------

    const maxDocuments =
        Math.min(
            documents.length,
            5
        );


    for (
        let i = 0;
        i < maxDocuments;
        i++
    ) {

        const doc =
            documents[i];


        if (!doc) {

            continue;
        }


        const title =
            doc.title ||
            "相关知识";


        const category =
            doc.category ||
            "健康教育";


        const content =
            doc.content ||
            "";


        const source =
            doc.source ||
            "患者健康知识库";


        const sourceType =
            doc.source_type ||
            "";


        const sourceDate =
            doc.source_date ||
            "";


        html += `

            <div class="rag-document">

                <div class="rag-document-title">

                    ${escapeHTML(title)}

                </div>


                <div class="rag-document-category">

                    ${escapeHTML(category)}

                </div>


                <div class="rag-document-content">

                    ${formatKnowledgeContent(
                        content
                    )}

                </div>


                <div class="rag-document-source">

                    来源：
                    ${escapeHTML(source)}

                    ${
                        sourceType
                            ? " · " +
                              escapeHTML(sourceType)
                            : ""
                    }

                    ${
                        sourceDate
                            ? " · " +
                              escapeHTML(sourceDate)
                            : ""
                    }

                </div>

            </div>

        `;
    }


    // --------------------------------------------------------
    // 安全提示
    // --------------------------------------------------------

    html += `

        <div class="rag-safety-notice">

            <strong>
                ⚠️ 重要提示
            </strong>

            <p>
                以上内容来自当前患者健康知识库，
                用于健康教育和信息整理。
            </p>

            <p>
                本助手不会根据上述资料自行决定停药、
                减量、换药或改变治疗方案。
            </p>

            <p>
                如涉及具体治疗调整，
                请与主管医生确认。
            </p>

        </div>

    `;


    html += `
        </div>
    `;


    return html;
}


// ============================================================
// 八、格式化知识库内容
// ============================================================

function formatKnowledgeContent(content) {

    if (!content) {

        return "";
    }


    const safeText =
        escapeHTML(
            String(content)
        );


    return safeText
        .replace(
            /\n\n/g,
            "</p><p>"
        )
        .replace(
            /\n/g,
            "<br>"
        );
}


// ============================================================
// 九、显示 AI 消息
// ============================================================

function showAIMessage(
    message,
    level
) {

    const chatBox =
        document.getElementById(
            "chatMessages"
        );


    if (!chatBox) {

        return;
    }


    const aiMessage =
        document.createElement(
            "div"
        );


    aiMessage.className =
        "chat-message ai-message";


    let label =
        "AI健康助手";


    if (
        level === "RED"
    ) {

        label =
            "🚨 医疗安全提示";

    }

    else if (
        level === "YELLOW"
    ) {

        label =
            "⚠️ 风险提示";

    }

    else if (
        level === "REVIEW"
    ) {

        label =
            "ℹ️ 信息补充";

    }

    else if (
        level === "GREEN"
    ) {

        label =
            "🤖 AI健康助手";
    }


    aiMessage.innerHTML = `

        <div class="message-label">
            ${label}
        </div>

        <div class="message-content">
            ${message}
        </div>

    `;


    chatBox.appendChild(
        aiMessage
    );
}


// ============================================================
// 十、防止 HTML 注入
// ============================================================

function escapeHTML(text) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        text == null
            ? ""
            : String(text);


    return div.innerHTML;
}


// ============================================================
// 十一、聊天框自动滚动
// ============================================================

function scrollChatToBottom() {

    const chatBox =
        document.getElementById(
            "chatMessages"
        );


    if (!chatBox) {

        return;
    }


    chatBox.scrollTop =
        chatBox.scrollHeight;
}


// ============================================================
// 十二、Enter 发送
// ============================================================

function handleEnter(event) {

    if (
        event.key === "Enter"
    ) {

        event.preventDefault();

        sendQuestion();
    }
}


// ============================================================
// 十三、症状打卡
// ============================================================

async function submitCheckin() {

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


    if (
        temperature === ""
    ) {

        alert(
            "请填写今天的体温"
        );

        return;
    }


    const symptoms =
        Array.from(

            document.querySelectorAll(
                'input[name="symptom"]:checked'
            )

        ).map(

            function (item) {

                return item.value;

            }

        );


    console.log(
        "今日体温：",
        temperature
    );


    console.log(
        "今日症状：",
        symptoms
    );


    // 当前版本仍不保存真实患者数据

    alert(

        "今日记录已完成。\n\n" +

        "当前版本已经接入风险引擎，" +

        "数据库暂未正式连接。"

    );


    closeCheckin();
}


// ============================================================
// 十四、普通提示
// ============================================================

function showMessage(
    message
) {

    alert(
        message
    );
}


// ============================================================
// 十五、后端连接测试
// ============================================================

async function testBackendConnection() {

    try {

        const response =
            await fetch(

                API_BASE_URL +
                "/api/health"

            );


        if (
            !response.ok
        ) {

            throw new Error(
                "HTTP " +
                response.status
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


// ============================================================
// 十六、RAG 连接测试
// ============================================================

async function testRAGConnection() {

    try {

        const response =
            await fetch(

                API_BASE_URL +
                "/api/ai/retrieve",

                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json; charset=utf-8"

                    },

                    body:
                        JSON.stringify({

                            question:
                                "长效干扰素治疗期间有哪些常见不良反应？"

                        })

                }

            );


        if (
            !response.ok
        ) {

            throw new Error(
                "RAG API HTTP " +
                response.status
            );
        }


        const result =
            await response.json();


        console.log(
            "========== RAG 连接测试 =========="
        );

        console.log(
            result
        );

        console.log(
            "=================================="
        );


        return result;


    } catch (error) {

        console.error(
            "RAG 连接测试失败：",
            error
        );


        return null;
    }
}


// ============================================================
// 十七、页面加载完成
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        console.log(
            "长效干扰素患者管理助手 V3.1 已加载"
        );

        console.log(
            "Backend：",
            API_BASE_URL
        );

        console.log(
            "RAG：",
            API_BASE_URL +
            "/api/ai/retrieve"
        );

    }
);
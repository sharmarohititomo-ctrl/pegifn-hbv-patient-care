// ============================================================
// 长效干扰素患者管理助手
// app.js - V2.7.1
//
// V2.7.1：患者输入 → /api/risk/analyze → 风险状态卡片
// V2.7.2：仅当后端 retrievalAllowed === true 时调用 /api/ai/retrieve
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
// 2. 前端分流依据后端字段：
//    level / intent / retrievalAllowed / treatmentDecisionBlocked
// 3. allowAI / stopAI 仅用于日志，不作为是否调用 RAG 的条件
// 4. RED：不调用 /api/ai/retrieve，直接显示医疗安全提示
// 5. treatmentDecisionBlocked === true：
//    不调用 RAG，显示治疗调整需要主管医生判断
// 6. 只有 retrievalAllowed === true 时才调用 /api/ai/retrieve
// 7. retrievalAllowed !== true：
//    不调用 RAG，显示信息不足 / 需要进一步评估
// 8. YELLOW / REVIEW / GREEN：
//    是否 RAG 完全依据 retrievalAllowed，不无条件检索
// 9. AI 不自行诊断、处方，不自行决定停药、减量或改变治疗方案
// 10. 患者端明确使用 role = patient
// ============================================================


// ============================================================
// 一、后端 API 地址
// ============================================================

const API_BASE_URL = "http://127.0.0.1:3000";

let currentRiskResult = null;


// ============================================================
// 二、AI 页面
// ============================================================

function openAI() {

    const page =
        document.getElementById("aiOverlay");

    if (!page) {

        console.error(
            "找不到 AI 页面：#aiOverlay"
        );

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

        console.error(
            "找不到 AI 页面：#aiOverlay"
        );

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
            风险分析
        </div>

        <div class="message-content">
            正在分析……
        </div>

    `;

    chatBox.appendChild(checkingMessage);

    scrollChatToBottom();


    // --------------------------------------------------------
    // 3. 调用 Risk Engine
    //
    // V3.5 修复：
    //
    // Backend V2.4 /api/risk/analyze
    // 要求：
    //
    // {
    //     "question": "患者问题"
    // }
    //
    // 原 V3.4 错误发送：
    //
    // {
    //     "text": "患者问题"
    // }
    //
    // 导致 Backend 返回 HTTP 400。
    // --------------------------------------------------------

    let checkResult;

    try {

        const response =
            await fetch(

                API_BASE_URL +
                "/api/risk/analyze",

                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json; charset=utf-8"

                    },

                    body:
                        JSON.stringify({

                            text:
                                question,

                            // 当前 Backend 读取 question 字段
                            question:
                                question,

                            role:
                                "patient"

                        })

                }

            );


        // ----------------------------------------------------
        // HTTP 状态检查
        // ----------------------------------------------------

        if (!response.ok) {

            let errorMessage =
                "后端风险 API 返回 HTTP " +
                response.status;

            // 尝试读取后端具体错误
            try {

                const errorResult =
                    await response.json();

                if (
                    errorResult &&
                    errorResult.message
                ) {

                    errorMessage +=
                        "：" +
                        errorResult.message;
                }

            } catch (parseError) {

                // 后端不是 JSON 时忽略
            }

            throw new Error(
                errorMessage
            );
        }


        // ----------------------------------------------------
        // 读取 JSON
        // ----------------------------------------------------

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

        if (result.level) {
            checkResult.level =
                result.level;
        }

        if (result.intent) {
            checkResult.intent =
                result.intent;
        }

        if (
            typeof result.retrievalAllowed ===
            "boolean"
        ) {
            checkResult.retrievalAllowed =
                result.retrievalAllowed;
        }

        if (
            typeof result.treatmentDecisionBlocked ===
            "boolean"
        ) {
            checkResult.treatmentDecisionBlocked =
                result.treatmentDecisionBlocked;
        }

        if (
            typeof result.allowAI ===
            "boolean"
        ) {
            checkResult.allowAI =
                result.allowAI;
        }

        if (
            typeof result.stopAI ===
            "boolean"
        ) {
            checkResult.stopAI =
                result.stopAI;
        }

        currentRiskResult = {

            level:
                checkResult.level,

            intent:
                checkResult.intent,

            retrievalAllowed:
                checkResult.retrievalAllowed === true,

            treatmentDecisionBlocked:
                checkResult.treatmentDecisionBlocked === true,

            allowAI:
                checkResult.allowAI === true,

            stopAI:
                checkResult.stopAI === true,

            data:
                result.data
        };


    } catch (error) {

        console.error(
            "调用后端风险 API 失败：",
            error
        );


        if (
            checkingMessage.parentNode
        ) {

            checkingMessage.remove();
        }


        showAIMessage(

            `

            <strong>
                ⚠️ 暂时无法完成风险分析
            </strong>

            <p>
                请稍后重试。
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

    if (
        checkingMessage.parentNode
    ) {

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
        "问题意图：",
        checkResult.intent
    );

    console.log(
        "是否允许检索：",
        checkResult.retrievalAllowed
    );

    console.log(
        "治疗决策是否拦截：",
        checkResult.treatmentDecisionBlocked
    );

    console.log(
        "患者端角色：",
        "patient"
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

            <div class="risk-card risk-card-red">

                <strong>
                    🔴 需要立即关注
                </strong>

                <p>
                    检测到可能需要立即处理的症状：
                </p>

                <p>
                    “${escapeHTML(question)}”
                </p>

                <p>
                    当前不会继续普通AI问答。
                </p>

                <p>
                    请根据医疗机构的紧急处理流程及时联系医生或就医。
                </p>

            </div>

            `,

            "RED"
        );

        scrollChatToBottom();

        return;
    }


    // ========================================================
    // 4b. 治疗决策拦截（V2.7.1 不调用 RAG）
    // ========================================================

    if (
        checkResult.treatmentDecisionBlocked === true
    ) {

        showAIMessage(

            `

            <div class="risk-card risk-card-treatment">

                <strong>
                    ⚠️ 治疗方案需要医生判断
                </strong>

                <p>
                    涉及停药、调整剂量或改变治疗方案的问题，
                    不能由患者自行决定。
                </p>

                <p>
                    请联系负责医生，由医生结合你的具体情况进行判断。
                </p>

            </div>

            `,

            "TREATMENT"
        );

        scrollChatToBottom();

        return;
    }


    // ========================================================
    // 4c. V2.7.2：仅当后端允许检索时调用 RAG
    // 不以“不是 RED”作为检索条件
    // ========================================================

    if (
        checkResult.retrievalAllowed === true
    ) {

        await retrieveRAGAnswer(
            question,
            checkResult.level
        );

        return;
    }


    // ========================================================
    // 5. YELLOW
    // retrievalAllowed !== true 时不调用 RAG
    // ========================================================

    if (
        checkResult.level === "YELLOW"
    ) {

        showAIMessage(

            `

            <div class="risk-card risk-card-yellow">

                <strong>
                    🟡 需要关注
                </strong>

                <p>
                    系统识别到这可能属于需要关注的症状。
                </p>

                <p>
                    建议记录相关情况，并按照医生制定的随访方案进行观察。
                </p>

                <p>
                    如果症状持续、加重或出现新的异常，请及时联系医生。
                </p>

            </div>

            `,

            "YELLOW"
        );

        scrollChatToBottom();

        return;
    }


    // ========================================================
    // 6. REVIEW
    // retrievalAllowed !== true 时不调用 RAG，不能显示绿色安全
    // ========================================================

    if (
        checkResult.level === "REVIEW"
    ) {

        showAIMessage(

            `

            <div class="risk-card risk-card-review">

                <strong>
                    ℹ️ 需要更多信息
                </strong>

                <p>
                    当前信息不足以判断风险等级。
                </p>

                <p>
                    为了更好地了解情况，可以补充：
                </p>

                <ul>
                    <li>症状从什么时候开始？</li>
                    <li>严重程度如何？</li>
                    <li>最近是否还有其他新的症状？</li>
                </ul>

                <p>
                    当前不会把这种情况直接判断为“安全”。
                </p>

            </div>

            `,

            "REVIEW"
        );

        scrollChatToBottom();

        return;
    }


    // ========================================================
    // 7. GREEN / 其他
    // V2.7.1 不调用 RAG，不显示绿色安全状态
    // ========================================================

    showAIMessage(

        `

        <div class="risk-card risk-card-review">

            <strong>
                ℹ️ 需要更多信息
            </strong>

            <p>
                当前信息不足以判断风险等级。
            </p>

            <p>
                当前不会把这种情况直接判断为“安全”。
            </p>

        </div>

        `,

        "REVIEW"
    );


    scrollChatToBottom();
}


// ============================================================
// 六、安全闸门衔接
//
// 分流顺序：
// RED
// → treatmentDecisionBlocked
// → retrievalAllowed
// → /api/ai/retrieve
//
// 不使用 allowAI / stopAI 单独决定是否 RAG。
// ============================================================

function showTreatmentDecisionBlockedMessage(
    source
) {

    const decisionData =
        (
            source &&
            source.data
        ) ||
        source ||
        {};

    showAIMessage(

        `

        <div class="review-notice">

            <strong>
                ⚕️ ${escapeHTML(
                    decisionData.title ||
                    "治疗调整需要医生判断"
                )}
            </strong>

            <p>
                ${escapeHTML(
                    decisionData.message ||
                    (source && source.answer) ||
                    "是否调整治疗方案，需要由主管医生结合完整情况判断。"
                )}
            </p>

            <p>
                <strong>
                    ${escapeHTML(
                        decisionData.suggestAction ||
                        "请联系主管医生确认。"
                    )}
                </strong>
            </p>

            <p>
                <small>
                    本助手不会根据单项症状或检查结果，
                    自行给出停药、减量、加量、换药或改变治疗方案建议。
                </small>
            </p>

        </div>

        `,

        "REVIEW"
    );

    scrollChatToBottom();
}

function showInsufficientAssessmentMessage(
    riskLevel
) {

    showAIMessage(

        `

        <strong>
            ⚠️ 暂时不能继续知识库检索
        </strong>

        <p>
            当前信息不足，需要进一步评估。
        </p>

        <p>
            请根据页面提示补充相关信息，
            或联系主管医生。
        </p>

        `,

        riskLevel || "REVIEW"
    );

    scrollChatToBottom();
}

function shouldCallRetrieveAPI(
    checkResult
) {

    if (
        !checkResult ||
        checkResult.level === "RED"
    ) {

        return false;
    }

    if (
        checkResult.treatmentDecisionBlocked === true
    ) {

        return false;
    }

    return checkResult.retrievalAllowed === true;
}

async function continueBySafetyPolicy(
    question,
    checkResult,
    riskLevel
) {

    if (
        checkResult &&
        checkResult.treatmentDecisionBlocked === true
    ) {

        showTreatmentDecisionBlockedMessage(
            checkResult
        );

        return;
    }

    if (
        !shouldCallRetrieveAPI(
            checkResult
        )
    ) {

        showInsufficientAssessmentMessage(
            riskLevel
        );

        return;
    }

    await retrieveRAGAnswer(
        question,
        riskLevel
    );
}


// ============================================================
// 七、真正的 RAG 检索
//
// 判断顺序：
// RED
// → treatmentDecisionBlocked
// → retrievalAllowed
// → documents
// → buildRAGAnswer()
//
// 当前 /api/ai/retrieve 明确返回顶层 result.documents，
// 同时 data.documents 为同一数组。
// 此处按后端明确返回的 result.documents 读取。
//
// 患者端继续传递 role = patient。
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
            📚 健康知识参考
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
                                question,

                            // 当前明确为患者端
                            role:
                                "patient"

                        })

                }

            );


        if (!response.ok) {

            let errorMessage =
                "RAG API 返回 HTTP " +
                response.status;

            try {

                const errorResult =
                    await response.json();

                if (
                    errorResult &&
                    errorResult.message
                ) {

                    errorMessage +=
                        "：" +
                        errorResult.message;
                }

            } catch (parseError) {

                // 忽略非 JSON 错误
            }

            throw new Error(
                errorMessage
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
            "当前 RAG 角色：",
            result.role
        );

        console.log(
            "风险等级：",
            result.level ||
            (
                result.risk &&
                result.risk.level
            )
        );

        console.log(
            "问题意图：",
            result.intent ||
            (
                result.risk &&
                result.risk.intent
            )
        );

        console.log(
            "是否允许检索：",
            result.retrievalAllowed
        );

        console.log(
            "治疗决策是否拦截：",
            result.treatmentDecisionBlocked
        );

        console.log(
            "是否允许 AI：",
            result.allowAI
        );

        console.log(
            "是否停止 AI：",
            result.stopAI
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
        // 1. RED：立即停止普通 AI / RAG
        // ----------------------------------------------------

        const resultLevel =
            result.level ||
            (
                result.risk &&
                result.risk.level
            ) ||
            riskLevel;

        if (
            resultLevel === "RED"
        ) {

            showAIMessage(

                `

                <strong>
                    🚨 需要及时处理
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
        // 2. 治疗调整拦截
        // 不自行给出停药、减量、加量、换药或改变治疗方案建议
        // ----------------------------------------------------

        if (
            result.treatmentDecisionBlocked === true
        ) {

            showTreatmentDecisionBlockedMessage(
                result
            );

            return;
        }


        // ----------------------------------------------------
        // 3. 仅当 retrievalAllowed === true 时继续普通 RAG
        // ----------------------------------------------------

        if (
            result.retrievalAllowed !== true
        ) {

            showInsufficientAssessmentMessage(
                riskLevel || "REVIEW"
            );

            return;
        }


        // ----------------------------------------------------
        // 4. 获取知识库文档
        // 当前后端明确返回 result.documents
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

                <div class="risk-card risk-card-review">

                    <strong>
                        ℹ️ 暂未找到与当前问题直接匹配的知识。
                    </strong>

                </div>

                `,

                "REVIEW"
            );


            scrollChatToBottom();

            return;
        }


        // ----------------------------------------------------
        // 5. 构建知识库回答
        // ----------------------------------------------------

        const answerHTML =
            buildRAGAnswer(
                question,
                documents,
                riskLevel,
                result
            );


        // ----------------------------------------------------
        // RAG 单独作为 UI 类型
        // ----------------------------------------------------

        showAIMessage(

            answerHTML,

            "RAG"

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
                ⚠️ 暂时无法获取相关知识
            </strong>

            <p>
                请稍后重试。
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

            <div class="health-education-header">

                <strong>
                    📚 健康知识参考
                </strong>

                <p>
                    根据当前患者健康知识库检索结果，
                    与您的问题相关的信息如下：
                </p>

            </div>

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
            doc.date ||
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
                ⚕️ 医疗安全说明
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

function formatKnowledgeContent(
    content
) {

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
// 九、显示 AI 消息 V3.5
//
// 统一患者端信息层级：
//
// RED    → 医疗安全提示
// YELLOW → 风险评估
// REVIEW → 信息补充
// GREEN  → 健康知识
// RAG    → 健康知识参考
//
// RAG 单独作为 UI 类型，
// 防止 RAG 内容继承 YELLOW 风险标签。
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

        console.error(
            "找不到聊天区域：#chatMessages"
        );

        return;
    }


    const aiMessage =
        document.createElement(
            "div"
        );


    aiMessage.className =
        "chat-message ai-message";


    // --------------------------------------------------------
    // 根据风险等级确定患者看到的模块名称
    // --------------------------------------------------------

    let label =
        "健康知识参考";


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
            "⚠️ 风险评估";

    }

    else if (
        level === "REVIEW"
    ) {

        label =
            "ℹ️ 需要更多信息";

    }

    else if (
        level === "TREATMENT"
    ) {

        label =
            "⚠️ 治疗方案需要医生判断";

    }

    else if (
        level === "GREEN"
    ) {

        label =
            "📚 健康知识参考";

    }

    else if (
        level === "RAG"
    ) {

        label = "";
    }


    // --------------------------------------------------------
    // CSS 标识
    // --------------------------------------------------------

    let levelClass =
        "message-default";


    if (
        level === "RED"
    ) {

        levelClass =
            "message-red";

    }

    else if (
        level === "YELLOW"
    ) {

        levelClass =
            "message-yellow";

    }

    else if (
        level === "REVIEW"
    ) {

        levelClass =
            "message-review";

    }

    else if (
        level === "TREATMENT"
    ) {

        levelClass =
            "message-treatment";

    }

    else if (
        level === "GREEN"
    ) {

        levelClass =
            "message-green";

    }

    else if (
        level === "RAG"
    ) {

        levelClass =
            "message-rag";
    }


    // --------------------------------------------------------
    // RAG 专用 HTML
    // --------------------------------------------------------

    if (
        level === "RAG"
    ) {

        aiMessage.innerHTML = `

            <div class="
                message-content
                ${levelClass}
            ">

                ${message}

            </div>

        `;

    }

    else {

        aiMessage.innerHTML = `

            <div class="
                message-label
                ${levelClass}
            ">

                ${label}

            </div>


            <div class="
                message-content
                ${levelClass}
            ">

                ${message}

            </div>

        `;
    }


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
                                "长效干扰素治疗期间有哪些常见不良反应？",

                            role:
                                "patient"

                        })

                }

            );


        if (
            !response.ok
        ) {

            let errorMessage =
                "RAG API HTTP " +
                response.status;

            try {

                const errorResult =
                    await response.json();

                if (
                    errorResult &&
                    errorResult.message
                ) {

                    errorMessage +=
                        "：" +
                        errorResult.message;
                }

            } catch (parseError) {

                // 忽略
            }

            throw new Error(
                errorMessage
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
            "当前 RAG 角色：",
            result.role
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
            "长效干扰素患者管理助手 V2.7.2 已加载"
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

        console.log(
            "当前页面角色：",
            "patient"
        );

    }
);
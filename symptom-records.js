/**
 * V2.8.4 患者症状记录 + 症状时间轴
 *
 * 症状记录模块只负责保存患者自述。
 *
 * 本模块不负责：
 * 1. 医疗诊断
 * 2. 风险分级
 * 3. 治疗决策
 *
 * 患者聊天输入仍由现有风险引擎处理。
 * 未知症状不能默认安全。
 *
 * 保存症状时不调用 RiskEngine。
 */

var SYMPTOM_STORAGE_KEY = "pegifn_patient_symptom_records";
var LAB_STORAGE_KEY_GUARD = "pegifn_patient_lab_records";
var symptomChartRange = "3m";
var pendingSymptomDeleteId = null;
var activeSymptomDetailId = null;

function loadSymptomRecords() {
    try {
        var raw = localStorage.getItem(SYMPTOM_STORAGE_KEY);
        var list = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(list)) {
            return [];
        }
        return sortSymptomRecords(list, "desc");
    } catch (error) {
        console.error("读取症状记录失败：", error);
        return [];
    }
}

function saveSymptomRecords(records) {
    localStorage.setItem(SYMPTOM_STORAGE_KEY, JSON.stringify(records || []));
}

function createSymptomRecordId() {
    return "sx_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

function sortSymptomRecords(list, direction) {
    return (list || []).slice().sort(function (a, b) {
        var dateA = typeof parseLabDate === "function" ? parseLabDate(a.date) : new Date(a.date);
        var dateB = typeof parseLabDate === "function" ? parseLabDate(b.date) : new Date(b.date);
        var timeA = dateA ? dateA.getTime() : 0;
        var timeB = dateB ? dateB.getTime() : 0;
        return direction === "asc" ? timeA - timeB : timeB - timeA;
    });
}

function getFilteredSymptomRecords(rangeKey, direction) {
    var key = rangeKey || symptomChartRange;
    var range = typeof getDateRange === "function"
        ? getDateRange(key)
        : { start: null, end: null };
    var filtered = loadSymptomRecords().filter(function (item) {
        if (!range.start) {
            return true;
        }
        var date = typeof parseLabDate === "function" ? parseLabDate(item.date) : new Date(item.date);
        if (!date) {
            return false;
        }
        return date.getTime() >= range.start.getTime() &&
            date.getTime() <= range.end.getTime();
    });
    return sortSymptomRecords(filtered, direction || "desc");
}

function getSelectedSymptomSeverity() {
    var selected = document.querySelector('input[name="sxSeverity"]:checked');
    return selected ? selected.value : "";
}

function validateSymptomRecord(input) {
    if (!input.date) {
        return "请选择记录日期";
    }

    if (!input.symptomPreset) {
        return "请选择或填写症状";
    }

    if (input.symptomPreset === "其他" && !String(input.customName || "").trim()) {
        return "请输入症状名称";
    }

    if (!input.symptom) {
        return "请选择或填写症状";
    }

    if (!input.severity) {
        return "请选择严重程度";
    }

    if (!input.startDate) {
        return "请选择症状开始日期";
    }

    var recordDate = typeof parseLabDate === "function" ? parseLabDate(input.date) : new Date(input.date);
    var startDate = typeof parseLabDate === "function" ? parseLabDate(input.startDate) : new Date(input.startDate);

    if (!recordDate || !startDate) {
        return "日期格式不正确";
    }

    if (startDate.getTime() > recordDate.getTime()) {
        return "症状开始日期不能晚于记录日期";
    }

    return {
        ok: true,
        record: {
            id: createSymptomRecordId(),
            date: input.date,
            symptom: input.symptom,
            severity: input.severity,
            startDate: input.startDate,
            duration: input.duration || "",
            note: input.note || "",
            source: "patient"
        }
    };
}

function addSymptomRecord(record) {
    var records = loadSymptomRecords();
    records.push(record);
    saveSymptomRecords(records);
}

function deleteSymptomRecordById(id) {
    var records = loadSymptomRecords().filter(function (item) {
        return item.id !== id;
    });
    saveSymptomRecords(records);
}

function onSymptomNameChange() {
    var select = document.getElementById("sxNameSelect");
    var wrap = document.getElementById("sxCustomWrap");
    if (!wrap) {
        return;
    }
    wrap.style.display = select && select.value === "其他" ? "block" : "none";
}

function renderSymptomHomeSummary() {
    var box = document.getElementById("homeSymptomSummary");
    if (!box) {
        return;
    }
    var latest = loadSymptomRecords()[0];
    if (!latest) {
        box.textContent = "最近症状：暂无症状记录";
        return;
    }
    box.innerHTML = "最近症状：<br>" + latest.symptom + "<br>" + latest.severity + "<br>" + latest.date;
}

function renderSymptomStats() {
    var box = document.getElementById("sxStats");
    if (!box) {
        return;
    }

    var all = loadSymptomRecords();
    var latest = all[0];
    var mild = all.filter(function (item) { return item.severity === "轻度"; }).length;
    var mid = all.filter(function (item) { return item.severity === "中度"; }).length;
    var high = all.filter(function (item) { return item.severity === "重度"; }).length;

    box.innerHTML =
        '<div class="sx-stat-card">记录次数：<strong>' + all.length + "</strong></div>" +
        '<div class="sx-stat-card">最近记录：<strong>' + (latest ? latest.date : "暂无") + "</strong></div>" +
        '<div class="sx-stat-card">最近症状：<strong>' + (latest ? latest.symptom : "暂无") + "</strong></div>" +
        '<div class="sx-stat-card">轻度：' + mild + "</div>" +
        '<div class="sx-stat-card">中度：' + mid + "</div>" +
        '<div class="sx-stat-card">重度：' + high + "</div>";
}

function renderSymptomList() {
    var list = document.getElementById("sxList");
    var empty = document.getElementById("sxEmptyState");
    if (!list || !empty) {
        return;
    }

    var records = getFilteredSymptomRecords(symptomChartRange, "desc");
    var all = loadSymptomRecords();

    if (!all.length) {
        empty.style.display = "block";
        list.innerHTML = "";
        return;
    }

    empty.style.display = "none";

    if (!records.length) {
        list.innerHTML = '<div class="lab-chart-empty">该时间范围内暂无症状记录</div>';
        return;
    }

    list.innerHTML = records.map(function (item) {
        return (
            '<button type="button" class="sx-card" onclick="openSymptomDetail(\'' + item.id + "')\">" +
            '<div class="lab-metric-date">' + item.date + "</div>" +
            "<h4>" + item.symptom + "</h4>" +
            "<p>" + item.severity + "</p>" +
            "<p>开始：" + item.startDate + "</p>" +
            "<p>持续：" + (item.duration ? item.duration : "-") + "</p>" +
            "<p>备注：" + (item.note ? item.note : "-") + "</p>" +
            "<p>查看</p>" +
            "</button>"
        );
    }).join("");
}

function renderSymptomTimeline() {
    var box = document.getElementById("sxTimeline");
    if (!box) {
        return;
    }

    var all = loadSymptomRecords();
    if (!all.length) {
        box.innerHTML = "";
        return;
    }

    var records = getFilteredSymptomRecords(symptomChartRange, "desc");
    if (!records.length) {
        box.innerHTML = '<div class="lab-chart-empty">该时间范围内暂无症状记录</div>';
        return;
    }

    box.innerHTML = records.map(function (item) {
        return (
            '<div class="lab-timeline-item" onclick="openSymptomDetail(\'' + item.id + "')\">" +
            '<div class="lab-timeline-date">' + item.date + "</div>" +
            '<div class="lab-timeline-line"></div>' +
            '<div class="lab-timeline-card">' +
            "<strong>● " + item.symptom + "</strong>" +
            "<p>" + item.severity + "</p>" +
            "<p>开始：" + item.startDate + "</p>" +
            "<p>持续：" + (item.duration ? item.duration : "-") + "</p>" +
            "</div></div>"
        );
    }).join("");
}

function renderSymptomHistory() {
    var body = document.getElementById("sxHistoryBody");
    var wrap = document.getElementById("sxHistoryWrap");
    if (!body || !wrap) {
        return;
    }

    var records = loadSymptomRecords();
    if (!records.length) {
        wrap.style.display = "none";
        body.innerHTML = "";
        return;
    }

    wrap.style.display = "block";
    body.innerHTML = records.map(function (item) {
        return (
            "<tr>" +
            "<td>" + item.date + "</td>" +
            "<td>" + item.symptom + "</td>" +
            "<td>" + item.severity + "</td>" +
            "<td>" + item.startDate + "</td>" +
            "<td>" + (item.duration ? item.duration : "-") + "</td>" +
            "<td>" + (item.note ? item.note : "") + "</td>" +
            '<td><button type="button" class="lab-delete-btn" onclick="askDeleteSymptom(\'' +
            item.id +
            "')\">删除</button></td>" +
            "</tr>"
        );
    }).join("");
}

function renderSymptomRecordsPage() {
    document.querySelectorAll(".sx-range-btn").forEach(function (button) {
        button.classList.toggle(
            "is-active",
            button.getAttribute("data-range") === symptomChartRange
        );
    });

    renderSymptomStats();
    renderSymptomList();
    renderSymptomTimeline();
    renderSymptomHistory();
    renderSymptomHomeSummary();
}

function showArchiveTab(tab) {
    var labPanel = document.getElementById("archiveLabPanel");
    var sxPanel = document.getElementById("archiveSymptomPanel");
    var labTab = document.getElementById("archiveTabLab");
    var sxTab = document.getElementById("archiveTabSymptom");

    if (labPanel) {
        labPanel.style.display = tab === "symptom" ? "none" : "block";
    }
    if (sxPanel) {
        sxPanel.style.display = tab === "symptom" ? "block" : "none";
    }
    if (labTab) {
        labTab.classList.toggle("is-active", tab !== "symptom");
    }
    if (sxTab) {
        sxTab.classList.toggle("is-active", tab === "symptom");
    }

    if (tab === "symptom") {
        renderSymptomRecordsPage();
    }
}

function setSymptomChartRange(range) {
    symptomChartRange = range || "3m";
    renderSymptomRecordsPage();
}

function openSymptomForm() {
    var overlay = document.getElementById("sxFormOverlay");
    var errorBox = document.getElementById("sxFormError");
    var dateInput = document.getElementById("sxDate");
    var startInput = document.getElementById("sxStartDate");
    var select = document.getElementById("sxNameSelect");
    var custom = document.getElementById("sxCustomName");
    var duration = document.getElementById("sxDuration");
    var note = document.getElementById("sxNote");
    var today = typeof todayText === "function" ? todayText() : "";

    if (select) {
        select.value = "";
    }
    if (custom) {
        custom.value = "";
    }
    if (duration) {
        duration.value = "";
    }
    if (note) {
        note.value = "";
    }
    if (dateInput) {
        dateInput.value = today;
    }
    if (startInput) {
        startInput.value = today;
    }
    if (errorBox) {
        errorBox.textContent = "";
    }

    document.querySelectorAll('input[name="sxSeverity"]').forEach(function (radio) {
        radio.checked = false;
    });

    onSymptomNameChange();

    if (overlay) {
        overlay.style.display = "flex";
    }
}

function closeSymptomForm() {
    var overlay = document.getElementById("sxFormOverlay");
    if (overlay) {
        overlay.style.display = "none";
    }
}

function submitSymptomRecord() {
    var select = document.getElementById("sxNameSelect");
    var preset = select ? select.value : "";
    var custom = document.getElementById("sxCustomName");
    var customName = custom ? custom.value.trim() : "";
    var symptomName = preset === "其他" ? customName : preset;
    var errorBox = document.getElementById("sxFormError");

    var result = validateSymptomRecord({
        date: document.getElementById("sxDate").value,
        symptomPreset: preset,
        customName: customName,
        symptom: symptomName,
        severity: getSelectedSymptomSeverity(),
        startDate: document.getElementById("sxStartDate").value,
        duration: document.getElementById("sxDuration").value.trim(),
        note: document.getElementById("sxNote").value.trim()
    });

    if (typeof result === "string") {
        if (errorBox) {
            errorBox.textContent = result;
        }
        return;
    }

    addSymptomRecord(result.record);
    closeSymptomForm();
    renderSymptomRecordsPage();
}

function openSymptomDetail(id) {
    activeSymptomDetailId = id;
    var record = loadSymptomRecords().filter(function (item) {
        return item.id === id;
    })[0];
    var content = document.getElementById("sxDetailContent");
    var overlay = document.getElementById("sxDetailOverlay");
    var deleteBtn = document.getElementById("sxDetailDeleteBtn");

    if (!record || !content) {
        return;
    }

    content.innerHTML =
        "<h3>症状详情</h3>" +
        "<p><strong>" + record.symptom + "</strong></p>" +
        "<p>记录日期：" + record.date + "</p>" +
        "<p>严重程度：" + record.severity + "</p>" +
        "<p>开始日期：" + record.startDate + "</p>" +
        "<p>持续时间：" + (record.duration ? record.duration : "-") + "</p>" +
        "<p>备注：" + (record.note ? record.note : "-") + "</p>" +
        "<p class=\"lab-chart-caption\">严重程度为患者自述，不代表系统风险分级。</p>";

    if (deleteBtn && !deleteBtn._sxBound) {
        deleteBtn._sxBound = true;
        deleteBtn.addEventListener("click", function () {
            closeSymptomDetail();
            askDeleteSymptom(activeSymptomDetailId || id);
        });
    }

    if (overlay) {
        overlay.style.display = "flex";
    }
}

function closeSymptomDetail() {
    var overlay = document.getElementById("sxDetailOverlay");
    if (overlay) {
        overlay.style.display = "none";
    }
}

function askDeleteSymptom(id) {
    pendingSymptomDeleteId = id;
    var overlay = document.getElementById("sxDeleteOverlay");
    var confirmBtn = document.getElementById("sxDeleteConfirmBtn");

    if (confirmBtn && !confirmBtn._sxBound) {
        confirmBtn._sxBound = true;
        confirmBtn.addEventListener("click", confirmSymptomDelete);
    }

    if (overlay) {
        overlay.style.display = "flex";
    }
}

function closeSymptomDeleteConfirm() {
    pendingSymptomDeleteId = null;
    var overlay = document.getElementById("sxDeleteOverlay");
    if (overlay) {
        overlay.style.display = "none";
    }
}

function confirmSymptomDelete() {
    if (!pendingSymptomDeleteId) {
        closeSymptomDeleteConfirm();
        return;
    }

    deleteSymptomRecordById(pendingSymptomDeleteId);
    closeSymptomDeleteConfirm();
    closeSymptomDetail();
    renderSymptomRecordsPage();
}

function closeSymptomOverlays() {
    closeSymptomForm();
    closeSymptomDetail();
    closeSymptomDeleteConfirm();
}

(function bindArchiveOpenClose() {
    if (typeof openLabRecords === "function" && !openLabRecords._sxWrapped) {
        var originalOpen = openLabRecords;
        var wrappedOpen = function () {
            originalOpen();
            showArchiveTab("lab");
            renderSymptomHomeSummary();
        };
        wrappedOpen._sxWrapped = true;
        openLabRecords = wrappedOpen;
    }

    if (typeof closeLabRecords === "function" && !closeLabRecords._sxWrapped) {
        var originalClose = closeLabRecords;
        var wrappedClose = function () {
            originalClose();
            closeSymptomOverlays();
            showArchiveTab("lab");
        };
        wrappedClose._sxWrapped = true;
        closeLabRecords = wrappedClose;
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", renderSymptomHomeSummary);
    } else {
        renderSymptomHomeSummary();
    }
})();

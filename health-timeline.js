/**
 * V2.8.5 患者健康事件统一时间轴
 *
 * 本模块仅用于患者健康数据的时间顺序展示。
 *
 * 不负责：
 * 医疗诊断
 * 风险判断
 * 治疗决策
 * 药物调整
 * 病情趋势判断
 *
 * 症状严重程度只是患者自述。
 *
 * 不要在这里调用：
 * RiskEngine
 * /api/risk/analyze
 * /api/ai/retrieve
 * 任何 AI 接口。
 *
 * 只读取：
 * pegifn_patient_lab_records
 * pegifn_patient_symptom_records
 *
 * 不修改、不删除、不清空、不迁移原始数据。
 */

var HT_LAB_KEY = "pegifn_patient_lab_records";
var HT_SX_KEY = "pegifn_patient_symptom_records";
var healthTimelineRange = "3m";
var healthTimelineEvents = [];

function htReadJson(key) {
    try {
        var raw = localStorage.getItem(key);
        var list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
    } catch (error) {
        console.error("读取健康时间轴数据失败：", error);
        return [];
    }
}

function htParseDate(text) {
    if (typeof parseLabDate === "function") {
        return parseLabDate(text);
    }
    var parts = String(text || "").split("-");
    if (parts.length !== 3) {
        return null;
    }
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return isNaN(date.getTime()) ? null : date;
}

function htInRange(dateText, rangeKey) {
    var range = typeof getDateRange === "function"
        ? getDateRange(rangeKey)
        : { start: null, end: null };
    if (!range.start) {
        return true;
    }
    var date = htParseDate(dateText);
    if (!date) {
        return false;
    }
    return date.getTime() >= range.start.getTime() &&
        date.getTime() <= range.end.getTime();
}

function htHasNumber(field) {
    return !!(field && typeof field.value === "number");
}

function htFormatAltAstPlt(field, unit) {
    if (typeof formatMetric === "function") {
        var text = formatMetric(field, unit);
        return text === "--" ? "" : text;
    }
    if (!htHasNumber(field)) {
        return "";
    }
    return String(field.value) + " " + unit;
}

function htFormatDna(record) {
    if (typeof formatHbvDna === "function") {
        var text = formatHbvDna(record);
        return text === "--" ? "" : text;
    }
    if (!record || !record.hbvDna) {
        return "";
    }
    if (record.hbvDna.type === "not_detected") {
        return "未检出";
    }
    if (record.hbvDna.displayValue) {
        return record.hbvDna.displayValue + " IU/mL";
    }
    if (typeof record.hbvDna.value === "number") {
        return String(record.hbvDna.value) + " IU/mL";
    }
    return "";
}

function htFormatHbsAg(record) {
    if (typeof formatHbsAg === "function") {
        var text = formatHbsAg(record);
        return text === "--" ? "" : text;
    }
    if (!record || !record.hbsAg || typeof record.hbsAg.value !== "number") {
        return "";
    }
    return String(record.hbsAg.value) + " IU/mL";
}

function htBuildLabEvent(record) {
    var details = [];
    var alt = htFormatAltAstPlt(record.alt, "U/L");
    var ast = htFormatAltAstPlt(record.ast, "U/L");
    var plt = htFormatAltAstPlt(record.plt, "×10⁹/L");
    var dna = htFormatDna(record);
    var hbs = htFormatHbsAg(record);

    if (alt) {
        details.push({ name: "ALT", value: alt });
    }
    if (ast) {
        details.push({ name: "AST", value: ast });
    }
    if (plt) {
        details.push({ name: "PLT", value: plt });
    }
    if (dna) {
        details.push({ name: "HBV DNA", value: dna });
    }
    if (hbs) {
        details.push({ name: "HBsAg", value: hbs });
    }

    if (record.note) {
        details.push({ name: "备注", value: record.note });
    }

    return {
        id: "lab:" + record.id,
        date: record.date,
        type: "lab",
        title: "指标记录",
        details: details,
        source: "lab"
    };
}

function htBuildSymptomEvent(record) {
    return {
        id: "symptom:" + record.id,
        date: record.date,
        type: "symptom",
        title: "症状记录",
        details: [
            { name: "症状", value: record.symptom || "" },
            { name: "严重程度", value: "患者自述：" + (record.severity || "") },
            { name: "开始日期", value: record.startDate || "" },
            { name: "持续", value: record.duration || "-" },
            { name: "备注", value: record.note || "-" }
        ],
        source: "symptom"
    };
}

function buildHealthTimelineEvents(rangeKey) {
    var labs = htReadJson(HT_LAB_KEY);
    var symptoms = htReadJson(HT_SX_KEY);
    var events = [];

    labs.forEach(function (record) {
        if (record && record.date && htInRange(record.date, rangeKey)) {
            events.push(htBuildLabEvent(record));
        }
    });

    symptoms.forEach(function (record) {
        if (record && record.date && htInRange(record.date, rangeKey)) {
            events.push(htBuildSymptomEvent(record));
        }
    });

    events.sort(function (a, b) {
        var timeA = htParseDate(a.date);
        var timeB = htParseDate(b.date);
        var ta = timeA ? timeA.getTime() : 0;
        var tb = timeB ? timeB.getTime() : 0;
        if (tb !== ta) {
            return tb - ta;
        }
        if (a.type !== b.type) {
            return a.type === "symptom" ? -1 : 1;
        }
        return String(a.id).localeCompare(String(b.id));
    });

    return events;
}

function setHealthTimelineRange(range) {
    healthTimelineRange = range || "3m";
    renderHealthTimelinePage();
}

function renderHealthTimelinePage() {
    document.querySelectorAll(".ht-range-btn").forEach(function (button) {
        button.classList.toggle(
            "is-active",
            button.getAttribute("data-range") === healthTimelineRange
        );
    });

    healthTimelineEvents = buildHealthTimelineEvents(healthTimelineRange);

    var labCount = healthTimelineEvents.filter(function (item) {
        return item.type === "lab";
    }).length;
    var sxCount = healthTimelineEvents.filter(function (item) {
        return item.type === "symptom";
    }).length;

    var stats = document.getElementById("htStats");
    if (stats) {
        var rangeLabel = typeof getDateRange === "function"
            ? getDateRange(healthTimelineRange).label
            : healthTimelineRange;
        stats.innerHTML =
            '<div class="sx-stat-card">当前时间范围：<strong>' + rangeLabel + "</strong></div>" +
            '<div class="sx-stat-card">共 <strong>' + healthTimelineEvents.length + "</strong> 条健康记录</div>" +
            '<div class="sx-stat-card">指标记录 <strong>' + labCount + "</strong> 条</div>" +
            '<div class="sx-stat-card">症状记录 <strong>' + sxCount + "</strong> 条</div>";
    }

    var empty = document.getElementById("htEmptyState");
    var box = document.getElementById("htTimeline");
    if (!box) {
        return;
    }

    if (!healthTimelineEvents.length) {
        if (empty) {
            empty.style.display = "block";
        }
        box.innerHTML = "";
        return;
    }

    if (empty) {
        empty.style.display = "none";
    }

    box.innerHTML = healthTimelineEvents.map(function (event) {
        var badgeClass = event.type === "lab" ? "ht-badge-lab" : "ht-badge-symptom";
        var lines = event.details.map(function (item) {
            return "<p><strong>" + item.name + "</strong> " + item.value + "</p>";
        }).join("");

        return (
            '<div class="lab-timeline-item" onclick="openHealthTimelineDetail(\'' + event.id + "')\">" +
            '<div class="lab-timeline-date">' + event.date + "</div>" +
            '<div class="lab-timeline-line"></div>' +
            '<div class="lab-timeline-card ht-event-card">' +
            '<span class="ht-badge ' + badgeClass + '">' + event.title + "</span>" +
            lines +
            "</div></div>"
        );
    }).join("");
}

function openHealthTimelineDetail(id) {
    var event = healthTimelineEvents.filter(function (item) {
        return item.id === id;
    })[0];
    var content = document.getElementById("htDetailContent");
    var overlay = document.getElementById("htDetailOverlay");

    if (!event || !content) {
        return;
    }

    var extra = event.type === "symptom"
        ? "<p class=\"lab-chart-caption\">严重程度为患者自述，不代表系统风险分级。</p>"
        : "";

    content.innerHTML =
        "<h3>" + event.title + "</h3>" +
        "<p>日期：" + event.date + "</p>" +
        event.details.map(function (item) {
            return "<p>" + item.name + "：" + item.value + "</p>";
        }).join("") +
        extra;

    if (overlay) {
        overlay.style.display = "flex";
    }
}

function closeHealthTimelineDetail() {
    var overlay = document.getElementById("htDetailOverlay");
    if (overlay) {
        overlay.style.display = "none";
    }
}

(function bindHealthTimelineTab() {
    if (typeof showArchiveTab === "function" && !showArchiveTab._htWrapped) {
        var original = showArchiveTab;
        var wrapped = function (tab) {
            var htPanel = document.getElementById("archiveHealthTimelinePanel");
            var htTab = document.getElementById("archiveTabTimeline");

            if (tab === "timeline") {
                var labPanel = document.getElementById("archiveLabPanel");
                var sxPanel = document.getElementById("archiveSymptomPanel");
                var labTab = document.getElementById("archiveTabLab");
                var sxTab = document.getElementById("archiveTabSymptom");

                if (labPanel) {
                    labPanel.style.display = "none";
                }
                if (sxPanel) {
                    sxPanel.style.display = "none";
                }
                if (htPanel) {
                    htPanel.style.display = "block";
                }
                if (labTab) {
                    labTab.classList.remove("is-active");
                }
                if (sxTab) {
                    sxTab.classList.remove("is-active");
                }
                if (htTab) {
                    htTab.classList.add("is-active");
                }

                healthTimelineRange = healthTimelineRange || "3m";
                renderHealthTimelinePage();
                return;
            }

            if (htPanel) {
                htPanel.style.display = "none";
            }
            if (htTab) {
                htTab.classList.remove("is-active");
            }
            original(tab);
        };
        wrapped._htWrapped = true;
        showArchiveTab = wrapped;
    }

    if (typeof openLabRecords === "function" && !openLabRecords._htWrapped) {
        var originalOpen = openLabRecords;
        var wrappedOpen = function () {
            originalOpen();
            healthTimelineRange = "3m";
            closeHealthTimelineDetail();
        };
        wrappedOpen._htWrapped = true;
        openLabRecords = wrappedOpen;
    }

    if (typeof closeLabRecords === "function" && !closeLabRecords._htWrapped) {
        var originalClose = closeLabRecords;
        var wrappedClose = function () {
            originalClose();
            closeHealthTimelineDetail();
        };
        wrappedClose._htWrapped = true;
        closeLabRecords = wrappedClose;
    }
})();

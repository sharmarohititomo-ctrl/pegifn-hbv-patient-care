/**
 * V2.8.3 患者指标趋势增强 + 指标时间轴
 * 仅负责记录、展示、趋势与时间轴，不做医学解释。
 * 兼容 V2.8.2 localStorage：pegifn_patient_lab_records
 */

var LAB_STORAGE_KEY = "pegifn_patient_lab_records";
var labChartRange = "3m";
var pendingLabDeleteId = null;
var activeIndicatorKey = null;
var activeTimelineId = null;

var LAB_RANGE_LABELS = {
    "1m": "近1个月",
    "3m": "近3个月",
    "6m": "近6个月",
    "1y": "近1年",
    all: "全部"
};

function loadLabRecords() {
    try {
        var raw = localStorage.getItem(LAB_STORAGE_KEY);
        var list = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(list)) {
            return [];
        }
        return sortLabRecords(list, "desc");
    } catch (error) {
        console.error("读取指标记录失败：", error);
        return [];
    }
}

function saveLabRecords(records) {
    localStorage.setItem(
        LAB_STORAGE_KEY,
        JSON.stringify(records || [])
    );
}

function createLabRecordId() {
    return "lab_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

function parseLabDate(text) {
    var parts = String(text || "").split("-");
    if (parts.length !== 3) {
        return null;
    }

    var year = Number(parts[0]);
    var month = Number(parts[1]);
    var day = Number(parts[2]);

    if (!year || !month || !day) {
        return null;
    }

    var date = new Date(year, month - 1, day);
    if (
        isNaN(date.getTime()) ||
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}

function sortLabRecords(list, direction) {
    return (list || []).slice().sort(function (a, b) {
        var dateA = parseLabDate(a.date);
        var dateB = parseLabDate(b.date);
        var timeA = dateA ? dateA.getTime() : 0;
        var timeB = dateB ? dateB.getTime() : 0;
        return direction === "asc" ? timeA - timeB : timeB - timeA;
    });
}

function getDateRange(rangeKey) {
    var key = rangeKey || labChartRange || "3m";
    var end = new Date();
    end.setHours(23, 59, 59, 999);

    var start = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    start.setHours(0, 0, 0, 0);

    if (key === "all") {
        return {
            key: "all",
            label: LAB_RANGE_LABELS.all,
            start: null,
            end: null
        };
    }

    if (key === "1m") {
        start.setMonth(start.getMonth() - 1);
    } else if (key === "6m") {
        start.setMonth(start.getMonth() - 6);
    } else if (key === "1y") {
        start.setFullYear(start.getFullYear() - 1);
    } else {
        key = "3m";
        start.setMonth(start.getMonth() - 3);
    }

    return {
        key: key,
        label: LAB_RANGE_LABELS[key] || "近3个月",
        start: start,
        end: end
    };
}

function getFilteredLabRecords(rangeKey, direction) {
    var range = getDateRange(rangeKey);
    var filtered = loadLabRecords().filter(function (item) {
        if (!range.start) {
            return true;
        }

        var date = parseLabDate(item.date);
        if (!date) {
            return false;
        }

        return date.getTime() >= range.start.getTime() &&
            date.getTime() <= range.end.getTime();
    });

    return sortLabRecords(filtered, direction || "desc");
}

function recordsInRange(records) {
    return getFilteredLabRecords(labChartRange, "asc");
}

function parseStrictNumber(raw) {
    var text = String(raw == null ? "" : raw).trim();

    if (!text) {
        return { ok: false, reason: "empty" };
    }

    if (/阳性|阴性|正常|异常|reactive|non-reactive/i.test(text)) {
        return { ok: false, reason: "forbidden" };
    }

    if (!/^-?\d+(\.\d+)?$/.test(text)) {
        return { ok: false, reason: "not_number" };
    }

    var value = Number(text);

    if (!isFinite(value)) {
        return { ok: false, reason: "not_number" };
    }

    return { ok: true, value: value };
}

function getSelectedDnaType() {
    var selected = document.querySelector('input[name="labDnaType"]:checked');
    return selected ? selected.value : "numeric";
}

function hasNumericField(field) {
    return !!(field && typeof field.value === "number");
}

function hasHbsAg(record) {
    return !!(record && hasNumericField(record.hbsAg));
}

function hasHbvDna(record) {
    return !!(record && record.hbvDna && (record.hbvDna.type || record.hbvDna.displayValue || typeof record.hbvDna.value === "number"));
}

function formatHbsAg(record) {
    if (!hasHbsAg(record)) {
        return "--";
    }
    return String(record.hbsAg.value) + " IU/mL";
}

function formatHbvDna(record) {
    if (!hasHbvDna(record)) {
        return "--";
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

    return "--";
}

function formatMetric(field, unit) {
    if (!hasNumericField(field)) {
        return "--";
    }
    return String(field.value) + " " + unit;
}

function latestRecord() {
    var records = loadLabRecords();
    return records.length ? records[0] : null;
}

function validateLabRecord(input) {
    var alt = parseStrictNumber(input.alt);
    if (!alt.ok) {
        return "ALT请输入数字，例如 32";
    }

    var ast = parseStrictNumber(input.ast);
    if (!ast.ok) {
        return "AST请输入数字，例如 28";
    }

    var plt = parseStrictNumber(input.plt);
    if (!plt.ok) {
        return "PLT请输入数字，例如 168";
    }

    var hbsAg = parseStrictNumber(input.hbsAg);
    if (!hbsAg.ok) {
        return "HBsAg请输入定量数值，例如 0.68";
    }

    if (!input.date) {
        return "请选择检测日期";
    }

    var hbvDna;

    if (input.dnaType === "not_detected") {
        hbvDna = {
            value: null,
            displayValue: "未检出",
            unit: "IU/mL",
            type: "not_detected"
        };
    } else if (input.dnaType === "below_detection_limit") {
        var limit = parseStrictNumber(input.dnaLimit);
        if (!limit.ok) {
            return "HBV DNA检测下限请输入数字，例如 20";
        }
        hbvDna = {
            value: limit.value,
            displayValue: "<" + String(limit.value),
            unit: "IU/mL",
            type: "below_detection_limit"
        };
    } else {
        var numeric = parseStrictNumber(input.dnaNumeric);
        if (!numeric.ok) {
            return "HBV DNA请输入数字，例如 28";
        }
        hbvDna = {
            value: numeric.value,
            displayValue: String(numeric.value),
            unit: "IU/mL",
            type: "numeric"
        };
    }

    return {
        ok: true,
        record: {
            id: createLabRecordId(),
            date: input.date,
            alt: { value: alt.value, unit: "U/L" },
            ast: { value: ast.value, unit: "U/L" },
            plt: { value: plt.value, unit: "×10⁹/L" },
            hbvDna: hbvDna,
            hbsAg: {
                value: hbsAg.value,
                unit: "IU/mL",
                type: "quantitative"
            },
            note: input.note || ""
        }
    };
}

function addLabRecord(record) {
    var records = loadLabRecords();
    records.push(record);
    saveLabRecords(records);
}

function closeLabDeleteConfirm() {
    pendingLabDeleteId = null;
    var overlay = document.getElementById("labDeleteOverlay");
    if (overlay) {
        overlay.style.display = "none";
    }
}

function confirmLabDelete() {
    if (!pendingLabDeleteId) {
        closeLabDeleteConfirm();
        return;
    }

    var records = loadLabRecords().filter(function (item) {
        return item.id !== pendingLabDeleteId;
    });

    saveLabRecords(records);
    closeLabDeleteConfirm();
    renderLabRecordsPage();
}

function deleteLabRecord(id) {
    pendingLabDeleteId = id;
    var overlay = document.getElementById("labDeleteOverlay");
    var confirmBtn = document.getElementById("labDeleteConfirmBtn");

    if (confirmBtn && !confirmBtn._labBound) {
        confirmBtn._labBound = true;
        confirmBtn.addEventListener("click", confirmLabDelete);
    }

    if (overlay) {
        overlay.style.display = "flex";
    }
}

function indicatorDisplay(record, key) {
    if (key === "alt") {
        return formatMetric(record && record.alt, "U/L");
    }
    if (key === "ast") {
        return formatMetric(record && record.ast, "U/L");
    }
    if (key === "plt") {
        return formatMetric(record && record.plt, "×10⁹/L");
    }
    if (key === "hbvDna") {
        return formatHbvDna(record);
    }
    return formatHbsAg(record);
}

function indicatorHasValue(record, key) {
    if (key === "hbvDna") {
        return hasHbvDna(record);
    }
    if (key === "hbsAg") {
        return hasHbsAg(record);
    }
    return hasNumericField(record && record[key]);
}

function getIndicatorNumericValue(record, key) {
    if (!record) {
        return null;
    }

    if (key === "hbvDna") {
        if (!record.hbvDna || record.hbvDna.type === "not_detected") {
            return null;
        }
        return typeof record.hbvDna.value === "number" ? record.hbvDna.value : null;
    }

    return hasNumericField(record[key]) ? record[key].value : null;
}

function getIndicatorStats(key, records) {
    var source = records || getFilteredLabRecords(labChartRange, "desc");
    var withValue = source.filter(function (item) {
        return indicatorHasValue(item, key);
    });
    var numeric = withValue
        .map(function (item) {
            return {
                record: item,
                value: getIndicatorNumericValue(item, key)
            };
        })
        .filter(function (item) {
            return typeof item.value === "number";
        });

    var latest = withValue[0] || null;
    var earliest = withValue.length ? withValue[withValue.length - 1] : null;
    var maxItem = null;
    var minItem = null;

    numeric.forEach(function (item) {
        if (!maxItem || item.value > maxItem.value) {
            maxItem = item;
        }
        if (!minItem || item.value < minItem.value) {
            minItem = item;
        }
    });

    return {
        count: withValue.length,
        latest: latest,
        earliest: earliest,
        maxItem: maxItem,
        minItem: minItem
    };
}

function renderIndicatorStats(key, records) {
    var stats = getIndicatorStats(key, records);
    var unitMap = {
        alt: "U/L",
        ast: "U/L",
        plt: "×10⁹/L",
        hbvDna: "IU/mL",
        hbsAg: "IU/mL"
    };

    if (!stats.count) {
        return '<p class="lab-chart-empty">暂无' + indicatorTitle(key) + "检测记录</p>";
    }

    function valueText(record) {
        return indicatorDisplay(record, key);
    }

    function numericText(item) {
        if (!item) {
            return "--";
        }
        if (key === "hbvDna") {
            return formatHbvDna(item.record);
        }
        return String(item.value) + " " + unitMap[key];
    }

    return (
        '<div class="lab-stats-grid">' +
        "<div>检测次数：" + stats.count + "</div>" +
        "<div>最近一次：" + valueText(stats.latest) + "</div>" +
        "<div>最早一次：" + valueText(stats.earliest) + "</div>" +
        "<div>最近检测日期：" + (stats.latest ? stats.latest.date : "--") + "</div>" +
        "<div>最高值：" + numericText(stats.maxItem) + "</div>" +
        "<div>最低值：" + numericText(stats.minItem) + "</div>" +
        "</div>"
    );
}

function indicatorTitle(key) {
    if (key === "alt") {
        return "ALT";
    }
    if (key === "ast") {
        return "AST";
    }
    if (key === "plt") {
        return "PLT";
    }
    if (key === "hbvDna") {
        return "HBV DNA";
    }
    return "HBsAg";
}

function renderLatestDate() {
    var box = document.getElementById("labLatestDate");
    if (!box) {
        return;
    }
    var latest = latestRecord();
    box.textContent = latest ? "最近检测：" + latest.date : "最近检测：暂无";
}

function renderLatestLabResults() {
    var box = document.getElementById("labLatestCards");
    if (!box) {
        return;
    }

    var latest = latestRecord();

    var cards = [
        { key: "alt", name: "ALT", value: latest && indicatorHasValue(latest, "alt") ? formatMetric(latest.alt, "U/L") : "--" },
        { key: "ast", name: "AST", value: latest && indicatorHasValue(latest, "ast") ? formatMetric(latest.ast, "U/L") : "--" },
        { key: "plt", name: "PLT", value: latest && indicatorHasValue(latest, "plt") ? formatMetric(latest.plt, "×10⁹/L") : "--" },
        { key: "hbvDna", name: "HBV DNA", value: latest && indicatorHasValue(latest, "hbvDna") ? formatHbvDna(latest) : "--" },
        { key: "hbsAg", name: "HBsAg", value: latest && indicatorHasValue(latest, "hbsAg") ? formatHbsAg(latest) : "--" }
    ];

    box.innerHTML = cards.map(function (item) {
        var empty = !latest || item.value === "--";
        return (
            '<button type="button" class="lab-metric-card" onclick="openIndicatorDetail(\'' + item.key + "')\">" +
            '<div class="lab-metric-name">' + item.name + "</div>" +
            '<div class="lab-metric-value">' + item.value + "</div>" +
            '<div class="lab-metric-date">' + (empty ? "暂无记录" : latest.date) + "</div>" +
            "</button>"
        );
    }).join("");
}

function renderLabHistory() {
    var body = document.getElementById("labHistoryBody");
    var empty = document.getElementById("labEmptyState");
    var wrap = document.getElementById("labHistoryWrap");

    if (!body || !empty || !wrap) {
        return;
    }

    var records = loadLabRecords();

    if (records.length === 0) {
        empty.style.display = "block";
        wrap.style.display = "none";
        body.innerHTML = "";
        return;
    }

    empty.style.display = "none";
    wrap.style.display = "block";

    body.innerHTML = records.map(function (item) {
        return (
            "<tr>" +
            "<td>" + item.date + "</td>" +
            "<td>" + (hasNumericField(item.alt) ? item.alt.value : "--") + "</td>" +
            "<td>" + (hasNumericField(item.ast) ? item.ast.value : "--") + "</td>" +
            "<td>" + (hasNumericField(item.plt) ? item.plt.value : "--") + "</td>" +
            "<td>" + formatHbvDna(item) + "</td>" +
            "<td>" + formatHbsAg(item) + "</td>" +
            "<td>" + (item.note ? item.note : "") + "</td>" +
            '<td><button type="button" class="lab-delete-btn" onclick="deleteLabRecord(\'' +
            item.id +
            "')\">删除</button></td>" +
            "</tr>"
        );
    }).join("");
}

function renderSvgChart(container, seriesList, options) {
    options = options || {};

    if (!container) {
        return;
    }

    var allPoints = [];
    var labeledPoints = [];

    seriesList.forEach(function (series) {
        series.points.forEach(function (point) {
            if (typeof point.value === "number") {
                allPoints.push(point);
            }
            if (point.label) {
                labeledPoints.push(point);
            }
        });
    });

    if (allPoints.length === 0 && labeledPoints.length === 0) {
        container.innerHTML = '<div class="lab-chart-empty">' +
            (options.emptyText || "暂无足够数据生成趋势") +
            "</div>";
        return;
    }

    var width = 520;
    var height = 180;
    var padL = 44;
    var padR = 16;
    var padT = 20;
    var padB = 28;
    var values = allPoints.length
        ? allPoints.map(function (item) { return item.value; })
        : [0, 1];
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);

    if (min === max) {
        var pad = Math.max(Math.abs(min) * 0.2, 0.5);
        min = min - pad;
        max = max + pad;
    }

    if (allPoints.length && Math.min.apply(null, allPoints.map(function (item) { return item.value; })) >= 0 && min < 0) {
        min = 0;
    }

    var dates = [];
    seriesList.forEach(function (series) {
        series.points.forEach(function (point) {
            if (dates.indexOf(point.date) === -1) {
                dates.push(point.date);
            }
        });
    });
    dates.sort(function (a, b) {
        var dateA = parseLabDate(a);
        var dateB = parseLabDate(b);
        return (dateA ? dateA.getTime() : 0) - (dateB ? dateB.getTime() : 0);
    });

    function xOf(date) {
        if (dates.length === 1) {
            return padL + (width - padL - padR) / 2;
        }
        var index = dates.indexOf(date);
        return padL + index * (width - padL - padR) / (dates.length - 1);
    }

    function yOf(value) {
        return padT + (max - value) * (height - padT - padB) / (max - min);
    }

    var svg = '<svg viewBox="0 0 ' + width + " " + height + '" class="lab-svg">';
    svg += '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (height - padB) + '" stroke="#d1d5db"/>';
    svg += '<line x1="' + padL + '" y1="' + (height - padB) + '" x2="' + (width - padR) + '" y2="' + (height - padB) + '" stroke="#d1d5db"/>';
    svg += '<text x="4" y="' + (padT + 4) + '" class="lab-svg-label">' + max.toFixed(max >= 100 ? 0 : 2) + "</text>";
    svg += '<text x="4" y="' + (height - padB) + '" class="lab-svg-label">' + min.toFixed(min >= 100 || min <= -100 ? 0 : 2) + "</text>";

    seriesList.forEach(function (series) {
        var usable = series.points.filter(function (point) {
            return typeof point.value === "number";
        });

        if (usable.length > 1) {
            var d = usable.map(function (point, index) {
                return (index === 0 ? "M" : "L") + xOf(point.date) + " " + yOf(point.value);
            }).join(" ");
            svg += '<path d="' + d + '" fill="none" stroke="' + series.color + '" stroke-width="2"/>';
        }

        series.points.forEach(function (point) {
            if (typeof point.value === "number") {
                svg += '<circle cx="' + xOf(point.date) + '" cy="' + yOf(point.value) + '" r="4" fill="' + series.color + '"/>';
                if (point.label) {
                    svg += '<text x="' + (xOf(point.date) + 6) + '" y="' + (yOf(point.value) - 8) + '" class="lab-svg-label">' + point.label + "</text>";
                }
            } else if (point.label) {
                svg += '<text x="' + (xOf(point.date) - 12) + '" y="' + (height - padB - 10) + '" class="lab-svg-label">' + point.label + "</text>";
            }
        });
    });

    if (dates.length) {
        svg += '<text x="' + padL + '" y="' + (height - 8) + '" class="lab-svg-label">' + dates[0] + "</text>";
        if (dates.length > 1) {
            svg += '<text x="' + (width - padR - 70) + '" y="' + (height - 8) + '" class="lab-svg-label">' + dates[dates.length - 1] + "</text>";
        }
    }

    svg += "</svg>";

    var hint = dates.length === 1
        ? '<p class="lab-chart-hint">增加更多检测记录后可查看趋势</p>'
        : "";

    var legend = seriesList.map(function (series) {
        return '<span class="lab-legend"><i style="background:' + series.color + '"></i>' + series.name + "</span>";
    }).join("");

    container.innerHTML = '<div class="lab-legend-row">' + legend + "</div>" + svg + hint;
}

function renderAltAstChart(records) {
    renderSvgChart(
        document.getElementById("labChartAltAst"),
        [
            {
                name: "ALT",
                color: "#2563eb",
                points: records.filter(function (item) { return hasNumericField(item.alt); }).map(function (item) {
                    return { date: item.date, value: item.alt.value };
                })
            },
            {
                name: "AST",
                color: "#7c3aed",
                points: records.filter(function (item) { return hasNumericField(item.ast); }).map(function (item) {
                    return { date: item.date, value: item.ast.value };
                })
            }
        ],
        { emptyText: "暂无ALT / AST检测记录" }
    );
}

function renderPltChart(records) {
    renderSvgChart(
        document.getElementById("labChartPlt"),
        [
            {
                name: "PLT",
                color: "#0f766e",
                points: records.filter(function (item) { return hasNumericField(item.plt); }).map(function (item) {
                    return { date: item.date, value: item.plt.value };
                })
            }
        ],
        { emptyText: "暂无PLT检测记录" }
    );
}

function renderHbvDnaChart(records) {
    renderSvgChart(
        document.getElementById("labChartHbvDna"),
        [
            {
                name: "HBV DNA",
                color: "#c2410c",
                points: records.filter(function (item) { return hasHbvDna(item); }).map(function (item) {
                    if (item.hbvDna.type === "not_detected") {
                        return { date: item.date, value: null, label: "未检出" };
                    }
                    return {
                        date: item.date,
                        value: item.hbvDna.value,
                        label: item.hbvDna.type === "below_detection_limit"
                            ? item.hbvDna.displayValue
                            : ""
                    };
                })
            }
        ],
        { emptyText: "暂无HBV DNA检测记录" }
    );
}

function renderHbsAgChart(records) {
    renderSvgChart(
        document.getElementById("labChartHbsAg"),
        [
            {
                name: "HBsAg",
                color: "#1d4ed8",
                points: records.filter(function (item) { return hasHbsAg(item); }).map(function (item) {
                    return {
                        date: item.date,
                        value: item.hbsAg.value
                    };
                })
            }
        ],
        { emptyText: "暂无HBsAg检测记录" }
    );
}

function setText(id, text) {
    var node = document.getElementById(id);
    if (node) {
        node.innerHTML = text;
    }
}

function renderTrendRange() {
    var range = getDateRange(labChartRange);
    var records = getFilteredLabRecords(labChartRange, "desc");
    var latest = records[0];
    var altCount = records.filter(function (item) { return hasNumericField(item.alt); }).length;
    var astCount = records.filter(function (item) { return hasNumericField(item.ast); }).length;
    var pltCount = records.filter(function (item) { return hasNumericField(item.plt); }).length;
    var dnaCount = records.filter(function (item) { return hasHbvDna(item); }).length;
    var hbsCount = records.filter(function (item) { return hasHbsAg(item); }).length;

    setText(
        "labMetaAltAst",
        range.label + "<br>单位：U/L<br>ALT：" + altCount + "次记录<br>AST：" + astCount + "次记录"
    );
    setText(
        "labLatestAltAst",
        latest
            ? "最近：<br>ALT " + formatMetric(latest.alt, "U/L") + "<br>AST " + formatMetric(latest.ast, "U/L")
            : "最近：暂无"
    );

    setText(
        "labMetaPlt",
        range.label + "<br>单位：×10⁹/L<br>PLT：" + pltCount + "次记录"
    );
    setText(
        "labLatestPlt",
        latest ? "最近：PLT " + formatMetric(latest.plt, "×10⁹/L") : "最近：暂无"
    );

    setText(
        "labMetaHbvDna",
        range.label + "<br>单位：IU/mL<br>HBV DNA：" + dnaCount + "次记录"
    );
    setText(
        "labLatestHbvDna",
        latest ? "最近：HBV DNA " + formatHbvDna(latest) : "最近：暂无"
    );

    setText(
        "labMetaHbsAg",
        range.label + "<br>单位：IU/mL<br>HBsAg：" + hbsCount + "次记录"
    );
    setText(
        "labLatestHbsAg",
        latest ? "最近：HBsAg " + formatHbsAg(latest) : "最近：暂无"
    );
}

function renderLabCharts() {
    var all = loadLabRecords();
    var ranged = getFilteredLabRecords(labChartRange, "asc");

    if (!all.length) {
        ["labChartAltAst", "labChartPlt", "labChartHbvDna", "labChartHbsAg"].forEach(function (id) {
            var node = document.getElementById(id);
            if (node) {
                node.innerHTML = "";
            }
        });
        ["labMetaAltAst", "labMetaPlt", "labMetaHbvDna", "labMetaHbsAg", "labLatestAltAst", "labLatestPlt", "labLatestHbvDna", "labLatestHbsAg"].forEach(function (id) {
            setText(id, "");
        });
        return;
    }

    renderTrendRange();
    renderAltAstChart(ranged);
    renderPltChart(ranged);
    renderHbvDnaChart(ranged);
    renderHbsAgChart(ranged);
}

function renderTimelineRecord(item) {
    return (
        '<div class="lab-timeline-item" onclick="openTimelineRecord(\'' + item.id + "')\">" +
        '<div class="lab-timeline-date">' + item.date + "</div>" +
        '<div class="lab-timeline-line"></div>' +
        '<div class="lab-timeline-card">' +
        '<div class="lab-timeline-metrics">' +
        "<div><strong>ALT</strong>" + formatMetric(item.alt, "U/L") + "</div>" +
        "<div><strong>AST</strong>" + formatMetric(item.ast, "U/L") + "</div>" +
        "<div><strong>PLT</strong>" + formatMetric(item.plt, "×10⁹/L") + "</div>" +
        "<div><strong>HBV DNA</strong>" + formatHbvDna(item) + "</div>" +
        "<div><strong>HBsAg</strong>" + formatHbsAg(item) + "</div>" +
        "</div>" +
        '<div class="lab-timeline-note">备注：' + (item.note ? item.note : "-") + "</div>" +
        "</div></div>"
    );
}

function renderIndicatorTimeline() {
    var box = document.getElementById("labTimeline");
    if (!box) {
        return;
    }

    var all = loadLabRecords();
    if (!all.length) {
        box.innerHTML = "";
        return;
    }

    var records = getFilteredLabRecords(labChartRange, "desc");
    if (!records.length) {
        box.innerHTML = '<div class="lab-chart-empty">该时间范围内暂无指标记录</div>';
        return;
    }

    box.innerHTML = records.map(renderTimelineRecord).join("");
}

function renderIndicatorDetail(key) {
    var content = document.getElementById("labDetailContent");
    if (!content) {
        return;
    }

    var records = getFilteredLabRecords(labChartRange, "desc");
    var unitMap = {
        alt: "U/L",
        ast: "U/L",
        plt: "×10⁹/L",
        hbvDna: "IU/mL",
        hbsAg: "IU/mL"
    };
    var title = key === "hbsAg" ? "HBsAg 定量趋势" : indicatorTitle(key) + "详情";
    if (key === "hbsAg") {
        title = "HBsAg定量详情";
    }

    var chartId = "labDetailChart";
    var historyRows = records.filter(function (item) {
        return indicatorHasValue(item, key);
    }).map(function (item) {
        return "<tr><td>" + item.date + "</td><td>" + indicatorDisplay(item, key) + "</td></tr>";
    }).join("");

    content.innerHTML =
        "<h3>" + title + "</h3>" +
        "<p>单位：" + unitMap[key] + "</p>" +
        "<p>当前范围：" + getDateRange(labChartRange).label + "</p>" +
        renderIndicatorStats(key, records) +
        '<div id="' + chartId + '" class="lab-chart-box"></div>' +
        "历史数据" +
        '<div class="lab-table-wrap"><table class="lab-table lab-detail-history"><thead><tr><th>日期</th><th>' +
        indicatorTitle(key) +
        "</th></tr></thead><tbody>" +
        (historyRows || "<tr><td colspan='2'>暂无记录</td></tr>") +
        "</tbody></table></div>";

    var chartRecords = getFilteredLabRecords(labChartRange, "asc");
    if (key === "alt" || key === "ast") {
        renderSvgChart(
            document.getElementById(chartId),
            [{
                name: indicatorTitle(key),
                color: "#2563eb",
                points: chartRecords.filter(function (item) { return hasNumericField(item[key]); }).map(function (item) {
                    return { date: item.date, value: item[key].value };
                })
            }],
            { emptyText: "暂无" + indicatorTitle(key) + "检测记录" }
        );
    } else if (key === "plt") {
        renderSvgChart(
            document.getElementById(chartId),
            [{
                name: "PLT",
                color: "#0f766e",
                points: chartRecords.filter(function (item) { return hasNumericField(item.plt); }).map(function (item) {
                    return { date: item.date, value: item.plt.value };
                })
            }],
            { emptyText: "暂无PLT检测记录" }
        );
    } else if (key === "hbvDna") {
        renderSvgChart(
            document.getElementById(chartId),
            [{
                name: "HBV DNA",
                color: "#c2410c",
                points: chartRecords.filter(function (item) { return hasHbvDna(item); }).map(function (item) {
                    if (item.hbvDna.type === "not_detected") {
                        return { date: item.date, value: null, label: "未检出" };
                    }
                    return {
                        date: item.date,
                        value: item.hbvDna.value,
                        label: item.hbvDna.type === "below_detection_limit" ? item.hbvDna.displayValue : ""
                    };
                })
            }],
            { emptyText: "暂无HBV DNA检测记录" }
        );
    } else {
        renderSvgChart(
            document.getElementById(chartId),
            [{
                name: "HBsAg",
                color: "#1d4ed8",
                points: chartRecords.filter(function (item) { return hasHbsAg(item); }).map(function (item) {
                    return { date: item.date, value: item.hbsAg.value };
                })
            }],
            { emptyText: "暂无HBsAg检测记录" }
        );
    }
}

function renderHbsAgDetail() {
    renderIndicatorDetail("hbsAg");
}

function renderHbvDnaDetail() {
    renderIndicatorDetail("hbvDna");
}

function openIndicatorDetail(key) {
    activeIndicatorKey = key;
    var overlay = document.getElementById("labDetailOverlay");
    if (key === "hbsAg") {
        renderHbsAgDetail();
    } else if (key === "hbvDna") {
        renderHbvDnaDetail();
    } else {
        renderIndicatorDetail(key);
    }
    if (overlay) {
        overlay.style.display = "flex";
    }
}

function closeIndicatorDetail() {
    activeIndicatorKey = null;
    var overlay = document.getElementById("labDetailOverlay");
    if (overlay) {
        overlay.style.display = "none";
    }
}

function openTimelineRecord(id) {
    activeTimelineId = id;
    var record = loadLabRecords().filter(function (item) {
        return item.id === id;
    })[0];
    var content = document.getElementById("labDayContent");
    var overlay = document.getElementById("labDayOverlay");

    if (!content || !record) {
        return;
    }

    content.innerHTML =
        "<h3>" + record.date + " 指标详情</h3>" +
        "<p>ALT：" + formatMetric(record.alt, "U/L") + "</p>" +
        "<p>AST：" + formatMetric(record.ast, "U/L") + "</p>" +
        "<p>PLT：" + formatMetric(record.plt, "×10⁹/L") + "</p>" +
        "<p>HBV DNA：" + formatHbvDna(record) + "</p>" +
        "<p>HBsAg：" + formatHbsAg(record) + "</p>" +
        "<p>备注：" + (record.note ? record.note : "-") + "</p>";

    if (overlay) {
        overlay.style.display = "flex";
    }
}

function closeTimelineRecord() {
    activeTimelineId = null;
    var overlay = document.getElementById("labDayOverlay");
    if (overlay) {
        overlay.style.display = "none";
    }
}

function renderLabRecordsPage() {
    document.querySelectorAll(".lab-range-btn").forEach(function (button) {
        button.classList.toggle(
            "is-active",
            button.getAttribute("data-range") === labChartRange
        );
    });

    renderLatestDate();
    renderLatestLabResults();
    renderLabHistory();
    renderLabCharts();
    renderIndicatorTimeline();

    if (activeIndicatorKey && document.getElementById("labDetailOverlay") &&
        document.getElementById("labDetailOverlay").style.display === "flex") {
        renderIndicatorDetail(activeIndicatorKey);
    }

    if (activeTimelineId && document.getElementById("labDayOverlay") &&
        document.getElementById("labDayOverlay").style.display === "flex") {
        openTimelineRecord(activeTimelineId);
    }
}

function openLabRecords() {
    var page = document.getElementById("labOverlay");
    if (!page) {
        return;
    }
    labChartRange = "3m";
    page.style.display = "block";
    renderLabRecordsPage();
}

function closeLabRecords() {
    var page = document.getElementById("labOverlay");
    if (page) {
        page.style.display = "none";
    }
    closeIndicatorDetail();
    closeTimelineRecord();
}

function todayText() {
    var now = new Date();
    return (
        now.getFullYear() +
        "-" +
        String(now.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(now.getDate()).padStart(2, "0")
    );
}

function onHbvDnaTypeChange() {
    var type = getSelectedDnaType();
    var numericWrap = document.getElementById("labDnaNumericWrap");
    var limitWrap = document.getElementById("labDnaLimitWrap");
    var preview = document.getElementById("labDnaPreview");

    if (numericWrap) {
        numericWrap.style.display = type === "numeric" ? "flex" : "none";
    }

    if (limitWrap) {
        limitWrap.style.display = type === "below_detection_limit" ? "flex" : "none";
    }

    var limitInput = document.getElementById("labDnaLimit");
    if (limitInput && !limitInput._labBound) {
        limitInput._labBound = true;
        limitInput.addEventListener("input", onHbvDnaTypeChange);
    }

    if (!preview) {
        return;
    }

    if (type === "not_detected") {
        preview.textContent = "最终显示：未检出";
    } else if (type === "below_detection_limit") {
        var limit = document.getElementById("labDnaLimit");
        var limitValue = limit && limit.value.trim() ? limit.value.trim() : "20";
        preview.textContent = "最终显示：<" + limitValue + " IU/mL";
    } else {
        preview.textContent = "";
    }
}

function openLabForm() {
    var overlay = document.getElementById("labFormOverlay");
    var errorBox = document.getElementById("labFormError");
    var dateInput = document.getElementById("labDate");

    ["labAlt", "labAst", "labPlt", "labHbsAg", "labDnaNumeric", "labNote"].forEach(function (id) {
        var field = document.getElementById(id);
        if (field) {
            field.value = "";
        }
    });

    var limit = document.getElementById("labDnaLimit");
    if (limit) {
        limit.value = "20";
    }

    var numericRadio = document.querySelector('input[name="labDnaType"][value="numeric"]');
    if (numericRadio) {
        numericRadio.checked = true;
    }

    if (dateInput) {
        dateInput.value = todayText();
    }

    if (errorBox) {
        errorBox.textContent = "";
    }

    onHbvDnaTypeChange();

    if (overlay) {
        overlay.style.display = "flex";
    }
}

function closeLabForm() {
    var overlay = document.getElementById("labFormOverlay");
    if (overlay) {
        overlay.style.display = "none";
    }
}

function submitLabRecord() {
    var errorBox = document.getElementById("labFormError");
    var result = validateLabRecord({
        date: document.getElementById("labDate").value,
        alt: document.getElementById("labAlt").value,
        ast: document.getElementById("labAst").value,
        plt: document.getElementById("labPlt").value,
        hbsAg: document.getElementById("labHbsAg").value,
        dnaType: getSelectedDnaType(),
        dnaNumeric: document.getElementById("labDnaNumeric").value,
        dnaLimit: document.getElementById("labDnaLimit").value,
        note: document.getElementById("labNote").value.trim()
    });

    if (typeof result === "string") {
        if (errorBox) {
            errorBox.textContent = result;
        }
        return;
    }

    addLabRecord(result.record);
    closeLabForm();
    renderLabRecordsPage();
}

function setLabChartRange(range) {
    labChartRange = range || "3m";
    renderLabRecordsPage();
}

// 医疗安全规则引擎 - 红黄绿风险分级体系
const RiskEngine = {
    // 1. 红色警报：必须立即就医 / 联系医生，AI 停止回答，触发紧急提示
    RED_FLAGS: [
        "高烧不退", "持续高热", "超过39度", 
        "想自杀", "活着没意思", "抑郁想死", 
        "皮肤发黄", "眼睛发黄", "黄疸", 
        "严重腹泻", "吐血", "黑便", 
        "浑身皮疹", "呼吸困难"
    ],

    // 2. 黄色警告：常见副作用，AI 提供缓解建议，但提醒患者在随访时告知医生
    YELLOW_FLAGS: [
        "脱发", "掉头发", 
        "轻度发烧", "低热", "头痛", "肌肉酸痛",
        "没食欲", "胃口不好", "恶心", 
        "睡不好", "失眠", "觉得有点心烦", 
        "皮肤发痒", "皮肤干燥"
    ],

    // 3. 核心分级审查函数
    analyzeSymptoms: function(patientInput) {
        const text = patientInput.toLowerCase().replace(/\s+/g, "");

        // 优先检查红色风险
        for (let keyword of this.RED_FLAGS) {
            if (text.includes(keyword)) {
                return {
                    level: "RED",
                    warning: "🚨 触发红色紧急警报：检测到严重症状或高风险倾向！请立即前往医院就诊，或联系您的主治医生。AI 无法为您提供针对此症状的评估。",
                    suggestAction: "立即就医 / 拨打120"
                };
            }
        }

        // 检查黄色风险
        for (let keyword of this.YELLOW_FLAGS) {
            if (text.includes(keyword)) {
                return {
                    level: "YELLOW",
                    warning: "⚠️ 提示：这属于长效干扰素治疗的常见副作用。AI 已为您匹配相关的标准健康科普，但请在下一次医院随访时主动告知您的主治医生。",
                    suggestAction: "查看缓解指南 / 随访记录"
                };
            }
        }

        // 绿色：安全，普通健康教育
        return {
            level: "GREEN",
            warning: "✨ 状态正常：未检测到高危症状。您可以继续向 AI 助手咨询普通的健康科普知识。",
            suggestAction: "正常 AI 对话"
        };
    }
};

// 导出模块（供后续前端和后端调用）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RiskEngine;
}

import type { JsonRecord } from "./dataset.ts";

export const SAMPLE_FILE_NAME = "support-dialogues.jsonl";

export const SAMPLE_RECORDS: JsonRecord[] = [
  {
    id: "dialogue-001",
    topic: "退款政策",
    quality: 0.96,
    source: "客服知识库",
    tags: ["政策", "清晰回答"],
    messages: [
      { role: "system", content: "你是一个简洁、准确的客户支持助手。" },
      { role: "user", content: "购买后 14 天内可以申请退款吗？" },
      {
        role: "assistant",
        content:
          "可以。商品未被明显使用且保留原包装时，你可以在签收后 14 天内提交退款申请。数字内容和定制商品除外。",
      },
    ],
  },
  {
    id: "dialogue-002",
    topic: "修改收货地址",
    quality: 0.91,
    source: "历史工单",
    tags: ["物流", "操作指引"],
    messages: [
      { role: "user", content: "订单已经付款，还能修改收货地址吗？" },
      {
        role: "assistant",
        content:
          "如果订单尚未进入仓库打包，可以在订单详情中选择“修改地址”。若按钮已消失，请尽快联系人工客服确认是否能够拦截。",
      },
      { role: "user", content: "在哪里查看是不是已经打包？" },
      {
        role: "assistant",
        content: "打开“我的订单”，状态显示为“待发货”时点进详情即可查看当前处理阶段。",
      },
    ],
  },
  {
    id: "dialogue-003",
    topic: "发票开具",
    quality: 0.88,
    source: "合成样本",
    tags: ["发票"],
    messages: [
      { role: "user", content: "公司采购怎么申请电子发票？" },
      {
        role: "assistant",
        content:
          "在订单完成后进入订单详情，选择“申请发票”，填写公司名称和纳税人识别号。审核通过后，电子发票会发送到你填写的邮箱。",
      },
    ],
  },
];

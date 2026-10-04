# RevenueScout 产品功能规格说明书 v1.0

## 1. 产品定义

### 1.1 产品名称

暂定名称：

**RevenueScout**

产品副标题：

**B2B 客户发现、购买信号识别与收入机会优化平台**

### 1.2 产品解决的核心问题

RevenueScout 不以“管理客户”为主要目标，也不是传统 CRM。

它解决的是企业在获客过程中最核心的几个问题：

1. 市场上有哪些企业可能成为我的客户？
2. 哪些企业真正符合我的目标客户画像？
3. 哪些企业现在正在出现购买信号？
4. 为什么现在应该联系这家公司？
5. 应该优先联系谁？
6. 应该向这家公司销售什么？
7. 这个机会大概值多少钱？
8. 哪个潜在客户值得销售人员优先投入时间？
9. 哪些推荐最终真的变成了回复、会议、商机和收入？
10. 系统能否根据真实结果不断改进之后的客户推荐？

RevenueScout 最终优化的不是“潜在客户数量”，而是：

**有限销售资源能够产生的预期收入。**

---

# 2. 产品核心原则

RevenueScout 所有功能必须围绕以下原则设计。

### 2.1 不追求最多客户，而追求最值得联系的客户

系统不能以：

“找到 10,000 家公司”

作为主要价值。

真正需要回答：

> 今天销售人员只有时间联系 20 家公司，最应该联系哪 20 家？

---

### 2.2 每一个推荐必须回答“为什么”

系统不能只显示：

> Lead Score：92

必须进一步解释：

> 为什么是 92？

例如：

- 企业规模高度符合目标画像；
- 最近快速招聘；
- 新增办公室；
- 正在招聘相关技术岗位；
- 当前业务流程存在明显人工环节；
- 最近获得融资；
- 新管理层上任；
- 与历史成交客户特征相似。

---

### 2.3 “Why now”比“Who”更重要

RevenueScout 不只是寻找合适的公司。

更重要的是：

> **为什么现在是联系这家公司的好时机？**

企业可能一直是一个潜在客户，但真正有价值的是发现：

> 它今天比六个月前更可能购买。

---

### 2.4 最终优化收入，而不是简单转化率

系统不能只认为：

“最容易成交的客户就是最好的客户。”

例如：

客户 A：

- 成交概率：60%
- 潜在合同：$2,000

客户 B：

- 成交概率：20%
- 潜在合同：$50,000

RevenueScout 应该能够体现两种机会价值的差异。

系统需要长期围绕：

**Expected Revenue / Potential Revenue / Sales Effort**

帮助企业排序。

---

### 2.5 推荐必须能够被真实结果验证

系统推荐客户之后，用户需要能够记录：

- 未联系；
- 已联系；
- 已回复；
- 无回复；
- 拒绝；
- 安排会议；
- Qualified；
- Proposal；
- Won；
- Lost。

最终系统必须知道：

> 当初推荐的客户最后发生了什么？

否则整个系统只是一个静态评分工具。

---

# 3. 用户类型

## 3.1 Owner / Founder

通常是小型企业创始人。

主要需求：

- 找更多客户；
- 知道市场在哪里；
- 知道应该先联系谁；
- 看到获客带来了多少收入；
- 不希望学习复杂 CRM。

---

## 3.2 Sales Manager

主要需求：

- 管理目标市场；
- 给销售人员分配机会；
- 查看团队表现；
- 查看哪些客户值得优先跟进；
- 查看收入预测；
- 查看哪些获客策略有效。

---

## 3.3 Sales Representative

主要需求：

- 每天打开系统就知道应该联系谁；
- 快速理解客户；
- 快速知道为什么联系；
- 快速知道应该谈什么；
- 记录联系结果；
- 查看自己的跟进任务。

---

## 3.4 Admin

主要需求：

- 管理公司账户；
- 管理成员；
- 管理权限；
- 管理数据；
- 管理合规设置；
- 管理系统规则。

---

# 4. 首次使用流程

新用户第一次进入 RevenueScout 时，不应该直接看到空白 Dashboard。

系统需要通过引导帮助用户描述：

> “你到底想找什么客户？”

---

## 4.1 企业基本信息

用户填写：

- 公司名称；
- 公司网站；
- 所在国家；
- 服务地区；
- 行业；
- 公司规模；
- 公司简介。

---

## 4.2 产品与服务定义

用户可以建立多个 Offering。

例如：

### Offering A

Custom Software Development

### Offering B

Workflow Automation

### Offering C

AI Integration

每个 Offering 需要记录：

- 名称；
- 描述；
- 主要解决的问题；
- 典型客户；
- 最低合同金额；
- 平均合同金额；
- 理想合同金额；
- 典型销售周期；
- 不适合的客户。

---

# 5. Ideal Customer Profile——目标客户画像

这是 RevenueScout 最重要的基础模块之一。

用户可以创建一个或多个 ICP。

例如：

## ICP：Australian Logistics SME

条件：

- Australia；
- Logistics；
- 20–200 employees；
- 多地点运营；
- 年收入达到一定规模；
- 有明显人工工作流；
- 有扩张迹象。

---

## 5.1 ICP 基础条件

用户可以定义：

- 国家；
- 州；
- 城市；
- 行业；
- 子行业；
- 员工人数；
- 公司规模；
- 企业年龄；
- 企业类型；
- 服务区域。

---

## 5.2 ICP 业务条件

可以定义：

- 是否快速增长；
- 是否有多个办公地点；
- 是否正在招聘；
- 是否近期融资；
- 是否存在特定岗位；
- 是否拥有特定业务模式；
- 是否存在特定软件/技术；
- 是否存在明显数字化需求。

---

## 5.3 排除条件

非常重要。

用户可以明确告诉系统：

> 什么客户不要推荐。

例如：

- 少于 5 人；
- 超过 5,000 人；
- 政府机构；
- 非营利组织；
- 直接竞争对手；
- 已经是客户；
- 已明确拒绝；
- 已退订；
- 指定行业。

---

# 6. 市场发现功能

## 6.1 Discover Companies

用户选择：

- 一个 Offering；
- 一个 ICP；
- 一个地区。

点击：

**Discover Opportunities**

系统返回潜在企业。

---

## 6.2 发现结果

每家公司至少显示：

- 公司名称；
- 网站；
- 地点；
- 行业；
- 大致规模；
- ICP Fit；
- 当前机会评分；
- 主要 buying signals；
- Expected Revenue；
- 为什么推荐；
- 推荐时间。

---

## 6.3 公司去重

同一家公司不能因为：

不同数据来源、不同网址形式、不同公司名称格式

而重复出现。

例如：

ABC Pty Ltd

ABC Australia

ABC

应该允许系统判断它们可能属于同一企业，并提示用户。

---

## 6.4 已存在客户识别

如果企业：

- 已经是客户；
- 已在销售 Pipeline；
- 已经被联系；
- 已拒绝；
- 已退订；

系统必须明确显示状态。

避免销售人员重复骚扰同一家公司。

---

# 7. Company Intelligence——企业情报页面

每一家企业拥有独立详情页面。

页面目标是回答：

> “我是否值得花时间研究和联系这家公司？”

---

## 7.1 企业基本资料

包括：

- 公司名称；
- Logo；
- Website；
- Location；
- Industry；
- Employee size；
- Company description；
- 成立时间；
- 服务区域；
- 主要产品/服务。

---

# 8. Buying Signals——购买信号

这是整个 RevenueScout 的核心功能之一。

系统需要围绕潜在客户持续形成“事件”。

---

## 8.1 Hiring Signal

例如：

公司近期开始大量招聘。

具体显示：

> 过去 30 天新增 14 个招聘岗位。

进一步区分：

- IT；
- Operations；
- Sales；
- Finance；
- Management；
- Engineering。

---

## 8.2 Expansion Signal

例如：

- 新开办公室；
- 新增仓库；
- 新增地区；
- 新业务部门；
- 新门店；
- 国际扩张。

---

## 8.3 Funding Signal

例如：

- 完成融资；
- 获得投资；
- 获得政府资金；
- 重大资本投入。

---

## 8.4 Leadership Signal

例如：

新任：

- CEO；
- CTO；
- COO；
- CIO；
- Head of Operations；
- Head of Sales。

系统需要说明：

为什么这一变化可能产生购买机会。

---

## 8.5 Technology Signal

例如：

- 更换网站；
- 引入新的软件；
- 开始招聘某类开发人员；
- 使用明显老旧流程；
- 技术体系发生明显变化。

---

## 8.6 Operational Pain Signal

系统发现与潜在业务问题有关的信息。

例如：

客户评价大量提到：

- 响应慢；
- 订单错误；
- 人工处理；
- 等待时间长；
- booking 混乱；
- customer support 不稳定。

系统不能简单把负面评论当作结论。

必须表示为：

> **Potential Pain Signal**

而不是：

> “该公司一定存在这个问题。”

---

## 8.7 Growth Signal

例如：

企业规模快速增长。

系统显示：

> Estimated headcount growth: +34% over 12 months.

---

## 8.8 Procurement / Tender Signal

如果企业公开表现出：

- 招标；
- 采购；
- vendor search；
- 项目采购需求；

系统把它标记为高价值信号。

---

# 9. Signal Timeline

每家公司应该拥有时间轴。

例如：

**October 3**

新增 7 个 operations vacancies

**September 21**

Brisbane office announced

**August 7**

New COO appointed

**June 14**

Website careers section expanded

用户能够看到：

> 这家公司为什么现在越来越值得联系。

---

# 10. Opportunity Score

每家公司都有：

**Opportunity Score**

范围：

0–100。

但这个分数必须拆开显示。

---

## 10.1 ICP Fit

回答：

> 这是不是我们想要的客户？

---

## 10.2 Buying Intent

回答：

> 它现在有没有可能产生购买需求？

---

## 10.3 Timing

回答：

> 是不是现在联系比较合适？

---

## 10.4 Deal Potential

回答：

> 如果成交，大概有多大价值？

---

## 10.5 Contactability

回答：

> 目前是不是存在合理的联系路径？

---

## 10.6 Confidence

系统对自己的判断有多大把握。

不能把信息很少的企业和信息非常充分的企业显示成同等可信。

---

# 11. Why This Company

任何排名较高的潜在客户都必须生成一个：

## Why this company?

例如：

> Strong ICP match because the company operates across multiple warehouses and employs approximately 80 people.

---

# 12. Why Now

单独设置：

## Why now?

例如：

> The company has opened a second distribution centre and increased operations hiring by approximately 30% within the past two months, indicating growing operational complexity.

这是产品最重要的信息之一。

---

# 13. Problem Hypothesis

系统可以根据现有信息产生：

**Problem Hypothesis**

例如：

> Rapid multi-location expansion may increase scheduling and operational coordination complexity.

必须明确告诉用户：

这是：

**Hypothesis**

而不是已确认事实。

---

# 14. Recommended Offering

如果企业创建了多个 Offering：

RevenueScout 应该推荐：

> 最适合向这家公司销售哪项服务。

例如：

Company A：

推荐：

**Workflow Automation**

而不是：

Custom Website Development。

系统同时解释：

> Why this offering?

---

# 15. Expected Deal Value

RevenueScout 允许用户定义不同客户类型通常对应的合同区间。

例如：

20–50 employees：

$10,000–25,000

50–200：

$25,000–60,000

200+：

$50,000+

系统据此给出：

**Estimated Deal Value**

并显示：

Low / Expected / High。

例如：

> $20,000 / $35,000 / $55,000

不能假装这是精确价格。

---

# 16. Conversion Probability

系统为客户显示：

**Estimated Conversion Probability**

例如：

> 18%

并解释主要影响因素。

早期没有足够真实数据时，需要明确标记：

> Low confidence

随着真实销售结果增加，可信度逐渐提升。

---

# 17. Expected Revenue

核心指标：

**Expected Revenue**

逻辑概念：

成交可能性 × 潜在 Deal Value。

例如：

> Conversion probability：20%

> Expected deal value：$40,000

> Expected Revenue：$8,000

此指标用于比较销售机会。

---

# 18. Sales Effort

用户可以估计：

- Low；
- Medium；
- High。

或者记录预计需要：

- 联系次数；
- 会议数量；
- 销售周期。

系统可以进一步提供：

## Revenue Efficiency

即：

> 预计收入与预计销售投入之间的关系。

帮助企业避免：

为了一个很小的订单投入大量销售资源。

---

# 19. Today 页面

RevenueScout 的核心首页不是普通 Dashboard。

应该首先回答：

# 今天应该做什么？

页面顶部显示：

## Today's Best Opportunities

例如：

1. Company A — Expected Revenue $9,500
2. Company B — Expected Revenue $8,100
3. Company C — Expected Revenue $6,400

每个客户下面直接显示：

- 为什么值得联系；
- 为什么现在；
- 推荐 Offering；
- 推荐联系人；
- 下一步行动。

---

# 20. Next Best Action

系统为每个 Opportunity 推荐：

**下一步做什么。**

可能是：

- Research company；
- Find decision maker；
- Contact now；
- Follow up；
- Wait；
- Book meeting；
- Prepare proposal；
- Do not contact；
- Revisit next month。

---

# 21. 联系人管理

每家公司可以有多个 Contact。

例如：

CEO  
CTO  
COO  
Operations Manager  
Sales Director  
IT Manager。

---

## 21.1 Contact 信息

包括：

- Name；
- Position；
- Company；
- Email；
- Phone；
- LinkedIn；
- Location；
- Decision-making relevance；
- Contact status。

---

## 21.2 Recommended Contact

RevenueScout 根据销售内容提示：

> 最适合联系谁。

例如：

卖：

workflow automation

可能优先：

COO / Head of Operations。

卖：

software development

可能优先：

CTO / CIO。

---

# 22. 联系理由

在联系人页面必须同时回答：

> Why this person?

例如：

> This person oversees operations and is likely to own the workflow affected by the identified expansion signal.

---

# 23. Outreach Preparation

RevenueScout 可以协助销售准备联系内容。

但不能把产品变成简单群发工具。

---

## 23.1 Outreach Brief

对于每个潜在客户生成：

- 公司摘要；
- 最近事件；
- 可能的痛点；
- 推荐 Offering；
- 联系理由；
- 推荐联系人；
- 联系切入点。

---

## 23.2 Message Angle

提供不同沟通角度，例如：

**Growth angle**

针对扩张。

**Efficiency angle**

针对流程效率。

**Revenue angle**

针对收入。

**Cost angle**

针对成本。

---

## 23.3 Personalisation Facts

单独列出：

> 可以安全用于个性化沟通的事实。

例如：

- 新办公室；
- 新服务；
- 新岗位；
- 新管理人员。

避免 AI 自动“编故事”。

---

# 24. 联系记录

每一次联系必须能够记录。

包括：

- 联系日期；
- 联系渠道；
- 联系人；
- 联系内容；
- 销售人员；
- 当前状态；
- 下一次行动日期；
- Notes。

---

# 25. Lead Lifecycle

一个潜在客户应该存在完整生命周期。

标准状态：

**Discovered**

↓

**Qualified**

↓

**Ready to Contact**

↓

**Contacted**

↓

**Replied**

↓

**Meeting**

↓

**Opportunity**

↓

**Proposal**

↓

最终：

**Won**

或

**Lost**

另外包括：

**Not Fit**

**Do Not Contact**

**Suppressed**

---

# 26. Follow-up 功能

如果联系后没有回复：

系统可以提示：

> Follow up due.

但不自动无限联系。

必须支持：

- follow-up 1；
- follow-up 2；
- final follow-up；
- stop contact。

---

# 27. Lost Reason

失败必须记录原因。

例如：

- No budget；
- No need；
- Timing；
- Competitor；
- Price；
- Wrong contact；
- Company too small；
- Existing supplier；
- No response；
- Internal solution；
- Other。

这是系统后续学习的重要信息。

---

# 28. Won Deal

成交时记录：

- 最终合同金额；
- 销售周期；
- 成交日期；
- Offering；
- 主要联系人；
- 原始推荐来源；
- 关键 buying signals。

系统因此能够知道：

> 哪些信号最终真的带来了钱。

---

# 29. Learning Loop

这是 RevenueScout 与普通 prospect database 最大的区别之一。

系统持续比较：

### 原始预测

和

### 最终真实结果。

例如：

推荐了：

1000 companies

其中：

300 contacted

70 replied

25 meetings

10 opportunities

4 won

RevenueScout需要分析：

> 哪些特征真正和成交有关？

---

# 30. Signal Performance

用户可以看到：

例如：

### Expansion Signal

50 leads

10 meetings

4 deals

Revenue generated：

$120,000

---

### Hiring Signal

80 leads

8 meetings

1 deal

Revenue：

$15,000

那么企业可以发现：

> 对我们的业务而言，“扩张”比“招聘”更有价值。

---

# 31. ICP Performance

不同 ICP 可以比较。

例如：

Logistics SME：

Revenue $180k

Healthcare SME：

Revenue $60k

Construction SME：

Revenue $240k

系统帮助企业重新分配获客资源。

---

# 32. Offering Performance

例如：

Workflow Automation：

Conversion 18%

Custom Software：

9%

AI Integration：

6%

系统让企业知道：

> 市场真正愿意买什么。

---

# 33. Revenue Attribution

系统应该回答：

> RevenueScout 推荐的客户最终产生了多少收入？

指标包括：

- Discovered Opportunities；
- Contacted；
- Meetings；
- Opportunities；
- Won Deals；
- Revenue；
- Average Deal Size；
- Sales Cycle；
- Expected Revenue；
- Actual Revenue。

---

# 34. Pipeline Dashboard

用户可以查看：

每个阶段：

- 客户数量；
- Expected Revenue；
- Actual Revenue；
- Conversion Rate。

例如：

200 discovered

80 qualified

50 contacted

20 replied

10 meetings

5 proposals

2 won。

---

# 35. Forecast

基于当前机会：

显示：

### Potential Revenue

例如：

$420,000

### Probability-adjusted Expected Revenue

$96,000

并明确区分：

预测

与

已经成交的收入。

---

# 36. Opportunity Alerts

如果某个现有潜客突然出现新的 buying signal：

用户收到通知。

例如：

> Company A has just announced a second warehouse.

并显示：

> Opportunity Score increased from 68 → 89.

以及：

> Recommended action: Contact within 3 days.

---

# 37. Watchlist

用户可以把某些企业加入：

**Watchlist**

即使现在还不值得联系，也持续关注。

例如：

> Great fit, poor timing.

一旦出现重要信号：

系统提醒。

---

# 38. Saved Markets

用户可以保存一个市场。

例如：

> Australian logistics businesses, 20–200 employees.

以后再次查看：

- 新出现企业；
- 新 buying signals；
- 排名变化；
- 新 opportunity。

---

# 39. Compliance Status

每个联系人都应该拥有：

**Contactability / Compliance Status**

例如：

- Contact permitted；
- Existing relationship；
- User-confirmed consent；
- Public business contact；
- Uncertain；
- Do not contact；
- Unsubscribed。

系统不能只因为有邮箱就默认：

> 可以无限发送商业信息。

---

# 40. Suppression List

如果联系人：

- 退订；
- 要求停止联系；
- 被公司标记禁止联系；
- 存在其他禁止条件；

进入：

**Suppression List**

之后整个组织中的其他销售人员也必须看到：

> Do Not Contact。

---

# 41. Consent Record

允许记录：

- consent 类型；
- 时间；
- 来源；
- Notes。

---

# 42. Duplicate Outreach Prevention

系统应该发现：

> 两个销售人员准备同时联系同一个人。

并提示：

> This contact was contacted by Sarah 2 days ago.

避免内部重复联系。

---

# 43. Company-level Contact Frequency

企业可以自行设定：

例如：

同一联系人：

7 天内不得超过 X 次。

同一公司：

14 天内不得超过 Y 次。

---

# 44. Team Workspace

企业可以邀请多个成员。

---

## 44.1 Opportunity Owner

每个客户可以指定负责人。

例如：

Owner：Yancy

其他销售人员能够看到：

> 已有人跟进。

---

## 44.2 Assignment

Sales Manager 可以：

- 手动分配客户；
- 批量分配；
- 重新分配。

---

## 44.3 Notes

团队成员能够共享内部 Notes。

---

## 44.4 Mentions

允许：

@某位成员

提醒对方查看一个客户。

---

# 45. 权限功能

至少支持：

### Admin

全部权限。

### Manager

查看团队、分配机会、看 Analytics。

### Sales

管理自己的客户和联系。

### Viewer

只读。

---

# 46. Search

系统全局搜索能够搜索：

- Companies；
- Contacts；
- Opportunities；
- Notes；
- Industries；
- Locations。

---

# 47. Filters

用户可以按照：

- Country；
- State；
- City；
- Industry；
- Size；
- Score；
- Signal；
- Expected Revenue；
- Stage；
- Owner；
- Last Contact；
- Last Signal；
- ICP；
- Offering

筛选。

---

# 48. Sort

支持：

- Opportunity Score；
- Expected Revenue；
- Conversion Probability；
- Deal Value；
- Latest Signal；
- Best ICP Fit；
- Sales Efficiency。

---

# 49. Saved Views

例如：

### My Hot Leads

Score > 80

### Sydney Logistics

Location = Sydney

### No Contact Yet

Stage = Qualified

### Expansion Leads

Signal = Expansion

用户可以保存筛选视图。

---

# 50. Data Confidence

每条重要信息应存在：

**Confidence / Verification Status**

例如：

Confirmed

Likely

Unverified

Outdated。

避免用户把低质量信息当成事实。

---

# 51. Source Visibility

涉及关键企业信息和 buying signal 时：

用户应该能够知道：

> 这个判断来自什么信息。

例如：

Company website

Job listing

Public announcement

User input。

---

# 52. Information Freshness

信息应该显示：

> Last updated

例如：

Updated 2 days ago

而不是永久展示旧数据。

---

# 53. 用户修正

用户应该能够告诉系统：

> 这个信息错了。

例如：

Wrong industry

Wrong employee count

Company closed

Wrong contact

Wrong signal。

修正之后：

不能继续向用户重复展示错误结果。

---

# 54. Recommendation Feedback

每个推荐支持：

👍 Useful

👎 Not useful

如果 Not useful：

选择：

- Wrong company；
- Wrong timing；
- Wrong signal；
- Wrong offering；
- Too small；
- Too large；
- Already contacted；
- Other。

---

# 55. Daily Brief

用户可以查看：

## 今日获客简报

例如：

8 new high-value opportunities

3 important buying signals

5 follow-ups due

1 opportunity increased above Score 90

Projected pipeline +$32,000。

---

# 56. Weekly Revenue Intelligence

每周总结：

- 新潜客；
- Top opportunities；
- 最强信号；
- Meetings；
- Won；
- Lost；
- 新收入；
- Pipeline change；
- 哪个 ICP 表现最好；
- 哪个 signal 表现最好。

---

# 57. Opportunity Comparison

允许选择：

Company A

Company B

Company C

然后比较：

- Fit；
- Timing；
- Signals；
- Deal size；
- Conversion probability；
- Expected Revenue；
- Sales effort。

帮助用户决定：

> 时间有限时先追谁。

---

# 58. Manual Lead

用户可以自己创建一家企业。

例如在线下活动认识的客户。

之后 RevenueScout 同样可以：

- 分析；
- 评分；
- 监控；
- 加入 Pipeline。

---

# 59. Import

允许用户导入已有：

- Companies；
- Contacts；
- Customers；
- Leads。

导入过程中应该：

- 检查重复；
- 标记错误；
- 允许预览；
- 允许确认。

---

# 60. Export

用户可以导出：

- Companies；
- Contacts；
- Pipeline；
- Sales results；
- Analytics。

---

# 61. 已有客户

RevenueScout 不应该把已有客户反复推荐为新客户。

已有客户单独标记：

**Customer**

但可以产生：

### Expansion Opportunity

例如：

已有客户出现新的增长信号。

系统可以推荐：

> Cross-sell / Upsell opportunity。

---

# 62. Competitor 标记

用户可以建立：

Competitor List。

这些企业：

不应该被推荐为正常潜客。

---

# 63. Partner 标记

部分企业不是客户，而是潜在合作伙伴。

允许标记：

Partner Opportunity。

避免错误进入 Sales Lead。

---

# 64. Blacklist

用户可以永久排除：

- Company；
- Domain；
- Industry；
- Person。

---

# 65. Sales Playbook

用户可以针对不同信号定义：

推荐销售策略。

例如：

### Expansion Signal

建议：

强调 scalability。

### Hiring Signal

建议：

强调 automation。

### Funding Signal

建议：

强调 growth infrastructure。

---

# 66. Signal-to-Offering Mapping

用户可以定义：

某种 signal 出现后：

哪些 Offering 更相关。

例如：

Rapid hiring

→ Workflow Automation

New CTO

→ Software Modernisation

Expansion

→ Operational Platform。

---

# 67. Revenue Goal

企业可以设定：

例如：

### Monthly New Revenue Target

$100,000

系统显示：

当前 Pipeline 是否足以支持目标。

例如：

Target：$100k

Expected：$63k

Gap：$37k。

---

# 68. Acquisition Gap

如果收入目标存在缺口：

RevenueScout 可以提示：

> 当前高价值机会数量不足。

需要：

例如：

12 additional qualified opportunities。

这样产品从：

“给你 leads”

变成：

“告诉你离收入目标还有多远”。

---

# 69. Sales Capacity

企业可以填写：

本周销售团队能够处理多少：

- Leads；
- Meetings；
- Proposals。

RevenueScout 不应该推荐 1,000 个 leads 给只有一个销售人员的小公司。

而应该根据能力优先提供：

最值得处理的一批。

---

# 70. Opportunity Queue

每个销售人员每天获得一个有优先级的队列：

例如：

### Priority 1

Contact Company A

### Priority 2

Follow up Company B

### Priority 3

Research Company C

### Priority 4

Meeting with Company D。

---

# 71. Snooze Opportunity

如果用户认为：

客户很好，但现在时机不对。

可以：

Snooze

例如：

1 week

1 month

3 months

specific date。

到期重新进入推荐。

---

# 72. Re-engagement

对于：

过去拒绝

但不是永久拒绝的客户。

如果之后出现重要 signal：

系统可以提示：

> Re-engagement opportunity.

例如：

六个月前说没有预算。

现在刚刚融资。

---

# 73. Explainability

所有重要系统判断必须支持：

## Why?

例如：

为什么 Score 89？

为什么认为 Expansion？

为什么推荐 COO？

为什么 Expected Revenue $20k？

为什么认为现在应该联系？

不能只展示黑盒结果。

---

# 74. 用户覆盖系统判断

用户可以手动：

提高优先级；

降低优先级；

修改 Deal Value；

修改 stage；

修改 contact；

修改 ICP match。

但系统要保留：

> 用户修改过。

---

# 75. Prediction vs Reality

对于最终成交客户：

系统可以展示：

### Originally predicted

Expected Deal：$25k

Probability：30%

### Actual

Won

Deal：$42k

Sales cycle：36 days。

这是系统学习与产品可信度的重要部分。

---

# 76. Analytics 首页

必须回答几个最重要的问题：

### 我们这个月找到了多少新机会？

### 哪些机会最值钱？

### 哪些机会最可能成交？

### 哪些 buying signals 最有价值？

### 哪些 ICP 最赚钱？

### 哪个 Offering 最容易销售？

### RevenueScout 推荐的客户产生了多少钱？

---

# 77. 产品明确不做的事情

RevenueScout 第一阶段不应该变成：

完整财务系统；

完整项目管理系统；

完整客服系统；

完整 HR 系统；

完整 ERP；

社交媒体管理工具；

通用聊天机器人；

传统邮件营销平台；

无差别邮件群发器；

纯联系人数据库；

纯 CRM。

核心永远是：

**Customer Acquisition Intelligence**

和

**Revenue Opportunity Optimisation。**

---

# 78. MVP 必须拥有的功能

第一阶段必须完成：

1. 用户和企业账户；
2. Offering；
3. ICP；
4. Company；
5. Company discovery；
6. Buying Signals；
7. Company profile；
8. Opportunity Score；
9. Why this company；
10. Why now；
11. Problem Hypothesis；
12. Recommended Offering；
13. Estimated Deal Value；
14. Conversion Probability；
15. Expected Revenue；
16. Opportunity ranking；
17. Contact；
18. Recommended Contact；
19. Lead lifecycle；
20. Contact record；
21. Won / Lost；
22. Lost reason；
23. Basic Analytics；
24. Feedback；
25. Watchlist；
26. Search/filter；
27. Suppression / Do Not Contact；
28. Today 页面。

达到这里，RevenueScout 已经是一个完整产品，而不是 Demo。

---

# 79. 第二阶段功能

MVP稳定以后加入：

- Signal Timeline；
- Opportunity Alerts；
- Follow-up；
- Saved Markets；
- Daily Brief；
- Weekly Intelligence；
- Team Workspace；
- Assignment；
- Revenue Goal；
- Acquisition Gap；
- Sales Capacity；
- Opportunity Queue；
- ICP Performance；
- Signal Performance；
- Offering Performance；
- Revenue Attribution；
- Forecast。

---

# 80. 第三阶段功能

产品获得真实用户和真实销售数据之后再加入：

- 更成熟的 Conversion Prediction；
- Revenue optimisation；
- Sales-effort optimisation；
- 自动发现新的高价值 signal；
- 自动发现高价值 ICP；
- 自动发现新的客户群；
- Opportunity pattern discovery；
- Re-engagement intelligence；
- Cross-sell / Upsell intelligence。

---

# 81. RevenueScout 的核心用户体验

理想情况下，一个小企业老板早上打开 RevenueScout。

首页不是：

> 18,436 leads found.

而是：

> **今天最值得你关注的是这 7 家企业。**

第一家公司：

**ABC Logistics**

Opportunity Score：

91

Expected Revenue：

$9,200

Why this company：

高度符合 Logistics SME ICP。

Why now：

过去六周新开一个仓库并招聘 12 名 operations staff。

Potential problem：

多地点运营可能增加 scheduling 与 coordination complexity。

Recommended offering：

Workflow Automation

Best person：

Head of Operations

Recommended action：

Contact this week。

老板看完以后能够立即回答：

> 我为什么应该花时间联系这家公司？

如果 RevenueScout 能稳定做到这一件事，

这个产品的核心价值就成立了。

---

# 82. 产品最终愿景

RevenueScout 最终不应该只是一个：

**Lead finder。**

而应该逐步成为：

# Revenue Decision System

它帮助企业回答：

> 我的下一个客户在哪里？

> 哪个市场最值得进入？

> 哪种客户最容易给我带来收入？

> 什么事件意味着客户可能马上产生需求？

> 我的销售人员今天应该把时间花在哪里？

> 哪些获客行为真正产生了收入？

> 如果我想下个月新增 $100,000 收入，现在还缺多少高质量机会？

最终目标：

**把“销售人员凭感觉找客户”逐渐变成“根据市场信号、历史结果和收入价值分配销售资源”。**
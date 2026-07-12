/**
 * 9 条已知日程的「日程详情」Markdown 正文（构建期预渲染用）。
 * 与 functions/_seed.js 的 SEED_BODIES 保持一致；用 TS 模板字符串避免 JSON 转义。
 * 后台在 D1 中编辑过的正文以运行时（D1）为准，构建期仅作首屏兜底。
 */
export const EVENT_BODIES: Record<string, string> = {
  'live-2026-01-25': `## 01.25 Sunday Candy Vol.03 活动结算

【Sunday Candy Vol.03】广州首演！

**歌单：**
00. SE - Gleams
01. 《私、シンデレラ》- ワガママなラストノート
02. 《可愛いって言われたい》- 高嶺のなでしこ
MC
03. 《Summer Darling》- 昼食彼女 Lunch Girls

👑 成员：白菜、云团、柚子、黄鱼鱼`,
  'live-2026-01-31': `## 01.31 第一届 Comic Expo 国风动漫展 活动结算

【南宁·第一届 Comic Expo 国风动漫展】

**歌单：**
00. SE - Gleams
01. 《可愛いって言われたい》- 高嶺のなでしこ
02. 《心型病毒》- TSH48
03. 《Summer Darling》- 昼食彼女 Lunch Girls

👑 成员：白菜、云团、柚子`,
  'live-2026-02-15': `## 02.15 桂平·ACG 第七届动漫新年盛典 活动结算

年前最后一场封箱演出，每张特典卷获成员手写新年祝福贺卡。

**歌单：**
00. SE - Gleams
01. 《下课铃声》- SNH48
02. 《心型病毒》- TSH48
03. 《Summer Darling》- 昼食彼女 Lunch Girls

👑 成员：白菜、云团、柚子、黄鱼鱼`,
  'live-2026-02-23': `## 02.23 Akatsuki Idol Party Vol.24 ~ アイドル新年会 ~ 活动结算

2026年开箱演出！

**歌单：**
00. SE - Gleams
01. 《ロマンティックガール》- ZUTTOMOTTO
02. 《可愛いって言われたい》- 高嶺のなでしこ
03. 《Summer Darling》- 昼食彼女 Lunch Girls

👑 成员：💛💙💚`,
  'live-2026-03-14': `## 03.14 SUMMERL∞P MINI FES 活动结算

白色情人节特别公演「白情与公主有个约会」！

**歌单：**
00. SE - Gleams
01. 《ロマンティックガール》- ZUTTOMOTTO
02. 《可愛いって言われたい》- 高嶺のなでしこ
03. 《Summer Darling》- 昼食彼女 Lunch Girls

👑 成员：💛💙💚`,
  'live-2026-03-28': `## 03.28 Akatsuki Idol Party Vol.25 活动结算

JK 盛夏服新衣装披露！

**歌单：**
00. SE - Gleams
01. 《ロマンティックガール》- ZUTTOMOTTO
02. 《可愛いって言われたい》- 高嶺のなでしこ
03. 《Summer Darling》- 昼食彼女 Lunch Girls
04. 《下课铃声》- SNH48

👑 成员：💛💙💚`,
  'live-2026-04-26': `## 04.26 Puppy Club First Anniversary 活动结算

西芭公式服1.0！

**歌单：**
00. SE - Gleams
01. 《ロマンティックガール》- ZUTTOMOTTO
02. 《可愛いって言われたい》- 高嶺のなでしこ
03. 《Summer Darling》- 昼食彼女 Lunch Girls
04. 《下课铃声》- SNH48

👑 成员：💛💙💚`,
  'live-2026-05-16': `## 05.16 五碳糖 FES3.0 ~初夏の宴~ 活动结算

女仆装主题演出！

**歌单：**
00. SE - Gleams
01. 《ロマンティックガール》- ZUTTOMOTTO
02. 《可愛いって言われたい》- 高嶺のなでしこ
03. 《下课铃声》- SNH48
04. 《Kawaii Kaiwai》- Piki

👑 成员：💛💙💚`,
  'live-2026-07-04': `## 07.04 Nez Fes Vol.1 -初晴の約束 真夏の約束- 活动结算

感谢大家在台风天也努力奔赴来为我们白菜 Hakusai 庆祝生日🎂，大家都辛苦了！

新衣装「白雪云」首次披露，蓝白色赛高！

👑 成员：💛💙💚`,
};

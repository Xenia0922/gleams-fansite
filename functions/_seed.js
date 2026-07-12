/**
 * 共享：events 表的建表 / 播种 / 回填。
 * 同时被 functions/api/events.js（数据接口）与 functions/_middleware.js（SSR 数据注入）引用，
 * 确保全站只有一份真实种子数据——杜绝曾经 schedule.js 写入虚构标题的问题。
 *
 * 注意：Cloudflare Pages Functions 用 esbuild 打包 .js，不做 TS 类型剥离，
 * 所以本文件保持纯 JS（JSDoc 注释即可，不要写 TS 类型注解）。
 */

const DDL = `CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT,
  title TEXT NOT NULL,
  venue TEXT,
  performers TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'upcoming',
  image TEXT,
  body TEXT,
  created_at TEXT NOT NULL
);`;

// 真实种子数据（与 src/data/schedule.json 一致）。performers 为数组，写入时 JSON.stringify。
export const SEED = [
  { id: 'live-2026-01-25', date: '2026-01-25', time: '', title: 'Sunday Candy Vol.03（广州首演）', venue: '广州', performers: ['hakusai', 'kumo', 'yuzi', 'huangyuyu'], status: 'past', image: '/images/events/live-2026-01-25.webp' },
  { id: 'live-2026-01-31', date: '2026-01-31', time: '12:40', title: '第一届 Comic Expo 国风动漫展（出道）', venue: '南宁北投明月荟（西乡塘区）', performers: ['hakusai', 'kumo', 'yuzi'], status: 'past', image: '/images/events/live-2026-01-31.webp' },
  { id: 'live-2026-02-15', date: '2026-02-15', time: '', title: '桂平·ACG第七届动漫新年盛典', venue: '桂平', performers: ['hakusai', 'kumo', 'yuzi', 'huangyuyu'], status: 'past', image: '/images/events/live-2026-02-15.webp' },
  { id: 'live-2026-02-23', date: '2026-02-23', time: '', title: 'Akatsuki Idol Party Vol.24 ～アイドル新年会～', venue: '南宁·候朋现场 HOPELIVE（中山路万象汇）', performers: ['hakusai', 'kumo', 'yuzi'], status: 'past', image: '/images/events/live-2026-02-23.webp' },
  { id: 'live-2026-03-14', date: '2026-03-14', time: '12:25', title: 'SUMMERL∞P MINI FES — 白情与公主有个约会', venue: '南宁·PinkNoises Live（会展动漫城）', performers: ['hakusai', 'kumo', 'yuzi'], status: 'past', image: '/images/events/live-2026-03-14.webp' },
  { id: 'live-2026-03-28', date: '2026-03-28', time: '13:30', title: 'Akatsuki Idol Party Vol.25', venue: '南宁·PinkNoises Live（会展动漫城）', performers: ['hakusai', 'kumo', 'yuzi'], status: 'past', image: '/images/events/live-2026-03-28.webp' },
  { id: 'live-2026-04-26', date: '2026-04-26', time: '', title: 'Puppy Club First Anniversary', venue: '南宁·民歌湖广场福馆 Full house', performers: ['hakusai', 'kumo', 'yuzi'], status: 'past', image: '/images/events/live-2026-04-26.webp' },
  { id: 'live-2026-05-16', date: '2026-05-16', time: '14:00', title: '五碳糖 FES3.0 ～初夏の宴～', venue: '南宁·PinkNoises Live（会展动漫城）', performers: ['hakusai', 'kumo', 'yuzi'], status: 'past', image: '/images/events/live-2026-05-16.webp' },
  { id: 'live-2026-07-04', date: '2026-07-04', time: '', title: 'Nez Fes Vol.1 -初晴の約束 真夏の約束-（白菜生日SP）', venue: '南宁·PinkNoises Live（会展动漫城）', performers: ['hakusai', 'kumo', 'yuzi'], status: 'past', image: '/images/events/live-2026-07-04.webp' },
];

// 旧 news/*.md 正文迁移：key = 事件 id，value = Markdown 正文
// 仅回填到 body 为空的行，不会覆盖后台已编辑的内容。
export const SEED_BODIES = {
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

/**
 * 建表（兼容旧表加 body 列）+ 首次播种 + 已存在数据回填 image/body（仅空时填）。
 * 由 events.js 与 middleware 共用，保证全站事件数据唯一且真实。
 */
export async function ensureEvents(env) {
  await env.DB.prepare(DDL).run();
  // 旧表补 body 列（部署前已存在 events 表时）
  try {
    await env.DB.prepare('ALTER TABLE events ADD COLUMN body TEXT').run();
  } catch (e) { /* 列已存在则忽略 */ }
  try {
    const { results } = await env.DB.prepare('SELECT COUNT(*) AS c FROM events').all();
    if (results[0] && results[0].c === 0) {
      for (const e of SEED) {
        await env.DB
          .prepare(
            `INSERT INTO events (id,date,time,title,venue,performers,status,image,body,created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?)`
          )
          .bind(e.id, e.date, e.time || '', e.title, e.venue || '', JSON.stringify(e.performers || []), e.status || 'past', e.image || '', SEED_BODIES[e.id] || '', new Date().toISOString())
          .run();
      }
    } else {
      // 已存在数据的表：回填旧 news 的 image 与 body（仅当对应字段为空，不覆盖后台已编辑内容）
      const { results: emptyImg } = await env.DB.prepare("SELECT COUNT(*) AS c FROM events WHERE image IS NULL OR image = ''").all();
      if (emptyImg[0] && emptyImg[0].c > 0) {
        for (const e of SEED) {
          if (!e.image) continue;
          await env.DB
            .prepare('UPDATE events SET image = ? WHERE id = ? AND (image IS NULL OR image = \'\')')
            .bind(e.image, e.id)
            .run();
        }
      }
      const { results: emptyRows } = await env.DB.prepare("SELECT COUNT(*) AS c FROM events WHERE body IS NULL OR body = ''").all();
      if (emptyRows[0] && emptyRows[0].c > 0) {
        for (const [id, body] of Object.entries(SEED_BODIES)) {
          await env.DB
            .prepare('UPDATE events SET body = ? WHERE id = ? AND (body IS NULL OR body = \'\')')
            .bind(body, id)
            .run();
        }
      }
    }
  } catch (e) { console.error('[seed] ensureEvents failed:', e.message); }
}

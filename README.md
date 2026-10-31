# 田豪的导航网

保留原导航网的搜索、分类、添加、移动、重命名、删除、撤销和 JSON 备份功能，增加账号登录和 Supabase 云同步。

## 文件

- `index.html`、`style.css`、`app.js`：网页。
- `sync-engine.js`：本机暂存、按版本保存、三方合并和冲突处理。
- `cloud-config.js`：项目网址和可公开的 Publishable key。
- `vendor/`：固定版本 `@supabase/supabase-js@2.118.0` 与 MIT 许可证。
- `setup.sql`：数据库初始化脚本。应复制文件**内容**到 Supabase SQL Editor，不能粘贴本地文件路径。

## 第一次配置

1. 在 Supabase 项目的 SQL Editor 中运行 `setup.sql` 的完整内容。末尾验证结果应是 `row_security=true`、`force_row_security=true`、`policies=3`。
2. 在 GitHub 仓库 Settings → Pages 中选择 Deploy from a branch，分支 `main`，目录 `/(root)`，保存。
3. 网站发布后，将 Supabase Authentication → URL Configuration 中的 Site URL 设置为：
   `https://tianhao131.github.io/T1anhao_Guiding_Web/`
   将同一网址加入 Redirect URLs，以便邮箱确认后返回网站。
4. 打开网站，首次使用时注册一个导航网同步账号，按提示确认邮箱，然后登录。这与登录 GitHub 或 Supabase 控制台的账号独立。
5. 在旧的桌面 HTML 页面中导出 JSON 备份，到新网站登录后用“导入 / 导出”导入一次。在另一台电脑打开同一网址并登录同一同步账号。

## 同步行为

- 首次登录后从云端读取收藏。公开网页文件不包含个人收藏。
- 修改会先写入当前账号的本机缓存，随后自动同步。
- 页面保持打开时每 20 秒检查云端；回到页面、重新联网或点击“同步”也会检查。
- 不同收藏或不同字段的修改自动合并。同一字段的不同修改、删除与编辑发生冲突时，需要用户选择冲突部分保留本机或云端；其他修改均保留。
- 本机缓存按账号隔离。退出登录会清空当前页面展示，但未同步草稿保留在原浏览器，待原账号再次登录后继续同步。
- 当前离线暂存支持已登录并打开的页面；首次打开或重新验证登录需要网络。它不是完整离线 PWA。
- 为避免覆盖别人的收藏，数据库使用按版本比较后更新，不使用无条件的最后写入覆盖。

## 个人资料与权限

- 收藏保存在 `navigation_bookmark_state`，每个同步账号一条记录。
- 行级权限要求 `auth.uid() = user_id`，未登录访问无表权限。
- 登录账号只能读写自己的记录；客户端只能插入 `user_id, entries`、更新 `entries`，版本由数据库触发器递增。
- `cloud-config.js` 中的 Publishable key 可以公开。Secret key、service_role、数据库密码不得放入代码。
- 原始 HTML 和个人 JSON 备份不应提交到公开仓库。

## 当前验证范围

已在本地验证双设备合并、同字段与删除冲突、断网恢复、缓存写入失败、账号分离、撤销、保存期间继续编辑，以及 DOM 登录与导航交互。

真实用户注册、邮箱确认、数据库权限和两台实际电脑的完整同步，需要在数据库初始化和 Pages 发布后进行验收。浏览器视觉布局尚未完成实际预览。

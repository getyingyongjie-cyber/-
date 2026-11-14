应用街 Google 登录部署文件

此目录中的 index.html 已改为 Google 登录，单文件约 20.6 MB。把本目录全部内容放到 Vercel 项目根目录并重新部署；只上传 index.html 不够，Google OAuth 需要 api 文件夹里的服务端接口。

Vercel → 项目 Settings → Environment Variables，Production 环境要有：
GOOGLE_CLIENT_ID = Google OAuth 客户端 ID
GOOGLE_CLIENT_SECRET = Google OAuth 客户端密钥
PUBLIC_ORIGIN = https://www.getyingyongjie.com
AUTH_COOKIE_SECRET = 一串随机长密码（至少 32 个随机字符）

不要把客户端密钥或 AUTH_COOKIE_SECRET 发给任何人，也不要放进 index.html。
保存变量后重新部署一次。Google OAuth 客户端的已获授权重定向 URI 必须精确填写：
https://www.getyingyongjie.com/api/auth/google/callback

注意：Vercel 项目若使用 www.getyingyongjie.com 作为正式主域，上面的 PUBLIC_ORIGIN 应与浏览器访问的主机名完全一致。不要把根域和 www 混用。

部署后先打开 https://www.getyingyongjie.com/api/auth/status 。应返回 JSON，且 configured 为 true。然后回首页刷新，打开账号入口，点“使用 Google 登录”。测试账号需先加入 Google Auth Platform → 受众群体 → 测试用户。

这套接口负责 Google 登录身份验证。旧反馈服务器使用的 Gmail 发信接口并未迁移到 Vercel Functions；如需恢复“登录后发送反馈”，还需单独迁移反馈接口。

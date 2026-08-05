import Link from "next/link";
import { chatGPTSignInPath } from "../chatgpt-auth";
import AdminApp from "./admin-app";
import { getAdminViewer } from "./admin-viewer";
import "./admin.css";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const viewer = await getAdminViewer();
  if (!viewer) {
    return <main className="backend-login">
      <section className="backend-login-card">
        <Link className="backend-login-brand" href="/"><span>华</span><strong>华彩赛事管理后台</strong></Link>
        <div className="backend-login-copy">
          <small>赛事运营与竞赛执行</small>
          <h1>把赛事资料、报名和赛程<br/>统一放在一个后台管理</h1>
          <p>组委会负责赛事和内容，裁判团队负责抽签、赛程、比分与排名。公众前端只读取已经发布的数据。</p>
        </div>
        <div className="backend-login-actions">
          <a href={chatGPTSignInPath("/admin")}>登录管理后台</a>
          <Link href="/">返回公众赛事页面</Link>
        </div>
        <footer><span>组委会</span><span>裁判长</span><span>裁判员</span><span>系统管理员</span></footer>
      </section>
    </main>;
  }

  return <AdminApp viewer={{ email: viewer.email, displayName: viewer.displayName }} />;
}

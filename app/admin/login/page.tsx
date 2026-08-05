import Link from "next/link";
import { redirect } from "next/navigation";
import { isInitialSetupAvailable } from "@/db/auth";
import { getAdminViewer } from "../admin-viewer";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await getAdminViewer()) redirect("/admin");
  const configured = Boolean(process.env.DATABASE_URL);
  const setup = configured ? await isInitialSetupAvailable() : false;

  return <main className="backend-login">
    <section className="backend-login-card">
      <Link className="backend-login-brand" href="/"><span>华</span><strong>华彩赛事管理后台</strong></Link>
      <div className="backend-login-copy">
        <small>赛事运营与竞赛执行</small>
        <h1>赛事资料、报名和赛程<br/>统一后台管理</h1>
        <p>管理员和组委会负责赛事与内容发布，裁判负责赛程、比分、晋级和排名。公众前端只读取已经正式发布的数据。</p>
      </div>
      {configured ? <LoginForm setup={setup} /> : <div className="backend-config-warning"><strong>后台等待连接数据库</strong><p>页面已经可以运行。请在 EdgeOne Pages 设置 Supabase 数据库连接后进入首次设置。</p></div>}
      <footer><span>管理员</span><span>组委会</span><span>裁判</span><Link href="/">返回公众赛事页面</Link></footer>
    </section>
  </main>;
}

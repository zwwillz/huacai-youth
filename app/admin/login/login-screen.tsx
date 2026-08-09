import Link from "next/link";
import LoginForm from "./login-form";
import "./login-performance.css";

export default function LoginScreen() {
  return <main className="backend-login">
    <section className="backend-login-card">
      <Link className="backend-login-brand" href="/"><span>华</span><strong>华彩赛事管理后台</strong></Link>
      <div className="backend-login-copy">
        <small>赛事运营与竞赛执行</small>
        <h1>赛事资料、报名和赛程<br/>统一后台管理</h1>
        <p>管理员和组委会负责赛事与内容发布，裁判负责赛程、比分、晋级和排名。公众前端只读取已经正式发布的数据。</p>
      </div>
      <LoginForm />
      <footer><span>管理员</span><span>组委会</span><span>裁判</span><Link href="/">返回公众赛事页面</Link></footer>
    </section>
  </main>;
}

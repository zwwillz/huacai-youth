import PlayerShell from "../player-shell";
import styles from "../player.module.css";

export default function PlayerDetailLoading() {
  return (
    <PlayerShell>
      <div className={styles.backLink}><span>‹</span> 返回球员</div>
      <section className={styles.card}>
        <div className={styles.emptyState}>正在加载球员资料…</div>
      </section>
    </PlayerShell>
  );
}

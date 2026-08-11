import { unstable_cache } from "next/cache";
import EventApp from "./event-app";
import { getPublicHomeData } from "@/db/public-home";

export const runtime = "nodejs";
// The homepage only carries lightweight event-list data. Registration time status is time-sensitive,
// so keep this cache short while still avoiding per-request database reads.
export const revalidate = 60;

const getCachedPublicHomeData = unstable_cache(
  getPublicHomeData,
  ["public-home-data-v3"],
  { revalidate: 60, tags: ["public-site"] },
);

function eventVisualCss(stations: Awaited<ReturnType<typeof getPublicHomeData>>["stations"]) {
  return stations.map((station) => {
    if (station.coverImage) {
      const image = JSON.stringify(station.coverImage);
      return `
.cover-${station.id}{background-image:linear-gradient(0deg,#271064ed 0%,#43149e6f 54%,transparent),url(${image})!important;background-size:cover!important;background-position:center!important}
.cover-${station.id}:before{display:none!important}
.station-${station.id} .hero-poster{background-image:linear-gradient(90deg,#341476 0%,#34147635 38%,transparent 62%),url(${image})!important;background-size:cover!important;background-position:center 10%!important}
.station-${station.id} .hero-poster:after{display:none!important}`;
    }

    if (station.id === "taiyuan" || station.id === "miyun") return "";
    return `
.cover-${station.id}{background-image:radial-gradient(circle at 76% 14%,#ff62b675,transparent 29%),linear-gradient(145deg,#2b126e,#6d36c9)!important}
.station-${station.id} .hero-poster{background-image:radial-gradient(circle at 50% 22%,#ff64a77d,transparent 27%),linear-gradient(145deg,#5d146d,#b22d87)!important;background-size:cover!important;background-position:center!important;position:relative!important}
.station-${station.id} .hero-poster:after{content:"";display:block!important;width:150px;height:150px;border:2px solid #ffffff21;border-radius:50%;box-shadow:0 0 0 28px #ffffff08,0 0 0 56px #ffffff05}
.station-${station.id} .hero-poster strong,.station-${station.id} .hero-poster span{display:block!important;position:absolute;z-index:2}
.station-${station.id} .hero-poster strong{top:43%;font-size:14px;color:#d9cef0}
.station-${station.id} .hero-poster span{top:49%;font-size:38px;font-weight:900}`;
  }).join("\n");
}

export default async function Home() {
  const useCiBuildFallback = process.env.GITHUB_ACTIONS === "true"
    && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY);
  const data: Awaited<ReturnType<typeof getPublicHomeData>> = useCiBuildFallback
    ? { stations: [], matches: [], players: [] }
    : await getCachedPublicHomeData();
  const visualCss = eventVisualCss(data.stations);

  return <>
    <style dangerouslySetInnerHTML={{ __html: visualCss }} />
    <style>{`
      .tabs.public-five-tabs,.tabs.public-unified-tabs{display:flex!important;grid-template-columns:none!important;width:max-content!important;max-width:100%!important;gap:5px!important;padding:5px!important}
      .tabs.public-five-tabs button,.tabs.public-unified-tabs button{min-width:0!important;padding:8px 14px!important;font-size:11px!important}
      .partner-logo-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
      .partner-logo-card{min-height:124px;padding:14px;border:1px solid #e9e4ef;border-radius:14px;color:inherit;background:#fbfafe;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;text-decoration:none;transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease}
      a.partner-logo-card:hover{border-color:#d9ccec;box-shadow:0 10px 25px #40226f12;transform:translateY(-1px)}
      .sponsor-section .partner-logo-card img{width:100%!important;height:58px!important;max-width:180px!important;object-fit:contain!important;border-radius:0!important;display:block!important}
      .partner-logo-card strong{margin-top:10px;font-size:11px;line-height:1.45}
      .partner-logo-card small{margin-top:4px;color:#817789;font-size:8px;letter-spacing:0}
      @media(max-width:900px){.tabs.public-five-tabs,.tabs.public-unified-tabs{display:flex!important;width:max-content!important}.tabs.public-five-tabs button,.tabs.public-unified-tabs button{padding:8px 14px!important;font-size:11px!important}.partner-logo-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:620px){.partner-logo-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.partner-logo-card{min-height:108px;padding:11px}.sponsor-section .partner-logo-card img{height:50px!important}}
    `}</style>
    <EventApp data={data} />
  </>;
}

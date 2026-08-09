import { getAdminViewer } from "@/app/admin/admin-viewer";
import { EventInput, saveEvent } from "@/db/admin";
import { ensureNewEventDefaults } from "@/db/event-bootstrap";
import { syncEventOverviewPublication } from "@/db/event-publication-sync";
import { getEventManagementData, saveEventManagementData } from "@/db/event-management";
import { getSqlClient } from "@/db";
import { revalidatePath, revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";

type CreateSetup = {
  groups?: Array<{ name: string; code: string; status: string }>;
  organizations?: { host?: string; support?: string; operator?: string; cooperator?: string };
  memberIds?: string[];
};

type CreateEventInput = EventInput & { setup?: CreateSetup };

function id(prefix: string) {
  return prefix + "_" + crypto.randomUUID().replaceAll("-", "");
}

export async function POST(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });
  try {
    const input = await request.json() as CreateEventInput;
    const data = await saveEvent(viewer.username, input);
    if (!input.id) {
      const created = data.events.find((event) => event.year === Number(input.year) && event.stationNo === Number(input.stationNo) && event.shortTitle === input.shortTitle.trim()) ?? data.events[0];
      if (created) {
        await ensureNewEventDefaults(created.id);
        const sql = getSqlClient();

        // A committee account that creates a new event must immediately retain
        // access to that event before the full setup bundle is saved.
        if (viewer.role === "committee") {
          const timestamp = new Date().toISOString();
          await sql`
            insert into public.event_members (id,event_id,user_id,role,status,created_at,updated_at)
            select ${id("member")},${created.id},u.id,'committee','active',${timestamp},${timestamp}
            from public.users u where u.username=${viewer.username}
            on conflict (event_id,user_id) do update set status='active',role='committee',updated_at=${timestamp}
          `;
        }

        if (input.setup) {
          const current = await getEventManagementData(viewer.username, created.id);
          const requestedGroups = input.setup.groups?.length ? input.setup.groups : [
            { name: "少年组", code: "U16", status: "active" },
            { name: "青年组", code: "U20", status: "active" },
          ];
          const groups = current.event.groups.map((group, index) => {
            const requested = requestedGroups.find((item) => item.code === group.code) ?? requestedGroups[index];
            return requested ? { ...group, name: requested.name, code: requested.code, status: requested.status } : group;
          });

          // The current event-management writer still expects a venue while saving
          // groups/organizations/members. Use a short-lived internal placeholder,
          // then immediately remove it so a newly created event has no fake venue.
          const saved = await saveEventManagementData(viewer.username, {
            eventId: current.event.id,
            year: current.event.year,
            stationNo: current.event.stationNo,
            fullTitle: current.event.fullTitle,
            shortTitle: current.event.shortTitle,
            city: current.event.city,
            startDate: current.event.startDate,
            endDate: current.event.endDate,
            registrationStartAt: current.event.registrationStartAt,
            registrationEndAt: current.event.registrationEndAt,
            coverImageKey: current.event.coverImageKey,
            summary: current.event.summary,
            status: current.event.status as "draft",
            publishStatus: current.event.publishStatus as "draft",
            venue: { ...current.event.venue, name: current.event.venue.name || "待设置场馆" },
            details: { ...current.event.details },
            sponsors: current.event.sponsors.map((row) => ({ ...row })),
            organizations: {
              host: input.setup.organizations?.host ?? "",
              support: input.setup.organizations?.support ?? "",
              operator: input.setup.organizations?.operator ?? "",
              cooperator: input.setup.organizations?.cooperator ?? "",
            },
            groups,
            memberIds: viewer.role === "system_admin" ? (input.setup.memberIds ?? []) : current.event.memberIds,
          });
          const placeholderVenueId = saved.event.venue.id;
          if (!current.event.venue.id && placeholderVenueId) {
            await sql`update public.events set venue_id=null where id=${created.id} and venue_id=${placeholderVenueId}`;
            await sql`delete from public.venues where id=${placeholderVenueId}`;
          }
        }
        await syncEventOverviewPublication(created.id, input.publishStatus === "published");
      }
    } else {
      await syncEventOverviewPublication(input.id, input.publishStatus === "published");
    }
    revalidateTag("admin-navigation-events", { expire: 0 });
    revalidateTag("public-site", { expire: 0 });
    revalidateTag("public-content", { expire: 0 });
    revalidatePath("/");
    return Response.json({ data });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "赛事保存失败。" }, { status: 400 });
  }
}

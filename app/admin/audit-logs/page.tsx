import Link from "next/link";

import { AdminPageHeader, EmptyAdminState } from "@/components/admin/AdminUi";
import { getAuditLogs } from "@/lib/admin-data";

type Query = { event?: string; actor?: string; entity?: string; from?: string; to?: string; page?: string };

function href(query: Query, page: number) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => { if (value && key !== "page") params.set(key, value); });
  params.set("page", String(page));
  return `/admin/audit-logs?${params}`;
}

export default async function AdminAuditLogsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const data = await getAuditLogs({ ...query, page: Number(query.page) || 1 });
  return (
    <>
      <AdminPageHeader eyebrow="Append-only accountability" title="Audit logs" description="Sensitive payloads, credentials and full customer addresses are excluded from these records." />
      <form className="admin-filter" method="get"><label>Event type<input name="event" defaultValue={query.event} placeholder="order.fulfilment_changed" /></label><label>Actor user ID<input name="actor" defaultValue={query.actor} /></label><label>Entity ID<input name="entity" defaultValue={query.entity} /></label><label>From<input name="from" type="date" defaultValue={query.from} /></label><label>To<input name="to" type="date" defaultValue={query.to} /></label><div className="admin-filter-actions"><button className="button button--small" type="submit">Apply filters</button><Link href="/admin/audit-logs">Clear</Link></div></form>
      {data.logs.length ? <div className="admin-audit-list">{data.logs.map((entry) => <article key={entry.id}><div><strong>{entry.summary}</strong><span>{entry.event_type} · {entry.entity_type}:{entry.entity_id} · {new Date(entry.created_at).toLocaleString("en-IN")}</span><small>Actor: {entry.actor_user_id || "system"}{entry.correlation_id ? ` · Request: ${entry.correlation_id}` : ""}</small></div><details><summary>Safe metadata</summary><pre>{JSON.stringify(entry.metadata, null, 2)}</pre></details></article>)}</div> : <EmptyAdminState title="No audit events match">Clear the filters or complete an audited admin operation.</EmptyAdminState>}
      {data.pageCount > 1 ? <nav className="admin-pagination" aria-label="Audit-log pages"><Link aria-disabled={data.page <= 1} href={href(query, Math.max(1, data.page - 1))}>Previous</Link><span>Page {data.page} of {data.pageCount}</span><Link aria-disabled={data.page >= data.pageCount} href={href(query, Math.min(data.pageCount, data.page + 1))}>Next</Link></nav> : null}
    </>
  );
}

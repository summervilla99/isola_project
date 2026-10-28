import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
let db: PGlite;
const A = "00000000-0000-4000-8000-000000000001",
  B = "00000000-0000-4000-8000-000000000002",
  C = "00000000-0000-4000-8000-000000000003";
async function as(id: string) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`,
  );
}
async function action(a: unknown) {
  await db.query("select public.isola_mutate($1::jsonb)", [JSON.stringify(a)]);
}
async function state() {
  return (await db.query<{ isola_state: any }>("select public.isola_state()"))
    .rows[0].isola_state;
}
async function rejects(fn: () => Promise<unknown>, text?: string) {
  await expect(fn()).rejects.toThrow(text);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${A}'),('${B}'),('${C}');`,
  );
  await db.exec(readFileSync("supabase/migrations/001_isola.sql", "utf8"));
});
afterAll(async () => {
  await db.close();
});
describe("database authority and transactions", () => {
  let item: string, space: string, token: string;
  it("creates a single owner and two private spaces", async () => {
    await as(A);
    await state();
    await action({ type: "island.create", name: "테스트 섬" });
    const s = await state();
    expect(s.members).toHaveLength(1);
    expect(s.spaces).toHaveLength(2);
    expect(s.spaces[0].visibility).toBe("private");
    space = s.spaces[0].id;
  });
  it("joins atomically and is idempotent for the same member", async () => {
    await as(A);
    token = (
      await db.query<{ isola_invite: string }>("select public.isola_invite()")
    ).rows[0].isola_invite;
    await as(B);
    await state();
    await action({ type: "invite.accept", token });
    await action({ type: "invite.accept", token });
    expect((await state()).members).toHaveLength(2);
  });
  it("does not expose drafts or private spaces to peers", async () => {
    await as(B);
    expect((await state()).spaces.every((s: any) => s.owner === B)).toBe(true);
    const raw = await db.query("select * from public.spaces where owner=$1", [
      A,
    ]);
    expect(raw.rows).toHaveLength(0);
  });
  it("rejects arbitrary direct writes", async () => {
    await as(B);
    await rejects(
      () =>
        db.query("update public.profiles set name=$1 where id=$2", [
          "hacked",
          A,
        ]),
      "permission denied",
    );
  });
  it("owner cannot read other member private records", async () => {
    await as(B);
    item = crypto.randomUUID();
    await action({
      type: "item.save",
      id: item,
      item: {
        kind: "book",
        title: "비밀 책",
        creator: "저자",
        note: "private",
        tags: [],
        visibility: "private",
      },
    });
    await as(A);
    expect(
      (await db.query("select * from public.items where id=$1", [item])).rows,
    ).toHaveLength(0);
  });
  it("exposes public records only to same-island members", async () => {
    await as(B);
    await action({
      type: "item.save",
      id: item,
      revision: 0,
      item: {
        kind: "book",
        title: "공개 책",
        creator: "저자",
        note: "hi",
        tags: [],
        visibility: "island",
      },
    });
    await as(A);
    expect((await state()).items.some((i: any) => i.id === item)).toBe(true);
    await as(C);
    await state();
    expect((await state()).items).toHaveLength(0);
    await rejects(
      () =>
        action({
          type: "comment.add",
          id: crypto.randomUUID(),
          target: item,
          body: "외부 댓글",
        }),
      "댓글",
    );
  });
  it("keeps comment retries idempotent and notifies owner", async () => {
    await as(A);
    const id = crypto.randomUUID();
    await action({
      type: "comment.add",
      id,
      target: item,
      body: "좋은 책이네요",
    });
    await action({
      type: "comment.add",
      id,
      target: item,
      body: "좋은 책이네요",
    });
    await as(B);
    const s = await state();
    expect(s.comments).toHaveLength(1);
    expect(s.notifications).toHaveLength(1);
  });
  it("private transition hides comments and notifications from peers", async () => {
    await as(B);
    await action({
      type: "item.save",
      id: item,
      revision: 1,
      item: {
        kind: "book",
        title: "다시 비밀",
        creator: "저자",
        note: "private",
        tags: [],
        visibility: "private",
      },
    });
    await as(A);
    expect((await state()).comments).toHaveLength(0);
    expect((await db.query("select * from public.comments")).rows).toHaveLength(
      0,
    );
  });
  it("rejects cross-owner changes and stale revisions", async () => {
    await as(B);
    await rejects(
      () =>
        action({ type: "space.save", id: space, revision: 0, placements: [] }),
      "내 공간",
    );
    await as(A);
    await action({
      type: "space.save",
      id: space,
      revision: 0,
      placements: [],
    });
    await rejects(
      () =>
        action({ type: "space.save", id: space, revision: 0, placements: [] }),
      "다른 창",
    );
  });
  it("checks collisions and keeps public/draft separate", async () => {
    await as(A);
    await rejects(
      () =>
        action({
          type: "space.save",
          id: space,
          revision: 1,
          placements: [{ id: "p", asset: "chair", x: 6, z: 11, rotation: 0 }],
        }),
      "출입구",
    );
    await action({ type: "space.publish", id: space, revision: 1 });
    await as(B);
    const s = await state();
    expect(s.spaces.some((s: any) => s.id === space)).toBe(true);
    expect(s.spaces.find((s: any) => s.id === space).draft).toEqual([]);
  });
  it("blocks are bilateral for records, comments and spaces", async () => {
    await as(B);
    await action({ type: "block", id: A, blocked: true });
    expect((await state()).spaces.every((s: any) => s.owner === B)).toBe(true);
    await as(A);
    expect((await state()).profiles.map((p: any) => p.id)).not.toContain(B);
    await as(B);
    await action({ type: "block", id: A, blocked: false });
  });
  it("requires transfer before owner leaves, then removes member spaces", async () => {
    await as(A);
    await rejects(() => action({ type: "island.leave" }), "방장");
    await action({ type: "island.transfer", id: B });
    await action({ type: "island.leave" });
    expect((await state()).island).toBeNull();
    await as(B);
    expect((await state()).members).toHaveLength(1);
    expect((await state()).island.owner).toBe(B);
  });
  it("revoked invitations cannot be accepted", async () => {
    await as(B);
    await action({ type: "invite.revoke" });
    await as(C);
    await rejects(() => action({ type: "invite.accept", token }), "만료");
  });
  it("enforces all eight plots even with another still-valid invite", async () => {
    await as(A);
    await action({ type: "island.create", name: "정원 검사" });
    const first = (
      await db.query<{ isola_invite: string }>("select public.isola_invite()")
    ).rows[0].isola_invite;
    const second = (
      await db.query<{ isola_invite: string }>("select public.isola_invite()")
    ).rows[0].isola_invite;
    const users = Array.from({ length: 8 }, () => crypto.randomUUID());
    await db.exec("reset role");
    for (const id of users)
      await db.query("insert into auth.users(id) values($1)", [id]);
    for (const id of users.slice(0, 7)) {
      await as(id);
      await state();
      await action({ type: "invite.accept", token: first });
    }
    await as(users[7]);
    await state();
    await rejects(
      () => action({ type: "invite.accept", token: second }),
      "가득",
    );
    await as(A);
    const s = await state();
    expect(s.members).toHaveLength(8);
    expect(new Set(s.members.map((m: any) => m.plot)).size).toBe(8);
  });
  it("denies anonymous execution of state and mutation functions", async () => {
    await db.exec("reset role;set role anon");
    await rejects(
      () => db.query("select public.isola_state()"),
      "permission denied",
    );
    await rejects(
      () => db.query("select public.isola_mutate('{}')"),
      "permission denied",
    );
  });
  it("account deletion request immediately denies access", async () => {
    await as(C);
    await action({ type: "account.delete" });
    await rejects(() => state(), "비활성");
    expect((await db.query("select * from public.items")).rows).toHaveLength(0);
  });
});

import { z } from "zod";
export type Kind = "book" | "film" | "quote" | "whisky";
export type Visibility = "private" | "island";
export const categories: Record<
  Kind,
  { label: string; plural: string; color: string; emoji: string }
> = {
  book: {
    label: "책",
    plural: "책장 속 이야기",
    color: "#7d9275",
    emoji: "📚",
  },
  film: {
    label: "영화",
    plural: "오래 남은 장면",
    color: "#bb8d76",
    emoji: "🎞️",
  },
  quote: {
    label: "문장",
    plural: "마음에 밑줄",
    color: "#b6a068",
    emoji: "✍️",
  },
  whisky: {
    label: "위스키",
    plural: "천천히 쌓인 취향",
    color: "#a78055",
    emoji: "🥃",
  },
};
export const avatarSchema = z.object({
  skin: z.enum(["#efc3a4", "#dba57b", "#a97553", "#704e3a"]),
  hair: z.enum(["#514139", "#8c6650", "#d4b77d", "#b7828b"]),
  shirt: z.enum(["#819e87", "#cc9684", "#a0aaca", "#d4ba7e"]),
  style: z.enum(["short", "bob", "bun"]),
  body: z.enum(["small", "round", "tall"]),
});
export type Avatar = z.infer<typeof avatarSchema>;
export const defaultAvatar: Avatar = {
  skin: "#efc3a4",
  hair: "#514139",
  shirt: "#819e87",
  style: "bob",
  body: "round",
};
export interface Profile {
  id: string;
  name: string;
  bio: string;
  avatar: Avatar;
  identity?: string;
}
export interface Item {
  id: string;
  owner: string;
  kind: Kind;
  title: string;
  creator: string;
  note: string;
  tags: string[];
  visibility: Visibility;
  revision: number;
  created: string;
}
export interface Placement {
  id: string;
  asset: string;
  x: number;
  z: number;
  rotation: number;
  itemId?: string;
}
export interface Space {
  id: string;
  owner: string;
  kind: "garden" | "interior";
  visibility: Visibility;
  draft: Placement[];
  published: Placement[];
  revision: number;
  publishedRevision: number;
}
export interface Comment {
  id: string;
  author: string;
  target: string;
  body: string;
  created: string;
  hidden?: boolean;
}
export interface Notice {
  id: string;
  recipient: string;
  actor: string;
  target: string;
  read: boolean;
  created: string;
}
export interface World {
  version: 1;
  me: string;
  island: { id: string; name: string; owner: string } | null;
  profiles: Profile[];
  members: { user: string; plot: number }[];
  items: Item[];
  spaces: Space[];
  comments: Comment[];
  notifications: Notice[];
  blocks: string[];
}
export const itemInput = z.object({
  kind: z.enum(["book", "film", "quote", "whisky"]),
  title: z.string().trim().min(1, "제목을 입력해 주세요.").max(120),
  creator: z.string().max(160),
  note: z.string().max(2000),
  tags: z.array(z.string().trim().min(1).max(20)).max(5),
  visibility: z.enum(["private", "island"]),
});
export const catalog = [
  { id: "chair", name: "동그란 의자", emoji: "🪑", w: 1, h: 1 },
  { id: "table", name: "작은 테이블", emoji: "🪵", w: 2, h: 2 },
  { id: "shelf", name: "나무 책장", emoji: "📚", w: 2, h: 1 },
  { id: "plant", name: "초록 화분", emoji: "🪴", w: 1, h: 1 },
  { id: "lamp", name: "버섯 조명", emoji: "🍄", w: 1, h: 1 },
  { id: "rug", name: "포근한 러그", emoji: "🧶", w: 2, h: 2 },
  { id: "flowers", name: "들꽃 한 다발", emoji: "🌷", w: 1, h: 1 },
  { id: "display", name: "취향 받침대", emoji: "🖼️", w: 1, h: 1 },
] as const;
export function cells(p: Placement) {
  const a = catalog.find((a) => a.id === p.asset);
  if (!a) throw Error("알 수 없는 소품입니다.");
  const w = p.rotation % 2 ? a.h : a.w,
    h = p.rotation % 2 ? a.w : a.h;
  return Array.from({ length: w * h }, (_, i) => [
    p.x + (i % w),
    p.z + Math.floor(i / w),
  ]);
}
export function validateLayout(list: Placement[], size = 12): string | null {
  if (list.length > 60) return "한 공간에 소품은 최대 60개까지 놓을 수 있어요.";
  if (new Set(list.map((p) => p.id)).size !== list.length)
    return "소품 ID가 중복되었어요.";
  const occupied = new Set<string>();
  for (const p of list) {
    if (
      !catalog.some((a) => a.id === p.asset) ||
      ![p.x, p.z, p.rotation].every(Number.isInteger) ||
      p.rotation < 0 ||
      p.rotation > 3
    )
      return "유효하지 않은 배치예요.";
    for (const [x, z] of cells(p)) {
      if (x < 0 || z < 0 || x >= size || z >= size)
        return "공간의 경계를 벗어났어요.";
      if (x >= size / 2 - 1 && x <= size / 2 && z >= size - 2)
        return "출입구는 비워 주세요.";
      const k = `${x},${z}`;
      if (occupied.has(k)) return "다른 소품과 겹쳐요.";
      occupied.add(k);
    }
  }
  // Every unoccupied cell must remain reachable from the entrance.
  const queue = [[size / 2, size - 1]],
    seen = new Set<string>();
  while (queue.length) {
    const [x, z] = queue.shift()!;
    const key = `${x},${z}`;
    if (
      x < 0 ||
      z < 0 ||
      x >= size ||
      z >= size ||
      occupied.has(key) ||
      seen.has(key)
    )
      continue;
    seen.add(key);
    queue.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
  }
  if (seen.size !== size * size - occupied.size)
    return "소품 사이에 막힌 공간이 생겨요. 통로를 열어 주세요.";
  return null;
}
export function pathfind(
  start: [number, number],
  end: [number, number],
  blocked: Set<string>,
  size = 12,
): [number, number][] {
  const key = (p: number[]) => p.join(",");
  const q: [number, number][] = [start],
    prev = new Map<string, [number, number] | null>([[key(start), null]]);
  while (q.length) {
    const p = q.shift()!;
    if (key(p) === key(end)) {
      const route: [number, number][] = [];
      let v: [number, number] | null = p;
      while (v) {
        route.unshift(v);
        v = prev.get(key(v)) ?? null;
      }
      return route;
    }
    for (const n of [
      [p[0] + 1, p[1]],
      [p[0] - 1, p[1]],
      [p[0], p[1] + 1],
      [p[0], p[1] - 1],
    ] as [number, number][]) {
      if (
        n[0] < 0 ||
        n[1] < 0 ||
        n[0] >= size ||
        n[1] >= size ||
        blocked.has(key(n)) ||
        prev.has(key(n))
      )
        continue;
      prev.set(key(n), p);
      q.push(n);
    }
  }
  return [];
}
export const uid = () => crypto.randomUUID();
export function makeSpaces(owner: string): Space[] {
  return (["interior", "garden"] as const).map((kind) => ({
    id: uid(),
    owner,
    kind,
    visibility: "private",
    draft: [],
    published: [],
    revision: 0,
    publishedRevision: 0,
  }));
}
export function demoWorld(): World {
  const profiles: Profile[] = [
    {
      id: "demo-me",
      name: "나",
      bio: "작고 다정한 것들을 모아요.",
      avatar: defaultAvatar,
    },
    {
      id: "demo-noa",
      name: "노아",
      bio: "책과 커피, 그리고 느린 오후.",
      avatar: { ...defaultAvatar, shirt: "#cc9684", style: "short" },
    },
    {
      id: "demo-sol",
      name: "솔",
      bio: "아름다운 장면을 오래 기억하고 싶어요.",
      avatar: { ...defaultAvatar, shirt: "#a0aaca", style: "bun" },
    },
    {
      id: "demo-yu",
      name: "유",
      bio: "계절마다 다른 초록을 좋아해요.",
      avatar: { ...defaultAvatar, shirt: "#d4ba7e" },
    },
  ];
  const now = new Date().toISOString();
  const items: Item[] = [
    {
      id: "demo-book",
      owner: "demo-me",
      kind: "book",
      title: "여름은 오래 그곳에 남아",
      creator: "마쓰이에 마사시",
      note: "창문을 열면 숲의 냄새가 날 것 같은 책. 서두르지 않고, 한 장씩 오래 머물고 싶었다.",
      tags: ["여름", "고요한 시간"],
      visibility: "island",
      revision: 0,
      created: now,
    },
    {
      id: "demo-film",
      owner: "demo-me",
      kind: "film",
      title: "리틀 포레스트",
      creator: "임순례",
      note: "나에게 돌아오는 가장 느리고 다정한 방법. 보고 나면 따뜻한 밥을 짓고 싶어진다.",
      tags: ["쉼", "계절"],
      visibility: "island",
      revision: 0,
      created: now,
    },
    {
      id: "demo-quote",
      owner: "demo-noa",
      kind: "quote",
      title: "작은 것들을 오래 바라보기",
      creator: "노아의 메모",
      note: "오늘은 서두르지 않고, 마음이 가는 곳에 조금 더 머물기로 했다.",
      tags: ["일상"],
      visibility: "island",
      revision: 0,
      created: now,
    },
    {
      id: "demo-whisky",
      owner: "demo-sol",
      kind: "whisky",
      title: "비 오는 날의 작은 기록",
      creator: "향의 기억",
      note: "나무와 사과를 닮은 향. 취향은 어느 날의 풍경도 함께 기억하게 한다.",
      tags: ["기억"],
      visibility: "island",
      revision: 0,
      created: now,
    },
  ];
  const spaces = profiles.flatMap((p) => makeSpaces(p.id));
  spaces.forEach((s) => {
    s.visibility = "island";
    s.published = [
      { id: uid(), asset: "shelf", x: 1, z: 1, rotation: 0 },
      { id: uid(), asset: "plant", x: 9, z: 1, rotation: 0 },
      { id: uid(), asset: "table", x: 4, z: 4, rotation: 0 },
      { id: uid(), asset: "chair", x: 4, z: 7, rotation: 0 },
      { id: uid(), asset: "lamp", x: 8, z: 8, rotation: 0 },
    ];
    const item = items.find((i) => i.owner === s.owner);
    if (item)
      s.published.push({
        id: uid(),
        asset: "display",
        x: 8,
        z: 4,
        rotation: 0,
        itemId: item.id,
      });
    s.draft = structuredClone(s.published);
  });
  return {
    version: 1,
    me: "demo-me",
    island: { id: "demo-island", name: "느린 오후의 섬", owner: "demo-me" },
    profiles,
    members: profiles.map((p, i) => ({ user: p.id, plot: i })),
    items,
    spaces,
    comments: [],
    notifications: [],
    blocks: [],
  };
}
export type Action = { type: string; [key: string]: unknown };
export function reduceDemo(source: World, a: Action): World {
  const s = structuredClone(source),
    me = s.me;
  const str = (v: unknown) => String(v ?? "");
  if (a.type === "profile") {
    const p = s.profiles.find((p) => p.id === me)!;
    p.name = z.string().trim().min(1).max(20).parse(a.name);
    p.bio = z.string().max(160).parse(a.bio);
    p.avatar = avatarSchema.parse(a.avatar);
    p.identity = z
      .string()
      .max(60)
      .parse(a.identity ?? "");
  } else if (a.type === "item.save") {
    const data = itemInput.parse(a.item);
    const existing = s.items.find((i) => i.id === a.id);
    if (existing) {
      if (existing.owner !== me) throw Error("내 기록만 수정할 수 있어요.");
      if (existing.revision !== a.revision)
        throw Error("다른 창에서 바뀌었어요. 새로고침해 주세요.");
      Object.assign(existing, data, { revision: existing.revision + 1 });
    } else {
      s.items.unshift({
        ...data,
        id: str(a.id) || uid(),
        owner: me,
        created: new Date().toISOString(),
        revision: 0,
      });
    }
  } else if (a.type === "item.delete") {
    if (!s.items.some((i) => i.id === a.id && i.owner === me))
      throw Error("내 기록만 삭제할 수 있어요.");
    s.items = s.items.filter((i) => i.id !== a.id);
    s.comments = s.comments.filter((c) => c.target !== a.id);
    s.spaces.forEach((sp) => {
      sp.draft = sp.draft.map((p) =>
        p.itemId === a.id ? { ...p, itemId: undefined } : p,
      );
      sp.published = sp.published.map((p) =>
        p.itemId === a.id ? { ...p, itemId: undefined } : p,
      );
    });
  } else if (
    a.type === "space.save" ||
    a.type === "space.publish" ||
    a.type === "space.visibility"
  ) {
    const sp = s.spaces.find((p) => p.id === a.id && p.owner === me);
    if (!sp) throw Error("내 공간만 수정할 수 있어요.");
    if (a.type === "space.visibility")
      sp.visibility = z.enum(["private", "island"]).parse(a.visibility);
    else {
      if (sp.revision !== a.revision)
        throw Error("다른 창에서 바뀌었어요. 최신 공간을 불러와 주세요.");
      const placements =
        a.type === "space.publish" ? sp.draft : (a.placements as Placement[]);
      const issue = validateLayout(placements, sp.kind === "garden" ? 16 : 12);
      if (issue) throw Error(issue);
      if (a.type === "space.publish") {
        for (const p of placements)
          if (
            p.itemId &&
            !s.items.some(
              (i) =>
                i.id === p.itemId &&
                i.owner === me &&
                i.visibility === "island",
            )
          )
            throw Error("섬에 공개한 내 기록만 전시할 수 있어요.");
        sp.published = structuredClone(placements);
        sp.publishedRevision++;
        sp.visibility = "island";
      } else {
        sp.draft = placements;
        sp.revision++;
      }
    }
  } else if (a.type === "comment.add") {
    const body = z.string().trim().min(1).max(500).parse(a.body);
    const owner =
      s.items.find((i) => i.id === a.target)?.owner ??
      s.spaces.find((i) => i.id === a.target)?.owner;
    if (!owner) throw Error("댓글을 남길 대상을 찾을 수 없어요.");
    const id = str(a.id) || uid();
    if (!s.comments.some((c) => c.id === id)) {
      s.comments.push({
        id,
        author: me,
        target: str(a.target),
        body,
        created: new Date().toISOString(),
      });
      if (owner !== me)
        s.notifications.push({
          id: uid(),
          recipient: owner,
          actor: me,
          target: str(a.target),
          read: false,
          created: new Date().toISOString(),
        });
    }
  } else if (a.type === "comment.delete")
    s.comments = s.comments.filter((c) => !(c.id === a.id && c.author === me));
  else if (a.type === "comment.hide") {
    const c = s.comments.find((c) => c.id === a.id);
    if (
      c &&
      (s.items.some((i) => i.id === c.target && i.owner === me) ||
        s.spaces.some((i) => i.id === c.target && i.owner === me))
    )
      c.hidden = true;
  } else if (a.type === "notice.read")
    s.notifications
      .filter((n) => n.recipient === me)
      .forEach((n) => (n.read = true));
  else if (a.type === "block") {
    const id = str(a.id);
    s.blocks = a.blocked
      ? [...new Set([...s.blocks, id])]
      : s.blocks.filter((b) => b !== id);
  } else if (a.type === "report") {
    if (!str(a.reason).trim()) throw Error("신고 사유를 입력해 주세요.");
    throw Error("샘플 모드에서는 실제 신고가 접수되지 않아요.");
  } else if (a.type === "island.rename") {
    if (s.island?.owner !== me) throw Error("방장만 이름을 바꿀 수 있어요.");
    s.island.name = z.string().trim().min(1).max(30).parse(a.name);
  } else throw Error("이 기능은 실제 서비스 연결 후 사용할 수 있어요.");
  return s;
}

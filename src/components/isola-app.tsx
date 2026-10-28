"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  Compass,
  Download,
  Flower2,
  Home,
  LayoutGrid,
  Leaf,
  List,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  MoreHorizontal,
  Palette,
  Plus,
  RotateCw,
  Search,
  Settings,
  Share2,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  Users,
  VolumeX,
  X,
} from "lucide-react";
import {
  Action,
  Avatar,
  Item,
  Kind,
  Placement,
  Space,
  World,
  catalog,
  categories,
  defaultAvatar,
  uid,
  validateLayout,
} from "@/domain/world";
import { loadWorld, mutate, supabase } from "@/lib/store";
const Scene = dynamic(() => import("./world-scene"), {
  ssr: false,
  loading: () => (
    <div className="scene-loading">
      <Loader2 className="spin" /> 작은 섬을 준비하고 있어요…
    </div>
  ),
});
type View =
  "island" | "archive" | "people" | "notifications" | "settings" | "space";
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current,
      previous = document.activeElement as HTMLElement;
    el?.showModal();
    return () => {
      el?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-btn" aria-label="닫기" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function AvatarDot({
  profile,
  small = false,
}: {
  profile?: { name: string; avatar: Avatar };
  small?: boolean;
}) {
  return (
    <span
      className={`avatar-dot ${small ? "small" : ""}`}
      style={{ background: profile?.avatar.shirt ?? "#b8c5af" }}
    >
      <span
        className="avatar-face"
        style={{
          background: profile?.avatar.skin ?? "#efc3a4",
          borderTopColor: profile?.avatar.hair ?? "#514139",
        }}
      >
        {profile?.name?.slice(0, 1)}
      </span>
    </span>
  );
}
export default function IsolaApp() {
  const [world, setWorld] = useState<World | null>(null),
    [demo, setDemo] = useState(false),
    [boot, setBoot] = useState(true),
    [view, setView] = useState<View>("island"),
    [spaceId, setSpaceId] = useState<string>(),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [menu, setMenu] = useState(false),
    [modal, setModal] = useState<
      "login" | "item" | "profile" | "invite" | "create" | null
    >(null),
    [detail, setDetail] = useState<string>(),
    [editingItem, setEditingItem] = useState<Item>(),
    [listMode, setListMode] = useState(false),
    [filter, setFilter] = useState<Kind | "all">("all"),
    [search, setSearch] = useState(""),
    [archiveScope, setArchiveScope] = useState<"mine" | "island">("mine"),
    [editing, setEditing] = useState(false),
    [draft, setDraft] = useState<Placement[]>([]),
    [selected, setSelected] = useState<string>(),
    [undoStack, setUndoStack] = useState<Placement[][]>([]),
    [redoStack, setRedoStack] = useState<Placement[][]>([]),
    [asset, setAsset] = useState("plant"),
    [quality, setQuality] = useState("normal"),
    [invite, setInvite] = useState(""),
    [pendingToken, setPendingToken] = useState(""),
    [offline, setOffline] = useState(false);
  const me = world?.profiles.find((p) => p.id === world.me),
    space = world?.spaces.find((s) => s.id === spaceId),
    owner = world?.profiles.find((p) => p.id === space?.owner),
    mine = space?.owner === world?.me;
  const tell = (s: string) => setToast(s);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    let active = true;
    const token =
      new URLSearchParams(location.search).get("invite") ??
      sessionStorage.getItem("isola-pending-invite");
    if (token) {
      setPendingToken(token);
      sessionStorage.setItem("isola-pending-invite", token);
      history.replaceState({}, "", location.pathname);
    }
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if (localStorage.getItem("isola-demo-active") === "true") {
      setDemo(true);
      loadWorld(true)
        .then((w) => {
          if (active) {
            setWorld(w);
            setBoot(false);
          }
        })
        .catch(() => {
          if (active) {
            setBoot(false);
            tell(
              "저장 공간을 사용할 수 없어요. 브라우저 설정을 확인해 주세요.",
            );
          }
        });
    } else if (supabase) {
      supabase.auth.getSession().then(async ({ data }) => {
        if (data.session) {
          try {
            const w = await loadWorld(false);
            if (active) setWorld(w);
          } catch (e) {
            tell((e as Error).message);
          }
        }
        if (active) setBoot(false);
      });
    } else {
      if (localStorage.getItem("isola-demo-active") === "true") {
        setDemo(true);
        loadWorld(true)
          .then(setWorld)
          .catch(() => {});
      }
      setBoot(false);
    }
    const onStorage = () => {
      if (active && localStorage.getItem("isola-demo-active") === "true")
        loadWorld(true).then(setWorld);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      active = false;
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  useEffect(() => {
    if (!supabase || demo) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        setTimeout(() => {
          loadWorld(false)
            .then((next) => {
              setWorld(next);
              setModal(null);
            })
            .catch((e) => tell(e.message));
        }, 0);
      }
      if (event === "SIGNED_OUT") {
        setWorld(null);
        setDetail(undefined);
        setDraft([]);
        setEditing(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [demo]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (editing && JSON.stringify(draft) !== JSON.stringify(space?.draft)) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editing, draft, space]);
  useEffect(() => {
    if (!world || demo) return;
    let disposed = false;
    const refresh = async () => {
      if (document.hidden || !navigator.onLine || editing || busy) return;
      try {
        const next = await loadWorld(false);
        if (!disposed) setWorld(next);
      } catch (e) {
        if (!disposed && String((e as Error).message).includes("비활성")) {
          setWorld(null);
          setDetail(undefined);
        }
      }
    };
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, 30000);
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [!!world, demo, editing, busy, view]);
  const act = async (a: Action) => {
    if (!world) return false;
    setBusy(true);
    try {
      setWorld(await mutate(demo, world, a));
      return true;
    } catch (e) {
      tell((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const navigate = (v: View, id?: string) => {
    if (
      editing &&
      JSON.stringify(draft) !== JSON.stringify(space?.draft) &&
      !confirm("저장하지 않은 꾸미기를 버리고 이동할까요?")
    )
      return;
    setEditing(false);
    setView(v);
    setSpaceId(id);
    setMenu(false);
    setDetail(undefined);
  };
  const startDemo = async () => {
    try {
      setDemo(true);
      localStorage.setItem("isola-demo-active", "true");
      setWorld(await loadWorld(true));
      setView("island");
    } catch {
      tell("브라우저 저장 공간을 사용할 수 없어요. 저장 설정을 확인해 주세요.");
    }
  };
  const visit = (id: string) => {
    const sp = world?.spaces.find((s) => s.id === id);
    if (!sp || (sp.owner !== world?.me && sp.visibility !== "island")) {
      tell("아직 공개하지 않은 공간이에요.");
      return;
    }
    navigate("space", id);
  };
  const changeDraft = (next: Placement[]) => {
    setUndoStack((h) => [...h.slice(-19), structuredClone(draft)]);
    setRedoStack([]);
    setDraft(next);
  };
  const add = (x: number, z: number) => {
    const next = [...draft, { id: uid(), asset, x, z, rotation: 0 }];
    const err = validateLayout(next, space?.kind === "garden" ? 16 : 12);
    if (err) tell(err);
    else {
      changeDraft(next);
      setSelected(next.at(-1)?.id);
    }
  };
  const modify = (patch: Partial<Placement>) => {
    const next = draft.map((p) => (p.id === selected ? { ...p, ...patch } : p));
    const err = validateLayout(next, space?.kind === "garden" ? 16 : 12);
    if (err) tell(err);
    else changeDraft(next);
  };
  const signOut = async () => {
    if (supabase && !demo) await supabase.auth.signOut();
    localStorage.removeItem("isola-demo-active");
    setWorld(null);
    setDemo(false);
    setDetail(undefined);
    setView("island");
    setEditing(false);
  };
  const visibleItems =
    world?.items.filter(
      (i) =>
        !world.blocks.includes(i.owner) &&
        (i.owner === world.me || i.visibility === "island"),
    ) ?? [];
  const openNew = () => {
    setEditingItem(undefined);
    setModal("item");
  };
  if (boot)
    return (
      <main className="boot">
        <Leaf />
        <h1>ISOLA</h1>
        <p>섬으로 가는 중이에요…</p>
      </main>
    );
  if (!world)
    return (
      <main className="landing">
        <nav className="landing-nav">
          <a className="wordmark" href="/">
            ISOLA<span>이솔라</span>
          </a>
          <button className="btn subtle" onClick={() => setModal("login")}>
            로그인 <ArrowRight size={16} />
          </button>
        </nav>
        <div className="landing-content">
          <p className="eyebrow">
            <Leaf size={16} /> A LITTLE WORLD, ALL YOURS
          </p>
          <h1>
            좋아하는 것들로
            <br />
            채운, 우리의 섬.
          </h1>
          <p className="landing-copy">
            바다 한가운데 작은 집 하나.
            <br />
            나다운 모습으로 머물고, 친구의 취향을 만나세요.
          </p>
          <div className="landing-actions">
            <button className="btn primary" onClick={() => setModal("login")}>
              나의 섬 시작하기 <ArrowRight size={17} />
            </button>
            <button className="btn outline" onClick={startDemo}>
              샘플 섬 둘러보기
            </button>
          </div>
          <p className="micro">
            초대받은 친구들과 함께 · 1명부터 8명까지 · 웹에서 바로
          </p>
          {pendingToken && (
            <div className="notice">
              친구가 섬에 초대했어요. 로그인 후 초대를 수락할 수 있어요.
            </div>
          )}
        </div>
        <div className="landing-art" aria-hidden="true">
          <div className="sun-disc" />
          <div className="cloud cloud-one" />
          <div className="cloud cloud-two" />
          <div className="illustration-island">
            <div className="tiny-house">
              <div className="roof" />
              <div className="door" />
              <div className="window" />
            </div>
            <span className="tree tree-one">♣</span>
            <span className="tree tree-two">♣</span>
            <span className="tree tree-three">♣</span>
            <span className="flowers">✿ &nbsp; ✿ &nbsp; ✿</span>
          </div>
          <div className="sea-ring ring-one" />
          <div className="sea-ring ring-two" />
          <span className="art-caption">당신만의 작은 낙원, ISOLA</span>
        </div>
        <footer className="landing-footer">
          <span>작고 다정한 세계를 만드는 중입니다.</span>
          <span>Make yourself at home.</span>
        </footer>
        {modal === "login" && (
          <Login
            onClose={() => setModal(null)}
            onDone={async () => {
              setDemo(false);
              localStorage.removeItem("isola-demo-active");
              try {
                setWorld(await loadWorld(false));
                setModal(null);
              } catch (e) {
                tell((e as Error).message);
              }
            }}
          />
        )}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </main>
    );
  const selectedPlacement = draft.find((p) => p.id === selected);
  const currentItem = visibleItems.find((i) => i.id === detail);
  const notifications = world.notifications.filter(
    (n) => n.recipient === world.me,
  );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "expanded" : ""}`}>
        <a
          href="/"
          className="wordmark"
          onClick={(e) => {
            e.preventDefault();
            navigate("island");
          }}
        >
          ISOLA<span>우리의 작은 낙원</span>
        </a>
        <div className="island-switch">
          <span className="mini-island">🏝️</span>
          <div>
            <strong>{world.island?.name ?? "새로운 섬"}</strong>
            <span>초대받은 우리만의 공간</span>
          </div>
        </div>
        <p className="nav-label">MY LITTLE WORLD</p>
        <nav className="main-nav" aria-label="주요 메뉴">
          {(
            [
              { key: "island", icon: Compass, label: "우리의 섬" },
              { key: "space", icon: Home, label: "나의 공간" },
              { key: "archive", icon: BookOpen, label: "취향 서랍" },
              { key: "people", icon: Users, label: "함께 사는 친구들" },
              { key: "notifications", icon: Bell, label: "도착한 마음" },
            ] as const
          ).map((n) => (
            <button
              key={n.key}
              className={view === n.key ? "active" : ""}
              onClick={() => {
                if (n.key === "space") {
                  const s = world.spaces.find(
                    (s) => s.owner === world.me && s.kind === "interior",
                  );
                  if (s) navigate("space", s.id);
                  else setModal("create");
                } else navigate(n.key);
              }}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.key === "notifications" &&
                notifications.some((n) => !n.read) && (
                  <i className="notification-dot" />
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Flower2 size={25} />
          <p>
            잠깐 쉬어가도 괜찮아.
            <br />
            여기는 우리의 섬이니까.
          </p>
          <span>조금 느려도 좋은 곳</span>
        </div>
        <div className="sidebar-bottom">
          <button
            className="settings-link"
            onClick={() => navigate("settings")}
          >
            <Settings size={17} />
            설정
          </button>
          <button
            className="profile-button"
            onClick={() => setModal("profile")}
          >
            <AvatarDot profile={me} />
            <div>
              <strong>{me?.name ?? "새로운 이웃"}</strong>
              <span>나답게, 자유롭게</span>
            </div>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            aria-label="메뉴 열기"
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            <span>나의 작은 세계</span>
            <ChevronRight size={14} />
            <strong>
              {
                {
                  island: "우리의 섬",
                  space: mine ? "나의 공간" : `${owner?.name ?? "친구"}의 공간`,
                  archive: "취향 서랍",
                  people: "함께 사는 친구들",
                  notifications: "도착한 마음",
                  settings: "설정",
                }[view]
              }
            </strong>
          </div>
          <div className="topbar-actions">
            <span className="private-chip">
              <LockKeyhole size={13} /> 초대 전용
            </span>
            <button
              className="icon-btn"
              aria-label="알림"
              onClick={() => navigate("notifications")}
            >
              <Bell size={19} />
            </button>
            <button
              className="avatar-button"
              aria-label="내 프로필"
              onClick={() => setModal("profile")}
            >
              <AvatarDot profile={me} small />
            </button>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <span>
              <Sparkles size={13} /> 샘플 섬 · 변경사항은 이 브라우저에만
              저장돼요
            </span>
            <button onClick={signOut}>
              실제 계정으로 시작하기 <ArrowRight size={13} />
            </button>
          </div>
        )}
        {offline && (
          <div className="notice">
            인터넷 연결이 끊겼어요. 연결 후 다시 저장해 주세요.
          </div>
        )}
        <main className="workspace">
          {pendingToken && !demo && (
            <div className="notice">
              섬 초대가 도착했어요.
              <button
                className="btn small primary"
                disabled={busy}
                onClick={async () => {
                  if (
                    await act({ type: "invite.accept", token: pendingToken })
                  ) {
                    setPendingToken("");
                    sessionStorage.removeItem("isola-pending-invite");
                    tell("섬에 오신 걸 환영해요!");
                  }
                }}
              >
                초대 수락하기
              </button>
              <button
                className="btn small subtle"
                onClick={() => {
                  setPendingToken("");
                  sessionStorage.removeItem("isola-pending-invite");
                }}
              >
                나중에
              </button>
            </div>
          )}
          {!world.island ? (
            <div className="empty welcome">
              <Flower2 size={48} />
              <p className="eyebrow">YOUR STORY STARTS HERE</p>
              <h1>나만의 작은 세계를 시작해요.</h1>
              <p>혼자 시작해도 좋아요. 친구들은 나중에 초대할 수 있어요.</p>
              <button
                className="btn primary"
                onClick={() => setModal("create")}
              >
                첫 번째 섬 만들기 <Plus size={16} />
              </button>
            </div>
          ) : (
            <>
              {(view === "island" || view === "space") && (
                <>
                  <div className="page-heading">
                    <div>
                      <p className="eyebrow">
                        {view === "island"
                          ? "SOMEWHERE WE BELONG"
                          : editing
                            ? "MAKE IT YOURS"
                            : "A LITTLE PIECE OF YOU"}
                      </p>
                      <h1>
                        {view === "island"
                          ? "오늘도, 우리의 섬에서."
                          : editing
                            ? "마음 가는 대로 꾸며요."
                            : `${mine ? "나" : (owner?.name ?? "친구")}의 ${space?.kind === "garden" ? "작은 정원" : "포근한 집"}`}
                        <span className="heading-flower">✳</span>
                      </h1>
                      <p>
                        {view === "island"
                          ? "좋아하는 것을 모으고, 서로의 세계를 천천히 알아가는 곳."
                          : editing
                            ? "소품을 고르고 바닥을 눌러 놓아 보세요."
                            : mine
                              ? "나를 닮은 것들로 채워지는 작은 공간."
                              : "잠시 머물며 친구의 취향을 만나 보세요."}
                      </p>
                    </div>
                    <div className="heading-actions">
                      {view === "island" ? (
                        <button
                          className="btn outline"
                          onClick={() => setModal("invite")}
                        >
                          <Plus size={16} /> 친구 초대하기
                        </button>
                      ) : (
                        <>
                          <button
                            className="btn subtle"
                            onClick={() => navigate("island")}
                          >
                            <ArrowLeft size={15} />
                            섬으로
                          </button>
                          {mine && (
                            <button
                              className="btn primary"
                              onClick={() => {
                                if (editing) {
                                  if (
                                    JSON.stringify(draft) !==
                                      JSON.stringify(space?.draft) &&
                                    !confirm("저장하지 않은 변경을 버릴까요?")
                                  )
                                    return;
                                  setEditing(false);
                                } else {
                                  setDraft(structuredClone(space!.draft));
                                  setEditing(true);
                                  setSelected(undefined);
                                }
                              }}
                            >
                              <Palette size={16} />
                              {editing ? "편집 끝내기" : "공간 꾸미기"}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    className={`world-layout ${editing ? "with-editor" : ""}`}
                  >
                    <section className="world-card" aria-label="3D 공간">
                      <div className="world-overlay top">
                        <span className="weather">
                          <Sun size={17} />
                          <strong>느린 오후</strong>
                          <span>마음이 쉬어가는 시간</span>
                        </span>
                        <div className="segmented">
                          <button
                            className={!listMode ? "selected" : ""}
                            aria-label="3D 보기"
                            onClick={() => setListMode(false)}
                          >
                            <LayoutGrid size={16} />
                          </button>
                          <button
                            className={listMode ? "selected" : ""}
                            aria-label="목록 보기"
                            onClick={() => setListMode(true)}
                          >
                            <List size={17} />
                          </button>
                        </div>
                      </div>
                      {listMode ? (
                        <div className="world-list">
                          <h2>
                            {view === "island"
                              ? "섬의 작은 집들"
                              : "공간에 놓인 것들"}
                          </h2>
                          {view === "island"
                            ? world.members
                                .filter((m) => !world.blocks.includes(m.user))
                                .map((m) => (
                                  <button
                                    key={m.user}
                                    className="list-row"
                                    onClick={() => {
                                      const s = world.spaces.find(
                                        (s) =>
                                          s.owner === m.user &&
                                          s.kind === "interior",
                                      );
                                      if (s) visit(s.id);
                                    }}
                                  >
                                    <AvatarDot
                                      profile={world.profiles.find(
                                        (p) => p.id === m.user,
                                      )}
                                    />
                                    <span>
                                      {
                                        world.profiles.find(
                                          (p) => p.id === m.user,
                                        )?.name
                                      }
                                      의 집
                                    </span>
                                    <ArrowRight size={16} />
                                  </button>
                                ))
                            : (editing ? draft : (space?.published ?? [])).map(
                                (p) => (
                                  <button
                                    className="list-row"
                                    key={p.id}
                                    onClick={() => {
                                      if (editing) setSelected(p.id);
                                      else if (p.itemId) setDetail(p.itemId);
                                    }}
                                  >
                                    <span>
                                      {
                                        catalog.find((a) => a.id === p.asset)
                                          ?.emoji
                                      }
                                    </span>
                                    <span>
                                      {
                                        catalog.find((a) => a.id === p.asset)
                                          ?.name
                                      }
                                      {p.itemId
                                        ? " · " +
                                          (visibleItems.find(
                                            (i) => i.id === p.itemId,
                                          )?.title ?? "비공개 기록")
                                        : ""}
                                    </span>
                                    <small>
                                      {p.x}, {p.z}
                                    </small>
                                  </button>
                                ),
                              )}
                          {view === "space" &&
                            !(editing ? draft : (space?.published ?? []))
                              .length && (
                              <p>
                                아직 소품이 없어요. 첫 번째 취향을 놓아 보세요.
                              </p>
                            )}
                        </div>
                      ) : (
                        <div className="canvas-wrap">
                          <Scene
                            key={spaceId ?? "island"}
                            world={world}
                            spaceId={view === "space" ? spaceId : undefined}
                            placements={
                              editing
                                ? draft
                                : space?.published.filter(
                                    (p) =>
                                      !p.itemId ||
                                      visibleItems.some(
                                        (i) => i.id === p.itemId,
                                      ),
                                  )
                            }
                            onVisit={visit}
                            onSelect={(id) => {
                              if (editing) setSelected(id);
                              else {
                                const p = space?.published.find(
                                  (p) => p.id === id,
                                );
                                if (p?.itemId) setDetail(p.itemId);
                              }
                            }}
                            onCell={add}
                            editing={editing}
                            quality={quality}
                            onError={() => {
                              setListMode(true);
                              tell("3D 대신 목록으로 편하게 둘러볼 수 있어요.");
                            }}
                          />
                        </div>
                      )}
                      <div className="world-overlay bottom">
                        <span className="scene-hint">
                          <span className="pulse-dot" />
                          {editing
                            ? "바닥을 눌러 소품 놓기"
                            : listMode
                              ? "목록에서 공간과 취향을 만나세요"
                              : "바닥을 눌러 산책 · 집을 눌러 방문"}
                        </span>
                        <button
                          className="sound-button"
                          aria-label="배경음 없음"
                          title="지금은 고요한 섬이에요"
                          onClick={() =>
                            tell("지금은 배경음 없이 고요하게 머무는 섬이에요.")
                          }
                        >
                          <VolumeX size={17} />
                        </button>
                      </div>
                    </section>
                    {editing && (
                      <aside className="editor-panel">
                        <h3>
                          <Palette size={17} /> 작은 공간 꾸미기
                        </h3>
                        <p className="micro">
                          {draft.length}/60개 · 저장 후 공개할 수 있어요
                        </p>
                        <div className="button-row">
                          <button
                            className="btn outline small"
                            disabled={!undoStack.length}
                            onClick={() => {
                              setRedoStack((h) => [
                                ...h,
                                structuredClone(draft),
                              ]);
                              setDraft(undoStack.at(-1)!);
                              setUndoStack((h) => h.slice(0, -1));
                              setSelected(undefined);
                            }}
                          >
                            되돌리기
                          </button>
                          <button
                            className="btn outline small"
                            disabled={!redoStack.length}
                            onClick={() => {
                              setUndoStack((h) => [
                                ...h,
                                structuredClone(draft),
                              ]);
                              setDraft(redoStack.at(-1)!);
                              setRedoStack((h) => h.slice(0, -1));
                              setSelected(undefined);
                            }}
                          >
                            다시 실행
                          </button>
                        </div>
                        <div className="catalog-grid">
                          {catalog.map((a) => (
                            <button
                              key={a.id}
                              className={asset === a.id ? "chosen" : ""}
                              onClick={() => {
                                setAsset(a.id);
                                setSelected(undefined);
                              }}
                            >
                              <span>{a.emoji}</span>
                              {a.name}
                            </button>
                          ))}
                        </div>
                        <form
                          className="coordinates"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            add(Number(f.get("x")), Number(f.get("z")));
                          }}
                        >
                          <label>
                            X
                            <input
                              name="x"
                              aria-label="배치 X 좌표"
                              type="number"
                              min="0"
                              max={space?.kind === "garden" ? 15 : 11}
                              defaultValue="2"
                              required
                            />
                          </label>
                          <label>
                            Z
                            <input
                              name="z"
                              aria-label="배치 Z 좌표"
                              type="number"
                              min="0"
                              max={space?.kind === "garden" ? 15 : 11}
                              defaultValue="2"
                              required
                            />
                          </label>
                          <button className="btn outline small" type="submit">
                            놓기
                          </button>
                        </form>
                        {selectedPlacement && (
                          <div className="selection">
                            <strong>
                              {
                                catalog.find(
                                  (a) => a.id === selectedPlacement.asset,
                                )?.name
                              }
                            </strong>
                            <div className="button-row">
                              <button
                                className="btn outline small"
                                onClick={() =>
                                  modify({
                                    rotation:
                                      (selectedPlacement.rotation + 1) % 4,
                                  })
                                }
                              >
                                <RotateCw size={14} />
                                회전
                              </button>
                              <button
                                className="btn outline small"
                                onClick={() => {
                                  setDraft(
                                    draft.filter((p) => p.id !== selected),
                                  );
                                  setSelected(undefined);
                                }}
                              >
                                <Trash2 size={14} />
                                빼기
                              </button>
                            </div>
                            <div className="coordinates">
                              <label>
                                X
                                <input
                                  type="number"
                                  aria-label="선택 소품 X 좌표"
                                  value={selectedPlacement.x}
                                  onChange={(e) =>
                                    modify({ x: Number(e.target.value) })
                                  }
                                />
                              </label>
                              <label>
                                Z
                                <input
                                  type="number"
                                  aria-label="선택 소품 Z 좌표"
                                  value={selectedPlacement.z}
                                  onChange={(e) =>
                                    modify({ z: Number(e.target.value) })
                                  }
                                />
                              </label>
                            </div>
                            {selectedPlacement.asset === "display" && (
                              <label>
                                전시할 기록
                                <select
                                  value={selectedPlacement.itemId ?? ""}
                                  onChange={(e) =>
                                    modify({
                                      itemId: e.target.value || undefined,
                                    })
                                  }
                                >
                                  <option value="">기록 선택</option>
                                  {world.items
                                    .filter(
                                      (i) =>
                                        i.owner === world.me &&
                                        i.visibility === "island",
                                    )
                                    .map((i) => (
                                      <option key={i.id} value={i.id}>
                                        {i.title}
                                      </option>
                                    ))}
                                </select>
                                <span className="micro">
                                  섬에 공개한 내 기록만 연결할 수 있어요.
                                </span>
                              </label>
                            )}
                          </div>
                        )}
                        <button
                          className="btn outline full"
                          disabled={busy}
                          onClick={async () => {
                            if (
                              await act({
                                type: "space.save",
                                id: spaceId,
                                revision: space?.revision,
                                placements: draft,
                              })
                            )
                              tell("초안을 저장했어요.");
                          }}
                        >
                          초안 저장
                        </button>
                        <button
                          className="btn primary full"
                          disabled={
                            busy ||
                            JSON.stringify(draft) !==
                              JSON.stringify(space?.draft)
                          }
                          onClick={async () => {
                            if (
                              await act({
                                type: "space.publish",
                                id: spaceId,
                                revision: space?.revision,
                              })
                            ) {
                              setEditing(false);
                              tell("친구들에게 공간을 공개했어요.");
                            }
                          }}
                        >
                          <Check size={16} />섬 친구들에게 공개
                        </button>
                      </aside>
                    )}
                  </div>
                  {view === "island" ? (
                    <>
                      <div className="island-footer">
                        <div className="resident-stack">
                          {world.profiles
                            .filter((p) => !world.blocks.includes(p.id))
                            .slice(0, 4)
                            .map((p) => (
                              <AvatarDot key={p.id} profile={p} small />
                            ))}
                        </div>
                        <span>
                          <strong>{world.members.length}명</strong>이 함께
                          가꾸는 작은 낙원
                        </span>
                        <button onClick={() => navigate("people")}>
                          우리 이웃들 <ArrowRight size={14} />
                        </button>
                        <span className="quiet-note">
                          <Leaf size={14} /> 각자의 속도로 머물러요
                        </span>
                      </div>
                      <div className="section-heading">
                        <div>
                          <p className="eyebrow">LITTLE THINGS WE LOVE</p>
                          <h2>
                            섬에 놓인 취향들{" "}
                            <span>
                              {
                                visibleItems.filter(
                                  (i) => i.visibility === "island",
                                ).length
                              }
                            </span>
                          </h2>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => {
                            setArchiveScope("island");
                            navigate("archive");
                          }}
                        >
                          모두 둘러보기 <ArrowRight size={15} />
                        </button>
                      </div>
                      <div className="item-grid home-grid">
                        {visibleItems
                          .filter((i) => i.visibility === "island")
                          .slice(0, 4)
                          .map((i) => (
                            <ItemCard
                              key={i.id}
                              item={i}
                              profile={world.profiles.find(
                                (p) => p.id === i.owner,
                              )}
                              onClick={() => setDetail(i.id)}
                            />
                          ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-toolbar">
                        <div className="button-row">
                          {(["interior", "garden"] as const).map((kind) => (
                            <button
                              key={kind}
                              className={`btn small ${space?.kind === kind ? "primary" : "outline"}`}
                              onClick={() => {
                                const s = world.spaces.find(
                                  (s) =>
                                    s.owner === space?.owner && s.kind === kind,
                                );
                                if (s) visit(s.id);
                              }}
                            >
                              {kind === "interior" ? (
                                <Home size={15} />
                              ) : (
                                <Flower2 size={15} />
                              )}{" "}
                              {kind === "interior" ? "집 안" : "정원"}
                            </button>
                          ))}
                        </div>
                        {mine && (
                          <label className="inline-label">
                            공개 범위
                            <select
                              aria-label="공간 공개 범위"
                              value={space?.visibility}
                              onChange={(e) =>
                                act({
                                  type: "space.visibility",
                                  id: spaceId,
                                  visibility: e.target.value,
                                })
                              }
                            >
                              <option value="private">나만 보기</option>
                              <option value="island">섬 친구들</option>
                            </select>
                          </label>
                        )}
                      </div>
                      {space && (
                        <Comments
                          target={space.id}
                          world={world}
                          act={act}
                          title="이 공간에 남긴 마음"
                        />
                      )}
                    </>
                  )}
                </>
              )}
              {view === "archive" && (
                <>
                  <div className="page-heading">
                    <div>
                      <p className="eyebrow">A COLLECTION OF YOU</p>
                      <h1>
                        취향 서랍<span className="heading-flower">✳</span>
                      </h1>
                      <p>좋아서 간직한 것들. 하나씩 꺼내어 놓아요.</p>
                    </div>
                    <button className="btn primary" onClick={openNew}>
                      <Plus size={17} />
                      취향 기록하기
                    </button>
                  </div>
                  <div className="archive-toolbar">
                    <div className="tabs">
                      <button
                        className={archiveScope === "mine" ? "active" : ""}
                        onClick={() => setArchiveScope("mine")}
                      >
                        나의 취향
                      </button>
                      <button
                        className={archiveScope === "island" ? "active" : ""}
                        onClick={() => setArchiveScope("island")}
                      >
                        섬의 취향
                      </button>
                    </div>
                    <label className="search-box">
                      <Search size={17} />
                      <input
                        aria-label="취향 검색"
                        placeholder="제목, 감상, 태그로 찾기"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="filter-row">
                    {(["all", "book", "film", "quote", "whisky"] as const).map(
                      (k) => (
                        <button
                          key={k}
                          className={filter === k ? "active" : ""}
                          onClick={() => setFilter(k)}
                        >
                          {k === "all"
                            ? "모두"
                            : categories[k].emoji + " " + categories[k].label}
                        </button>
                      ),
                    )}
                  </div>
                  <div className="item-grid">
                    {visibleItems
                      .filter(
                        (i) =>
                          (archiveScope === "mine"
                            ? i.owner === world.me
                            : i.visibility === "island") &&
                          (filter === "all" || i.kind === filter) &&
                          `${i.title} ${i.creator} ${i.note} ${i.tags.join(" ")}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                      )
                      .map((i) => (
                        <ItemCard
                          key={i.id}
                          item={i}
                          profile={world.profiles.find((p) => p.id === i.owner)}
                          onClick={() => setDetail(i.id)}
                        />
                      ))}
                  </div>
                  {!visibleItems.some(
                    (i) =>
                      (archiveScope === "mine"
                        ? i.owner === world.me
                        : i.visibility === "island") &&
                      (filter === "all" || i.kind === filter) &&
                      `${i.title} ${i.creator} ${i.note} ${i.tags.join(" ")}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  ) && (
                    <div className="empty">
                      <BookOpen size={34} />
                      <h2>아직 비어 있는 서랍이에요.</h2>
                      <p>좋아하는 것 하나부터 모아 볼까요?</p>
                      <button className="btn outline" onClick={openNew}>
                        첫 취향 기록하기
                      </button>
                    </div>
                  )}
                </>
              )}
              {view === "people" && (
                <>
                  <div className="page-heading">
                    <div>
                      <p className="eyebrow">OUR LITTLE NEIGHBORHOOD</p>
                      <h1>함께 사는 친구들</h1>
                      <p>
                        서로 다른 취향이 모여 하나의 섬이 돼요.{" "}
                        {world.members.length}/8명
                      </p>
                    </div>
                    <button
                      className="btn outline"
                      onClick={() => setModal("invite")}
                    >
                      <Plus size={16} />
                      친구 초대하기
                    </button>
                  </div>
                  <div className="people-grid">
                    {world.members.map((m) => {
                      const p = world.profiles.find((p) => p.id === m.user);
                      const blocked = world.blocks.includes(m.user);
                      return (
                        <article className="person-card" key={m.user}>
                          <AvatarDot profile={blocked ? undefined : p} />
                          <h2>
                            {blocked ? "표시 제한된 멤버" : (p?.name ?? "이웃")}{" "}
                            {m.user === world.me && <small>나</small>}
                          </h2>
                          <p>
                            {blocked
                              ? "차단한 이웃이에요."
                              : p?.bio || "아직 소개를 적지 않았어요."}
                          </p>
                          {!blocked && p?.identity && (
                            <span className="tag">{p.identity}</span>
                          )}
                          <div className="button-row">
                            {!blocked && (
                              <button
                                className="btn outline small"
                                onClick={() => {
                                  const s = world.spaces.find(
                                    (s) =>
                                      s.owner === m.user &&
                                      s.kind === "interior",
                                  );
                                  if (s) visit(s.id);
                                }}
                              >
                                집에 놀러가기 <ArrowRight size={14} />
                              </button>
                            )}
                            {m.user !== world.me && (
                              <button
                                className="text-button"
                                onClick={() => {
                                  if (
                                    confirm(
                                      blocked
                                        ? "차단을 해제할까요?"
                                        : "서로의 공간과 기록을 볼 수 없게 돼요. 차단할까요?",
                                    )
                                  )
                                    act({
                                      type: "block",
                                      id: m.user,
                                      blocked: !blocked,
                                    });
                                }}
                              >
                                {blocked ? "차단 해제" : "차단"}
                              </button>
                            )}
                          </div>
                          {world.island?.owner === world.me &&
                            m.user !== world.me && (
                              <details>
                                <summary>섬 관리</summary>
                                <div className="button-row">
                                  <button
                                    className="text-button"
                                    onClick={() => {
                                      if (
                                        confirm("이 친구에게 방장을 넘길까요?")
                                      )
                                        act({
                                          type: "island.transfer",
                                          id: m.user,
                                        });
                                    }}
                                  >
                                    방장 이전
                                  </button>
                                  <button
                                    className="text-button danger"
                                    onClick={() => {
                                      if (
                                        confirm(
                                          "이 친구를 섬에서 내보낼까요? 개인 공간이 제거돼요.",
                                        )
                                      )
                                        act({
                                          type: "island.remove",
                                          id: m.user,
                                        });
                                    }}
                                  >
                                    내보내기
                                  </button>
                                </div>
                              </details>
                            )}
                        </article>
                      );
                    })}
                    <button
                      className="person-card invite-card"
                      onClick={() => setModal("invite")}
                    >
                      <Plus size={30} />
                      <h2>비어 있는 작은 집</h2>
                      <p>친구를 초대해 함께 채워요.</p>
                    </button>
                  </div>
                </>
              )}
              {view === "notifications" && (
                <>
                  <div className="page-heading">
                    <div>
                      <p className="eyebrow">A NOTE FOR YOU</p>
                      <h1>도착한 마음</h1>
                      <p>친구가 남겨두고 간 작은 이야기.</p>
                    </div>
                    <button
                      className="btn outline"
                      onClick={() => act({ type: "notice.read" })}
                    >
                      모두 읽음
                    </button>
                  </div>
                  {notifications.length ? (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        className="notification-row"
                        onClick={() => {
                          const i = visibleItems.find((i) => i.id === n.target);
                          if (i) setDetail(i.id);
                          else if (world.spaces.some((s) => s.id === n.target))
                            visit(n.target);
                          act({ type: "notice.read" });
                        }}
                      >
                        <Mail />
                        <span>
                          <strong>
                            {world.profiles.find((p) => p.id === n.actor)
                              ?.name ?? "친구"}
                          </strong>
                          님이 마음을 남겼어요.
                          <small>
                            {new Date(n.created).toLocaleDateString("ko-KR")}
                          </small>
                        </span>
                        {!n.read && <i className="notification-dot" />}
                        <ChevronRight size={17} />
                      </button>
                    ))
                  ) : (
                    <div className="empty">
                      <Mail size={42} />
                      <h2>아직 도착한 마음이 없어요.</h2>
                      <p>친구의 공간에 먼저 작은 인사를 남겨 볼까요?</p>
                      <button
                        className="btn outline"
                        onClick={() => navigate("people")}
                      >
                        친구들 만나기
                      </button>
                    </div>
                  )}
                </>
              )}
              {view === "settings" && (
                <>
                  <div className="page-heading">
                    <div>
                      <p className="eyebrow">FEEL AT HOME</p>
                      <h1>편안하게 머무는 방법</h1>
                      <p>나에게 맞는 모습과 속도를 찾아요.</p>
                    </div>
                  </div>
                  <div className="settings-grid">
                    <section className="settings-card">
                      <h2>나의 모습</h2>
                      <p>어떤 모습이든 좋아요. 성별에 따른 제한은 없어요.</p>
                      <button
                        className="btn outline"
                        onClick={() => setModal("profile")}
                      >
                        <Palette size={16} />
                        프로필과 아바타 바꾸기
                      </button>
                    </section>
                    <section className="settings-card">
                      <h2>화면과 접근성</h2>
                      <label>
                        3D 품질
                        <select
                          value={quality}
                          onChange={(e) => setQuality(e.target.value)}
                        >
                          <option value="normal">기본</option>
                          <option value="low">가볍게 (그림자 줄이기)</option>
                        </select>
                      </label>
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={listMode}
                          onChange={(e) => setListMode(e.target.checked)}
                        />{" "}
                        3D 대신 목록으로 둘러보기
                      </label>
                      <p className="micro">
                        기기의 모션 감소 설정을 따릅니다. 배경음은 꺼져 있어요.
                      </p>
                    </section>
                    <section className="settings-card">
                      <h2>섬 설정</h2>
                      {world.island?.owner === world.me ? (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            if (
                              await act({
                                type: "island.rename",
                                name: f.get("name"),
                              })
                            )
                              tell("섬 이름을 바꿨어요.");
                          }}
                        >
                          <label>
                            섬 이름
                            <input
                              name="name"
                              defaultValue={world.island.name}
                              required
                              maxLength={30}
                            />
                          </label>
                          <button className="btn outline small">
                            이름 저장
                          </button>
                        </form>
                      ) : (
                        <p>섬 관리 권한은 방장에게 있어요.</p>
                      )}
                      <button
                        className="text-button danger"
                        onClick={() => {
                          if (
                            confirm(
                              "섬을 떠나면 내 공간이 제거되고 기록이 비공개로 바뀌어요. 계속할까요?",
                            )
                          )
                            act({ type: "island.leave" });
                        }}
                      >
                        섬 떠나기
                      </button>
                    </section>
                    <section className="settings-card">
                      <h2>내 데이터</h2>
                      <p>내 취향과 공간 기록을 파일로 보관할 수 있어요.</p>
                      <button
                        className="btn outline"
                        onClick={() => {
                          const mine = {
                            profile: me,
                            items: world.items.filter(
                              (i) => i.owner === world.me,
                            ),
                            spaces: world.spaces.filter(
                              (s) => s.owner === world.me,
                            ),
                            comments: world.comments.filter(
                              (c) => c.author === world.me,
                            ),
                          };
                          const u = URL.createObjectURL(
                            new Blob([JSON.stringify(mine, null, 2)], {
                              type: "application/json",
                            }),
                          );
                          const a = document.createElement("a");
                          a.href = u;
                          a.download = "isola-my-world.json";
                          a.click();
                          URL.revokeObjectURL(u);
                        }}
                      >
                        <Download size={16} />내 기록 다운로드
                      </button>
                      <div className="button-row">
                        <button className="text-button" onClick={signOut}>
                          <LogOut size={15} />
                          로그아웃
                        </button>
                        <button
                          className="text-button danger"
                          onClick={async () => {
                            if (
                              confirm(
                                "계정 삭제를 요청할까요? 접근 권한이 회수되고 운영자의 삭제 처리를 기다립니다.",
                              )
                            ) {
                              if (await act({ type: "account.delete" }))
                                await signOut();
                            }
                          }}
                        >
                          계정 삭제 요청
                        </button>
                      </div>
                    </section>
                  </div>
                </>
              )}
            </>
          )}
          <footer className="workspace-footer">
            <span>
              ISOLA <span>·</span> 작고 다정한 우리의 세계
            </span>
            <span>Take your time. You belong here.</span>
          </footer>
        </main>
      </div>
      {modal === "profile" && (
        <ProfileForm
          world={world}
          onClose={() => setModal(null)}
          onSave={async (a) => {
            if (await act(a)) {
              setModal(null);
              tell("나다운 모습으로 저장했어요.");
            }
          }}
        />
      )}
      {modal === "item" && (
        <ItemForm
          item={editingItem}
          onClose={() => setModal(null)}
          onSave={async (data) => {
            if (
              await act({
                type: "item.save",
                id: editingItem?.id ?? uid(),
                revision: editingItem?.revision,
                item: data,
              })
            ) {
              setModal(null);
              tell("취향 서랍에 담았어요.");
            }
          }}
        />
      )}
      {modal === "create" && (
        <Modal title="우리의 섬 이름은?" onClose={() => setModal(null)}>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (await act({ type: "island.create", name: f.get("name") })) {
                setModal(null);
                navigate("island");
              }
            }}
          >
            <p>혼자 시작해서 최대 8명의 친구와 함께할 수 있어요.</p>
            <label>
              섬 이름
              <input
                name="name"
                placeholder="느린 오후의 섬"
                maxLength={30}
                required
              />
            </label>
            <button className="btn primary full" disabled={busy}>
              나의 섬 만들기 <ArrowRight size={17} />
            </button>
          </form>
        </Modal>
      )}
      {modal === "invite" && (
        <Modal
          title="우리 섬에 놀러 올래?"
          onClose={() => {
            setModal(null);
            setInvite("");
          }}
        >
          <div className="form">
            <p>
              초대한 친구만 함께 살 수 있어요. 초대는 7일 동안 유효하며 남은
              집터 수만큼 사용할 수 있어요.
            </p>
            {demo ? (
              <div className="notice">
                샘플 모드에서는 초대를 보낼 수 없어요. 실제 로그인과 Supabase
                연결 후 사용할 수 있습니다.
              </div>
            ) : world.island?.owner !== world.me ? (
              <div className="notice">초대 링크는 방장이 만들 수 있어요.</div>
            ) : (
              <>
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const { data, error } =
                        await supabase!.rpc("isola_invite");
                      if (error) throw error;
                      setInvite(`${location.origin}/?invite=${data}`);
                    } catch (e) {
                      tell((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  초대 링크 만들기
                </button>
                {invite && (
                  <>
                    <label>
                      친구에게 직접 전달해 주세요
                      <input value={invite} readOnly />
                    </label>
                    <button
                      className="btn outline"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(invite);
                          tell("초대 링크를 복사했어요.");
                        } catch {
                          tell("위 링크를 선택해 직접 복사해 주세요.");
                        }
                      }}
                    >
                      <Share2 size={16} />
                      링크 복사
                    </button>
                  </>
                )}
                <button
                  className="text-button danger"
                  onClick={async () => {
                    if (
                      confirm("발급된 초대 링크를 모두 만료시킬까요?") &&
                      (await act({ type: "invite.revoke" }))
                    ) {
                      setInvite("");
                      tell("기존 초대를 취소했어요.");
                    }
                  }}
                >
                  기존 초대 모두 취소
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
      {currentItem && (
        <Modal title="취향 한 조각" onClose={() => setDetail(undefined)}>
          <div
            className="detail-art"
            style={{ background: `${categories[currentItem.kind].color}25` }}
          >
            <span>{categories[currentItem.kind].emoji}</span>
            <p>{categories[currentItem.kind].label}</p>
          </div>
          <div className="detail-body">
            <div className="detail-meta">
              <span>
                {currentItem.visibility === "private"
                  ? "🔒 나만 보기"
                  : "섬 친구에게 공개"}
              </span>
              <span>
                {world.profiles.find((p) => p.id === currentItem.owner)?.name}의
                취향
              </span>
            </div>
            <h2>{currentItem.title}</h2>
            <p className="creator">{currentItem.creator}</p>
            <p className="detail-note">
              {currentItem.note || "아직 감상을 남기지 않았어요."}
            </p>
            <div className="tags">
              {currentItem.tags.map((t) => (
                <span className="tag" key={t}>
                  #{t}
                </span>
              ))}
            </div>
            {currentItem.owner === world.me ? (
              <div className="button-row">
                <button
                  className="btn outline small"
                  onClick={() => {
                    setEditingItem(currentItem);
                    setDetail(undefined);
                    setModal("item");
                  }}
                >
                  기록 수정
                </button>
                <button
                  className="btn outline small"
                  onClick={() => {
                    const s = world.spaces.find(
                      (s) => s.owner === world.me && s.kind === "interior",
                    );
                    if (currentItem.visibility !== "island") {
                      tell("먼저 기록을 섬 친구에게 공개해 주세요.");
                      return;
                    }
                    if (s) {
                      navigate("space", s.id);
                      setDraft(structuredClone(s.draft));
                      setEditing(true);
                      setAsset("display");
                      tell("취향 받침대를 놓고 기록을 연결해 주세요.");
                    }
                  }}
                >
                  내 공간에 전시하기
                </button>
                <button
                  className="text-button danger"
                  onClick={async () => {
                    if (
                      confirm("이 기록과 연결된 댓글을 삭제할까요?") &&
                      (await act({ type: "item.delete", id: currentItem.id }))
                    ) {
                      setDetail(undefined);
                      tell("기록을 삭제했어요.");
                    }
                  }}
                >
                  삭제
                </button>
              </div>
            ) : (
              <button
                className="text-button"
                onClick={() => {
                  const reason = prompt("신고 사유를 적어 주세요.");
                  if (reason)
                    act({
                      type: "report",
                      target: currentItem.id,
                      reason,
                    }).then((ok) => {
                      if (ok) tell("신고를 접수했어요.");
                    });
                }}
              >
                <Shield size={14} />
                신고
              </button>
            )}
            <Comments target={currentItem.id} world={world} act={act} />
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {busy && (
        <div className="saving" role="status">
          <Loader2 size={15} className="spin" />
          저장 중
        </div>
      )}
    </div>
  );
}
function ItemCard({
  item,
  profile,
  onClick,
}: {
  item: Item;
  profile?: { name: string; avatar: Avatar };
  onClick: () => void;
}) {
  const cat = categories[item.kind];
  return (
    <button className={`item-card ${item.kind}`} onClick={onClick}>
      <div className="item-art">
        <span className="category-pill">{cat.label}</span>
        {item.kind === "book" ? (
          <div className="book-object">
            <span>{item.title}</span>
            <small>{item.creator}</small>
          </div>
        ) : item.kind === "film" ? (
          <div className="film-object">
            <span className="film-hill" />
            <span className="film-sun" />
            <strong>{item.title}</strong>
          </div>
        ) : item.kind === "quote" ? (
          <div className="quote-object">
            <span>“</span>
            <p>{item.title}</p>
            <i>────────</i>
          </div>
        ) : (
          <div className="bottle-object">
            <span />
            <i>
              ISOLA
              <br />
              MEMORIES
            </i>
          </div>
        )}
      </div>
      <div className="item-info">
        <h3>{item.title}</h3>
        <p>{item.creator || cat.plural}</p>
        <div className="item-author">
          <AvatarDot profile={profile} small />
          <span>{profile?.name ?? "이웃"}의 취향</span>
          {item.visibility === "private" && <LockKeyhole size={12} />}
          <ArrowRight size={14} />
        </div>
      </div>
    </button>
  );
}
function Login({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="ISOLA에 오신 걸 환영해요" onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!supabase) return;
          setBusy(true);
          setError("");
          try {
            const result = sent
              ? await supabase.auth.verifyOtp({
                  email,
                  token: code,
                  type: "email",
                })
              : await supabase.auth.signInWithOtp({
                  email,
                  options: { emailRedirectTo: window.location.origin },
                });
            if (result.error) throw result.error;
            if (sent) onDone();
            else setSent(true);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>비밀번호 없이, 이메일의 로그인 링크로 시작해요.</p>
        {!supabase ? (
          <div className="notice">
            지금은 서비스 연결을 준비하고 있어요. 먼저 샘플 섬을 둘러보세요.
            개발자는 README의 Supabase 설정을 완료해 주세요.
          </div>
        ) : (
          <>
            <label>
              이메일
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={sent}
                placeholder="hello@example.com"
                autoComplete="email"
              />
            </label>
            {sent && (
              <div className="notice">
                이메일의 로그인 링크를 눌러 주세요. 인증번호가 도착했다면 아래에
                입력해도 됩니다. 새 탭에서 열리면 이 화면도 로그인돼요.
              </div>
            )}
            {sent && (
              <label>
                이메일 인증번호
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  minLength={6}
                  maxLength={8}
                />
              </label>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="btn primary full" disabled={busy}>
              {busy
                ? "잠시만 기다려 주세요"
                : sent
                  ? "섬으로 들어가기"
                  : "로그인 메일 받기"}
            </button>
            {sent && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setSent(false);
                  setCode("");
                }}
              >
                이메일 변경 / 로그인 메일 다시 받기
              </button>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
function ItemForm({
  item,
  onClose,
  onSave,
}: {
  item?: Item;
  onClose: () => void;
  onSave: (data: unknown) => Promise<void>;
}) {
  const [kind, setKind] = useState<Kind>(item?.kind ?? "book"),
    [saving, setSaving] = useState(false);
  return (
    <Modal
      title={item ? "취향 기록 다듬기" : "새로운 취향 한 조각"}
      onClose={onClose}
    >
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setSaving(true);
          await onSave({
            kind,
            title: f.get("title"),
            creator: f.get("creator"),
            note: f.get("note"),
            tags: String(f.get("tags"))
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            visibility: f.get("visibility"),
          });
          setSaving(false);
        }}
      >
        <div className="kind-picker">
          {(Object.keys(categories) as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              className={kind === k ? "selected" : ""}
              onClick={() => setKind(k)}
            >
              <span>{categories[k].emoji}</span>
              {categories[k].label}
            </button>
          ))}
        </div>
        <label>
          {kind === "quote" ? "문장 제목" : "제목 / 이름"}
          <input
            name="title"
            defaultValue={item?.title}
            maxLength={120}
            required
            placeholder="오래 기억하고 싶은 것"
          />
        </label>
        <label>
          {kind === "book"
            ? "저자"
            : kind === "film"
              ? "감독"
              : kind === "quote"
                ? "출처"
                : "증류소 / 브랜드"}
          <input
            name="creator"
            defaultValue={item?.creator}
            maxLength={160}
            placeholder="기억의 출처를 남겨 주세요"
          />
        </label>
        <label>
          {kind === "quote" ? "문장과 나의 메모" : "나의 감상"}
          <textarea
            name="note"
            defaultValue={item?.note}
            maxLength={2000}
            rows={5}
            placeholder="어떤 순간이 마음에 남았나요?"
          />
        </label>
        <label>
          태그 <span className="micro">쉼표로 구분 · 최대 5개</span>
          <input
            name="tags"
            defaultValue={item?.tags.join(", ")}
            placeholder="여름, 고요한 시간"
          />
        </label>
        <label>
          공개 범위
          <select
            name="visibility"
            defaultValue={item?.visibility ?? "private"}
          >
            <option value="private">나만 보기</option>
            <option value="island">섬 친구에게 공개</option>
          </select>
        </label>
        <p className="micro">
          비공개로 바꾸면 친구는 연결된 전시와 댓글을 볼 수 없어요.
        </p>
        <button className="btn primary full" disabled={saving}>
          취향 서랍에 담기 <Check size={16} />
        </button>
      </form>
    </Modal>
  );
}
function ProfileForm({
  world,
  onClose,
  onSave,
}: {
  world: World;
  onClose: () => void;
  onSave: (a: Action) => Promise<void>;
}) {
  const me = world.profiles.find((p) => p.id === world.me);
  const [avatar, setAvatar] = useState<Avatar>(me?.avatar ?? defaultAvatar);
  return (
    <Modal title="나답게, 자유롭게" onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          await onSave({
            type: "profile",
            name: f.get("name"),
            bio: f.get("bio"),
            identity: f.get("identity"),
            avatar,
          });
        }}
      >
        <div className="avatar-preview">
          <AvatarDot profile={{ name: me?.name ?? "나", avatar }} />
          <p>내가 고른 모습이 곧 나예요.</p>
        </div>
        <label>
          닉네임
          <input
            name="name"
            defaultValue={me?.name ?? "새로운 이웃"}
            required
            maxLength={20}
          />
        </label>
        <label>
          짧은 소개
          <input name="bio" defaultValue={me?.bio} maxLength={160} />
        </label>
        <label>
          나를 표현하는 말{" "}
          <span className="micro">선택 · 섬 친구에게 공개</span>
          <input
            name="identity"
            defaultValue={me?.identity}
            maxLength={60}
            placeholder="호칭, 대명사, 원하는 표현을 자유롭게"
          />
        </label>
        <div className="two-columns">
          <label>
            체형
            <select
              value={avatar.body}
              onChange={(e) =>
                setAvatar({ ...avatar, body: e.target.value as Avatar["body"] })
              }
            >
              <option value="small">작은 체형</option>
              <option value="round">둥근 체형</option>
              <option value="tall">길쭉한 체형</option>
            </select>
          </label>
          <label>
            머리 모양
            <select
              value={avatar.style}
              onChange={(e) =>
                setAvatar({
                  ...avatar,
                  style: e.target.value as Avatar["style"],
                })
              }
            >
              <option value="short">짧은 머리</option>
              <option value="bob">단발 머리</option>
              <option value="bun">묶은 머리</option>
            </select>
          </label>
        </div>
        {(
          [
            ["skin", "피부색", ["#efc3a4", "#dba57b", "#a97553", "#704e3a"]],
            ["hair", "머리색", ["#514139", "#8c6650", "#d4b77d", "#b7828b"]],
            ["shirt", "옷 색상", ["#819e87", "#cc9684", "#a0aaca", "#d4ba7e"]],
          ] as const
        ).map(([key, label, colors]) => (
          <fieldset className="swatch-field" key={key}>
            <legend>{label}</legend>
            {colors.map((color, i) => (
              <button
                type="button"
                key={color}
                aria-label={`${label} ${i + 1}`}
                aria-pressed={avatar[key] === color}
                className={avatar[key] === color ? "chosen" : ""}
                style={{ background: color }}
                onClick={() => setAvatar({ ...avatar, [key]: color })}
              >
                {avatar[key] === color && <Check size={15} />}
              </button>
            ))}
          </fieldset>
        ))}
        <button className="btn primary full">
          이 모습으로 머물기 <Check size={16} />
        </button>
      </form>
    </Modal>
  );
}
function Comments({
  target,
  world,
  act,
  title = "남겨진 마음",
}: {
  target: string;
  world: World;
  act: (a: Action) => Promise<boolean>;
  title?: string;
}) {
  const [text, setText] = useState(""),
    [sending, setSending] = useState(false);
  const comments = world.comments.filter(
    (c) => c.target === target && !c.hidden && !world.blocks.includes(c.author),
  );
  const own =
    world.items.some((i) => i.id === target && i.owner === world.me) ||
    world.spaces.some((i) => i.id === target && i.owner === world.me);
  return (
    <section className="comments">
      <h3>
        {title} <span>{comments.length}</span>
      </h3>
      {comments.length ? (
        comments.map((c) => (
          <article key={c.id} className="comment">
            <AvatarDot
              profile={world.profiles.find((p) => p.id === c.author)}
              small
            />
            <div>
              <strong>
                {world.profiles.find((p) => p.id === c.author)?.name ?? "이웃"}
              </strong>
              <p>{c.body}</p>
              <small>{new Date(c.created).toLocaleDateString("ko-KR")}</small>
            </div>
            {c.author === world.me ? (
              <button
                className="text-button"
                onClick={() => {
                  if (confirm("댓글을 삭제할까요?"))
                    act({ type: "comment.delete", id: c.id });
                }}
              >
                삭제
              </button>
            ) : own ? (
              <button
                className="text-button"
                onClick={() => act({ type: "comment.hide", id: c.id })}
              >
                숨김
              </button>
            ) : null}
          </article>
        ))
      ) : (
        <p className="muted">아직 조용하네요. 첫 번째 마음을 남겨 주세요.</p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSending(true);
          if (await act({ type: "comment.add", id: uid(), target, body: text }))
            setText("");
          setSending(false);
        }}
      >
        <label className="sr-only" htmlFor={`comment-${target}`}>
          댓글 내용
        </label>
        <input
          id={`comment-${target}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="작고 다정한 마음을 남겨요"
          required
        />
        <button
          className="btn primary"
          disabled={sending || !text.trim()}
          aria-label="댓글 남기기"
        >
          <ArrowRight size={18} />
        </button>
      </form>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Heart,
  Home,
  Menu,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/lib/store";

type Position = { x: number; y: number };
type Neighbor = Position & { id: string; name: string; bubble?: string };
type PlazaProps = {
  islandId?: string;
  userId?: string;
  userName?: string;
  demo?: boolean;
  knownNames?: Record<string, string>;
  knownLooks?: Record<string, string>;
  playerLook?: string;
  islandName?: string;
  residentCount?: number;
  guest?: boolean;
  onExplore?: () => void;
  onLogin?: () => void;
  onHome?: () => void;
  onArchive?: () => void;
  onPeople?: () => void;
  onInvite?: () => void;
  onProfile?: () => void;
  onCreateAccount?: () => void;
};

const START = { x: 51, y: 76 };
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export default function CapyPlaza({
  islandId,
  userId,
  userName,
  demo = false,
  knownNames = {},
  knownLooks = {},
  playerLook,
  islandName,
  residentCount,
  guest = false,
  onExplore,
  onLogin,
  onHome,
  onArchive,
  onPeople,
  onInvite,
  onProfile,
  onCreateAccount,
}: PlazaProps) {
  const map = useRef<HTMLDivElement>(null);
  const player = useRef<Position>(START);
  const destination = useRef<Position>(START);
  const heldKeys = useRef(new Set<string>());
  const [position, setPosition] = useState<Position>(START);
  const [walking, setWalking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bubble, setBubble] = useState("");
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [connected, setConnected] = useState(false);
  const channel = useRef<ReturnType<
    NonNullable<typeof supabase>["channel"]
  > | null>(null);
  const lastSent = useRef(0);
  const knownNamesRef = useRef(knownNames);
  knownNamesRef.current = knownNames;

  const walkTo = useCallback((point: Position) => {
    destination.current = {
      x: clamp(point.x, 27, 74),
      y: clamp(point.y, 48, 88),
    };
    setWalking(true);
  }, []);

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      const keys = heldKeys.current;
      const dx =
        Number(keys.has("ArrowRight") || keys.has("d")) -
        Number(keys.has("ArrowLeft") || keys.has("a"));
      const dy =
        Number(keys.has("ArrowDown") || keys.has("s")) -
        Number(keys.has("ArrowUp") || keys.has("w"));
      if (dx || dy) {
        destination.current = {
          x: clamp(player.current.x + dx * dt * 24, 27, 74),
          y: clamp(player.current.y + dy * dt * 24, 48, 88),
        };
      }
      const distanceX = destination.current.x - player.current.x;
      const distanceY = destination.current.y - player.current.y;
      const distance = Math.hypot(distanceX, distanceY);
      if (distance > 0.15) {
        const step = Math.min(distance, dt * 19);
        player.current = {
          x: player.current.x + (distanceX / distance) * step,
          y: player.current.y + (distanceY / distance) * step,
        };
        setPosition({ ...player.current });
        setWalking(true);
      } else {
        setWalking(false);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const down = (event: KeyboardEvent) => {
      if (
        /^(INPUT|TEXTAREA|SELECT)$/.test((event.target as HTMLElement)?.tagName)
      )
        return;
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "w",
          "a",
          "s",
          "d",
        ].includes(event.key)
      ) {
        event.preventDefault();
        heldKeys.current.add(event.key);
      }
    };
    const up = (event: KeyboardEvent) => heldKeys.current.delete(event.key);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    if (!bubble) return;
    const timeout = window.setTimeout(() => setBubble(""), 2400);
    return () => window.clearTimeout(timeout);
  }, [bubble]);

  useEffect(() => {
    if (!supabase || !islandId || !userId || demo) return;
    const client = supabase;
    const room = client.channel(`capy-island:${islandId}`, {
      config: { private: true, presence: { key: userId } },
    });
    channel.current = room;
    let subscribed = false;
    const updateNeighbors = () => {
      const peers = Object.values(
        room.presenceState(),
      ).flat() as unknown as Neighbor[];
      setNeighbors(
        peers
          .filter(
            (peer) =>
              peer.id !== userId &&
              !!knownNamesRef.current[peer.id] &&
              Number.isFinite(peer.x) &&
              Number.isFinite(peer.y),
          )
          .map((peer) => ({
            id: peer.id,
            name: knownNamesRef.current[peer.id],
            x: clamp(peer.x, 27, 74),
            y: clamp(peer.y, 48, 88),
          })),
      );
    };
    room
      .on("presence", { event: "sync" }, updateNeighbors)
      .on("broadcast", { event: "walk" }, ({ payload }) => {
        const peer = payload as Neighbor;
        if (
          !peer.id ||
          peer.id === userId ||
          !knownNamesRef.current[peer.id] ||
          !Number.isFinite(peer.x) ||
          !Number.isFinite(peer.y)
        )
          return;
        setNeighbors((current) =>
          current.map((item) =>
            item.id === peer.id
              ? { ...item, x: clamp(peer.x, 27, 74), y: clamp(peer.y, 48, 88) }
              : item,
          ),
        );
      })
      .on("broadcast", { event: "gesture" }, ({ payload }) => {
        const peer = payload as Neighbor;
        if (
          !peer.id ||
          peer.id === userId ||
          !knownNamesRef.current[peer.id] ||
          !["안녕! 👋", "여기 너무 좋아 🌷", "같이 쉬어갈래? ☕"].includes(
            peer.bubble ?? "",
          )
        )
          return;
        setNeighbors((current) =>
          current.map((item) =>
            item.id === peer.id ? { ...item, bubble: peer.bubble } : item,
          ),
        );
        window.setTimeout(
          () =>
            setNeighbors((current) =>
              current.map((item) =>
                item.id === peer.id ? { ...item, bubble: undefined } : item,
              ),
            ),
          2400,
        );
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          subscribed = true;
          setConnected(true);
          await room.track({
            id: userId,
            name: userName ?? "카피바라",
            ...player.current,
          });
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          subscribed = false;
          setConnected(false);
        }
      });
    const refresh = window.setInterval(() => {
      if (subscribed)
        void room.track({
          id: userId,
          name: userName ?? "카피바라",
          ...player.current,
        });
    }, 5000);
    return () => {
      window.clearInterval(refresh);
      channel.current = null;
      void client.removeChannel(room);
    };
  }, [islandId, userId, userName, demo]);

  useEffect(() => {
    if (
      !connected ||
      !channel.current ||
      performance.now() - lastSent.current < 100
    )
      return;
    lastSent.current = performance.now();
    void channel.current.send({
      type: "broadcast",
      event: "walk",
      payload: { id: userId, ...position },
    });
  }, [position, connected, userId]);

  const gesture = (message: string) => {
    setBubble(message);
    if (connected)
      void channel.current?.send({
        type: "broadcast",
        event: "gesture",
        payload: { id: userId, bubble: message },
      });
  };

  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (guest) {
      onExplore?.();
      return;
    }
    const bounds = map.current?.getBoundingClientRect();
    if (!bounds) return;
    walkTo({
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
    });
  };

  return (
    <section
      className={`capy-plaza ${guest ? "is-guest" : ""}`}
      aria-label="카피바라 마을 광장"
    >
      <div ref={map} className="capy-map" onClick={handleMapClick}>
        <div className="capy-sky-glow" />
        <div className="capy-neighbor capy-neighbor-one" aria-hidden="true">
          <img src="/capy-world/capy-neighbor-v1.webp" alt="" />
          <span>라일락</span>
        </div>
        <div className="capy-neighbor capy-neighbor-two" aria-hidden="true">
          <img src="/capy-world/capy-hero-v1.webp" alt="" />
          <span>느린 오후</span>
        </div>
        {!guest && (
          <div
            className={`capy-player ${walking ? "is-walking" : ""}`}
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
            aria-label="내 카피바라"
          >
            {bubble && <span className="capy-bubble">{bubble}</span>}
            <img
              src={
                playerLook === "bun"
                  ? "/capy-world/capy-neighbor-v1.webp"
                  : "/capy-world/capy-hero-v1.webp"
              }
              alt=""
              draggable={false}
            />
            <span className="capy-name">나</span>
          </div>
        )}
        {neighbors.map((neighbor) => (
          <div
            key={neighbor.id}
            className="capy-player capy-remote"
            style={{ left: `${neighbor.x}%`, top: `${neighbor.y}%` }}
          >
            {neighbor.bubble && (
              <span className="capy-bubble">{neighbor.bubble}</span>
            )}
            <img
              src={
                knownLooks[neighbor.id] === "bun"
                  ? "/capy-world/capy-neighbor-v1.webp"
                  : "/capy-world/capy-hero-v1.webp"
              }
              alt=""
              draggable={false}
            />
            <span className="capy-name">{neighbor.name}</span>
          </div>
        ))}
      </div>

      <header className="capy-hud-top">
        <div className="capy-brand">
          <span className="capy-brand-icon">✿</span>
          <span>
            CAPY COVE<small>카피바라들의 노을 마을</small>
          </span>
        </div>
        <div className="capy-top-actions">
          {!guest && (
            <span className="capy-island-chip">
              {islandName} ·{" "}
              {demo
                ? "샘플"
                : connected
                  ? `${neighbors.length + 1}명 접속`
                  : "연결 중"}{" "}
              · {residentCount}명 거주
            </span>
          )}
          <button
            className="capy-round-button capy-menu-button"
            aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <nav className="capy-menu" aria-label="마을 메뉴">
          {guest ? (
            <>
              <button onClick={onExplore}>
                <ArrowRight size={18} /> 마을에 들어가기
              </button>
              <button onClick={onLogin}>
                <Heart size={18} /> 내 카피바라 만들기
              </button>
            </>
          ) : (
            <>
              <button onClick={onHome}>
                <Home size={18} /> 나의 집
              </button>
              <button onClick={onArchive}>
                <BookOpen size={18} /> 취향 진열장
              </button>
              <button onClick={onPeople}>
                <Users size={18} /> 이웃들
              </button>
              <button onClick={onInvite}>
                <Heart size={18} /> 친구 초대
              </button>
              <button onClick={onProfile}>내 프로필</button>
              {demo && (
                <button onClick={onCreateAccount}>
                  <ArrowRight size={18} /> 실제 계정으로 시작
                </button>
              )}
            </>
          )}
        </nav>
      )}

      {guest ? (
        <div className="capy-guest-card">
          <p>WELCOME TO THE COVE</p>
          <h1>
            오늘은 여기서
            <br />
            조금 쉬어갈까?
          </h1>
          <span>카피바라가 되어 걷고, 친구의 작은 세계에 놀러 가요.</span>
          <div>
            <button className="capy-primary-button" onClick={onExplore}>
              바로 마을 구경하기 <ArrowRight size={19} />
            </button>
            <button className="capy-text-button" onClick={onLogin}>
              내 카피바라 만들기
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="capy-place-label">
            <span>✦</span> 조개분수 광장 <small>바닥을 누르면 걸어가요</small>
            <small className="capy-live-count">
              {demo
                ? "샘플 섬"
                : connected
                  ? `${neighbors.length + 1}명 접속`
                  : "연결 중"}
            </small>
          </div>
          <div className="capy-action-bar">
            <button onClick={() => gesture("안녕! 👋")} aria-label="인사하기">
              <span>👋</span>
              <small>인사</small>
            </button>
            <button
              onClick={() => gesture("여기 너무 좋아 🌷")}
              aria-label="감탄하기"
            >
              <span>🌷</span>
              <small>감탄</small>
            </button>
            <button
              onClick={() => gesture("같이 쉬어갈래? ☕")}
              aria-label="함께 쉬기"
            >
              <span>☕</span>
              <small>쉬기</small>
            </button>
          </div>
          <div className="capy-mobile-pad" aria-label="이동 방향">
            <button
              aria-label="위로 이동"
              onPointerDown={() => walkTo({ x: position.x, y: position.y - 6 })}
            >
              ↑
            </button>
            <div>
              <button
                aria-label="왼쪽으로 이동"
                onPointerDown={() =>
                  walkTo({ x: position.x - 6, y: position.y })
                }
              >
                ←
              </button>
              <button
                aria-label="아래로 이동"
                onPointerDown={() =>
                  walkTo({ x: position.x, y: position.y + 6 })
                }
              >
                ↓
              </button>
              <button
                aria-label="오른쪽으로 이동"
                onPointerDown={() =>
                  walkTo({ x: position.x + 6, y: position.y })
                }
              >
                →
              </button>
            </div>
          </div>
          <div className="capy-hud-bottom">
            <span>✿</span> 작은 발걸음부터 시작해요
          </div>
        </>
      )}
    </section>
  );
}

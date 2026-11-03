"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Heart,
  Home,
  Menu,
  Music2,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/lib/store";
import { startClubBeat } from "@/lib/club-beat";

type Position = { x: number; y: number };
type Zone = "village" | "club";
type Neighbor = Position & {
  id: string;
  name: string;
  zone: Zone;
  bubble?: string;
  dancing?: boolean;
  facing?: number;
  walking?: boolean;
};
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
const CLUB_START = { x: 50, y: 78 };
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const walkingFrames = [
  "front-0",
  "front-1",
  "side-0",
  "side-1",
  "back-0",
  "back-1",
];

function walkablePoint(point: Position, zone: Zone): Position {
  const club = zone === "club";
  const y = clamp(point.y, club ? 51 : 48, 88);
  const narrowEntrance = club ? y < 58 : y < 59;
  return {
    x: clamp(
      point.x,
      narrowEntrance ? (club ? 35 : 41) : club ? 22 : 27,
      narrowEntrance ? (club ? 66 : 59) : club ? 78 : 74,
    ),
    y,
  };
}

function walkingSprite(facing = 0, frame = 0) {
  const side = Math.abs(Math.sin(facing)) > Math.abs(Math.cos(facing)) * 0.7;
  if (side)
    return {
      src: `/capy-world/walk/side-${frame}.webp`,
      flip: Math.sin(facing) < 0,
    };
  if (Math.cos(facing) < 0)
    return { src: `/capy-world/walk/back-${frame}.webp`, flip: false };
  return { src: `/capy-world/walk/front-${frame}.webp`, flip: false };
}

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
  const padDirection = useRef<Position | null>(null);
  const moveSpeed = useRef(0);
  const [position, setPosition] = useState<Position>(START);
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState(0);
  const facingRef = useRef(0);
  const [walkFrame, setWalkFrame] = useState(0);
  const lastWalkFrame = useRef(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const reducedMotionRef = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bubble, setBubble] = useState("");
  const [zone, setZone] = useState<Zone>("village");
  const [dancing, setDancing] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const zoneRef = useRef<Zone>("village");
  const audioContext = useRef<AudioContext | null>(null);
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [remoteFrame, setRemoteFrame] = useState(0);
  const anyNeighborWalking = neighbors.some((neighbor) => neighbor.walking);
  const remoteIdleTimers = useRef(new Map<string, number>());
  const [connected, setConnected] = useState(false);
  const channel = useRef<ReturnType<
    NonNullable<typeof supabase>["channel"]
  > | null>(null);
  const lastSent = useRef(0);
  const knownNamesRef = useRef(knownNames);
  knownNamesRef.current = knownNames;

  useEffect(() => {
    for (const frame of walkingFrames) {
      const image = new Image();
      image.src = `/capy-world/walk/${frame}.webp`;
    }
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reducedMotionRef.current = query.matches;
      setReducedMotion(query.matches);
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const walkTo = useCallback((point: Position) => {
    destination.current = walkablePoint(point, zoneRef.current);
    setWalking(true);
  }, []);

  const changeZone = useCallback(
    (next: Zone) => {
      if (guest) {
        onExplore?.();
        return;
      }
      zoneRef.current = next;
      setZone(next);
      const start = next === "club" ? CLUB_START : START;
      player.current = start;
      destination.current = start;
      setPosition(start);
      setNeighbors([]);
      setBubble("");
      setDancing(false);
      facingRef.current = 0;
      setFacing(0);
      moveSpeed.current = 0;
      if (next === "village") setMusicOn(false);
    },
    [guest, onExplore],
  );

  useEffect(() => {
    if (
      !guest &&
      zone === "village" &&
      position.y <= 49 &&
      position.x >= 44 &&
      position.x <= 56
    ) {
      changeZone("club");
    }
  }, [position, zone, guest, changeZone]);

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      const keys = heldKeys.current;
      const dx =
        Number(keys.has("ArrowRight") || keys.has("d")) -
        Number(keys.has("ArrowLeft") || keys.has("a")) +
        (padDirection.current?.x ?? 0);
      const dy =
        Number(keys.has("ArrowDown") || keys.has("s")) -
        Number(keys.has("ArrowUp") || keys.has("w")) +
        (padDirection.current?.y ?? 0);
      if (dx || dy) {
        destination.current = walkablePoint(
          {
            x: player.current.x + dx * dt * 24,
            y: player.current.y + dy * dt * 24,
          },
          zoneRef.current,
        );
      }
      const distanceX = destination.current.x - player.current.x;
      const distanceY = destination.current.y - player.current.y;
      const distance = Math.hypot(distanceX, distanceY);
      if (distance > 0.15) {
        const angle = Math.atan2(distanceX, distanceY);
        if (Math.abs(angle - facingRef.current) > 0.08) {
          facingRef.current = angle;
          setFacing(angle);
        }
        if (!reducedMotionRef.current && now - lastWalkFrame.current > 150) {
          lastWalkFrame.current = now;
          setWalkFrame((frame) => 1 - frame);
        }
        const targetSpeed = Math.min(19, distance * 42);
        moveSpeed.current +=
          (targetSpeed - moveSpeed.current) * Math.min(1, dt * 10);
        const step = Math.min(distance, dt * moveSpeed.current);
        player.current = {
          x: player.current.x + (distanceX / distance) * step,
          y: player.current.y + (distanceY / distance) * step,
        };
        setPosition({ ...player.current });
        setWalking(true);
      } else {
        moveSpeed.current = 0;
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
    if (!anyNeighborWalking || reducedMotion) return;
    const timer = window.setInterval(
      () => setRemoteFrame((frame) => 1 - frame),
      150,
    );
    return () => window.clearInterval(timer);
  }, [anyNeighborWalking, reducedMotion]);

  useEffect(() => {
    if (!bubble) return;
    const timeout = window.setTimeout(() => setBubble(""), 2400);
    return () => window.clearTimeout(timeout);
  }, [bubble]);

  useEffect(() => {
    const context = audioContext.current;
    if (!context || !musicOn || zone !== "club") {
      if (context?.state === "running") void context.suspend();
      return;
    }
    void context.resume();
    return startClubBeat(context);
  }, [musicOn, zone]);

  useEffect(
    () => () => {
      if (audioContext.current) void audioContext.current.close();
    },
    [],
  );

  const toggleMusic = () => {
    if (!musicOn && !audioContext.current)
      audioContext.current = new AudioContext();
    if (!musicOn) void audioContext.current?.resume();
    setMusicOn((current) => !current);
  };

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
              peer.zone === zoneRef.current &&
              !!knownNamesRef.current[peer.id] &&
              Number.isFinite(peer.x) &&
              Number.isFinite(peer.y),
          )
          .map((peer) => ({
            id: peer.id,
            name: knownNamesRef.current[peer.id],
            zone: peer.zone,
            x: clamp(
              peer.x,
              peer.zone === "club" ? 22 : 27,
              peer.zone === "club" ? 78 : 74,
            ),
            y: clamp(peer.y, peer.zone === "club" ? 51 : 48, 88),
            facing: peer.facing ?? 0,
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
          peer.zone !== zoneRef.current ||
          !knownNamesRef.current[peer.id] ||
          !Number.isFinite(peer.x) ||
          !Number.isFinite(peer.y)
        )
          return;
        setNeighbors((current) =>
          current.map((item) =>
            item.id === peer.id
              ? {
                  ...item,
                  x: clamp(
                    peer.x,
                    peer.zone === "club" ? 22 : 27,
                    peer.zone === "club" ? 78 : 74,
                  ),
                  y: clamp(peer.y, peer.zone === "club" ? 51 : 48, 88),
                  facing: peer.facing ?? item.facing,
                  walking: true,
                }
              : item,
          ),
        );
        const previousTimer = remoteIdleTimers.current.get(peer.id);
        if (previousTimer) window.clearTimeout(previousTimer);
        const timer = window.setTimeout(() => {
          setNeighbors((current) =>
            current.map((item) =>
              item.id === peer.id ? { ...item, walking: false } : item,
            ),
          );
          remoteIdleTimers.current.delete(peer.id);
        }, 260);
        remoteIdleTimers.current.set(peer.id, timer);
      })
      .on("broadcast", { event: "gesture" }, ({ payload }) => {
        const peer = payload as Neighbor;
        if (
          !peer.id ||
          peer.id === userId ||
          peer.zone !== zoneRef.current ||
          !knownNamesRef.current[peer.id] ||
          ![
            "안녕! 👋",
            "여기 너무 좋아 🌷",
            "같이 쉬어갈래? ☕",
            "춤춰요! 🪩",
            "건배! 🍺",
          ].includes(peer.bubble ?? "")
        )
          return;
        setNeighbors((current) =>
          current.map((item) =>
            item.id === peer.id
              ? { ...item, bubble: peer.bubble, dancing: !!peer.dancing }
              : item,
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
            zone: zoneRef.current,
            ...player.current,
            facing: facingRef.current,
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
          zone: zoneRef.current,
          ...player.current,
          facing: facingRef.current,
        });
    }, 5000);
    return () => {
      window.clearInterval(refresh);
      for (const timer of remoteIdleTimers.current.values())
        window.clearTimeout(timer);
      remoteIdleTimers.current.clear();
      channel.current = null;
      void client.removeChannel(room);
    };
  }, [islandId, userId, userName, demo]);

  useEffect(() => {
    if (connected)
      void channel.current?.track({
        id: userId,
        name: userName ?? "카피바라",
        zone,
        ...player.current,
        facing: facingRef.current,
      });
  }, [zone, connected, userId, userName]);

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
      payload: { id: userId, zone, ...position, facing },
    });
  }, [position, facing, connected, userId, zone]);

  const gesture = (message: string, dance = false) => {
    setBubble(message);
    if (dance) setDancing((current) => !current);
    if (connected)
      void channel.current?.send({
        type: "broadcast",
        event: "gesture",
        payload: {
          id: userId,
          zone,
          bubble: message,
          dancing: dance ? !dancing : dancing,
        },
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

  const holdDirection = (
    event: React.PointerEvent<HTMLButtonElement>,
    direction: Position,
  ) => {
    event.preventDefault();
    padDirection.current = direction;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const releaseDirection = () => {
    padDirection.current = null;
  };

  const cameraFocus = zone === "club" ? CLUB_START : START;
  const cameraX = reducedMotion
    ? 0
    : clamp((cameraFocus.x - position.x) * 0.65, -20, 20);
  const cameraY = reducedMotion
    ? 0
    : clamp((cameraFocus.y - position.y) * 0.45, -12, 12);

  return (
    <section
      className={`capy-plaza ${guest ? "is-guest" : ""} is-${zone}`}
      aria-label={zone === "club" ? "카피바라 클럽" : "카피바라 마을 광장"}
    >
      <div
        ref={map}
        className="capy-map"
        style={{
          transform: `translate(calc(-50% + ${cameraX}px), calc(-50% + ${cameraY}px)) scale(1.03)`,
        }}
        onClick={handleMapClick}
      >
        <div className="capy-sky-glow" />
        <div className="capy-atmosphere" aria-hidden="true" />
        {zone === "village" ? (
          <>
            <div className="capy-club-sign" aria-hidden="true">
              CAPY CLUB
            </div>
            <button
              className="capy-club-entrance"
              aria-label="카피바라 클럽 입장"
              onClick={(event) => {
                event.stopPropagation();
                changeZone("club");
              }}
            >
              <span>
                🪩 클럽 입장 <ArrowRight size={16} />
              </span>
            </button>
            <div className="capy-guard" aria-label="클럽 입구의 카피바라 가드">
              <img src="/capy-world/club-guard-v1.webp" alt="" />
              <span>가드 모카</span>
            </div>
            <div className="capy-neighbor capy-neighbor-one" aria-hidden="true">
              <img src="/capy-world/capy-neighbor-v1.webp" alt="" />
              <span>라일락</span>
            </div>
          </>
        ) : (
          <>
            <div
              className="capy-neighbor capy-club-dancer-one"
              aria-hidden="true"
            >
              <img src="/capy-world/capy-neighbor-v1.webp" alt="" />
              <span>라일락</span>
            </div>
            <div
              className="capy-neighbor capy-club-dancer-two"
              aria-hidden="true"
            >
              <img src="/capy-world/club-guard-v1.webp" alt="" />
              <span>모카</span>
            </div>
          </>
        )}
        {!guest && (
          <div
            className={`capy-player ${walking ? "is-walking" : ""} ${dancing ? "is-dancing" : ""}`}
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              zIndex: Math.round(position.y),
            }}
            aria-label="내 카피바라"
          >
            {bubble && <span className="capy-bubble">{bubble}</span>}
            <img
              src={
                playerLook === "bun"
                  ? "/capy-world/capy-neighbor-v1.webp"
                  : walkingSprite(facing, walking ? walkFrame : 0).src
              }
              style={{ scale: walkingSprite(facing).flip ? "-1 1" : undefined }}
              alt=""
              draggable={false}
            />
            <span className="capy-name">나</span>
          </div>
        )}
        {neighbors.map((neighbor) => (
          <div
            key={neighbor.id}
            className={`capy-player capy-remote ${neighbor.dancing ? "is-dancing" : ""}`}
            style={{
              left: `${neighbor.x}%`,
              top: `${neighbor.y}%`,
              zIndex: Math.round(neighbor.y),
            }}
          >
            {neighbor.bubble && (
              <span className="capy-bubble">{neighbor.bubble}</span>
            )}
            <img
              src={
                knownLooks[neighbor.id] === "bun"
                  ? "/capy-world/capy-neighbor-v1.webp"
                  : walkingSprite(
                      neighbor.facing,
                      neighbor.walking ? remoteFrame : 0,
                    ).src
              }
              style={{
                scale: walkingSprite(neighbor.facing).flip ? "-1 1" : undefined,
              }}
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
            카피바라 스토리<small>CAPYBARA STORY</small>
          </span>
        </div>
        <div className="capy-top-actions">
          {!guest && (
            <span className="capy-island-chip">
              {zone === "club" ? "카피바라 클럽" : islandName} ·{" "}
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
              <button
                onClick={() => changeZone(zone === "club" ? "village" : "club")}
              >
                {zone === "club" ? (
                  <ArrowLeft size={18} />
                ) : (
                  <Music2 size={18} />
                )}
                {zone === "club" ? "노을 마을로" : "카피바라 클럽"}
              </button>
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
          <p>WELCOME TO CAPYBARA STORY</p>
          <h1>
            노을이 지면,
            <br />
            클럽 문이 열려.
          </h1>
          <span>바다 마을을 걷다가, 카피바라 클럽에서 만나.</span>
          <div>
            <button className="capy-primary-button" onClick={onExplore}>
              카피바라로 들어가기 <ArrowRight size={19} />
            </button>
            <button className="capy-text-button" onClick={onLogin}>
              내 카피바라 만들기
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="capy-place-label">
            <span>✦</span> {zone === "club" ? "카피바라 클럽" : "노을 마을"}{" "}
            <small>바닥을 누르면 걸어가요</small>
            <small className="capy-live-count">
              {demo
                ? "샘플 섬"
                : connected
                  ? `${neighbors.length + 1}명 접속`
                  : "연결 중"}
            </small>
          </div>
          {zone === "club" && (
            <button
              className="capy-exit-club"
              onClick={() => changeZone("village")}
            >
              <ArrowLeft size={17} /> 마을로 나가기
            </button>
          )}
          <div className="capy-action-bar">
            {zone === "club" ? (
              <>
                <button
                  onClick={() => gesture("춤춰요! 🪩", true)}
                  aria-label="춤추기"
                  aria-pressed={dancing}
                >
                  <span>🪩</span>
                  <small>{dancing ? "춤 멈춤" : "춤추기"}</small>
                </button>
                <button
                  onClick={() => gesture("건배! 🍺")}
                  aria-label="맥주로 건배"
                >
                  <span>🍺</span>
                  <small>건배</small>
                </button>
                <button
                  onClick={toggleMusic}
                  aria-label={musicOn ? "음악 끄기" : "음악 켜기"}
                  aria-pressed={musicOn}
                >
                  <span>{musicOn ? "🔊" : "🎵"}</span>
                  <small>하우스 비트</small>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => gesture("안녕! 👋")}
                  aria-label="인사하기"
                >
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
              </>
            )}
          </div>
          <div className="capy-mobile-pad" aria-label="이동 방향">
            <button
              aria-label="위로 이동"
              onPointerDown={(event) => holdDirection(event, { x: 0, y: -1 })}
              onPointerUp={releaseDirection}
              onPointerCancel={releaseDirection}
              onLostPointerCapture={releaseDirection}
            >
              ↑
            </button>
            <div>
              <button
                aria-label="왼쪽으로 이동"
                onPointerDown={(event) => holdDirection(event, { x: -1, y: 0 })}
                onPointerUp={releaseDirection}
                onPointerCancel={releaseDirection}
                onLostPointerCapture={releaseDirection}
              >
                ←
              </button>
              <button
                aria-label="아래로 이동"
                onPointerDown={(event) => holdDirection(event, { x: 0, y: 1 })}
                onPointerUp={releaseDirection}
                onPointerCancel={releaseDirection}
                onLostPointerCapture={releaseDirection}
              >
                ↓
              </button>
              <button
                aria-label="오른쪽으로 이동"
                onPointerDown={(event) => holdDirection(event, { x: 1, y: 0 })}
                onPointerUp={releaseDirection}
                onPointerCancel={releaseDirection}
                onLostPointerCapture={releaseDirection}
              >
                →
              </button>
            </div>
          </div>
          <div className="capy-hud-bottom">
            <span>✿</span>{" "}
            {zone === "club"
              ? "HOUSE BEAT · 120 BPM"
              : "클럽 입구에서 모카가 기다려요"}
          </div>
        </>
      )}
    </section>
  );
}

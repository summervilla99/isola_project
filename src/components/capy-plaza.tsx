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
  const [zone, setZone] = useState<Zone>("village");
  const [dancing, setDancing] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const zoneRef = useRef<Zone>("village");
  const audioContext = useRef<AudioContext | null>(null);
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [connected, setConnected] = useState(false);
  const channel = useRef<ReturnType<
    NonNullable<typeof supabase>["channel"]
  > | null>(null);
  const lastSent = useRef(0);
  const knownNamesRef = useRef(knownNames);
  knownNamesRef.current = knownNames;

  const walkTo = useCallback((point: Position) => {
    const club = zoneRef.current === "club";
    destination.current = {
      x: clamp(point.x, club ? 22 : 27, club ? 78 : 74),
      y: clamp(point.y, club ? 51 : 48, 88),
    };
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
      if (next === "village") setMusicOn(false);
    },
    [guest, onExplore],
  );

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
        const club = zoneRef.current === "club";
        destination.current = {
          x: clamp(
            player.current.x + dx * dt * 24,
            club ? 22 : 27,
            club ? 78 : 74,
          ),
          y: clamp(player.current.y + dy * dt * 24, club ? 51 : 48, 88),
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
                }
              : item,
          ),
        );
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
        });
    }, 5000);
    return () => {
      window.clearInterval(refresh);
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
      payload: { id: userId, zone, ...position },
    });
  }, [position, connected, userId, zone]);

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

  return (
    <section
      className={`capy-plaza ${guest ? "is-guest" : ""} is-${zone}`}
      aria-label={zone === "club" ? "카피바라 클럽" : "카피바라 마을 광장"}
    >
      <div ref={map} className="capy-map" onClick={handleMapClick}>
        <div className="capy-sky-glow" />
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
            className={`capy-player capy-remote ${neighbor.dancing ? "is-dancing" : ""}`}
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

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
import { playCapySound, type CapySound } from "@/lib/capy-sounds";
import { doorScenarios, type DoorScenarioId } from "@/lib/door-scenarios";
import LibraryNotes from "@/components/library-notes";

type Position = { x: number; y: number };
type Zone =
  "village" | "club" | "spring" | "library-yard" | "library" | "beach";
type LibraryAction = "reading" | "napping" | "snacking" | "stacking";
type ClubGenre = "house" | "edm";
type SocialAction =
  "lie" | "nose" | "orange" | "chin" | "follow" | "gaze" | "chorus";
type Neighbor = Position & {
  id: string;
  name: string;
  zone: Zone;
  bubble?: string;
  dancing?: boolean;
  facing?: number;
  walking?: boolean;
  orange?: boolean;
  idleState?: number;
  jumping?: boolean;
  libraryAction?: LibraryAction;
  sunsetWatching?: boolean;
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
const SPRING_START = { x: 50, y: 83 };
const LIBRARY_YARD_START = { x: 46, y: 78 };
const LIBRARY_START = { x: 52, y: 79 };
const BEACH_START = { x: 58, y: 86 };
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const animalSprite = "/capy-world/animal/player-v1.webp";
const frontSprite = "/capy-world/animal/player-front-v1.webp";
const backSprite = "/capy-world/animal/player-back-v1.webp";
const swimmingSprite = "/capy-world/animal/swimming-v1.webp";
const MUSIC = {
  village: { src: "/audio/village.mp3", volume: 0.34 },
  house: { src: "/audio/club-house.mp3", volume: 0.46 },
  edm: { src: "/audio/club-edm.mp3", volume: 0.45 },
  spring: { src: "/audio/spring.mp3", volume: 0.31 },
} as const;

function walkablePoint(point: Position, zone: Zone): Position {
  const club = zone === "club";
  const library = zone === "library";
  const beach = zone === "beach";
  const y = clamp(
    point.y,
    club ? 48 : zone === "spring" ? 49 : library ? 56 : beach ? 42 : 38,
    club ? 92 : 94,
  );
  return {
    x: clamp(point.x, 8, 92),
    y,
  };
}

function walkingSprite(facing = 0) {
  const forward = Math.cos(facing);
  if (forward > 0.55) return { src: frontSprite, flip: false };
  if (forward < -0.55) return { src: backSprite, flip: false };
  return { src: animalSprite, flip: Math.sin(facing) < 0 };
}

export default function CapyPlaza({
  userName,
  demo = false,
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
  const [mapSize, setMapSize] = useState({ width: 0, viewportWidth: 0 });
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState(0);
  const facingRef = useRef(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bubble, setBubble] = useState("");
  const [zone, setZone] = useState<Zone>("village");
  const [guardOpen, setGuardOpen] = useState(false);
  const [guardStep, setGuardStep] = useState<
    "hello" | "challenge" | "charming" | "success"
  >("hello");
  const [doorScenario, setDoorScenario] = useState<DoorScenarioId>("charm");
  const [charmPhase, setCharmPhase] = useState(0);
  const [doorHint, setDoorHint] = useState("");
  const doorVisits = useRef(0);
  const [dancing, setDancing] = useState(false);
  const [musicOn, setMusicOn] = useState(true);
  const [musicBlocked, setMusicBlocked] = useState(true);
  const [clubGenre, setClubGenre] = useState<ClubGenre>("house");
  const [jumping, setJumping] = useState(false);
  const [bartenderOpen, setBartenderOpen] = useState(false);
  const [barStep, setBarStep] = useState<"hello" | "wriggling" | "served">(
    "hello",
  );
  const [drinkCount, setDrinkCount] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [idlePhase, setIdlePhase] = useState(0);
  const lastActivity = useRef(0);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const clickSeries = useRef({ count: 0, timer: 0 });
  const [puffing, setPuffing] = useState(false);
  const [springClues, setSpringClues] = useState(0);
  const [springDiscovered, setSpringDiscovered] = useState(false);
  const [libraryNotesOpen, setLibraryNotesOpen] = useState(false);
  const [notesRefresh, setNotesRefresh] = useState(0);
  const [libraryAction, setLibraryAction] = useState<LibraryAction | null>(
    null,
  );
  const [bookStack, setBookStack] = useState(0);
  const [sunsetWatching, setSunsetWatching] = useState(false);
  const bookStackRef = useRef(bookStack);
  bookStackRef.current = bookStack;
  const libraryActionTimer = useRef<number | null>(null);
  const [orangeTarget, setOrangeTarget] = useState<string | null>(null);
  const [socialTarget, setSocialTarget] = useState<{
    id: string;
    name: string;
    x: number;
    y: number;
  } | null>(null);
  const [socialPose, setSocialPose] = useState<SocialAction | null>(null);
  const [npcBubble, setNpcBubble] = useState("");
  const [npcBubbleFor, setNpcBubbleFor] = useState<string | null>(null);
  const [chorusCount, setChorusCount] = useState(0);
  const idlePhaseRef = useRef(idlePhase);
  idlePhaseRef.current = idlePhase;
  const orangeRef = useRef(false);
  orangeRef.current = orangeTarget === "self" || zone === "spring";
  const zoneRef = useRef<Zone>("village");
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const musicUnlockedRef = useRef(false);
  const jumpTimer = useRef<number | null>(null);
  const jumpingRef = useRef(false);
  const jumpActionRef = useRef<() => void>(() => {});
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const remoteIdleTimers = useRef(new Map<string, number>());
  const remoteJumpTimers = useRef(new Map<string, number>());
  const [connected, setConnected] = useState(false);
  const [connectionTimedOut, setConnectionTimedOut] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [nickname, setNickname] = useState("");
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const presenceIdRef = useRef(
    `visitor-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`,
  );
  const presenceName =
    nickname ||
    (!demo && userName
      ? userName
      : `카피바라 ${presenceIdRef.current.slice(-4)}`);
  const presenceNameRef = useRef(presenceName);
  presenceNameRef.current = presenceName;
  const channel = useRef<ReturnType<
    NonNullable<typeof supabase>["channel"]
  > | null>(null);
  const lastSent = useRef(0);
  const updateNeighborsRef = useRef<() => void>(() => {});

  useEffect(() => {
    const element = map.current;
    if (!element) return;
    const measure = () => {
      const width = element.offsetWidth;
      const viewportWidth = window.innerWidth;
      setMapSize((current) =>
        current.width === width && current.viewportWidth === viewportWidth
          ? current
          : { width, viewportWidth },
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (guest) return;
    try {
      const saved = localStorage.getItem("capybara-story-nickname-v1");
      if (saved?.trim()) {
        const name = saved.trim().slice(0, 12);
        setNickname(name);
        setNicknameDraft(name);
      } else {
        setNicknameOpen(true);
      }
    } catch {
      setNicknameOpen(true);
    }
  }, [guest]);

  useEffect(() => {
    if (guest) return;
    try {
      if (localStorage.getItem("capybara-story-spring-v1") === "true")
        setSpringDiscovered(true);
    } catch {}
  }, [guest]);

  const saveNickname = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = nicknameDraft.replace(/\s+/g, " ").trim().slice(0, 12);
    if (!name) return;
    setNickname(name);
    setNicknameDraft(name);
    setNicknameOpen(false);
    try {
      localStorage.setItem("capybara-story-nickname-v1", name);
    } catch {}
  };

  useEffect(() => {
    const image = new Image();
    image.src = animalSprite;
  }, []);

  useEffect(() => {
    const warmSprites = () => {
      for (const src of [frontSprite, backSprite]) {
        const image = new Image();
        image.src = src;
      }
    };
    const timer = window.setTimeout(warmSprites, 900);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReducedMotion(query.matches);
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const markActive = useCallback(() => {
    lastActivity.current = performance.now();
    setIdlePhase(0);
  }, []);

  const sound = useCallback(
    (kind: CapySound) => {
      if (soundOn) playCapySound(kind);
    },
    [soundOn],
  );

  const playMusic = useCallback(() => {
    const audio = musicRef.current;
    if (!audio) return;
    musicUnlockedRef.current = true;
    void audio
      .play()
      .then(() => setMusicBlocked(false))
      .catch(() => setMusicBlocked(true));
  }, []);

  const switchMusic = useCallback(
    (nextZone: Zone, nextGenre: ClubGenre = clubGenre) => {
      const audio = musicRef.current;
      if (!audio) return;
      const track =
        nextZone === "club"
          ? MUSIC[nextGenre]
          : nextZone === "spring" || nextZone === "beach"
            ? MUSIC.spring
            : MUSIC.village;
      if (audio.getAttribute("src") !== track.src) {
        audio.pause();
        audio.src = track.src;
      }
      audio.volume = track.volume;
      if (musicOn && musicUnlockedRef.current) playMusic();
    },
    [clubGenre, musicOn, playMusic],
  );

  const toggleMusic = () => {
    if (musicOn && musicBlocked) {
      playMusic();
    } else if (musicOn) {
      musicRef.current?.pause();
      setMusicOn(false);
      setMusicBlocked(false);
    } else {
      setMusicOn(true);
      playMusic();
    }
  };

  const jump = useCallback(() => {
    if (guest || jumpingRef.current) return;
    jumpingRef.current = true;
    setJumping(true);
    setBubble("");
    markActive();
    sound("kyu");
    if (connected)
      void channel.current?.send({
        type: "broadcast",
        event: "jump",
        payload: { id: presenceIdRef.current, zone: zoneRef.current },
      });
    jumpTimer.current = window.setTimeout(() => {
      jumpingRef.current = false;
      setJumping(false);
      jumpTimer.current = null;
    }, 680);
  }, [guest, connected, markActive, sound]);
  jumpActionRef.current = jump;

  useEffect(
    () => () => {
      if (jumpTimer.current) window.clearTimeout(jumpTimer.current);
      if (libraryActionTimer.current)
        window.clearTimeout(libraryActionTimer.current);
      musicRef.current?.pause();
    },
    [],
  );

  useEffect(() => {
    lastActivity.current = performance.now();
    const timer = window.setInterval(() => {
      if (walking || guardOpen || bartenderOpen || menuOpen) return;
      const idleFor = performance.now() - lastActivity.current;
      setIdlePhase(
        idleFor >= 40000
          ? 4
          : idleFor >= 25000
            ? 3
            : idleFor >= 15000
              ? 2
              : idleFor >= 8000
                ? 1
                : 0,
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [walking, guardOpen, bartenderOpen, menuOpen]);

  useEffect(() => {
    if (walking) markActive();
  }, [walking, position, markActive]);

  useEffect(() => {
    if (walking && sunsetWatching) setSunsetWatching(false);
  }, [walking, sunsetWatching]);

  const startSelfPress = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    markActive();
    longPressed.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      setPuffing(true);
      setBubble("뿌우우우…");
      sound("ppu");
    }, 650);
  };

  const endSelfPress = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
    if (puffing) {
      setPuffing(false);
      setBubble("푸슉… 🌺");
    }
  };

  const clickSelf = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    markActive();
    clickSeries.current.count += 1;
    if (clickSeries.current.timer)
      window.clearTimeout(clickSeries.current.timer);
    clickSeries.current.timer = window.setTimeout(() => {
      const count = clickSeries.current.count;
      clickSeries.current.count = 0;
      let message = "뀨?";
      if (count >= 4) {
        message = "그만 눌러… 🫠";
        setSocialPose("lie");
        sound("ppu");
        window.setTimeout(() => setSocialPose(null), 1600);
      } else if (count >= 2) {
        message = "뀨앙! ✨";
        sound("kyuang");
      } else {
        sound("kyu");
      }
      setBubble(message);
      if (connected)
        void channel.current?.send({
          type: "broadcast",
          event: "gesture",
          payload: {
            id: presenceIdRef.current,
            zone,
            ...player.current,
            bubble: message,
            dancing: false,
          },
        });
    }, 260);
  };

  const walkTo = useCallback((point: Position) => {
    destination.current = walkablePoint(point, zoneRef.current);
    setWalking(true);
    setSunsetWatching(false);
  }, []);

  const changeZone = useCallback(
    (next: Zone) => {
      if (guest) {
        onExplore?.();
        return;
      }
      zoneRef.current = next;
      switchMusic(next);
      setZone(next);
      const start =
        next === "club"
          ? CLUB_START
          : next === "spring"
            ? SPRING_START
            : next === "library-yard"
              ? LIBRARY_YARD_START
              : next === "library"
                ? LIBRARY_START
                : next === "beach"
                  ? BEACH_START
                  : START;
      player.current = start;
      destination.current = start;
      heldKeys.current.clear();
      padDirection.current = null;
      setPosition(start);
      setNeighbors([]);
      setBubble("");
      setDancing(false);
      setGuardOpen(false);
      setGuardStep("hello");
      setCharmPhase(0);
      setDoorHint("");
      setBartenderOpen(false);
      setBarStep("hello");
      setSocialTarget(null);
      setSocialPose(null);
      setNpcBubble("");
      setNpcBubbleFor(null);
      setOrangeTarget(next === "spring" ? "self" : null);
      setLibraryNotesOpen(false);
      setLibraryAction(null);
      setBookStack(0);
      setSunsetWatching(false);
      markActive();
      facingRef.current = 0;
      setFacing(0);
      moveSpeed.current = 0;
    },
    [guest, onExplore, markActive, switchMusic],
  );

  const requestClubEntry = useCallback(() => {
    if (guest) {
      onExplore?.();
      return;
    }
    destination.current = { ...player.current };
    moveSpeed.current = 0;
    setWalking(false);
    setDoorScenario(doorVisits.current % 2 ? "password" : "charm");
    setGuardStep("hello");
    setCharmPhase(0);
    setDoorHint("");
    setGuardOpen(true);
    const club = new Image();
    club.src = "/capy-world/club-v3.avif";
    const dj = new Image();
    dj.src = "/capy-world/animal/dj-v1.webp";
    const bartender = new Image();
    bartender.src = "/capy-world/animal/bartender-v1.webp";
  }, [guest, onExplore]);

  useEffect(() => {
    if (
      !guest &&
      zone === "village" &&
      !guardOpen &&
      position.y <= 49 &&
      position.x >= 44 &&
      position.x <= 56
    ) {
      requestClubEntry();
    }
  }, [position, zone, guest, guardOpen, requestClubEntry]);

  useEffect(() => {
    if (!guest && zone === "village" && position.x <= 9 && position.y >= 53)
      changeZone("library-yard");
  }, [guest, zone, position, changeZone]);

  useEffect(() => {
    if (!guest && zone === "village" && position.x >= 91 && position.y >= 53)
      changeZone("beach");
  }, [guest, zone, position, changeZone]);

  const finishCharm = () => {
    setCharmPhase(4);
    setDancing(false);
    setGuardStep("success");
  };

  const charmGuard = () => {
    setGuardStep("charming");
    setCharmPhase(1);
    setBubble("뀨우우… 🌺");
    setDancing(true);
  };

  useEffect(() => {
    if (guardStep !== "charming") return;
    const timers = [
      window.setTimeout(() => setCharmPhase(2), 1100),
      window.setTimeout(() => setCharmPhase(3), 2500),
      window.setTimeout(finishCharm, 4500),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [guardStep]);

  const enterApprovedClub = () => {
    doorVisits.current += 1;
    changeZone("club");
  };

  const choosePassword = (correct: boolean) => {
    if (correct) {
      setDoorHint("");
      setBubble("꾸물꾸물 둠칫둠칫 ✨");
      setGuardStep("success");
      return;
    }
    setDoorHint("모카가 고개를 젓는다. 리듬은 맞는데… 뭔가 다르다.");
    setBubble("…아닌가? 🥲");
  };

  const askBartender = () => {
    destination.current = { ...player.current };
    moveSpeed.current = 0;
    setWalking(false);
    setBarStep("hello");
    setBartenderOpen(true);
  };

  const wriggleForDrink = () => {
    setBarStep("wriggling");
    setBubble("꾸물… 꾸물꾸물… 🍹");
  };

  useEffect(() => {
    if (barStep !== "wriggling") return;
    const timer = window.setTimeout(() => {
      setBarStep("served");
      setDrinkCount((current) => current + 1);
      setBubble("노을 거품주 받았다! 🍹");
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [barStep]);

  const discoverSpring = () => {
    markActive();
    if (springDiscovered) {
      changeZone("spring");
      return;
    }
    const next = springClues + 1;
    setSpringClues(next);
    setBubble(
      next === 1
        ? "어디선가 따뜻한 김이 나…"
        : next === 2
          ? "바위 안쪽에서 물소리가 들려!"
          : "비밀 온천을 찾았다! ♨️",
    );
    if (next >= 3) {
      setSpringDiscovered(true);
      try {
        localStorage.setItem("capybara-story-spring-v1", "true");
      } catch {}
      const spring = new Image();
      spring.src = "/capy-world/hot-spring-v1.webp";
    }
  };

  const openSocial = (
    event: React.MouseEvent<HTMLElement>,
    target: { id: string; name: string; x: number; y: number },
  ) => {
    event.stopPropagation();
    markActive();
    setSocialTarget(target);
    setNpcBubble("");
    setNpcBubbleFor(null);
  };

  const performSocial = (action: SocialAction) => {
    if (!socialTarget) return;
    markActive();
    destination.current = walkablePoint(
      { x: socialTarget.x - 7, y: socialTarget.y + 1 },
      zoneRef.current,
    );
    setWalking(true);
    setSocialPose(action);
    const messages: Record<SocialAction, [string, string]> = {
      lie: ["말없이 옆에 누웠다…", "…편안해"],
      nose: ["코 톡!", "뀨? 🌺"],
      orange: ["귤 올려줄게 🍊", "가만히 있어볼게…"],
      chin: ["등에 턱 좀 빌릴게", "무거운데 따뜻해…"],
      follow: ["천천히 따라갈게", "같이 꾸물꾸물"],
      gaze: ["……", "……"],
      chorus: ["뀨앙—!", "뀨아앙—!"],
    };
    const [mine, theirs] = messages[action];
    setBubble(mine);
    setNpcBubble(theirs);
    setNpcBubbleFor(socialTarget.id);
    if (action === "orange") setOrangeTarget(socialTarget.id);
    if (action === "chorus") {
      setChorusCount((count) => count + 1);
      sound(zone === "spring" ? "echo" : "chorus");
    }
    if (connected)
      void channel.current?.send({
        type: "broadcast",
        event: "social",
        payload: {
          id: presenceIdRef.current,
          zone,
          targetId: socialTarget.id,
          action,
          bubble: mine,
        },
      });
    setSocialTarget(null);
    window.setTimeout(
      () => {
        setSocialPose(null);
        setNpcBubble("");
        setNpcBubbleFor(null);
      },
      action === "follow" ? 6000 : 3600,
    );
  };

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
      if ((event.target as HTMLElement)?.closest?.(".capy-library-overlay"))
        return;
      if (
        /^(INPUT|TEXTAREA|SELECT)$/.test((event.target as HTMLElement)?.tagName)
      )
        return;
      if (
        event.code === "Space" &&
        !event.repeat &&
        !(event.target as HTMLElement)?.closest("button, a")
      ) {
        event.preventDefault();
        jumpActionRef.current();
        return;
      }
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
    const timeout = window.setTimeout(
      () => setBubble(""),
      barStep === "wriggling" ? 3400 : 2400,
    );
    return () => window.clearTimeout(timeout);
  }, [bubble, barStep]);

  useEffect(() => {
    if (zone !== "library" || bookStack < 5) return;
    setBubble("와르르! 모두 모른 척… 🫣");
    const timer = window.setTimeout(() => setBookStack(0), 1700);
    return () => window.clearTimeout(timer);
  }, [zone, bookStack]);

  useEffect(() => {
    if (!guest) switchMusic(zone, clubGenre);
  }, [guest, zone, clubGenre, switchMusic]);

  useEffect(() => {
    if (guest || !musicOn) return;
    const resume = (event: Event) => {
      if ((event.target as HTMLElement)?.closest?.("[data-music-control]"))
        return;
      if (musicRef.current?.paused) playMusic();
    };
    window.addEventListener("pointerdown", resume, true);
    window.addEventListener("keydown", resume, true);
    return () => {
      window.removeEventListener("pointerdown", resume, true);
      window.removeEventListener("keydown", resume, true);
    };
  }, [guest, musicOn, playMusic]);

  const changeClubGenre = () => {
    const next = clubGenre === "house" ? "edm" : "house";
    setClubGenre(next);
    switchMusic("club", next);
  };

  useEffect(() => {
    if (!supabase || guest) return;
    const client = supabase;
    const presenceId = presenceIdRef.current;
    const room = client.channel("capy-public:plaza", {
      config: { private: false, presence: { key: presenceId } },
    });
    channel.current = room;
    let subscribed = false;
    let disposed = false;
    let retryTimer: number | undefined;
    setConnectionTimedOut(false);
    const retry = () => {
      if (disposed || retryTimer !== undefined) return;
      subscribed = false;
      setConnected(false);
      setConnectionTimedOut(true);
      setNeighbors([]);
      retryTimer = window.setTimeout(() => {
        setReconnectAttempt((attempt) => attempt + 1);
      }, 3000);
    };
    const visiblePeer = (peer: Neighbor) =>
      peer.id &&
      peer.id !== presenceId &&
      peer.zone === zoneRef.current &&
      Number.isFinite(peer.x) &&
      Number.isFinite(peer.y);
    const updateNeighbors = () => {
      const peers = Object.values(
        room.presenceState(),
      ).flat() as unknown as Neighbor[];
      setNeighbors(
        peers.filter(visiblePeer).map((peer) => ({
          id: peer.id,
          name: peer.name ?? "카피바라",
          zone: peer.zone,
          x: clamp(
            peer.x,
            peer.zone === "spring" ? 17 : peer.zone === "club" ? 14 : 8,
            peer.zone === "spring" ? 83 : peer.zone === "club" ? 86 : 92,
          ),
          y: clamp(peer.y, peer.zone === "spring" ? 49 : 38, 92),
          facing: peer.facing ?? 0,
          idleState: peer.idleState ?? 0,
          orange: !!peer.orange,
          sunsetWatching: !!peer.sunsetWatching,
        })),
      );
    };
    updateNeighborsRef.current = updateNeighbors;
    room
      .on("presence", { event: "sync" }, updateNeighbors)
      .on("broadcast", { event: "walk" }, ({ payload }) => {
        const peer = payload as Neighbor;
        if (!visiblePeer(peer)) return;
        setNeighbors((current) =>
          current.map((item) =>
            item.id === peer.id
              ? {
                  ...item,
                  x: clamp(
                    peer.x,
                    peer.zone === "spring" ? 17 : peer.zone === "club" ? 14 : 8,
                    peer.zone === "spring"
                      ? 83
                      : peer.zone === "club"
                        ? 86
                        : 92,
                  ),
                  y: clamp(peer.y, peer.zone === "spring" ? 49 : 38, 92),
                  facing: peer.facing ?? item.facing,
                  walking: true,
                }
              : item,
          ),
        );
        const previousTimer = remoteIdleTimers.current.get(peer.id);
        if (previousTimer) window.clearTimeout(previousTimer);
        remoteIdleTimers.current.set(
          peer.id,
          window.setTimeout(() => {
            setNeighbors((current) =>
              current.map((item) =>
                item.id === peer.id ? { ...item, walking: false } : item,
              ),
            );
            remoteIdleTimers.current.delete(peer.id);
          }, 260),
        );
      })
      .on("broadcast", { event: "sunset" }, ({ payload }) => {
        const peer = payload as Neighbor;
        if (!visiblePeer(peer)) return;
        setNeighbors((current) =>
          current.map((item) =>
            item.id === peer.id
              ? {
                  ...item,
                  x: peer.x,
                  y: peer.y,
                  sunsetWatching: true,
                  walking: false,
                }
              : item,
          ),
        );
      })
      .on("broadcast", { event: "jump" }, ({ payload }) => {
        const peer = payload as { id?: string; zone?: Zone };
        if (!peer.id || peer.id === presenceId || peer.zone !== zoneRef.current)
          return;
        setNeighbors((current) =>
          current.map((item) =>
            item.id === peer.id ? { ...item, jumping: true } : item,
          ),
        );
        const previousTimer = remoteJumpTimers.current.get(peer.id);
        if (previousTimer) window.clearTimeout(previousTimer);
        remoteJumpTimers.current.set(
          peer.id,
          window.setTimeout(() => {
            setNeighbors((current) =>
              current.map((item) =>
                item.id === peer.id ? { ...item, jumping: false } : item,
              ),
            );
            remoteJumpTimers.current.delete(peer.id!);
          }, 680),
        );
      })
      .on("broadcast", { event: "gesture" }, ({ payload }) => {
        const peer = payload as Neighbor;
        if (!visiblePeer(peer) || !peer.bubble) return;
        setNeighbors((current) =>
          current.map((item) =>
            item.id === peer.id
              ? {
                  ...item,
                  bubble: peer.bubble,
                  dancing: !!peer.dancing,
                  libraryAction: peer.libraryAction,
                }
              : item,
          ),
        );
        window.setTimeout(
          () =>
            setNeighbors((current) =>
              current.map((item) =>
                item.id === peer.id
                  ? { ...item, bubble: undefined, libraryAction: undefined }
                  : item,
              ),
            ),
          2400,
        );
      })
      .on("broadcast", { event: "library-note" }, () => {
        setNotesRefresh((value) => value + 1);
      })
      .on("broadcast", { event: "library-stack" }, ({ payload }) => {
        const event = payload as { zone?: Zone };
        if (zoneRef.current !== "library" || event.zone !== "library") return;
        setBookStack((current) => Math.min(5, current + 1));
      })
      .on("broadcast", { event: "library-stack-request" }, ({ payload }) => {
        const event = payload as { id?: string; zone?: Zone };
        if (
          zoneRef.current !== "library" ||
          event.zone !== "library" ||
          !event.id ||
          event.id === presenceId
        )
          return;
        void room.send({
          type: "broadcast",
          event: "library-stack-state",
          payload: {
            target: event.id,
            zone: "library",
            count: bookStackRef.current,
          },
        });
      })
      .on("broadcast", { event: "library-stack-state" }, ({ payload }) => {
        const event = payload as {
          target?: string;
          zone?: Zone;
          count?: number;
        };
        if (
          zoneRef.current !== "library" ||
          event.target !== presenceId ||
          event.zone !== "library" ||
          typeof event.count !== "number"
        )
          return;
        setBookStack((current) => Math.max(current, clamp(event.count!, 0, 5)));
      })
      .on("broadcast", { event: "social" }, ({ payload }) => {
        const event = payload as {
          id?: string;
          zone?: Zone;
          targetId?: string;
          action?: SocialAction;
          bubble?: string;
        };
        if (
          !event.id ||
          event.id === presenceId ||
          event.zone !== zoneRef.current
        )
          return;
        setNeighbors((current) =>
          current.map((item) =>
            item.id === event.id
              ? {
                  ...item,
                  bubble: event.bubble,
                  dancing: event.action === "chorus",
                  orange: event.action === "orange" ? true : item.orange,
                }
              : item,
          ),
        );
        if (event.targetId === presenceId) {
          setBubble(
            event.action === "orange"
              ? "머리에 귤이 올라왔다 🍊"
              : "친구가 천천히 다가왔다…",
          );
          if (event.action === "orange") setOrangeTarget("self");
        }
      })
      .subscribe(async (status) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          if (retryTimer !== undefined) window.clearTimeout(retryTimer);
          retryTimer = undefined;
          subscribed = true;
          setConnected(true);
          setConnectionTimedOut(false);
          await room.track({
            id: presenceId,
            name: presenceNameRef.current,
            zone: zoneRef.current,
            ...player.current,
            facing: facingRef.current,
            idleState: idlePhaseRef.current,
            orange: orangeRef.current,
            sunsetWatching: false,
          });
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          retry();
        }
      });
    const connectionTimer = window.setTimeout(() => {
      if (!subscribed) retry();
    }, 8000);
    return () => {
      disposed = true;
      window.clearTimeout(connectionTimer);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      for (const timer of remoteIdleTimers.current.values())
        window.clearTimeout(timer);
      remoteIdleTimers.current.clear();
      for (const timer of remoteJumpTimers.current.values())
        window.clearTimeout(timer);
      remoteJumpTimers.current.clear();
      channel.current = null;
      updateNeighborsRef.current = () => {};
      void client.removeChannel(room);
      setConnected(false);
      setConnectionTimedOut(false);
      setNeighbors([]);
    };
  }, [guest, reconnectAttempt]);

  useEffect(() => {
    if (connected) {
      void channel.current?.track({
        id: presenceIdRef.current,
        name: presenceName,
        zone,
        ...player.current,
        facing: facingRef.current,
        idleState: idlePhase,
        orange: orangeTarget === "self" || zone === "spring",
        sunsetWatching,
      });
    }
  }, [
    zone,
    connected,
    presenceName,
    idlePhase,
    orangeTarget,
    walking,
    sunsetWatching,
  ]);

  useEffect(() => {
    if (connected) updateNeighborsRef.current();
  }, [zone, connected]);

  useEffect(() => {
    if (zone !== "library" || !connected) return;
    void channel.current?.send({
      type: "broadcast",
      event: "library-stack-request",
      payload: { id: presenceIdRef.current, zone: "library" },
    });
  }, [zone, connected]);

  useEffect(() => {
    if (
      !connected ||
      !channel.current ||
      performance.now() - lastSent.current < 140
    )
      return;
    lastSent.current = performance.now();
    void channel.current.send({
      type: "broadcast",
      event: "walk",
      payload: {
        id: presenceIdRef.current,
        zone,
        ...position,
        facing,
      },
    });
  }, [position, facing, connected, zone]);

  const gesture = (message: string, dance = false) => {
    setBubble(message);
    if (dance) setDancing((current) => !current);
    if (connected)
      void channel.current?.send({
        type: "broadcast",
        event: "gesture",
        payload: {
          id: presenceIdRef.current,
          zone,
          ...player.current,
          bubble: message,
          dancing: dance ? !dancing : dancing,
        },
      });
  };

  const doLibraryAction = (action: LibraryAction) => {
    if (libraryActionTimer.current)
      window.clearTimeout(libraryActionTimer.current);
    setLibraryAction(action);
    const message =
      action === "reading"
        ? "한 장만 더 읽을게… 📖"
        : action === "napping"
          ? "꾸벅… 쿵! 😴"
          : action === "snacking"
            ? "사서 몰래 귤 한 입 🍊"
            : "책을 살포시 얹었다 📚";
    setBubble(message);
    if (action === "snacking") {
      setNpcBubble("쉿! …음? 귤 냄새?");
      setNpcBubbleFor("librarian");
      window.setTimeout(() => {
        setNpcBubble("…드르렁");
      }, 1500);
      window.setTimeout(() => {
        setNpcBubble("");
        setNpcBubbleFor(null);
      }, 3300);
    }
    if (connected)
      void channel.current?.send({
        type: "broadcast",
        event: "gesture",
        payload: {
          id: presenceIdRef.current,
          zone,
          ...player.current,
          bubble: message,
          libraryAction: action,
        },
      });
    libraryActionTimer.current = window.setTimeout(
      () => setLibraryAction(null),
      2600,
    );
  };

  const stackBook = () => {
    if (bookStack >= 5) return;
    doLibraryAction("stacking");
    setBookStack((current) => Math.min(5, current + 1));
    if (connected)
      void channel.current?.send({
        type: "broadcast",
        event: "library-stack",
        payload: { zone: "library" },
      });
  };

  const watchSunset = () => {
    const participants = [
      presenceIdRef.current,
      ...neighbors.map((neighbor) => neighbor.id),
    ].sort();
    const spot = {
      x:
        50 +
        (participants.indexOf(presenceIdRef.current) -
          (participants.length - 1) / 2) *
          6,
      y: 81,
    };
    player.current = spot;
    destination.current = spot;
    setPosition(spot);
    setWalking(false);
    setSunsetWatching(true);
    gesture("같이 노을 볼래? 🌅");
    if (connected)
      void channel.current?.send({
        type: "broadcast",
        event: "sunset",
        payload: {
          id: presenceIdRef.current,
          zone: "beach",
          ...spot,
        },
      });
  };

  const swimOrReturn = () => {
    const swimming = position.y < 78;
    walkTo({ x: position.x, y: swimming ? 86 : 55 });
    gesture(swimming ? "모래사장으로 꾸물꾸물 🐾" : "첨벙! 바다로 간다 💦");
  };

  const goLighthouse = () => {
    walkTo({ x: 84, y: 57 });
    gesture("등대 불빛을 따라 헤엄헤엄 ✨");
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

  const cameraFocus =
    zone === "club"
      ? CLUB_START
      : zone === "spring"
        ? SPRING_START
        : zone === "library-yard"
          ? LIBRARY_YARD_START
          : zone === "library"
            ? LIBRARY_START
            : zone === "beach"
              ? BEACH_START
              : START;
  const cameraY = reducedMotion
    ? 0
    : clamp((cameraFocus.y - position.y) * 0.3, -8, 8);
  const horizontalTravel = Math.max(
    0,
    (mapSize.width - mapSize.viewportWidth) / 2,
  );
  const cameraX = clamp(
    (0.5 - position.x / 100) * mapSize.width,
    -horizontalTravel,
    horizontalTravel,
  );
  const swimming = zone === "beach" && position.y < 78;
  const sunsetCount =
    Number(sunsetWatching) +
    neighbors.filter((neighbor) => neighbor.sunsetWatching).length;

  return (
    <section
      className={`capy-plaza ${guest ? "is-guest" : ""} is-${zone}`}
      aria-label={
        zone === "club"
          ? "카피바라 클럽"
          : zone === "spring"
            ? "비밀 귤 온천"
            : zone === "library-yard"
              ? "꾸벅 도서관 앞마당"
              : zone === "library"
                ? "꾸벅 도서관"
                : zone === "beach"
                  ? "등대 해변"
                  : "카피바라 마을 광장"
      }
    >
      <audio ref={musicRef} loop preload="none" aria-hidden="true" />
      <div
        ref={map}
        className="capy-map"
        style={{
          transform: `translate(calc(-50% + ${cameraX}px), calc(-50% + ${cameraY}dvh))`,
        }}
        onClick={handleMapClick}
      >
        <div className="capy-sky-glow" />
        <div className="capy-atmosphere" aria-hidden="true" />
        {zone === "village" && (
          <div className="capy-village-foreground" aria-hidden="true" />
        )}
        {zone === "village" ? (
          <>
            <button
              className="capy-club-entrance"
              aria-label="카피바라 클럽 입장"
              onClick={(event) => {
                event.stopPropagation();
                requestClubEntry();
              }}
            >
              <span>
                🪩 클럽 입장 <ArrowRight size={16} />
              </span>
            </button>
            <button
              className="capy-guard"
              aria-label="클럽 가드 모카에게 말 걸기"
              onClick={(event) => {
                event.stopPropagation();
                requestClubEntry();
              }}
            >
              <img
                src="/capy-world/animal/guard-v2.webp"
                alt="산호 장식 창을 든 클럽 가드 모카"
              />
              <span>가드 모카</span>
            </button>
            <button
              className={`capy-neighbor capy-neighbor-one ${socialTarget?.id === "lilac" ? "is-selected" : ""} ${socialPose === "lie" ? "is-social-lying" : ""}`}
              aria-label="라일락과 교감하기"
              onClick={(event) =>
                openSocial(event, {
                  id: "lilac",
                  name: "라일락",
                  x: 29,
                  y: 67,
                })
              }
            >
              {npcBubble && npcBubbleFor === "lilac" && (
                <i className="capy-npc-bubble">{npcBubble}</i>
              )}
              {orangeTarget === "lilac" && (
                <i className="capy-orange" aria-label="머리 위의 귤">
                  🍊
                </i>
              )}
              <img src={animalSprite} alt="" />
              <span>라일락</span>
            </button>
            <button
              className={`capy-spring-secret ${springDiscovered ? "is-discovered" : ""} is-clue-${springClues}`}
              aria-label={
                springDiscovered
                  ? "비밀 귤 온천 들어가기"
                  : "김이 나는 수상한 바위 살펴보기"
              }
              onClick={(event) => {
                event.stopPropagation();
                discoverSpring();
              }}
            >
              <i aria-hidden="true">♨</i>
              <span>수상한 바위</span>
            </button>
            <button
              className="capy-library-path"
              aria-label="왼쪽 꽃길로 꾸벅 도서관 가기"
              onClick={(event) => {
                event.stopPropagation();
                changeZone("library-yard");
              }}
            >
              <span>← 꾸벅 도서관</span>
            </button>
            <button
              className="capy-beach-path"
              aria-label="오른쪽 바닷길로 등대 해변 가기"
              onClick={(event) => {
                event.stopPropagation();
                changeZone("beach");
              }}
            >
              <span>등대 해변 →</span>
            </button>
          </>
        ) : zone === "club" ? (
          <>
            <div
              className={`capy-dj ${musicOn && !musicBlocked ? "is-live" : ""}`}
            >
              <img src="/capy-world/animal/dj-v1.webp" alt="" />
              <span>DJ 밤톨</span>
            </div>
            <button
              className={`capy-bartender ${barStep === "wriggling" ? "is-watching" : ""}`}
              aria-label="바텐더 카피바라 코코에게 주문하기"
              onClick={(event) => {
                event.stopPropagation();
                askBartender();
              }}
            >
              <img src="/capy-world/animal/bartender-v1.webp" alt="" />
              <span>바텐더 코코</span>
            </button>
            <button
              className="capy-neighbor capy-club-dancer-one"
              aria-label="라일락과 교감하기"
              onClick={(event) =>
                openSocial(event, {
                  id: "lilac",
                  name: "라일락",
                  x: 38,
                  y: 70,
                })
              }
            >
              {npcBubble && npcBubbleFor === "lilac" && (
                <i className="capy-npc-bubble">{npcBubble}</i>
              )}
              {orangeTarget === "lilac" && <i className="capy-orange">🍊</i>}
              <img src={animalSprite} alt="" />
              <span>라일락</span>
            </button>
            <button
              className="capy-neighbor capy-club-dancer-two"
              aria-label="모카와 교감하기"
              onClick={(event) =>
                openSocial(event, {
                  id: "moka",
                  name: "모카",
                  x: 64,
                  y: 70,
                })
              }
            >
              {npcBubble && npcBubbleFor === "moka" && (
                <i className="capy-npc-bubble">{npcBubble}</i>
              )}
              {orangeTarget === "moka" && <i className="capy-orange">🍊</i>}
              <img src={animalSprite} alt="" />
              <span>모카</span>
            </button>
          </>
        ) : zone === "library-yard" ? (
          <>
            <button
              className="capy-library-door"
              aria-label="꾸벅 도서관에 들어가기"
              onClick={(event) => {
                event.stopPropagation();
                changeZone("library");
              }}
            >
              <span>📖 들어가기</span>
            </button>
            <button
              className="capy-library-trail"
              aria-label="꽃길을 따라 노을 마을로 돌아가기"
              onClick={(event) => {
                event.stopPropagation();
                changeZone("village");
              }}
            >
              <span>← 마을 꽃길</span>
            </button>
          </>
        ) : zone === "library" ? (
          <>
            <button
              className="capy-library-shelf"
              aria-label="벽 책장에서 노트 읽고 남기기"
              onClick={(event) => {
                event.stopPropagation();
                setLibraryNotesOpen(true);
              }}
            >
              <span>📚 책장 · 노트 남기기</span>
            </button>
            <button
              className="capy-library-librarian"
              aria-label="꾸벅꾸벅 조는 사서에게 말 걸기"
              onClick={(event) => {
                event.stopPropagation();
                setNpcBubble("쉿… 드르렁…");
                setNpcBubbleFor("librarian");
              }}
            >
              {npcBubbleFor === "librarian" && npcBubble && (
                <i className="capy-npc-bubble">{npcBubble}</i>
              )}
              <img
                src="/capy-world/animal/librarian-seated-v1.webp"
                alt="의자에 앉아 책을 읽다 조는 카피바라 사서"
              />
              <span>사서 꾸벅</span>
            </button>
            <button
              className={`capy-library-stack ${bookStack >= 5 ? "is-falling" : ""}`}
              aria-label="책 탑에 책 한 권 얹기"
              onClick={(event) => {
                event.stopPropagation();
                stackBook();
              }}
            >
              <span className="capy-stack-books">
                {"📚".repeat(Math.max(1, bookStack))}
              </span>
              <span>책 탑 {bookStack}/5</span>
            </button>
          </>
        ) : zone === "beach" ? (
          <>
            <button
              className="capy-beach-bench"
              aria-label="친구와 나란히 노을 바라보기"
              onClick={(event) => {
                event.stopPropagation();
                watchSunset();
              }}
            >
              <span>
                🌅 함께 노을 보기{sunsetCount > 0 ? ` · ${sunsetCount}명` : ""}
              </span>
            </button>
            <button
              className="capy-beach-shore"
              aria-label="해변 바다로 헤엄치기"
              onClick={(event) => {
                event.stopPropagation();
                swimOrReturn();
              }}
            >
              <span>물결을 따라 헤엄치기 💦</span>
            </button>
          </>
        ) : (
          <>
            <div className="capy-spring-steam" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <button
              className="capy-neighbor capy-spring-friend-one"
              aria-label="귤이와 온천 교감하기"
              onClick={(event) =>
                openSocial(event, {
                  id: "gyul",
                  name: "귤이",
                  x: 34,
                  y: 67,
                })
              }
            >
              {npcBubble && npcBubbleFor === "gyul" && (
                <i className="capy-npc-bubble">{npcBubble}</i>
              )}
              <i className="capy-orange">🍊</i>
              <img src={animalSprite} alt="" />
              <span>귤이</span>
            </button>
            <button
              className="capy-neighbor capy-spring-friend-two"
              aria-label="보글이와 온천 교감하기"
              onClick={(event) =>
                openSocial(event, {
                  id: "bubble",
                  name: "보글이",
                  x: 66,
                  y: 69,
                })
              }
            >
              {npcBubble && npcBubbleFor === "bubble" && (
                <i className="capy-npc-bubble">{npcBubble}</i>
              )}
              <i className="capy-orange">🍊</i>
              <img src={animalSprite} alt="" />
              <span>보글이</span>
            </button>
          </>
        )}
        {!guest && (
          <div
            className={`capy-player is-local ${walking ? "is-walking" : ""} ${jumping ? "is-jumping" : ""} ${dancing ? "is-dancing" : ""} ${guardStep === "charming" ? "is-charming" : ""} ${barStep === "wriggling" ? "is-bar-wriggling" : ""} ${puffing ? "is-puffing" : ""} ${idlePhase ? `is-idle-${idlePhase}` : ""} ${socialPose ? `is-social-${socialPose}` : ""} ${libraryAction ? `is-library-${libraryAction}` : ""} ${zone === "spring" ? "is-soaking" : ""} ${swimming ? "is-swimming" : ""} ${sunsetWatching ? "is-sunset-watching" : ""}`}
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              zIndex: Math.round(position.y),
            }}
            aria-label="내 카피바라"
            role="button"
            tabIndex={0}
            onPointerDown={startSelfPress}
            onPointerUp={endSelfPress}
            onPointerCancel={endSelfPress}
            onClick={clickSelf}
          >
            <i className="capy-contact-shadow" aria-hidden="true" />
            {bubble && <span className="capy-bubble">{bubble}</span>}
            {idlePhase >= 3 && idlePhase < 4 && (
              <i className="capy-butterfly" aria-label="카피바라에게 앉은 나비">
                🦋
              </i>
            )}
            {idlePhase >= 4 && (
              <i className="capy-sleep" aria-label="졸고 있음">
                z z z
              </i>
            )}
            {(orangeTarget === "self" || zone === "spring") && (
              <i className="capy-orange" aria-label="머리 위의 귤">
                🍊
              </i>
            )}
            <img
              src={swimming ? swimmingSprite : walkingSprite(facing).src}
              style={{ scale: walkingSprite(facing).flip ? "-1 1" : undefined }}
              alt=""
              draggable={false}
            />
            <span className="capy-name">{nickname || "나"}</span>
            {chorusCount >= 2 && (
              <span className="capy-chorus-sticker">카피바라 합창단 ✦</span>
            )}
            {guardStep === "charming" && (
              <div className="capy-map-charm" aria-live="polite">
                <div aria-hidden="true">
                  <i>♥</i>
                  <i>✦</i>
                  <i>✿</i>
                </div>
                <small>귀여움 측정 중</small>
                <span>
                  <i
                    style={{
                      width: `${[0, 24, 52, 86, 100][charmPhase]}%`,
                    }}
                  />
                </span>
                <strong>
                  {charmPhase < 2
                    ? "납작…"
                    : charmPhase < 3
                      ? "꾸물꾸물…"
                      : "귀여움 120%"}
                </strong>
                <button onClick={finishCharm}>건너뛰기</button>
              </div>
            )}
          </div>
        )}
        {neighbors.map((neighbor) => (
          <div
            key={neighbor.id}
            className={`capy-player capy-remote ${neighbor.walking ? "is-walking" : ""} ${neighbor.jumping ? "is-jumping" : ""} ${neighbor.dancing ? "is-dancing" : ""} ${neighbor.libraryAction ? `is-library-${neighbor.libraryAction}` : ""} ${neighbor.idleState ? `is-idle-${neighbor.idleState}` : ""} ${zone === "beach" && neighbor.y < 78 ? "is-swimming" : ""} ${neighbor.sunsetWatching ? "is-sunset-watching" : ""}`}
            style={{
              left: `${neighbor.x}%`,
              top: `${neighbor.y}%`,
              zIndex: Math.round(neighbor.y),
            }}
            role="button"
            tabIndex={0}
            aria-label={`${neighbor.name}과 교감하기`}
            onClick={(event) =>
              openSocial(event, {
                id: neighbor.id,
                name: neighbor.name,
                x: neighbor.x,
                y: neighbor.y,
              })
            }
          >
            <i className="capy-contact-shadow" aria-hidden="true" />
            {neighbor.bubble && (
              <span className="capy-bubble">{neighbor.bubble}</span>
            )}
            {(neighbor.orange || zone === "spring") && (
              <i className="capy-orange">🍊</i>
            )}
            <img
              src={
                zone === "beach" && neighbor.y < 78
                  ? swimmingSprite
                  : walkingSprite(neighbor.facing).src
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

      {zone === "library" && libraryNotesOpen && (
        <LibraryNotes
          nickname={presenceName}
          visitorId={presenceIdRef.current}
          refreshToken={notesRefresh}
          onPosted={() => {
            if (connected)
              void channel.current?.send({
                type: "broadcast",
                event: "library-note",
                payload: { zone: "library" },
              });
          }}
          onClose={() => setLibraryNotesOpen(false)}
        />
      )}

      {zone === "village" && guardOpen && guardStep !== "charming" && (
        <div className="capy-guard-dialogue" role="dialog" aria-modal="true">
          <img
            src="/capy-world/animal/guard-card-v1.webp"
            alt="선글라스를 쓴 클럽 가드 모카"
          />
          <div>
            <small>CAPY CLUB · {doorScenarios[doorScenario].label}</small>
            <strong>가드 모카</strong>
            <p>
              {guardStep === "hello"
                ? doorScenarios[doorScenario].intro
                : guardStep === "challenge"
                  ? doorScenarios[doorScenario].challenge
                  : doorScenarios[doorScenario].success}
            </p>
            {doorHint && <em className="capy-door-hint">{doorHint}</em>}
            <div className="capy-guard-dialogue-actions">
              {guardStep === "hello" && (
                <button onClick={() => setGuardStep("challenge")}>
                  모카에게 말 걸기
                </button>
              )}
              {guardStep === "challenge" && doorScenario === "charm" && (
                <button className="is-charm" onClick={charmGuard}>
                  🌺 배를 바닥에 붙이고 애교 부리기
                </button>
              )}
              {guardStep === "challenge" &&
                doorScenario === "password" &&
                doorScenarios.password.choices?.map((choice) => (
                  <button
                    key={choice.label}
                    className="is-password"
                    onClick={() => choosePassword(choice.correct)}
                  >
                    {choice.label}
                  </button>
                ))}
              {guardStep === "success" && doorScenario === "charm" && (
                <button className="is-quiet" onClick={charmGuard}>
                  애교 한 번 더 보기
                </button>
              )}
              {guardStep === "success" && (
                <button className="is-enter" onClick={enterApprovedClub}>
                  🪩 클럽 입장
                </button>
              )}
              {guardStep !== "success" && (
                <button
                  className="is-quiet"
                  onClick={() => setGuardOpen(false)}
                >
                  다음에 올게
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {zone === "club" && bartenderOpen && (
        <div className="capy-bar-dialogue" role="dialog" aria-modal="false">
          <small>COCO&apos;S BAR · 오늘의 주문법</small>
          <strong>바텐더 코코</strong>
          <p>
            {barStep === "hello"
              ? "여긴 돈보다 리듬을 받아. 바닥에 배 붙이고 세 번만 꾸물거려 봐."
              : barStep === "wriggling"
                ? "하나… 둘… 꾸물… 좋아, 거품이 올라온다."
                : `완벽한 꾸물거림이었어. 노을 거품주 ${drinkCount}잔째야. 천천히 즐겨.`}
          </p>
          <div>
            {barStep !== "wriggling" && (
              <button onClick={wriggleForDrink}>
                {barStep === "served"
                  ? "한 잔 더 꾸물거리기"
                  : "꾸물거려서 주문하기"}
              </button>
            )}
            {barStep === "wriggling" && <b>꾸물거림 감별 중 ···</b>}
            <button
              className="is-quiet"
              onClick={() => setBartenderOpen(false)}
            >
              바에서 나오기
            </button>
          </div>
        </div>
      )}

      {socialTarget && (
        <div className="capy-social-menu" role="dialog" aria-modal="false">
          <small>SLOW SOCIAL · {socialTarget.name}</small>
          <strong>어떻게 천천히 다가갈까?</strong>
          <div>
            <button onClick={() => performSocial("lie")}>옆에 눕기</button>
            <button onClick={() => performSocial("nose")}>코 맞대기</button>
            <button onClick={() => performSocial("orange")}>귤 올려주기</button>
            <button onClick={() => performSocial("chin")}>턱 기대기</button>
            <button onClick={() => performSocial("follow")}>
              따라 꾸물거리기
            </button>
            <button onClick={() => performSocial("gaze")}>
              말없이 바라보기
            </button>
            <button
              className="is-chorus"
              onClick={() => performSocial("chorus")}
            >
              같이 뀨앙하기
            </button>
            <button className="is-quiet" onClick={() => setSocialTarget(null)}>
              가만히 있기
            </button>
          </div>
        </div>
      )}

      {!guest && nicknameOpen && (
        <form className="capy-nickname-card" onSubmit={saveNickname}>
          <button
            type="button"
            className="capy-nickname-close"
            aria-label="닉네임 설정 닫기"
            onClick={() => setNicknameOpen(false)}
          >
            <X size={17} />
          </button>
          <small>✿ 내 카피바라 이름표</small>
          <strong>여기선 뭐라고 불러줄까?</strong>
          <label htmlFor="capy-nickname">닉네임</label>
          <input
            id="capy-nickname"
            value={nicknameDraft}
            onChange={(event) => setNicknameDraft(event.target.value)}
            maxLength={12}
            placeholder="예: 귤먹는 밤톨"
            autoComplete="nickname"
          />
          <button type="submit" disabled={!nicknameDraft.trim()}>
            이름표 달기 ✦
          </button>
        </form>
      )}

      <header className="capy-hud-top">
        <div className="capy-brand">
          <span className="capy-brand-icon">✿</span>
          <span>
            카피바라 스토리<small>CAPYBARA STORY</small>
          </span>
        </div>
        <div className="capy-top-actions">
          {!guest && zone !== "club" && (
            <button
              className="capy-round-button capy-bgm-button"
              data-music-control
              aria-label={
                musicOn
                  ? musicBlocked
                    ? "배경음악 시작"
                    : "배경음악 끄기"
                  : "배경음악 켜기"
              }
              aria-pressed={musicOn && !musicBlocked}
              onClick={toggleMusic}
              title={musicOn && musicBlocked ? "눌러서 음악 시작" : "배경음악"}
            >
              {musicOn && !musicBlocked ? "♫" : "♪"}
            </button>
          )}
          {!guest && (
            <span className="capy-island-chip">
              {zone === "club"
                ? "카피바라 클럽"
                : zone === "spring"
                  ? "비밀 귤 온천"
                  : zone === "library-yard"
                    ? "도서관 앞마당"
                    : zone === "library"
                      ? "꾸벅 도서관"
                      : zone === "beach"
                        ? "등대 해변"
                        : islandName}{" "}
              ·{" "}
              {connected
                ? `${neighbors.length + 1}명 온라인`
                : connectionTimedOut
                  ? "오프라인 모드"
                  : "연결 중"}{" "}
              · {residentCount}명 거주
            </span>
          )}
          {!guest && (
            <button
              className="capy-round-button capy-sound-button"
              aria-label={soundOn ? "카피바라 소리 끄기" : "카피바라 소리 켜기"}
              aria-pressed={soundOn}
              onClick={() => setSoundOn((current) => !current)}
            >
              {soundOn ? "뀨" : "…"}
            </button>
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

      {zone === "village" && !guest && (
        <nav className="capy-mobile-routes" aria-label="다른 장소로 이동">
          <button onClick={() => changeZone("library-yard")}>
            ↖ 꾸벅 도서관
          </button>
          <button onClick={() => changeZone("beach")}>↗ 등대 해변</button>
        </nav>
      )}

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
                onClick={() =>
                  zone === "village"
                    ? requestClubEntry()
                    : changeZone("village")
                }
              >
                {zone !== "village" ? (
                  <ArrowLeft size={18} />
                ) : (
                  <Music2 size={18} />
                )}
                {zone !== "village" ? "노을 마을로" : "카피바라 클럽"}
              </button>
              {springDiscovered && zone !== "spring" && (
                <button onClick={() => changeZone("spring")}>
                  <span>♨</span> 비밀 귤 온천
                </button>
              )}
              {zone !== "library-yard" && zone !== "library" && (
                <button
                  onClick={() => {
                    changeZone("library-yard");
                    setMenuOpen(false);
                  }}
                >
                  <BookOpen size={18} /> 꾸벅 도서관
                </button>
              )}
              {zone !== "beach" && (
                <button
                  onClick={() => {
                    changeZone("beach");
                    setMenuOpen(false);
                  }}
                >
                  <span>🌊</span> 등대 해변
                </button>
              )}
              <button
                onClick={() => {
                  setNicknameDraft(nickname);
                  setNicknameOpen(true);
                  setMenuOpen(false);
                }}
              >
                ✿ 닉네임 바꾸기
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
            <span>✦</span>{" "}
            {zone === "club"
              ? "카피바라 클럽"
              : zone === "spring"
                ? "비밀 귤 온천"
                : zone === "library-yard"
                  ? "도서관 꽃길"
                  : zone === "library"
                    ? "꾸벅 도서관"
                    : zone === "beach"
                      ? "등대 해변"
                      : "노을 마을"}{" "}
            <small>
              {zone === "beach"
                ? "바다를 누르면 헤엄쳐요"
                : "바닥을 누르면 걸어가요"}
            </small>
            <small className="capy-live-count">
              {connected
                ? `${neighbors.length + 1}명 온라인`
                : connectionTimedOut
                  ? "오프라인 모드"
                  : "연결 중"}
            </small>
          </div>
          {zone !== "village" && (
            <button
              className="capy-exit-club"
              onClick={() =>
                changeZone(zone === "library" ? "library-yard" : "village")
              }
            >
              <ArrowLeft size={17} />{" "}
              {zone === "library" ? "도서관 밖으로" : "마을로 나가기"}
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
                  data-music-control
                  aria-label={
                    musicOn
                      ? musicBlocked
                        ? "클럽 음악 시작"
                        : "클럽 음악 끄기"
                      : "클럽 음악 켜기"
                  }
                  aria-pressed={musicOn && !musicBlocked}
                >
                  <span>{musicOn && !musicBlocked ? "🔊" : "🎵"}</span>
                  <small>{clubGenre === "house" ? "하우스" : "EDM"}</small>
                </button>
                <button
                  onClick={changeClubGenre}
                  data-music-control
                  aria-label={
                    clubGenre === "house"
                      ? "EDM 음악으로 바꾸기"
                      : "하우스 음악으로 바꾸기"
                  }
                >
                  <span>⚡</span>
                  <small>
                    {clubGenre === "house" ? "EDM 전환" : "하우스 전환"}
                  </small>
                </button>
              </>
            ) : zone === "library" ? (
              <>
                <button
                  onClick={() => doLibraryAction("reading")}
                  aria-label="책 읽기"
                >
                  <span>📖</span>
                  <small>책 읽기</small>
                </button>
                <button
                  onClick={() => doLibraryAction("napping")}
                  aria-label="꾸벅 졸기"
                >
                  <span>😴</span>
                  <small>꾸벅 졸기</small>
                </button>
                <button
                  onClick={() => doLibraryAction("snacking")}
                  aria-label="몰래 귤 먹기"
                >
                  <span>🍊</span>
                  <small>몰래 귤</small>
                </button>
                <button onClick={stackBook} aria-label="책 탑 쌓기">
                  <span>📚</span>
                  <small>책 탑</small>
                </button>
              </>
            ) : zone === "beach" ? (
              <>
                <button
                  onClick={swimOrReturn}
                  aria-label={
                    swimming ? "모래사장으로 돌아가기" : "바다로 헤엄치기"
                  }
                >
                  <span>{swimming ? "🐾" : "🌊"}</span>
                  <small>{swimming ? "해변으로" : "헤엄치기"}</small>
                </button>
                <button
                  onClick={watchSunset}
                  aria-label="친구와 함께 노을 바라보기"
                  aria-pressed={sunsetWatching}
                >
                  <span>🌅</span>
                  <small>노을 보기</small>
                </button>
                <button
                  onClick={goLighthouse}
                  aria-label="등대 쪽으로 헤엄치기"
                >
                  <span>🗼</span>
                  <small>등대 쪽</small>
                </button>
              </>
            ) : zone === "spring" ? (
              <>
                <button
                  onClick={() => gesture("첨벙! 💦")}
                  aria-label="온천에서 첨벙하기"
                >
                  <span>💦</span>
                  <small>첨벙</small>
                </button>
                <button
                  onClick={() => {
                    setBubble("귤이 둥실 떠갔다 🍊");
                    setNpcBubble("귤 받았다…");
                    setNpcBubbleFor("gyul");
                    window.setTimeout(() => {
                      setNpcBubble("");
                      setNpcBubbleFor(null);
                    }, 2400);
                  }}
                  aria-label="귤 밀어주기"
                >
                  <span>🍊</span>
                  <small>귤 밀기</small>
                </button>
                <button
                  onClick={() => {
                    setBubble("뀨앙—…");
                    sound("echo");
                  }}
                  aria-label="온천에서 뀨앙 메아리"
                >
                  <span>♨️</span>
                  <small>뀨앙</small>
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
            <button
              className="capy-jump-action"
              onClick={jump}
              aria-label="점프"
              aria-keyshortcuts="Space"
            >
              <span>🐾</span>
              <small>점프</small>
            </button>
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
              : zone === "spring"
                ? "귤이 둥둥 · 오래 있으면 모두 잠들어요"
                : zone === "library"
                  ? "쉿… 사서 꾸벅이 졸고 있어요 · 책장을 눌러 노트 남기기"
                  : zone === "library-yard"
                    ? "바닷바람이 책장을 넘겨요 · 문을 눌러 들어가기"
                    : zone === "beach"
                      ? swimming
                        ? "물결을 따라 헤엄치는 중 · 오른쪽엔 작은 등대"
                        : "바다를 누르면 헤엄쳐요 · 오른쪽엔 작은 등대"
                      : springDiscovered
                        ? "왼쪽 꽃길엔 도서관 · 오른쪽 꽃길엔 온천"
                        : "왼쪽 꽃길엔 도서관 · 김이 나는 바위를 찾아보세요"}
          </div>
        </>
      )}
    </section>
  );
}

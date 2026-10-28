"use client";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  Component,
  ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import {
  Avatar,
  Placement,
  World,
  catalog,
  cells,
  defaultAvatar,
  pathfind,
} from "@/domain/world";

type Vec = [number, number, number];
function CameraFit({ space }: { space: boolean }) {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = Math.min(
        size.width / (space ? 17 : 23),
        size.height / (space ? 14 : 15),
      );
      camera.updateProjectionMatrix();
      invalidate();
    }
  }, [camera, size, space, invalidate]);
  return null;
}
const homes: Vec[] = [
  [-3.6, 0.5, 1.6],
  [1.1, 0.65, -3.2],
  [4.8, 0.4, 1.2],
  [-4.4, 0.5, -3.9],
  [0.4, 0.4, 5.3],
  [5.1, 0.4, -4.7],
  [-6, 0.4, 4],
  [4.5, 0.4, 5.5],
];
type LabelPosition = { owner: string; x: number; y: number };
function Labels({
  world,
  report,
}: {
  world: World;
  report: (labels: LabelPosition[]) => void;
}) {
  const { camera, size } = useThree();
  const last = useRef("");
  useFrame(() => {
    const positions = world.members
      .filter((m) => !world.blocks.includes(m.user))
      .map((m) => {
        const h = homes[m.plot % 8];
        const point = new THREE.Vector3(h[0], h[1] + 2.8, h[2]).project(camera);
        return {
          owner: m.user,
          x: Math.round(((point.x + 1) * size.width) / 2),
          y: Math.round(((1 - point.y) * size.height) / 2),
        };
      });
    const encoded = JSON.stringify(positions);
    if (encoded !== last.current) {
      last.current = encoded;
      report(positions);
    }
  });
  return null;
}
function Mesh({
  position = [0, 0, 0],
  scale = [1, 1, 1],
  color,
  shape = "box",
  rotation = [0, 0, 0],
  onClick,
}: {
  position?: Vec;
  scale?: Vec;
  color: string;
  shape?: string;
  rotation?: Vec;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  return (
    <mesh
      position={position}
      scale={scale}
      rotation={rotation}
      castShadow
      receiveShadow
      onClick={onClick}
    >
      {shape === "sphere" ? (
        <icosahedronGeometry args={[1, 1]} />
      ) : shape === "cone" ? (
        <coneGeometry args={[1, 1, 5]} />
      ) : shape === "cylinder" ? (
        <cylinderGeometry args={[1, 1, 1, 16]} />
      ) : (
        <boxGeometry />
      )}
      <meshStandardMaterial color={color} roughness={0.92} />
    </mesh>
  );
}
function Tree({
  position,
  scale = 1,
  pink = false,
}: {
  position: Vec;
  scale?: number;
  pink?: boolean;
}) {
  return (
    <group position={position} scale={scale}>
      <Mesh
        position={[0, 0.7, 0]}
        scale={[0.14, 1.4, 0.14]}
        color="#93795b"
        shape="cylinder"
      />
      <Mesh
        position={[0, 1.65, 0]}
        scale={[0.8, 0.95, 0.7]}
        color={pink ? "#dbafac" : "#91b17b"}
        shape="sphere"
      />
      <Mesh
        position={[-0.3, 1.45, 0.2]}
        scale={[0.55, 0.6, 0.55]}
        color={pink ? "#edc8bc" : "#aac38b"}
        shape="sphere"
      />
    </group>
  );
}
function House({
  position,
  color = "#bc8a76",
  name,
  onVisit,
}: {
  position: Vec;
  color?: string;
  name?: string;
  onVisit?: () => void;
}) {
  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onVisit?.();
      }}
    >
      <Mesh position={[0, 0.65, 0]} scale={[1.65, 1.3, 1.5]} color="#fff0d4" />
      <mesh position={[0, 1.58, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.55, 1.05, 4]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      <Mesh
        position={[-0.5, 1.8, -0.3]}
        scale={[0.28, 0.7, 0.3]}
        color="#f1dfbd"
      />
      <Mesh
        position={[0, 0.4, 0.765]}
        scale={[0.42, 0.8, 0.06]}
        color="#9aaf92"
      />
      <Mesh
        position={[0.55, 0.75, 0.77]}
        scale={[0.32, 0.38, 0.05]}
        color="#c6ded9"
      />
      <Mesh
        position={[-0.55, 0.75, 0.77]}
        scale={[0.32, 0.38, 0.05]}
        color="#c6ded9"
      />
      <Mesh
        position={[0, 0.02, 1.08]}
        scale={[0.7, 0.1, 0.5]}
        color="#dccdb1"
      />
    </group>
  );
}
export function Doll({
  avatar = defaultAvatar,
  position = [0, 0, 0],
}: {
  avatar?: Avatar;
  position?: Vec;
}) {
  return (
    <group
      position={position}
      scale={avatar.body === "small" ? 0.82 : avatar.body === "tall" ? 1.08 : 1}
    >
      <Mesh
        position={[-0.12, 0.15, 0]}
        scale={[0.16, 0.3, 0.19]}
        color="#695b50"
      />
      <Mesh
        position={[0.12, 0.15, 0]}
        scale={[0.16, 0.3, 0.19]}
        color="#695b50"
      />
      <Mesh
        position={[0, 0.49, 0]}
        scale={[0.36, 0.43, 0.28]}
        color={avatar.shirt}
        shape="sphere"
      />
      <Mesh
        position={[0, 0.94, 0]}
        scale={[0.3, 0.31, 0.28]}
        color={avatar.skin}
        shape="sphere"
      />
      <Mesh
        position={[0, 1.09, -0.04]}
        scale={[0.32, 0.2, avatar.style === "bob" ? 0.31 : 0.26]}
        color={avatar.hair}
        shape="sphere"
      />
      {avatar.style === "bun" && (
        <Mesh
          position={[0, 1.33, -0.06]}
          scale={[0.14, 0.14, 0.14]}
          color={avatar.hair}
          shape="sphere"
        />
      )}
      <Mesh
        position={[-0.1, 0.95, 0.257]}
        scale={[0.025, 0.035, 0.015]}
        color="#493a35"
        shape="sphere"
      />
      <Mesh
        position={[0.1, 0.95, 0.257]}
        scale={[0.025, 0.035, 0.015]}
        color="#493a35"
        shape="sphere"
      />
    </group>
  );
}
function Walker({
  target,
  avatar,
  blocked,
  size,
}: {
  target: Vec;
  avatar: Avatar;
  blocked?: Set<string>;
  size?: number;
}) {
  const { invalidate } = useThree();
  const ref = useRef<THREE.Group>(null);
  const route = useRef<Vec[]>([]);
  useEffect(() => {
    const resume = () => {
      if (!document.hidden) invalidate();
    };
    document.addEventListener("visibilitychange", resume);
    return () => document.removeEventListener("visibilitychange", resume);
  }, [invalidate]);
  useEffect(() => {
    if (!ref.current) return;
    invalidate();
    if (size && blocked) {
      const current = ref.current.position;
      const start: [number, number] = [
        Math.max(0, Math.min(size - 1, Math.round(current.x + size / 2))),
        Math.max(0, Math.min(size - 1, Math.round(current.z + size / 2))),
      ];
      const end: [number, number] = [
        Math.max(0, Math.min(size - 1, Math.round(target[0] + size / 2))),
        Math.max(0, Math.min(size - 1, Math.round(target[2] + size / 2))),
      ];
      route.current = pathfind(start, end, blocked, size).map(([x, z]) => [
        x - size / 2,
        0.1,
        z - size / 2,
      ]);
    } else route.current = [target];
  }, [target, blocked, size]);
  useFrame((_, dt) => {
    const g = ref.current,
      p = route.current[0];
    if (!g || !p || document.hidden) return;
    invalidate();
    const to = new THREE.Vector3(...p),
      delta = to.clone().sub(g.position);
    if (delta.length() < 0.08) {
      route.current.shift();
      return;
    }
    g.rotation.y = Math.atan2(delta.x, delta.z);
    const step = Math.min(Math.min(dt, 0.05) * 2.5, delta.length());
    g.position.add(delta.normalize().multiplyScalar(step));
  });
  return (
    <group ref={ref} position={size ? [0, 0.1, size / 2 - 1] : [0, 0.5, 1]}>
      <Doll avatar={avatar} />
    </group>
  );
}
function Prop({ p, onSelect }: { p: Placement; onSelect?: () => void }) {
  const a = catalog.find((a) => a.id === p.asset);
  if (!a) return null;
  return (
    <group
      position={[p.x, 0.12, p.z]}
      rotation={[0, (p.rotation * Math.PI) / 2, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      {p.asset === "plant" || p.asset === "flowers" ? (
        <>
          <Mesh
            position={[0, 0.22, 0]}
            scale={[0.3, 0.4, 0.3]}
            color="#ca9c83"
            shape="cylinder"
          />
          <Mesh
            position={[0, 0.7, 0]}
            scale={[0.4, 0.5, 0.4]}
            color={p.asset === "plant" ? "#92ad7d" : "#e4b4a3"}
            shape="sphere"
          />
        </>
      ) : p.asset === "lamp" ? (
        <>
          <Mesh
            position={[0, 0.55, 0]}
            scale={[0.06, 1, 0.06]}
            color="#8e8564"
          />
          <Mesh
            position={[0, 1.12, 0]}
            scale={[0.4, 0.25, 0.4]}
            color="#edcb93"
            shape="sphere"
          />
        </>
      ) : p.asset === "shelf" ? (
        <>
          <Mesh
            position={[0.5, 0.75, 0]}
            scale={[1.8, 1.5, 0.55]}
            color="#b59573"
          />
          {[0, 1, 2, 3, 4].map((i) => (
            <Mesh
              key={i}
              position={[-0.15 + i * 0.3, 0.9, 0.3]}
              scale={[0.17, 0.5, 0.22]}
              color={["#cc9684", "#a6b693", "#e4d4a3", "#96b6bd", "#d4a886"][i]}
            />
          ))}
        </>
      ) : p.asset === "rug" ? (
        <Mesh
          position={[0.5, 0, 0.5]}
          scale={[1.9, 0.05, 1.9]}
          color="#bdaf8a"
        />
      ) : p.asset === "display" ? (
        <>
          <Mesh
            position={[0, 0.4, 0]}
            scale={[0.6, 0.8, 0.6]}
            color="#c9b293"
          />
          <Mesh
            position={[0, 0.91, 0]}
            scale={[0.35, 0.2, 0.45]}
            color={p.itemId ? "#94a986" : "#ded3bb"}
          />
        </>
      ) : (
        <>
          <Mesh
            position={[a.w / 2 - 0.5, 0.6, a.h / 2 - 0.5]}
            scale={[a.w * 0.85, 0.16, a.h * 0.85]}
            color="#c6a37e"
          />
          {[-0.25, 0.25].map((x) => (
            <Mesh
              key={x}
              position={[x, 0.3, 0]}
              scale={[0.1, 0.6, 0.1]}
              color="#a78a6c"
            />
          ))}
          {p.asset === "chair" && (
            <Mesh
              position={[0, 1, -0.35]}
              scale={[0.9, 0.7, 0.1]}
              color="#b99a77"
            />
          )}
        </>
      )}
    </group>
  );
}
function Island({
  world,
  onVisit,
  onTarget,
}: {
  world: World;
  onVisit: (id: string) => void;
  onTarget: (v: Vec) => void;
}) {
  return (
    <>
      <Mesh
        position={[0, -0.55, 0]}
        scale={[10.2, 0.7, 8.6]}
        color="#dfd1ac"
        shape="cylinder"
      />
      <Mesh
        position={[0, -0.03, 0]}
        scale={[9.7, 0.3, 8.2]}
        color="#b9c99a"
        shape="cylinder"
      />
      <Mesh
        position={[0, 0.14, 0]}
        scale={[9.5, 0.09, 8]}
        color="#bfd09e"
        shape="cylinder"
        onClick={(e) => {
          e.stopPropagation();
          onTarget([e.point.x, 0.3, e.point.z]);
        }}
      />
      <Mesh position={[0, 0.24, 1.3]} scale={[1.3, 0.02, 10]} color="#e7d8b5" />
      <Mesh position={[0, 0.25, 0]} scale={[12, 0.02, 1.15]} color="#e7d8b5" />
      <Mesh
        position={[0, 0.26, -0.1]}
        scale={[2.5, 0.02, 2.5]}
        color="#e7d8b5"
        shape="cylinder"
      />
      {world.members
        .filter((m) => !world.blocks.includes(m.user))
        .map((m, i) => (
          <House
            key={m.user}
            position={homes[m.plot % 8]}
            color={["#c58e79", "#91a7a1", "#d0ad7a", "#aea3b6"][i % 4]}
            name={world.profiles.find((p) => p.id === m.user)?.name + "의 집"}
            onVisit={() => {
              const s = world.spaces.find(
                (s) => s.owner === m.user && s.kind === "interior",
              );
              if (s) onVisit(s.id);
            }}
          />
        ))}
      {Array.from({ length: 23 }, (_, i) => {
        const t = i * 2.399,
          x = Math.cos(t) * (6.7 + (i % 3) * 0.4),
          z = Math.sin(t) * (5.6 + (i % 3) * 0.25);
        return (
          <Tree
            key={i}
            position={[x, 0.15, z]}
            scale={0.65 + (i % 4) * 0.15}
            pink={i % 7 === 0}
          />
        );
      })}
      {Array.from({ length: 35 }, (_, i) => {
        const x = Math.sin(i * 7.4) * 8,
          z = Math.cos(i * 2.7) * 6;
        return (
          <group key={i} position={[x, 0.3, z]}>
            <Mesh
              position={[0, 0.12, 0]}
              scale={[0.025, 0.25, 0.025]}
              color="#8f9f70"
            />
            <Mesh
              position={[0, 0.27, 0]}
              scale={[0.09, 0.06, 0.09]}
              color={i % 2 ? "#f5dbb4" : "#e3afa7"}
              shape="sphere"
            />
          </group>
        );
      })}
      <Mesh position={[0, 0.05, 8.4]} scale={[1.5, 0.2, 2.5]} color="#bf9d79" />
      {[0, 1, 2, 3].map((i) => (
        <Mesh
          key={i}
          position={[-0.7 + (i % 2) * 1.4, 0.3, 7.7 + Math.floor(i / 2) * 1.4]}
          scale={[0.1, 0.8, 0.1]}
          color="#9c8266"
        />
      ))}
      <group position={[7, -0.2, 5.5]} rotation={[0, -0.6, 0]}>
        <Mesh scale={[0.8, 0.3, 1.8]} color="#f2e5c8" shape="sphere" />
        <Mesh position={[0, 1, 0]} scale={[0.04, 2, 0.04]} color="#aa8e6a" />
        <Mesh
          position={[0.35, 1.3, 0]}
          scale={[0.7, 1, 0.04]}
          color="#f6e7d0"
          shape="cone"
        />
      </group>
    </>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? (
      <div className="scene-loading">
        3D를 불러올 수 없어요. 목록 모드로 전환해 주세요.
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function WorldScene({
  world,
  spaceId,
  placements,
  onVisit,
  onSelect,
  onCell,
  editing = false,
  quality = "normal",
  onError,
}: {
  world: World;
  spaceId?: string;
  placements?: Placement[];
  onVisit: (id: string) => void;
  onSelect: (id: string) => void;
  onCell?: (x: number, z: number) => void;
  editing?: boolean;
  quality?: string;
  onError: () => void;
}) {
  const [target, setTarget] = useState<Vec>([0, 0.3, 1]);
  const [labels, setLabels] = useState<LabelPosition[]>([]);
  const space = world.spaces.find((s) => s.id === spaceId),
    size = space?.kind === "garden" ? 16 : 12;
  const occupied = useMemo(
    () =>
      new Set(
        (placements ?? []).flatMap((p) => cells(p).map((c) => c.join(","))),
      ),
    [placements],
  );
  return (
    <SceneBoundary onError={onError}>
      <div style={{ height: "100%", position: "relative" }}>
        <Canvas
          frameloop="demand"
          orthographic
          camera={{
            position: [15, 15, 19],
            zoom: space ? 28 : 22,
            near: 0.1,
            far: 120,
          }}
          shadows={quality !== "low"}
          dpr={quality === "low" ? 1 : [1, 1.5]}
          gl={{ antialias: true, alpha: false }}
          onCreated={({ gl }) => {
            gl.setClearColor("#b8dbd7");
          }}
        >
          <CameraFit space={!!space} />
          <OrbitControls
            enableRotate={false}
            enablePan={false}
            minZoom={space ? 15 : 12}
            maxZoom={space ? 50 : 40}
          />
          <ambientLight intensity={1.5} />
          <directionalLight
            position={[-8, 18, 10]}
            intensity={2.7}
            color="#fff0d9"
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-left={-14}
            shadow-camera-right={14}
            shadow-camera-top={14}
            shadow-camera-bottom={-14}
          />
          <hemisphereLight args={["#fff6df", "#a0b8b0", 1.1]} />
          <Suspense fallback={null}>
            {space ? (
              <group>
                <Mesh
                  position={[0, -0.15, 0]}
                  scale={[size, 0.3, size]}
                  color={space.kind === "garden" ? "#c0ce9d" : "#e6d4b5"}
                />
                {space.kind === "interior" && (
                  <>
                    <Mesh
                      position={[0, 1, -size / 2 - 0.1]}
                      scale={[size, 2, 0.2]}
                      color="#eee5d0"
                    />
                    <Mesh
                      position={[-size / 2 - 0.1, 1, 0]}
                      scale={[0.2, 2, size]}
                      color="#e2d9c3"
                    />
                  </>
                )}
                <mesh
                  rotation={[-Math.PI / 2, 0, 0]}
                  position={[0, 0.015, 0]}
                  onClick={(e) => {
                    e.stopPropagation();
                    const x = Math.max(
                        0,
                        Math.min(size - 1, Math.round(e.point.x + size / 2)),
                      ),
                      z = Math.max(
                        0,
                        Math.min(size - 1, Math.round(e.point.z + size / 2)),
                      );
                    if (editing) onCell?.(x, z);
                    else setTarget([x - size / 2, 0.1, z - size / 2]);
                  }}
                >
                  <planeGeometry args={[size, size]} />
                  <meshStandardMaterial
                    color={space.kind === "garden" ? "#bccd9c" : "#eddfc6"}
                  />
                </mesh>
                {editing && (
                  <gridHelper
                    args={[size, size, "#baa889", "#d8c9a7"]}
                    position={[0, 0.03, 0]}
                  />
                )}
                <group position={[-size / 2, 0, -size / 2]}>
                  {placements?.map((p) => (
                    <Prop key={p.id} p={p} onSelect={() => onSelect(p.id)} />
                  ))}
                </group>
                <Walker
                  key={space.id}
                  target={target}
                  avatar={
                    world.profiles.find((p) => p.id === world.me)?.avatar ??
                    defaultAvatar
                  }
                  blocked={occupied}
                  size={size}
                />
              </group>
            ) : (
              <>
                <Labels world={world} report={setLabels} />
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.05, 0]}>
                  <planeGeometry args={[200, 200]} />
                  <meshStandardMaterial color="#b8dbd7" roughness={0.7} />
                </mesh>
                <Island world={world} onVisit={onVisit} onTarget={setTarget} />
                <Walker
                  target={target}
                  avatar={
                    world.profiles.find((p) => p.id === world.me)?.avatar ??
                    defaultAvatar
                  }
                />
                {[11, 13, 15].map((r) => (
                  <mesh
                    key={r}
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[0, -1, 0]}
                  >
                    <ringGeometry args={[r, r + 0.025, 80]} />
                    <meshBasicMaterial
                      color="#d0e7df"
                      transparent
                      opacity={0.6}
                    />
                  </mesh>
                ))}
              </>
            )}
          </Suspense>
        </Canvas>
        {!space &&
          labels.map((label) => (
            <button
              key={label.owner}
              className="house-label"
              style={{
                position: "absolute",
                left: label.x,
                top: label.y,
                transform: "translate(-50%, -50%)",
                zIndex: 7,
              }}
              onClick={() => {
                const target = world.spaces.find(
                  (s) => s.owner === label.owner && s.kind === "interior",
                );
                if (target) onVisit(target.id);
              }}
            >
              {world.profiles.find((p) => p.id === label.owner)?.name ?? "이웃"}
              의 집 <span>↗</span>
            </button>
          ))}
      </div>
    </SceneBoundary>
  );
}

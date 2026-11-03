"use client";

import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, useTexture } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

type Position = { x: number; y: number };
export type VillageActor = Position & {
  id: string;
  name: string;
  look?: string;
  facing?: number;
  walking?: boolean;
  dancing?: boolean;
  bubble?: string;
};

type Props = {
  guest: boolean;
  player?: VillageActor;
  neighbors: VillageActor[];
  frame: number;
  reducedMotion: boolean;
  onMoveTo: (position: Position) => void;
  onEnterClub: () => void;
  onCameraYaw: (yaw: number) => void;
  onReady: () => void;
};

const asset = "/capy-world/real-3d";
const spriteRoot = "/capy-world";
const WORLD_X = 0.34;
const WORLD_Z = 0.4;
const groundY = 0.46;
const toWorld = (position: Position) =>
  new THREE.Vector3(
    (position.x - 50) * WORLD_X,
    groundY,
    (position.y - 70) * WORLD_Z,
  );
const toPosition = (point: THREE.Vector3): Position => ({
  x: point.x / WORLD_X + 50,
  y: point.z / WORLD_Z + 70,
});

function tiled(texture: THREE.Texture, x: number, y: number, color = false) {
  const copy = texture.clone();
  copy.wrapS = THREE.RepeatWrapping;
  copy.wrapT = THREE.RepeatWrapping;
  copy.repeat.set(x, y);
  if (color) copy.colorSpace = THREE.SRGBColorSpace;
  copy.needsUpdate = true;
  return copy;
}

function useVillageMaterials() {
  const [sand, sandNormal, stone, stoneNormal, wood, plaster, roof] =
    useTexture([
      `${asset}/sand-light.webp`,
      `${asset}/sand-normal.webp`,
      `${asset}/stone.webp`,
      `${asset}/stone-normal.webp`,
      `${asset}/wood.webp`,
      `${asset}/plaster.webp`,
      `${asset}/roof.webp`,
    ]);
  return useMemo(
    () => ({
      sand: tiled(sand, 6, 6, true),
      sandNormal: tiled(sandNormal, 6, 6),
      stone: tiled(stone, 4, 8, true),
      stoneNormal: tiled(stoneNormal, 4, 8),
      wood: tiled(wood, 2, 2, true),
      plaster: tiled(plaster, 2, 1, true),
      roof: tiled(roof, 2, 2, true),
    }),
    [sand, sandNormal, stone, stoneNormal, wood, plaster, roof],
  );
}

function Ocean({ reducedMotion }: { reducedMotion: boolean }) {
  const shader = useRef<THREE.ShaderMaterial>(null);
  useFrame(({ clock }) => {
    if (shader.current && !reducedMotion)
      shader.current.uniforms.uTime.value = clock.elapsedTime;
  });
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  return (
    <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[700, 700, 128, 128]} />
      <shaderMaterial
        ref={shader}
        uniforms={uniforms}
        side={THREE.DoubleSide}
        vertexShader={`
          uniform float uTime;
          varying vec3 vWorld;
          varying vec3 vNormalWorld;
          void main() {
            vec3 p = position;
            p.z += sin(p.x * 0.41 + uTime * 0.75) * 0.09;
            p.z += sin(p.y * 0.32 - uTime * 0.56 + p.x * 0.15) * 0.07;
            p.z += sin((p.x + p.y) * 0.76 + uTime * 1.1) * 0.025;
            vec4 world = modelMatrix * vec4(p, 1.0);
            vWorld = world.xyz;
            vNormalWorld = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `}
        fragmentShader={`
          precision highp float;
          uniform float uTime;
          varying vec3 vWorld;
          varying vec3 vNormalWorld;
          void main() {
            vec3 viewDir = normalize(cameraPosition - vWorld);
            float wave = sin(vWorld.x * 0.42 + uTime * 0.75) * 0.5 + sin(vWorld.z * 0.72 - uTime * 0.5) * 0.25;
            float small = sin(vWorld.x * 2.8 + vWorld.z * 1.7 + uTime * 1.8) * 0.06;
            vec3 n = normalize(vNormalWorld + vec3(wave * 0.09 + small, 0.0, small * 0.8));
            float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 2.8);
            float distanceFade = smoothstep(20.0, 130.0, length(vWorld.xz));
            vec3 nearSea = mix(vec3(0.02, 0.30, 0.38), vec3(0.06, 0.40, 0.48), 0.5 + 0.5 * wave);
            vec3 sea = mix(nearSea, vec3(0.035, 0.23, 0.31), distanceFade);
            sea += vec3(0.08, 0.11, 0.10) * fresnel;
            vec3 sunDir = normalize(vec3(-0.16, 0.28, -0.95));
            float glint = pow(max(dot(reflect(-sunDir, n), viewDir), 0.0), 34.0);
            float glitter = pow(max(0.0, sin(vWorld.x * 3.2 + vWorld.z * 4.7 + uTime * 2.1)), 20.0);
            sea += vec3(1.0, 0.58, 0.25) * (glint * 0.42 + glitter * glint * 0.19);
            float haze = smoothstep(70.0, 300.0, length(vWorld.xz));
            sea = mix(sea, vec3(0.28, 0.39, 0.45), haze * 0.45);
            gl_FragColor = vec4(sea, 1.0);
          }
        `}
      />
    </mesh>
  );
}

function Island({
  onMoveTo,
  maps,
}: {
  onMoveTo: Props["onMoveTo"];
  maps: ReturnType<typeof useVillageMaterials>;
}) {
  const clickGround = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.delta > 5) return;
    onMoveTo(toPosition(event.point));
  };
  return (
    <group>
      <mesh position={[0, -0.32, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[18, 16.8, 1.52, 72]} />
        <meshStandardMaterial color="#847a70" roughness={0.98} />
      </mesh>
      <mesh
        position={[0, groundY, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={clickGround}
      >
        <circleGeometry args={[17.9, 72]} />
        <meshStandardMaterial
          map={maps.sand}
          normalMap={maps.sandNormal}
          normalScale={[0.12, 0.12]}
          roughness={1}
          color="#fff0db"
        />
      </mesh>
      <mesh
        position={[0, groundY + 0.016, -4.4]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={clickGround}
      >
        <planeGeometry args={[4.4, 18]} />
        <meshStandardMaterial
          map={maps.stone}
          normalMap={maps.stoneNormal}
          normalScale={[0.24, 0.24]}
          roughness={0.98}
          color="#e9d8c7"
        />
      </mesh>
      <mesh
        position={[0, groundY + 0.022, -5.4]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={clickGround}
      >
        <circleGeometry args={[5.6, 48]} />
        <meshStandardMaterial
          map={maps.stone}
          normalMap={maps.stoneNormal}
          normalScale={[0.24, 0.24]}
          roughness={0.98}
          color="#e9d8c7"
        />
      </mesh>
    </group>
  );
}

function Palm({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  const texture = useTexture(`${asset}/palm.webp`);
  const plane = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture]);
  useFrame(() => {
    if (plane.current)
      plane.current.rotation.y = Math.atan2(
        camera.position.x - position[0],
        camera.position.z - position[2],
      );
  });
  return (
    <mesh
      ref={plane}
      position={[position[0], position[1] + 4.25 * scale, position[2]]}
      scale={scale}
    >
      <planeGeometry args={[6.6, 8.5]} />
      <meshBasicMaterial
        map={texture}
        transparent
        alphaTest={0.035}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function Rocks() {
  const stones = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const angle = (i / 28) * Math.PI * 2;
        const radius = 15.6 + Math.sin(i * 12.7) * 1.2;
        return {
          x: Math.cos(angle) * radius,
          z: Math.sin(angle) * radius,
          s: 0.35 + (i % 4) * 0.17,
        };
      }),
    [],
  );
  return (
    <group>
      {stones.map((rock, index) => (
        <mesh
          key={index}
          position={[rock.x, groundY + rock.s * 0.25, rock.z]}
          scale={[rock.s * 1.4, rock.s * 0.65, rock.s]}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial
            color={index % 3 ? "#90887d" : "#b5aa98"}
            roughness={1}
          />
        </mesh>
      ))}
    </group>
  );
}

function House({
  club = false,
  maps,
  onEnterClub,
}: {
  club?: boolean;
  maps: ReturnType<typeof useVillageMaterials>;
  onEnterClub: () => void;
}) {
  const [clubFacade, cottageFacade] = useTexture([
    `${asset}/club-facade.webp`,
    `${asset}/cottage-facade.webp`,
  ]);
  useEffect(() => {
    for (const texture of [clubFacade, cottageFacade]) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
    }
  }, [clubFacade, cottageFacade]);
  const width = club ? 10.4 : 5.4;
  const height = club ? 5.2 : 3.3;
  const depth = club ? 6.2 : 4.4;
  const position: [number, number, number] = club
    ? [0, groundY, -11.25]
    : [-9.2, groundY, -8.3];
  const doorWidth = club ? 3.0 : 1.35;
  const doorHeight = club ? 3.55 : 2.18;
  const wallSide = (width - doorWidth) / 2;
  const front = depth / 2;
  const arch = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        Array.from({ length: 15 }, (_, i) => {
          const angle = Math.PI - (i / 14) * Math.PI;
          return new THREE.Vector3(
            (Math.cos(angle) * doorWidth) / 2,
            doorHeight - doorWidth / 2 + (Math.sin(angle) * doorWidth) / 2,
            front + 0.13,
          );
        }),
      ),
    [doorWidth, doorHeight, front],
  );
  const gable = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, height);
    shape.lineTo(width / 2, height);
    shape.lineTo(0, height + 1.3);
    shape.closePath();
    return shape;
  }, [width, height]);
  return (
    <group position={position}>
      <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.18, 0.48, depth + 0.18]} />
        <meshStandardMaterial
          map={maps.stone}
          color="#c6b7a5"
          roughness={0.95}
        />
      </mesh>
      <mesh
        position={[-(doorWidth + wallSide) / 2, height / 2, front]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[wallSide, height, 0.45]} />
        <meshStandardMaterial
          map={maps.plaster}
          color="#fff7e8"
          roughness={0.92}
        />
      </mesh>
      <mesh
        position={[(doorWidth + wallSide) / 2, height / 2, front]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[wallSide, height, 0.45]} />
        <meshStandardMaterial
          map={maps.plaster}
          color="#fff7e8"
          roughness={0.92}
        />
      </mesh>
      <mesh
        position={[0, (height + doorHeight) / 2, front]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[doorWidth, height - doorHeight, 0.45]} />
        <meshStandardMaterial
          map={maps.plaster}
          color="#fff7e8"
          roughness={0.92}
        />
      </mesh>
      <mesh position={[0, height / 2, -front]} castShadow receiveShadow>
        <boxGeometry args={[width, height, 0.4]} />
        <meshStandardMaterial
          map={maps.plaster}
          color="#fff4e3"
          roughness={0.95}
        />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[(side * width) / 2, height / 2, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.42, height, depth]} />
          <meshStandardMaterial
            map={maps.plaster}
            color="#fff4e3"
            roughness={0.95}
          />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[0, 0, side * front]}
          castShadow
          receiveShadow
        >
          <shapeGeometry args={[gable]} />
          <meshStandardMaterial
            map={maps.plaster}
            color="#fff5e5"
            side={THREE.DoubleSide}
            roughness={0.94}
          />
        </mesh>
      ))}
      <mesh
        position={[0, doorHeight / 2, front + 0.015]}
        onClick={
          club
            ? (e) => {
                e.stopPropagation();
                onEnterClub();
              }
            : undefined
        }
      >
        <planeGeometry args={[doorWidth - 0.15, doorHeight - 0.08]} />
        <meshStandardMaterial
          color={club ? "#513d4c" : "#665340"}
          emissive={club ? "#b45c79" : "#b47842"}
          emissiveIntensity={club ? 0.4 : 0.1}
          roughness={0.75}
        />
      </mesh>
      <mesh
        position={[0, doorHeight / 2, front + 0.04]}
        onClick={
          club
            ? (e) => {
                e.stopPropagation();
                onEnterClub();
              }
            : undefined
        }
      >
        <planeGeometry args={[doorWidth - 0.5, doorHeight - 0.5]} />
        <meshBasicMaterial
          color={club ? "#9f5f8a" : "#513e34"}
          transparent
          opacity={club ? 0.22 : 0.1}
        />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <tubeGeometry args={[arch, 28, 0.13, 8, false]} />
        <meshStandardMaterial color="#ead8b8" roughness={0.68} />
      </mesh>
      {[-1, 1].map((side) => (
        <group
          key={side}
          position={[side * (width * 0.32), height * 0.57, front + 0.27]}
        >
          <mesh>
            <circleGeometry args={[club ? 0.62 : 0.4, 20]} />
            <meshStandardMaterial color="#c5aa82" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0, 0.035]}>
            <circleGeometry args={[club ? 0.48 : 0.31, 20]} />
            <meshStandardMaterial
              color="#f5ba70"
              emissive="#f0a04f"
              emissiveIntensity={0.9}
              roughness={0.25}
            />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * width * 0.25, height + 0.65, 0]}
          rotation={[0, 0, -side * Math.atan2(1.3, width / 2)]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[width * 0.55, 0.16, depth + 0.75]} />
          <meshStandardMaterial
            map={maps.roof}
            color="#d5ab8f"
            roughness={0.92}
          />
        </mesh>
      ))}
      <mesh position={[0, height + 1.33, 0]} castShadow>
        <boxGeometry args={[0.24, 0.18, depth + 0.9]} />
        <meshStandardMaterial color="#ad755d" roughness={0.85} />
      </mesh>
      <mesh position={[0, club ? 3.62 : 2.08, front + 0.36]}>
        <planeGeometry args={club ? [11.5, 7.67] : [6, 4.5]} />
        <meshBasicMaterial
          map={club ? clubFacade : cottageFacade}
          transparent
          alphaTest={0.04}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {[-1, 1].flatMap((side) =>
        [-0.9, 1.05].map((z, index) => (
          <group
            key={`${side}-${index}`}
            position={[side * (width / 2 + 0.235), height * 0.59, z]}
            rotation={[0, (side * Math.PI) / 2, 0]}
          >
            <mesh>
              <circleGeometry args={[club ? 0.53 : 0.36, 32]} />
              <meshStandardMaterial
                color="#c9a480"
                roughness={0.8}
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh position={[0, 0, 0.018]}>
              <circleGeometry args={[club ? 0.43 : 0.29, 32]} />
              <meshStandardMaterial
                color="#c47d57"
                emissive="#e49a58"
                emissiveIntensity={0.42}
                roughness={0.25}
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh position={[0, 0, 0.045]}>
              <boxGeometry args={[0.055, club ? 0.86 : 0.58, 0.035]} />
              <meshStandardMaterial color="#6c5448" />
            </mesh>
            <mesh position={[0, 0, 0.045]}>
              <boxGeometry args={[club ? 0.86 : 0.58, 0.055, 0.035]} />
              <meshStandardMaterial color="#6c5448" />
            </mesh>
          </group>
        )),
      )}
      {club && (
        <>
          <pointLight
            position={[0, 2.3, front + 1]}
            color="#eaa57e"
            intensity={3}
            distance={8}
          />
          <Html center position={[0, 5.2, front + 0.65]} distanceFactor={13}>
            <div className="capy-world-sign">CAPY CLUB</div>
          </Html>
          <Html center position={[0, 1.3, front + 0.85]} distanceFactor={12}>
            <button
              className="capy-world-entry"
              aria-label="카피바라 클럽 입장"
              onClick={onEnterClub}
            >
              클럽 입장 ↗
            </button>
          </Html>
        </>
      )}
    </group>
  );
}

function Pier({ maps }: { maps: ReturnType<typeof useVillageMaterials> }) {
  return (
    <group position={[14.3, groundY + 0.24, -1]} rotation={[0, -0.28, 0]}>
      {Array.from({ length: 9 }, (_, index) => (
        <group key={index} position={[index * 1.2, 0, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.16, 0.2, 3.2]} />
            <meshStandardMaterial
              map={maps.wood}
              color="#bfa783"
              roughness={0.92}
            />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[0, -1.1, side * 1.26]} castShadow>
              <cylinderGeometry args={[0.16, 0.2, 2.5, 8]} />
              <meshStandardMaterial color="#76563f" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Avatar({
  actor,
  frame,
  reducedMotion,
}: {
  actor: VillageActor;
  frame: number;
  reducedMotion: boolean;
}) {
  const textures = useTexture([
    `${spriteRoot}/walk/front-0.webp`,
    `${spriteRoot}/walk/front-1.webp`,
    `${spriteRoot}/walk/side-0.webp`,
    `${spriteRoot}/walk/side-1.webp`,
    `${spriteRoot}/walk/back-0.webp`,
    `${spriteRoot}/walk/back-1.webp`,
    `${spriteRoot}/capy-neighbor-v1.webp`,
    `${spriteRoot}/club-guard-v1.webp`,
  ]);
  const group = useRef<THREE.Group>(null);
  const figure = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const { camera } = useThree();
  const position = toWorld(actor);
  useEffect(() => {
    textures.forEach((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
    });
  }, [textures]);
  useFrame(({ clock }, dt) => {
    if (!group.current || !figure.current || !material.current) return;
    group.current.position.lerp(position, 1 - Math.exp(-dt * 18));
    const yaw = Math.atan2(
      camera.position.x - group.current.position.x,
      camera.position.z - group.current.position.z,
    );
    figure.current.rotation.y = yaw;
    const relative = (actor.facing ?? 0) - yaw;
    const side =
      Math.abs(Math.sin(relative)) > Math.abs(Math.cos(relative)) * 0.7;
    const step = actor.walking ? frame : 0;
    const index =
      actor.look === "bun"
        ? 6
        : actor.look === "guard"
          ? 7
          : side
            ? 2 + step
            : Math.cos(relative) < 0
              ? 4 + step
              : step;
    const next = textures[index];
    if (material.current.map !== next) {
      material.current.map = next;
      material.current.needsUpdate = true;
    }
    figure.current.scale.x = side && Math.sin(relative) < 0 ? -1 : 1;
    figure.current.position.y =
      1.18 +
      (!reducedMotion && actor.walking
        ? Math.abs(Math.sin(clock.elapsedTime * 13)) * 0.055
        : !reducedMotion && actor.dancing
          ? Math.sin(clock.elapsedTime * 8) * 0.08
          : 0);
    figure.current.rotation.z =
      actor.dancing && !reducedMotion
        ? Math.sin(clock.elapsedTime * 8) * 0.1
        : 0;
  });
  return (
    <group ref={group} position={position.toArray()}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <circleGeometry args={[0.68, 24]} />
        <meshBasicMaterial
          color="#3c3440"
          transparent
          opacity={0.25}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={figure} position={[0, 1.18, 0]} renderOrder={2}>
        <planeGeometry args={[1.75, 2.35]} />
        <meshBasicMaterial
          ref={material}
          map={textures[0]}
          transparent
          alphaTest={0.035}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <Html center position={[0, 2.75, 0]} distanceFactor={12}>
        <div className="capy-world-name">{actor.bubble || actor.name}</div>
      </Html>
    </group>
  );
}

function CameraRig({
  player,
  onCameraYaw,
}: {
  player: Position;
  onCameraYaw: Props["onCameraYaw"];
}) {
  const controls = useRef<React.ElementRef<typeof OrbitControls>>(null);
  const { camera, size } = useThree();
  const last = useRef(toWorld(player));
  const lastYaw = useRef(0);
  useEffect(() => {
    const target = toWorld(player);
    const portrait = size.width < size.height;
    camera.position.set(
      target.x,
      portrait ? 4.6 : 3.9,
      target.z + (portrait ? 21 : 12.3),
    );
    controls.current?.target.set(target.x, 1.7, target.z - 4);
    controls.current?.update();
    last.current.copy(target);
  }, [camera, size.width, size.height]);
  useFrame(() => {
    if (!controls.current) return;
    const next = toWorld(player);
    const shift = next.clone().sub(last.current).multiplyScalar(0.08);
    controls.current.target.add(shift);
    camera.position.add(shift);
    last.current.add(shift);
    controls.current.update();
    const yaw = Math.atan2(
      camera.position.x - controls.current.target.x,
      camera.position.z - controls.current.target.z,
    );
    if (Math.abs(yaw - lastYaw.current) > 0.015) {
      lastYaw.current = yaw;
      onCameraYaw(yaw);
    }
  });
  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.48}
      zoomSpeed={0.75}
      minPolarAngle={0.32}
      maxPolarAngle={1.31}
      minAzimuthAngle={-1.8}
      maxAzimuthAngle={1.8}
      minDistance={6}
      maxDistance={30}
    />
  );
}

function VillageContents(props: Props) {
  const maps = useVillageMaterials();
  useEffect(() => {
    props.onReady();
  }, []);
  const startingPlayer = props.player ?? {
    id: "guest",
    name: "",
    x: 51,
    y: 76,
  };
  return (
    <>
      <fog attach="fog" args={["#bba3a0", 58, 210]} />
      <hemisphereLight args={["#d5eaff", "#9c755f", 2.1]} />
      <ambientLight intensity={0.38} />
      <directionalLight
        position={[-20, 14, -30]}
        intensity={2.6}
        color="#ffd6a0"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
      />
      <Ocean reducedMotion={props.reducedMotion} />
      <Island onMoveTo={props.onMoveTo} maps={maps} />
      <Rocks />
      <Palm position={[-13.6, groundY, -10.0]} scale={1.15} />
      <Palm position={[12.8, groundY, -11.8]} scale={1.05} />
      <House club maps={maps} onEnterClub={props.onEnterClub} />
      <House maps={maps} onEnterClub={props.onEnterClub} />
      <Pier maps={maps} />
      <Avatar
        actor={{ id: "guard", name: "가드 모카", look: "guard", x: 59, y: 56 }}
        frame={0}
        reducedMotion={props.reducedMotion}
      />
      <Avatar
        actor={{ id: "lilac", name: "라일락", look: "bun", x: 32, y: 65 }}
        frame={0}
        reducedMotion={props.reducedMotion}
      />
      {!props.guest && props.player && (
        <Avatar
          actor={props.player}
          frame={props.frame}
          reducedMotion={props.reducedMotion}
        />
      )}
      {props.neighbors.map((neighbor) => (
        <Avatar
          key={neighbor.id}
          actor={neighbor}
          frame={props.frame}
          reducedMotion={props.reducedMotion}
        />
      ))}
      <CameraRig player={startingPlayer} onCameraYaw={props.onCameraYaw} />
    </>
  );
}

export default function CapyVillage3D(props: Props) {
  return (
    <div className="capy-world-3d" aria-label="3D 노을 마을">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ fov: 51, near: 0.1, far: 700, position: [0, 8, 16] }}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        }}
      >
        <Suspense fallback={null}>
          <VillageContents {...props} />
        </Suspense>
      </Canvas>
    </div>
  );
}

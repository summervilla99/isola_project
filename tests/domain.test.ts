import { describe, it, expect } from "vitest";
import {
  demoWorld,
  reduceDemo,
  validateLayout,
  pathfind,
  itemInput,
} from "../src/domain/world";
describe("space rules", () => {
  it("rejects overlapping and off-grid furniture", () => {
    expect(
      validateLayout([
        { id: "a", asset: "table", x: 0, z: 0, rotation: 0 },
        { id: "b", asset: "plant", x: 1, z: 1, rotation: 0 },
      ]),
    ).toContain("겹");
    expect(
      validateLayout([{ id: "a", asset: "table", x: 11, z: 11, rotation: 0 }]),
    ).toContain("경계");
  });
  it("keeps entrance clear", () =>
    expect(
      validateLayout([{ id: "a", asset: "chair", x: 6, z: 11, rotation: 0 }]),
    ).toContain("출입구"));
  it("rejects isolated pockets", () =>
    expect(
      validateLayout([
        { id: "a", asset: "chair", x: 0, z: 1, rotation: 0 },
        { id: "b", asset: "chair", x: 1, z: 0, rotation: 0 },
      ]),
    ).toContain("통로"));
  it("finds a route around obstacles", () => {
    const p = pathfind([0, 0], [2, 0], new Set(["1,0"]), 4);
    expect(p).toEqual([
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [2, 0],
    ]);
  });
  it("prevents stale save and protects other owners", () => {
    const s = demoWorld(),
      sp = s.spaces.find((s) => s.owner === "demo-me")!;
    const first = reduceDemo(s, {
      type: "space.save",
      id: sp.id,
      revision: 0,
      placements: [],
    });
    expect(() =>
      reduceDemo(first, {
        type: "space.save",
        id: sp.id,
        revision: 0,
        placements: [],
      }),
    ).toThrow("다른 창");
    expect(() =>
      reduceDemo(s, {
        type: "space.save",
        id: s.spaces.find((s) => s.owner !== "demo-me")!.id,
        revision: 0,
        placements: [],
      }),
    ).toThrow("내 공간");
  });
  it("does not delete source archive when removing a display", () => {
    const s = demoWorld(),
      sp = s.spaces[0];
    const next = reduceDemo(s, {
      type: "space.save",
      id: sp.id,
      revision: 0,
      placements: [],
    });
    expect(next.items).toHaveLength(s.items.length);
  });
  it("does not publish private archive", () => {
    const s = demoWorld();
    s.items[0].visibility = "private";
    expect(() =>
      reduceDemo(s, { type: "space.publish", id: s.spaces[0].id, revision: 0 }),
    ).toThrow("공개");
  });
  it("rejects tags and blank titles", () => {
    expect(
      itemInput.safeParse({
        kind: "book",
        title: " ",
        creator: "",
        note: "",
        tags: [],
        visibility: "private",
      }).success,
    ).toBe(false);
  });
});

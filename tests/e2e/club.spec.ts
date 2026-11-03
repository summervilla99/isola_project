import { expect, test } from "@playwright/test";

test("a capybara can enter the club, dance, toast, and return to the village", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "카피바라 마을 광장" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "카피바라 클럽 입장" }).click();
  await expect(
    page.getByRole("region", { name: "카피바라 클럽" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "춤추기" }).click();
  await expect(page.getByRole("button", { name: "춤추기" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "맥주로 건배" }).click();
  await expect(page.locator(".capy-player .capy-bubble")).toHaveText(
    "건배! 🍺",
  );
  await page.getByRole("button", { name: "음악 켜기" }).click();
  await expect(page.getByRole("button", { name: "음악 끄기" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "마을로 나가기" }).click();
  await expect(
    page.getByRole("region", { name: "카피바라 마을 광장" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "카피바라 클럽 입장" }),
  ).toBeVisible();
});

test("walking toward the doorway changes the character direction and enters the club", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".capy-plaza")).toHaveClass(/has-world-3d/, {
    timeout: 20000,
  });
  await page.keyboard.down("ArrowUp");
  await expect(page.getByLabel("내 카피바라").locator("img")).toHaveAttribute(
    "src",
    /walk\/back-/,
  );
  await expect(page.getByRole("region", { name: "카피바라 클럽" })).toBeVisible(
    { timeout: 6000 },
  );
  await page.keyboard.up("ArrowUp");
});

test("clicking the 3D ground walks the capybara toward that point", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".capy-plaza")).toHaveClass(/has-world-3d/, {
    timeout: 20000,
  });
  const player = page.getByLabel("내 카피바라");
  const left = async () =>
    Number.parseFloat(
      (await player.getAttribute("style"))?.match(/left: ([\d.]+)%/)?.[1] ??
        "0",
    );
  const before = await left();
  const canvas = page.locator(".capy-world-3d canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await canvas.click({
    position: { x: box!.width * 0.68, y: box!.height * 0.65 },
  });
  await expect.poll(left).toBeGreaterThan(before + 3);
});

test("holding the mobile direction pad moves continuously", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".capy-island-chip")).toContainText("샘플");
  const player = page.getByLabel("내 카피바라");
  const before = Number.parseFloat(
    (await player.getAttribute("style"))?.match(/top: ([\d.]+)%/)?.[1] ?? "0",
  );
  const button = page.getByRole("button", { name: "위로 이동" });
  const box = await button.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  const after = Number.parseFloat(
    (await player.getAttribute("style"))?.match(/top: ([\d.]+)%/)?.[1] ?? "0",
  );
  expect(after).toBeLessThan(before - 3.5);
  await expect(player.locator("img")).toHaveAttribute("src", /walk\/back-/);
});

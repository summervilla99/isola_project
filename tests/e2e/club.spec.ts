import { expect, test } from "@playwright/test";

test("a capybara can enter the club, dance, toast, and return to the village", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "카피바라로 들어가기" }).click();
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

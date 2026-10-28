import { test, expect } from "@playwright/test";
test("sample records persist and are explicitly separate from real accounts", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "샘플 섬 둘러보기", exact: true })
    .click();
  await expect(
    page.getByText("샘플 섬 · 변경사항은 이 브라우저에만 저장돼요"),
  ).toBeVisible();
  if (await page.getByRole("button", { name: "메뉴 열기" }).isVisible())
    await page.getByRole("button", { name: "메뉴 열기" }).click();
  await page.getByRole("button", { name: "취향 서랍", exact: true }).click();
  await page
    .getByRole("button", { name: "취향 기록하기", exact: true })
    .click();
  await page.getByLabel("제목 / 이름", { exact: true }).fill("테스트 책");
  await page
    .getByRole("button", { name: "취향 서랍에 담기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "테스트 책", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "오늘도, 우리의 섬에서. ✳" }),
  ).toBeVisible();
  if (await page.getByRole("button", { name: "메뉴 열기" }).isVisible())
    await page.getByRole("button", { name: "메뉴 열기" }).click();
  await page.getByRole("button", { name: "취향 서랍", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "테스트 책", exact: true }),
  ).toBeVisible();
});
test("list fallback and space editor save the draft before publication", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "샘플 섬 둘러보기", exact: true })
    .click();
  await page.getByRole("button", { name: "목록 보기", exact: true }).click();
  await page.getByRole("button").filter({ hasText: "나의 집" }).first().click();
  await page.getByRole("button", { name: "공간 꾸미기", exact: true }).click();
  await page.getByRole("button", { name: "놓기", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "섬 친구들에게 공개", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "초안 저장", exact: true }).click();
  await page
    .getByRole("button", { name: "섬 친구들에게 공개", exact: true })
    .click();
  await expect(page.getByText("친구들에게 공간을 공개했어요.")).toBeVisible();
});

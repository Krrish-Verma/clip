import { test, expect } from "@playwright/test";

test("camera recording saves a playable draft and restores it after reload", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/record");
  await page
    .getByRole("combobox", { name: "Record", exact: true })
    .selectOption("camera");
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(
    page.getByRole("button", { name: "Finish recording" }),
  ).toBeVisible({ timeout: 20000 });
  await expect
    .poll(() =>
      page
        .getByLabel("Live screen preview")
        .evaluate((v: HTMLVideoElement) => v.videoWidth),
    )
    .toBeGreaterThan(0);
  await page.waitForTimeout(2200); // MediaRecorder writes durable chunks once a second.
  await page.getByRole("button", { name: "Finish recording" }).click();
  await expect(page.getByLabel("Recording preview")).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByLabel("Recording preview")
        .evaluate((v: HTMLVideoElement) => v.readyState),
    )
    .toBeGreaterThanOrEqual(2);
  page.on("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(
    page.getByText("Your last recording is still here."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect
    .poll(() =>
      page
        .getByLabel("Recording preview")
        .evaluate((v: HTMLVideoElement) => v.videoWidth),
    )
    .toBeGreaterThan(0);
});

test("studio sends ranges, framing, and blur settings and fits a mobile viewport", async ({
  page,
}) => {
  const clip = {
    id: "one",
    title: "Project walkthrough",
    status: "READY",
    durationSeconds: 20,
    canManage: true,
    publishedRevision: 0,
  };
  let submitted: Record<string, unknown> | undefined;
  await page.route("http://127.0.0.1:8080/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = clip;
    if (path === "/api/videos") body = [clip];
    if (path.endsWith("/playback")) body = { playbackUrl: "" };
    if (path.endsWith("/studio"))
      body = {
        revision: 0,
        jobStatus: "SUCCEEDED",
        transcriptStatus: "NOT_STARTED",
        description: "",
      };
    if (path.endsWith("/edits")) {
      submitted = route.request().postDataJSON();
      await route.fulfill({ status: 202 });
      return;
    }
    await route.fulfill({
      json: body,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.goto("/videos/one/edit");
  await expect(
    page.getByRole("heading", { name: "Project walkthrough" }),
  ).toBeVisible();
  await page.getByLabel("Start of segment 1").fill("2");
  await page.getByLabel("End of segment 1").fill("12");
  await page.getByLabel("Output format").selectOption("portrait");
  await page.getByLabel("Text overlay", { exact: true }).fill("Next step");
  await page.getByRole("button", { name: "Add blur", exact: true }).click();
  await page.getByRole("button", { name: "Render changes" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Render revision", exact: true })
    .click();
  await expect.poll(() => submitted).toBeTruthy();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(submitted).toMatchObject({
    segments: [{ videoId: "one", start: 2, end: 12 }],
    aspect: "portrait",
    overlayText: "Next step",
    blurs: [{ x: 0.1, y: 0.1, width: 0.25, height: 0.15 }],
  });
  await page.setViewportSize({ width: 390, height: 850 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".runtime/qa/studio-mobile.png",
    caret: "initial",
    fullPage: true,
  });
});

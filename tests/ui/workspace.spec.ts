import { test, expect } from "@playwright/test";

test("library filters and keyboard navigation work without cloud configuration", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "My library." }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Favorites/ }).click();
  await expect(
    page.getByRole("heading", { name: "Keep your best thinking close." }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Archive/ }).click();
  await expect(
    page.getByRole("heading", { name: "Nothing in the archive." }),
  ).toBeVisible();
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("link", { name: "Record a video" }).click();
  await expect(page).toHaveURL(/\/record$/);
  await expect(
    page.getByRole("button", { name: "Start recording" }),
  ).toBeVisible();
});

test("desktop and mobile library layouts fit the viewport", async ({
  page,
}) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "My library." }),
    ).toBeVisible();
    // Wait for React hydration before Playwright temporarily hides input carets.
    await page.getByRole("button", { name: /^Favorites/ }).click();
    await expect(page.getByRole("heading", { name: "Keep your best thinking close." })).toBeVisible();
    await page.getByRole("button", { name: /^All videos/ }).click();
    await expect(page.getByRole("heading", { name: "My library." })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.runtime/qa/library-${width}.png`,
      fullPage: true,
    });
  }
});

test("landing and recorder pages render with no client errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const route of ["/", "/record"]) {
    await page.goto(route);
    await expect(
      page.getByRole("button", { name: "Start recording" }),
    ).toBeVisible();
    await page.screenshot({
      path: `.runtime/qa/${route === "/" ? "landing" : "recorder"}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});

test("shared video guests can reply to the correct timestamped thread", async ({
  page,
}) => {
  // Transport fixtures exercise the presentation; real persistence has separate PostgreSQL tests.
  const root = {
    id: "root",
    displayName: "Alex",
    message: "What happens next?",
    timestampSeconds: 4,
    createdAt: "2026-10-26T12:00:00Z",
    resolved: false,
  };
  const messages = [root];
  const posted: Record<string, unknown>[] = [];
  await page.route("http://127.0.0.1:8080/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path.startsWith("/api/shares/"))
      body = {
        id: "clip",
        title: "A project walkthrough",
        status: "READY",
        visibility: "UNLISTED",
        durationSeconds: 30,
        createdAt: root.createdAt,
        views: 2,
        creatorDisplayName: "Alex",
        playbackUrl: "",
        favorite: false,
        archived: false,
      };
    if (path.endsWith("/comments")) {
      if (route.request().method() === "POST") {
        const data = route.request().postDataJSON();
        posted.push(data);
        const reply = {
          ...root,
          ...data,
          id: "reply",
          displayName: data.guestDisplayName,
        };
        messages.push(reply);
        body = reply;
      } else body = messages;
    }
    await route.fulfill({
      json: body,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.goto("/s/test-share");
  await expect(page.getByText("What happens next?")).toBeVisible();
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await page.getByPlaceholder("Your name").fill("Jamie");
  await page
    .getByLabel("Comment", { exact: true })
    .fill("Please show the next step.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Please show the next step.")).toBeVisible();
  expect(posted).toHaveLength(1);
  expect(posted[0]).toMatchObject({
    parentId: "root",
    timestampSeconds: 4,
    guestDisplayName: "Jamie",
  });
});

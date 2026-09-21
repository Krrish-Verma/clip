import { chmod, lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// OneDrive can mark generated directories read-only, which prevents Next.js
// from removing its previous build on Windows. Only touch this project's
// disposable .next output; never follow symbolic links or modify source files.
if (process.platform === "win32") {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.next");
  async function makeBuildDirectoriesWritable(directory) {
    const stats = await lstat(directory);
    if (!stats.isDirectory() || stats.isSymbolicLink()) return;
    await chmod(directory, 0o777);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        await makeBuildDirectoriesWritable(path.join(directory, entry.name));
      }
    }
  }
  try {
    await makeBuildDirectoriesWritable(root);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { BlobStore } from "../ports";

/** Filesystem BlobStore (architecture C). Keys are `/`-separated relative paths. */
export class FsBlobStore implements BlobStore {
  private readonly root: string;

  constructor(rootDir: string) {
    this.root = resolve(rootDir);
  }

  private pathFor(key: string): string {
    const full = resolve(this.root, key);
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error(`blob key escapes store root: ${key}`);
    }
    return full;
  }

  async put(key: string, data: Uint8Array): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async get(key: string): Promise<Uint8Array | undefined> {
    const path = this.pathFor(key);
    if (!existsSync(path)) return undefined;
    return new Uint8Array(await readFile(path));
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async list(prefix: string): Promise<string[]> {
    if (!existsSync(this.root)) return [];
    const entries = await readdir(this.root, { recursive: true, withFileTypes: true });
    return entries
      .filter((e) => e.isFile())
      .map((e) => relative(this.root, join(e.parentPath, e.name)).split(sep).join("/"))
      .filter((k) => k.startsWith(prefix))
      .sort();
  }
}

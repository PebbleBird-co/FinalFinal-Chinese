import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, normalize, relative, resolve } from 'node:path';

function canonicalPath(path: string): string {
  const normalized = normalize(path);
  return process.platform === 'win32' ? normalized.toLocaleLowerCase('en-US') : normalized;
}

export async function resolveDirectoryPath(inputPath: string): Promise<string> {
  if (typeof inputPath !== 'string' || inputPath.trim().length === 0 || !isAbsolute(inputPath)) {
    throw new Error('Directory path must be a non-empty absolute path.');
  }

  const resolvedPath = await realpath(resolve(inputPath));
  const metadata = await stat(resolvedPath);
  if (!metadata.isDirectory()) throw new Error('Selected path is not a directory.');

  return normalize(resolvedPath);
}

export function isPathInsideRoot(rootPath: string, candidatePath: string): boolean {
  const canonicalRoot = canonicalPath(rootPath);
  const canonicalCandidate = canonicalPath(candidatePath);
  const relativePath = relative(canonicalRoot, canonicalCandidate);

  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
}

export class DirectoryAccessRegistry {
  private readonly authorizedDirectories = new Set<string>();

  authorize(path: string): void {
    this.authorizedDirectories.add(canonicalPath(path));
  }

  assertAuthorized(path: string): void {
    if (!this.authorizedDirectories.has(canonicalPath(path))) {
      throw new Error('Directory access was not authorized by the user.');
    }
  }
}

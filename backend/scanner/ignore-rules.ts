const IGNORED_DIRECTORY_NAMES = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  '.cache',
]);

const IGNORED_FILE_NAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);
const IGNORED_FILE_EXTENSIONS = new Set(['.tmp', '.temp', '.lock']);

export function shouldIgnoreDirectory(name: string): boolean {
  return IGNORED_DIRECTORY_NAMES.has(name);
}

export function shouldIgnoreFile(name: string): boolean {
  if (IGNORED_FILE_NAMES.has(name) || name.startsWith('~$')) return true;

  const lowerName = name.toLowerCase();
  return [...IGNORED_FILE_EXTENSIONS].some((extension) => lowerName.endsWith(extension));
}

export const DEFAULT_IGNORE_RULES = Object.freeze([
  ...IGNORED_DIRECTORY_NAMES,
  ...IGNORED_FILE_NAMES,
  '~$*',
  '*.tmp',
  '*.temp',
  '*.lock',
]);

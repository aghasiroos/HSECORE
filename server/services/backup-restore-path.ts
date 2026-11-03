import path from 'node:path';

/**
 * Resolves an archive-provided relative file path beneath the restore root.
 * Rejects absolute paths and traversal segments instead of trying to sanitize
 * them into a different destination.
 */
export function resolveBackupRestorePath(rootDir: string, archivePath: string): string {
  if (typeof archivePath !== 'string' || archivePath.length === 0 || archivePath.includes('\0')) {
    throw new Error('مسیر فایل در آرشیو پشتیبان خالی یا نامعتبر است.');
  }

  const normalizedInput = archivePath.replace(/\\/g, '/');
  if (
    normalizedInput.startsWith('/') ||
    path.posix.isAbsolute(normalizedInput) ||
    path.win32.isAbsolute(archivePath) ||
    /^[a-zA-Z]:/.test(normalizedInput)
  ) {
    throw new Error('مسیر مطلق در آرشیو پشتیبان مجاز نیست.');
  }

  const segments = normalizedInput.split('/');
  if (segments.some((segment) => segment === '..' || segment === '.' || segment.length === 0)) {
    throw new Error('مسیر فایل در آرشیو پشتیبان خارج از پوشه مقصد یا نامعتبر است.');
  }

  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, ...segments);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('مسیر فایل در آرشیو پشتیبان خارج از پوشه مقصد است.');
  }

  return resolved;
}

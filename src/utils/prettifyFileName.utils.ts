export function prettifyFileName(filename: string): string {
  // Split name and extension
  const lastDotIndex = filename.lastIndexOf(".");
  const name = filename.substring(0, lastDotIndex);
  const ext = filename.substring(lastDotIndex);

  // Replace spaces and parentheses with dash
  let cleanName = name.replace(/\s*\(\s*(\d+)\s*\)\s*/g, "-$1"); // "(1)" → "-1"
  cleanName = cleanName.replace(/\s+/g, "-"); // spaces → dash
  cleanName = cleanName.replace(/[^a-zA-Z0-9-_]/g, ""); // remove any other unwanted chars

  // Combine with extension
  return `${cleanName}${ext}`;
}

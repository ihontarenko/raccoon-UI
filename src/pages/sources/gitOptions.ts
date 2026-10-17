// A git source's options, shared by the new-source form and the source page. Where the repository is hosted, and the
// token it is read with, belong to the connection the source reads through.

/** A git source's options as stored: only what was given. */
export function gitOptionsOf(branch: string): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  if (branch.trim() !== "") {
    options.branch = branch.trim();
  }
  return options;
}

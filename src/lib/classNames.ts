import { clsx, type ClassValue } from "clsx";

/**
 * Joins Tailwind class names, dropping whatever is `false`, `null` or `undefined`.
 *
 * ⚠️ DELIBERATELY NOT `tailwind-merge`, and this is the one decision in the file. `twMerge` resolves
 * a conflict by knowing which utilities set the same property — and it knows Tailwind's own scale,
 * not this product's. `text-md` is a size here and `text-muted` is a colour, and neither name exists
 * in `twMerge`'s tables: it reads both as the same `text-*` group and keeps only the last, so a label
 * written `text-md text-muted` silently loses its size. Joining without merging cannot lose a class;
 * the cost is that a component must not name the same property twice, which is a thing to get right
 * once rather than a thing to paper over on every call.
 */
export function classNames(...values: ClassValue[]): string {
  return clsx(values);
}

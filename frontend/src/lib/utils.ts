import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Removes frontmatter from MDX content
 * Frontmatter is the section between --- markers at the beginning of the content
 */
export function stripFrontmatter(mdxContent: string): string {
  if (!mdxContent) return '';

  // Check if the content starts with frontmatter (---)
  if (mdxContent.trim().startsWith('---')) {
    // Find the end of the frontmatter (the second ---)
    const secondDashIndex = mdxContent.indexOf('---', 3);

    if (secondDashIndex !== -1) {
      // Return everything after the second --- and any following whitespace
      return mdxContent.substring(secondDashIndex + 3).trim();
    }
  }

  // If no frontmatter found or format is unexpected, return the original content
  return mdxContent;
}

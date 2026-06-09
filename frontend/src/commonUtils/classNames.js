// Joins truthy class name fragments with a space — a minimal `clsx` substitute
// for combining literal SCSS class names with conditional Tailwind utilities.
export const classNames = (...fragments) => fragments.filter(Boolean).join(' ');

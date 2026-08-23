import { Moon, Sun } from 'lucide-react';
import { setTheme, useTheme, type Theme } from '@/lib/theme';

interface Props {
  className?: string;
}

/**
 * Light/dark switch.
 *
 * Two states rather than three: the OS preference is the starting point and
 * needs no menu entry, and a "system" option people have to reason about buys
 * very little on a switch they press once. Until it is pressed the app keeps
 * following the OS, including when the OS changes mid-session.
 */
export function ThemeToggle({ className }: Props) {
  const theme = useTheme();
  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      className={`theme-toggle${className ? ` ${className}` : ''}`}
      onClick={event => {
        // The wipe grows from the button, so it needs where the button is.
        const box = event.currentTarget.getBoundingClientRect();
        setTheme(next, { x: box.left + box.width / 2, y: box.top + box.height / 2 });
      }}
      title={next === 'dark' ? 'Switch to dark' : 'Switch to light'}
      aria-label={next === 'dark' ? 'Switch to dark theme' : 'Switch to light theme'}
    >
      <Sun className="theme-icon theme-icon--sun h-4 w-4" />
      <Moon className="theme-icon theme-icon--moon h-4 w-4" />
    </button>
  );
}

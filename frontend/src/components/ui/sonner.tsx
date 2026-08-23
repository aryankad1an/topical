import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/lib/theme";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Toast surface, themed from the app's own theme.
 *
 * It used to read `next-themes`, which this app never installs a provider for,
 * so every toast rendered "system" — the OS theme — and looked wrong for
 * anyone who had used the switch to disagree with their OS.
 */
const Toaster = (props: ToasterProps) => (
  <Sonner theme={useTheme()} className="toaster group" {...props} />
);

export { Toaster };

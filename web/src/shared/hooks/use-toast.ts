import { toast as sonnerToast } from "sonner";

type ToastInput = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
};

function toast({ title, description, variant }: ToastInput) {
  const msg = title ?? description ?? "";
  const opts = title && description ? { description } : undefined;
  if (variant === "destructive") return sonnerToast.error(msg, opts);
  return sonnerToast(msg, opts);
}

export function useToast() {
  return { toast };
}

export { toast };
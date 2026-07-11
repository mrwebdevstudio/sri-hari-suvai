type AnimatedImagePlaceholderProps = {
  label?: string;
  animated?: boolean;
  className?: string;
};

export function AnimatedImagePlaceholder({
  label = "Product image unavailable",
  animated = true,
  className = "",
}: AnimatedImagePlaceholderProps) {
  return (
    <div
      className={["image-placeholder", animated ? "image-placeholder--animated" : "", className]
        .filter(Boolean)
        .join(" ")}
      role="img"
      aria-label={label}
    >
      <span aria-hidden="true">Sri Hari Suvai</span>
    </div>
  );
}

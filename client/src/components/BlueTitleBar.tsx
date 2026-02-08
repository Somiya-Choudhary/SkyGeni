
type Props = {
  title?: string;
};

export default function BlueTitleBar({ title = "Other Graph" }: Props) {
  return (
    <div
      style={{
        width: "100%",
        height: 48,
        display: "flex",
        alignItems: "center",
        padding: "0 18px",
        boxSizing: "border-box",
        borderRadius: 6,
        background: "linear-gradient(180deg, #2f6fb0 0%, #1f4f85 100%)",
        border: "1px solid rgba(255,255,255,0.22)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
        color: "#fff",
      }}
    >
      <span
        style={{
          fontFamily:
            'system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif',
          fontWeight: 800,
          fontSize: 22,
        }}
      >
        {title}
      </span>
    </div>
  );
}

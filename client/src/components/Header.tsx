import { MessageSquare, Bell, Mail, User } from "lucide-react";

function Header() {
  return (
    <header
        style={{
            width: "100%",
            height: "56px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            background: "linear-gradient(135deg, #0f2a44, #1e4f8f)",
            color: "#ffffff",
            boxSizing: "border-box",
        }}
    >
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
        SkyGeni
      </h1>
      <div style={{ display: "flex", gap: 8 }}>
        <button><MessageSquare size={20} /></button>
        <button><Bell size={20} /></button>
        <button><Mail size={20} /></button>
        <button><User size={20} /></button>
      </div>
    </header>
  );
}

export default Header;

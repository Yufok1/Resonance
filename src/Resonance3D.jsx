{inputPos && (
  <div
    style={{
      position: "fixed",
      top: 20,
      left: 60,            // shift right from 20 to 60 px
      background: "rgba(0,0,0,0.85)",
      padding: 15,         // bigger padding
      borderRadius: 8,
      zIndex: 10,
      width: 400,          // wider box for paragraphs
      maxWidth: "80vw",
      boxShadow: "0 0 15px rgba(255,255,255,0.1)"
    }}
  >
    <textarea
      autoFocus
      value={input}
      onChange={(e) => setInput(e.target.value)}
      placeholder="Type your ripple..."
      style={{
        fontSize: 16,
        padding: 10,
        width: "100%",
        height: 120,       // taller textarea for paragraphs
        borderRadius: 5,
        border: "1px solid #555",
        backgroundColor: "#111",
        color: "white",
        resize: "vertical",
        fontFamily: "monospace",
        lineHeight: 1.4,
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();  // prevent newline on enter without shift
          addRipple();
        }
        if (e.key === "Escape") setInputPos(null);
      }}
    />
    <div style={{ marginTop: 10, textAlign: "right" }}>
      <button onClick={addRipple} style={{ padding: "6px 14px", marginRight: 8 }}>
        Add
      </button>
      <button onClick={() => setInputPos(null)} style={{ padding: "6px 14px" }}>
        Cancel
      </button>
    </div>
  </div>
)}

// src/Resonance3D.jsx
import React, { useState, useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { database } from "./firebase";
import {
  ref,
  onValue,
  push,
  remove,
  query,
  limitToLast
} from "firebase/database";
import PlacementHUD from "./PlacementHUD";

function Ripple({ id, text, position, onDelete }) {
  const ref = useRef();
  const { camera } = useThree();

  useEffect(() => {
    if (ref.current) {
      ref.current.lookAt(camera.position);
    }
  }, [camera]);

  return (
    <group position={position}>
      <Text
        ref={ref}
        fontSize={0.5}
        color="white"
        anchorX="center"
        anchorY="middle"
        maxWidth={4}
        lineHeight={1}
        onClick={() => onDelete(id)}
        style={{ cursor: "pointer" }}
      >
        {text}
      </Text>
    </group>
  );
}

function ProceduralObject({ position, color, shape = "box" }) {
  const ref = useRef();
  const { camera } = useThree();

  useEffect(() => {
    if (ref.current) {
      ref.current.lookAt(camera.position);
    }
  });

  let geometry;
  switch (shape.toLowerCase()) {
    case "sphere":
      geometry = <sphereGeometry args={[0.75, 32, 32]} />;
      break;
    case "cone":
      geometry = <coneGeometry args={[0.7, 1.2, 32]} />;
      break;
    case "cylinder":
      geometry = <cylinderGeometry args={[0.5, 0.5, 1.2, 32]} />;
      break;
    case "torus":
      geometry = <torusGeometry args={[0.5, 0.2, 16, 100]} />;
      break;
    default:
      geometry = <boxGeometry args={[1, 1, 1]} />;
  }

  return (
    <mesh position={position} ref={ref} castShadow>
      {geometry}
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

export default function Resonance3D() {
  const [ripples, setRipples] = useState([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("text"); // "text" or "object"
  const previewRef = useRef();

  useEffect(() => {
    const ripplesRef = query(ref(database, "ripples"), limitToLast(100));
    const unsubscribe = onValue(ripplesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const all = Object.entries(data).map(([id, r]) => ({ id, ...r }));
      setRipples(all);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Enter" && previewRef.current) {
        const pos = previewRef.current.position.toArray();
        const now = Date.now();

        if (mode === "text") {
          push(ref(database, "ripples"), {
            type: "text",
            text: input,
            position: pos,
            createdAt: now,
          });
        } else {
          let color = "gray";
          if (input.toLowerCase().includes("red")) color = "red";
          else if (input.toLowerCase().includes("blue")) color = "blue";
          else if (input.toLowerCase().includes("green")) color = "green";

          let shape = "box";
          if (input.toLowerCase().includes("sphere")) shape = "sphere";
          else if (input.toLowerCase().includes("cone")) shape = "cone";
          else if (input.toLowerCase().includes("cylinder")) shape = "cylinder";
          else if (input.toLowerCase().includes("torus")) shape = "torus";

          push(ref(database, "ripples"), {
            type: "object",
            shape,
            color,
            position: pos,
            createdAt: now,
          });
        }

        setInput("");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [input, mode]);

  const deleteRipple = (id) => {
    remove(ref(database, `ripples/${id}`));
  };

  return (
    <>
      <div style={{ position: "fixed", top: 20, left: 20, zIndex: 20 }}>
        <button
          onClick={() => setMode(mode === "text" ? "object" : "text")}
          style={{ padding: "8px 16px" }}
        >
          Switch to {mode === "text" ? "Object" : "Text"} Mode
        </button>
      </div>

      <Canvas shadows camera={{ position: [0, 5, 10], fov: 60 }} style={{ height: "100vh", background: "black" }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 7]} intensity={1} castShadow />
        <OrbitControls />

        {/* HUD */}
        <PlacementHUD
          shape={mode === "text" ? "box" : "sphere"}
          text={input}
          color="cyan"
          previewRef={previewRef}
        />

        {/* Render all ripple types */}
        {ripples.map(({ id, type, text, shape, color, position }) =>
          type === "text" ? (
            <Ripple key={id} id={id} text={text} position={position} onDelete={deleteRipple} />
          ) : (
            <ProceduralObject key={id} position={position} shape={shape} color={color} />
          )
        )}
      </Canvas>

      {/* Input UI */}
      <div style={{ position: "fixed", bottom: 20, left: 20, zIndex: 30 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === "text" ? "Type your ripple..." : "Type object prompt (e.g. 'red sphere')..."}
          style={{
            fontSize: 16,
            padding: 10,
            width: 300,
            height: 80,
            borderRadius: 5,
            border: "1px solid #555",
            backgroundColor: "#111",
            color: "white",
            resize: "none",
            fontFamily: "monospace",
            lineHeight: 1.4,
          }}
        />
      </div>
    </>
  );
}

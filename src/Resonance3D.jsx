import React, { useState, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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

// --- Ripple component (text facing camera) ---
function Ripple({ id, text, position, onDelete }) {
  const ref = useRef();
  const { camera } = useThree();

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = position[1] + Math.sin(clock.getElapsedTime() + position[0]) * 0.1;
      ref.current.lookAt(camera.position);
    }
  });

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

// --- Procedural Object component ---
function ProceduralObject({ position, color }) {
  const ref = useRef();
  const { camera } = useThree();

  useFrame(({ clock }) => {
    if (ref.current) {
      // simple floating animation
      ref.current.position.y = position[1] + Math.sin(clock.getElapsedTime()) * 0.2;
      ref.current.lookAt(camera.position);
    }
  });

  return (
    <mesh position={position} ref={ref} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

export default function Resonance3D() {
  const [ripples, setRipples] = useState([]);
  const [objects, setObjects] = useState([]);
  const [input, setInput] = useState("");
  const [inputPos, setInputPos] = useState(null);
  const [mode, setMode] = useState("text"); // "text" or "object"

  // Load ripples from Firebase
  React.useEffect(() => {
    const ripplesRef = query(ref(database, "ripples"), limitToLast(100));
    const unsubscribe = onValue(ripplesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const loadedRipples = Object.entries(data).map(([id, ripple]) => ({
        id,
        text: ripple.text,
        position: ripple.position,
      }));
      setRipples(loadedRipples);
    });
    return () => unsubscribe();
  }, []);

  // Add ripple to Firebase
  const addRipple = () => {
    if (!input.trim() || !inputPos) return;
    const ripplesRef = ref(database, "ripples");
    push(ripplesRef, { text: input, position: inputPos });
    setInput("");
    setInputPos(null);
  };

  // Delete ripple from Firebase
  const deleteRipple = (id) => {
    const rippleRef = ref(database, `ripples/${id}`);
    remove(rippleRef);
  };

  // Procedural object generator (simple example)
  const generateObjectsFromPrompt = (prompt, position) => {
    // Basic example: generate a colored cube or sphere based on keywords
    const newObjects = [];
    if (prompt.toLowerCase().includes("red")) {
      newObjects.push({ position, color: "red" });
    } else if (prompt.toLowerCase().includes("blue")) {
      newObjects.push({ position, color: "blue" });
    } else {
      newObjects.push({ position, color: "gray" });
    }
    setObjects((objs) => [...objs, ...newObjects]);
    setInputPos(null);
    setInput("");
  };

  // Handle canvas click to set input position
  const handleCanvasClick = (event) => {
    event.stopPropagation();
    setInputPos([event.point.x, event.point.y + 0.5, event.point.z]);
  };

  // Handle form submit based on mode
  const handleSubmit = () => {
    if (mode === "text") {
      addRipple();
    } else if (mode === "object") {
      generateObjectsFromPrompt(input, inputPos);
    }
  };

  return (
    <>
      {/* Mode toggle button */}
      <div style={{ position: "fixed", top: 20, left: 20, zIndex: 20 }}>
        <button
          onClick={() => setMode(mode === "text" ? "object" : "text")}
          style={{ padding: "8px 16px" }}
        >
          Switch to {mode === "text" ? "Object" : "Text"} Mode
        </button>
      </div>

      <Canvas
        shadows
        camera={{ position: [0, 5, 10], fov: 60 }}
        style={{ height: "100vh", background: "black" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 7]} intensity={1} castShadow />
        <OrbitControls />
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          onClick={handleCanvasClick}
          receiveShadow
        >
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>

        {/* Render text ripples */}
        {ripples.map(({ id, text, position }) => (
          <Ripple
            key={id}
            id={id}
            text={text}
            position={position}
            onDelete={deleteRipple}
          />
        ))}

        {/* Render procedural objects */}
        {objects.map(({ position, color }, i) => (
          <ProceduralObject key={i} position={position} color={color} />
        ))}
      </Canvas>

      {/* Input area */}
      {inputPos && (
        <div
          style={{
            position: "fixed",
            top: 60,
            left: 20,
            background: "rgba(0,0,0,0.85)",
            padding: 15,
            borderRadius: 8,
            zIndex: 30,
            width: 400,
            maxWidth: "80vw",
            boxShadow: "0 0 15px rgba(255,255,255,0.1)"
          }}
        >
          <textarea
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === "text"
                ? "Type your ripple..."
                : "Type object prompt (e.g., 'red cube')..."
            }
            style={{
              fontSize: 16,
              padding: 10,
              width: "100%",
              height: 120,
              borderRadius: 5,
              border: "1px solid #555",
              backgroundColor: "#111",
              color: "white",
              resize: "vertical",
              fontFamily: "monospace",
              lineHeight: 1.4
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
              if (e.key === "Escape") setInputPos(null);
            }}
          />
          <div style={{ marginTop: 10, textAlign: "right" }}>
            <button
              onClick={handleSubmit}
              style={{ padding: "6px 14px", marginRight: 8 }}
            >
              Add
            </button>
            <button
              onClick={() => setInputPos(null)}
              style={{ padding: "6px 14px" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

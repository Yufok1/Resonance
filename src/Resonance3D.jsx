import React, { useState, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Grid } from "@react-three/drei";
import { database } from "./firebase";
import {
  ref,
  onValue,
  push,
  remove,
  query,
  limitToLast
} from "firebase/database";

// Ripple component: text faces camera once, fixed position
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

// Procedural object component (supports multiple shapes)
function ProceduralObject({ position, color, shape = "box" }) {
  const ref = useRef();
  const { camera } = useThree();

  useFrame(() => {
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

// Volumetric dot grid helper
function DotGrid({ size = 10, spacing = 2 }) {
  const dots = [];
  for (let x = -size; x <= size; x += spacing) {
    for (let y = -size; y <= size; y += spacing) {
      for (let z = -size; z <= size; z += spacing) {
        dots.push([x, y, z]);
      }
    }
  }
  return (
    <>
      {dots.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color="#555" opacity={0.15} transparent />
        </mesh>
      ))}
    </>
  );
}

export default function Resonance3D() {
  const [ripples, setRipples] = useState([]);
  const [objects, setObjects] = useState([]);
  const [input, setInput] = useState("");
  const [inputPos, setInputPos] = useState(null);
  const [mode, setMode] = useState("text"); // "text" or "object"

  // Load ripples from Firebase
  useEffect(() => {
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

  // Procedural object generation from prompt
  const generateObjectsFromPrompt = (prompt, position) => {
    let color = "gray";
    if (prompt.toLowerCase().includes("red")) color = "red";
    else if (prompt.toLowerCase().includes("blue")) color = "blue";
    else if (prompt.toLowerCase().includes("green")) color = "green";

    let shape = "box";
    if (prompt.toLowerCase().includes("sphere")) shape = "sphere";
    else if (prompt.toLowerCase().includes("cone")) shape = "cone";
    else if (prompt.toLowerCase().includes("cylinder")) shape = "cylinder";
    else if (prompt.toLowerCase().includes("torus")) shape = "torus";

    const newObject = { position, color, shape };
    setObjects((objs) => [...objs, newObject]);
    setInputPos(null);
    setInput("");
  };

  // Updated click handler with default placement 5 units in front if no hit
  const handleCanvasClick = (event) => {
    event.stopPropagation();

    if (event.intersections.length > 0) {
      setInputPos(event.intersections[0].point.toArray());
    } else {
      const { camera, raycaster } = event;
      const direction = raycaster.ray.direction.clone().normalize();
      const position = camera.position.clone().add(direction.multiplyScalar(5));
      setInputPos(position.toArray());
    }
  };

  // Submit handler based on mode
  const handleSubmit = () => {
    if (mode === "text") {
      addRipple();
    } else if (mode === "object") {
      generateObjectsFromPrompt(input, inputPos);
    }
  };

  return (
    <>
      {/* Mode toggle */}
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
        <fog attach="fog" args={["#000000", 5, 30]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 7]} intensity={1} castShadow />
        <OrbitControls />

        {/* Axes helper */}
        <axesHelper args={[5]} />

        {/* Volumetric dot grid */}
        <DotGrid size={10} spacing={2} />

        {/* Invisible plane for clicks */}
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
        {objects.map(({ position, color, shape }, i) => (
          <ProceduralObject
            key={i}
            position={position}
            color={color}
            shape={shape}
          />
        ))}
      </Canvas>

      {/* Input UI */}
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
            boxShadow: "0 0 15px rgba(255,255,255,0.1)",
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
              lineHeight: 1.4,
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

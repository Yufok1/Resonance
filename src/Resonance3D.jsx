import React, { useState, useRef, useEffect } from "react";
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

// Ripple text element that always faces the camera and fades with distance
function Ripple({ id, text, position, onDelete }) {
  const ref = useRef();
  const { camera } = useThree();
  const [opacity, setOpacity] = useState(1);

  useFrame(() => {
    if (ref.current) {
      ref.current.lookAt(camera.position);
      const distance = ref.current.position.distanceTo(camera.position);
      setOpacity(Math.max(0, 1 - distance / 50)); // Fade with distance
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
        fillOpacity={opacity}
      >
        {text}
      </Text>
    </group>
  );
}

// 3D volumetric dot grid for spatial reference
function DotGrid({ size = 20, spacing = 2 }) {
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
          <meshBasicMaterial color="#555" opacity={0.2} transparent />
        </mesh>
      ))}
    </>
  );
}

export default function Resonance3D() {
  const [ripples, setRipples] = useState([]);
  const [input, setInput] = useState("");
  const [inputPos, setInputPos] = useState(null);

  // Load latest ripples from Firebase
  useEffect(() => {
    const ripplesRef = query(ref(database, "ripples"), limitToLast(50));
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

  // Delete ripple
  const deleteRipple = (id) => {
    const rippleRef = ref(database, `ripples/${id}`);
    remove(rippleRef);
  };

  // Set input position based on click direction
  const handleCanvasClick = (event) => {
    const { camera, raycaster } = event;
    const direction = raycaster.ray.direction.clone().normalize();
    const position = camera.position.clone().add(direction.multiplyScalar(5));
    setInputPos(position.toArray());
  };

  return (
    <>
      <Canvas
        shadows
        camera={{ position: [0, 5, 10], fov: 60 }}
        style={{ height: "100vh", background: "black" }}
        onClick={handleCanvasClick}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 7]} intensity={1} castShadow />
        <OrbitControls />
        <DotGrid size={20} spacing={2} />

        {ripples.map(({ id, text, position }) => (
          <Ripple
            key={id}
            id={id}
            text={text}
            position={position}
            onDelete={deleteRipple}
          />
        ))}
      </Canvas>

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
            placeholder="Type your ripple..."
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
                addRipple();
              }
              if (e.key === "Escape") setInputPos(null);
            }}
          />
          <div style={{ marginTop: 10, textAlign: "right" }}>
            <button
              onClick={addRipple}
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

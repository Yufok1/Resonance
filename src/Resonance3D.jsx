import React, { useState, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";

function Ripple({ text, position, onDelete }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    ref.current.position.y = position[1] + Math.sin(clock.getElapsedTime() + position[0]) * 0.1;
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
        onClick={onDelete}
        style={{ cursor: "pointer" }}
      >
        {text}
      </Text>
    </group>
  );
}

function Plane({ onClick }) {
  const { viewport } = useThree();
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      onClick={onClick}
      receiveShadow
    >
      <planeBufferGeometry args={[viewport.width * 10, viewport.height * 10]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  );
}

export default function Resonance3D() {
  const [ripples, setRipples] = useState([]);
  const [input, setInput] = useState("");
  const [inputPos, setInputPos] = useState(null);

  const handleCanvasClick = (event) => {
    event.stopPropagation();
    setInputPos([event.point.x, event.point.y + 0.5, event.point.z]);
  };

  const addRipple = () => {
    if (!input.trim()) return;
    setRipples([...ripples, { id: Date.now(), text: input, position: inputPos }]);
    setInput("");
    setInputPos(null);
  };

  const deleteRipple = (id) => {
    setRipples(ripples.filter((r) => r.id !== id));
  };

  return (
    <>
      <Canvas
        shadows
        camera={{ position: [0, 5, 10], fov: 60 }}
        style={{ height: "100vh", background: "black" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 7]} intensity={1} castShadow />
        <OrbitControls />
        <Plane onClick={handleCanvasClick} />
        {ripples.map(({ id, text, position }) => (
          <Ripple key={id} text={text} position={position} onDelete={() => deleteRipple(id)} />
        ))}
      </Canvas>

      {inputPos && (
        <div
          style={{
            position: "fixed",
            top: 20,
            left: 20,
            background: "rgba(0,0,0,0.8)",
            padding: 10,
            borderRadius: 5,
            zIndex: 10,
          }}
        >
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your ripple"
            style={{ fontSize: 16, padding: 4, width: 250 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") addRipple();
              if (e.key === "Escape") setInputPos(null);
            }}
          />
          <button onClick={addRipple} style={{ marginLeft: 8, padding: "4px 8px" }}>
            Add
          </button>
          <button onClick={() => setInputPos(null)} style={{ marginLeft: 8, padding: "4px 8px" }}>
            Cancel
          </button>
        </div>
      )}
    </>
  );
}

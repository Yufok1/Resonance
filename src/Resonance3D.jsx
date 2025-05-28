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
import * as THREE from "three";

// Ripple that locks orientation on creation
function Ripple({ id, text, position, rotation, onDelete }) {
  const ref = useRef();
  const [opacity, setOpacity] = useState(1);
  const rotEuler = new THREE.Euler(...(rotation || [0, 0, 0]));

  useFrame(({ camera }) => {
    if (ref.current) {
      const distance = ref.current.position.distanceTo(camera.position);
      setOpacity(Math.max(0, 1 - distance / 50));
    }
  });

  return (
    <group position={position} rotation={rotEuler}>
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

// Ghost ripple in front of the camera
function GhostText({ text }) {
  const ref = useRef();
  const { camera } = useThree();
  const [position, setPosition] = useState([0, 0, -5]);

  useFrame(() => {
    const dir = camera.getWorldDirection(new THREE.Vector3()).normalize();
    const ghostPos = camera.position.clone().add(dir.multiplyScalar(5));
    setPosition([ghostPos.x, ghostPos.y, ghostPos.z]);
    if (ref.current) ref.current.lookAt(camera.position);
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
        fillOpacity={0.25}
      >
        {text}
      </Text>
    </group>
  );
}

// Dot field for spatial awareness
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

  useEffect(() => {
    const ripplesRef = query(ref(database, "ripples"), limitToLast(50));
    const unsubscribe = onValue(ripplesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const loadedRipples = Object.entries(data).map(([id, ripple]) => ({
        id,
        text: ripple.text,
        position: ripple.position,
        rotation: ripple.rotation || [0, 0, 0],
      }));
      setRipples(loadedRipples);
    });
    return () => unsubscribe();
  }, []);

  const addRipple = () => {
    if (!input.trim()) return;
    const canvas = document.querySelector("canvas");
    const camera = canvas.__threeObj?.camera;
    if (!camera) return;

    const dir = camera.getWorldDirection(new THREE.Vector3()).normalize();
    const pos = camera.position.clone().add(dir.multiplyScalar(5));
    const rot = new THREE.Euler().setFromQuaternion(camera.quaternion).toArray();

    const ripplesRef = ref(database, "ripples");
    push(ripplesRef, {
      text: input,
      position: [pos.x, pos.y, pos.z],
      rotation: rot,
    });

    setInput("");
  };

  const deleteRipple = (id) => {
    const rippleRef = ref(database, `ripples/${id}`);
    remove(rippleRef);
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
        <DotGrid size={20} spacing={2} />

        {ripples.map(({ id, text, position, rotation }) => (
          <Ripple
            key={id}
            id={id}
            text={text}
            position={position}
            rotation={rotation}
            onDelete={deleteRipple}
          />
        ))}

        {input && <GhostText text={input} />}
      </Canvas>

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
            if (e.key === "Escape") setInput("");
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
            onClick={() => setInput("")}
            style={{ padding: "6px 14px" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

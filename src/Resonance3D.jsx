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
  limitToLast,
} from "firebase/database";
import * as THREE from "three";

// Ghost HUD text that lives in front of the camera
const GhostText = React.forwardRef(({ text }, ref) => {
  const textRef = useRef();
  const { camera } = useThree();
  const [position, setPosition] = useState([0, 0, 0]);

  useFrame(() => {
    const dir = camera.getWorldDirection(new THREE.Vector3()).normalize();
    const ghostPos = camera.position.clone().add(dir.multiplyScalar(5));
    setPosition([ghostPos.x, ghostPos.y, ghostPos.z]);
    if (ref) {
      ref.current = {
        position: ghostPos.clone(),
        quaternion: camera.quaternion.clone(),
      };
    }
    if (textRef.current) textRef.current.lookAt(camera.position);
  });

  return (
    <group position={position}>
      <Text
        ref={textRef}
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
});

// Placed ripple with fixed position/rotation
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

// Custom 3D plus sign axis indicator
function PlusSignAxes({ size = 5, thickness = 0.2 }) {
  return (
    <group>
      {/* X axis */}
      <mesh position={[size / 2, 0, 0]}>
        <boxGeometry args={[size, thickness, thickness]} />
        <meshStandardMaterial color="red" />
      </mesh>
      {/* Y axis */}
      <mesh position={[0, size / 2, 0]}>
        <boxGeometry args={[thickness, size, thickness]} />
        <meshStandardMaterial color="green" />
      </mesh>
      {/* Z axis */}
      <mesh position={[0, 0, size / 2]}>
        <boxGeometry args={[thickness, thickness, size]} />
        <meshStandardMaterial color="blue" />
      </mesh>
    </group>
  );
}

// Helper component to capture camera ref from useThree
function CameraRefSetter({ cameraRef }) {
  const { camera } = useThree();
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera, cameraRef]);
  return null;
}

export default function Resonance3D() {
  const [ripples, setRipples] = useState([]);
  const [input, setInput] = useState("");
  const ghostRef = useRef(null);
  const cameraRef = useRef();

  // Listen to Firebase ripples
  useEffect(() => {
    const ripplesRef = query(ref(database, "ripples"), limitToLast(100));
    const unsubscribe = onValue(ripplesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const loaded = Object.entries(data).map(([id, val]) => ({
        id,
        text: val.text,
        position: val.position,
        rotation: val.rotation || [0, 0, 0],
      }));
      setRipples(loaded);
    });
    return () => unsubscribe();
  }, []);

  // Handle W/S keys for forward/back movement relative to camera direction
  useEffect(() => {
    const onKeyDown = (e) => {
      // Ignore if typing in input
      if (e.target.tagName === "INPUT") return;

      if (e.code === "KeyW" || e.key === "w") {
        if (!cameraRef.current) return;
        const dir = new THREE.Vector3();
        cameraRef.current.getWorldDirection(dir);
        cameraRef.current.position.addScaledVector(dir, 0.5);
      }
      if (e.code === "KeyS" || e.key === "s") {
        if (!cameraRef.current) return;
        const dir = new THREE.Vector3();
        cameraRef.current.getWorldDirection(dir);
        cameraRef.current.position.addScaledVector(dir, -0.5);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const addRipple = () => {
    if (!input.trim() || !ghostRef.current) return;

    const pos = ghostRef.current.position;
    const rot = new THREE.Euler().setFromQuaternion(ghostRef.current.quaternion).toArray();

    push(ref(database, "ripples"), {
      text: input,
      position: [pos.x, pos.y, pos.z],
      rotation: rot,
    });

    setInput("");
  };

  const deleteRipple = (id) => {
    remove(ref(database, `ripples/${id}`));
  };

  return (
    <>
      <Canvas
        shadows
        camera={{ position: [0, 5, 10], fov: 60 }}
        style={{ height: "100vh", background: "black" }}
      >
        <CameraRefSetter cameraRef={cameraRef} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 7]} intensity={1} castShadow />
        <OrbitControls />
        <PlusSignAxes size={5} thickness={0.2} />
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
        {input && <GhostText text={input} ref={ghostRef} />}
      </Canvas>

      {/* Input UI bar */}
      <div
        style={{
          position: "fixed",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#111",
          border: "1px solid #444",
          borderRadius: 8,
          padding: "10px 15px",
          zIndex: 30,
          display: "flex",
          alignItems: "center",
          boxShadow: "0 0 10px rgba(255,255,255,0.1)",
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addRipple();
            }
            if (e.key === "Escape") setInput("");
          }}
          placeholder="Type your ripple..."
          style={{
            background: "transparent",
            border: "none",
            color: "white",
            fontSize: 16,
            width: 300,
            outline: "none",
          }}
        />
        <button
          onClick={addRipple}
          style={{
            marginLeft: 10,
            padding: "6px 14px",
            background: "white",
            color: "black",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>
    </>
  );
}

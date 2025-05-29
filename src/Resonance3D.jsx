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

// GhostText, Ripple, DotGrid, PlusSignAxes as before...

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

  // Keys state
  const keys = useRef({ forward: false, backward: false });

  // Keyboard listeners
  useEffect(() => {
    const down = (e) => {
      if (e.target.tagName === "INPUT") return;
      if (e.code === "KeyW") keys.current.forward = true;
      if (e.code === "KeyS") keys.current.backward = true;
    };
    const up = (e) => {
      if (e.code === "KeyW") keys.current.forward = false;
      if (e.code === "KeyS") keys.current.backward = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Listen to ripples from Firebase
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

  // Move camera forward/back smoothly on W/S keys
  useFrame(() => {
    if (!cameraRef.current) return;
    const moveSpeed = 0.1;
    const camera = cameraRef.current;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();

    if (keys.current.forward) {
      camera.position.addScaledVector(dir, moveSpeed);
    }
    if (keys.current.backward) {
      camera.position.addScaledVector(dir, -moveSpeed);
    }
  });

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
        <OrbitControls enablePan={false} enableZoom={false} />
        <PlusSignAxes size={5} thickness={0.2} />
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

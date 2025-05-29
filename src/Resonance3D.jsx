import React, { useState, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, PointerLockControls } from "@react-three/drei";
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

// Ripple component: text placed at fixed position and rotation
function Ripple({ id, text, position, rotation, onDelete }) {
  const ref = useRef();
  const [opacity, setOpacity] = useState(1);
  const rotEuler = new THREE.Euler(...(rotation || [0, 0, 0]));

  useFrame(({ camera }) => {
    if (ref.current) {
      const dist = ref.current.position.distanceTo(camera.position);
      setOpacity(Math.max(0, 1 - dist / 50));
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

// Dot grid helper for spatial orientation
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
          <meshBasicMaterial color="#555" opacity={0.15} transparent />
        </mesh>
      ))}
    </>
  );
}

// 3D plus sign axes indicator
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

// Controls component to handle camera movement and placing ripples
function ControlsAndPlacer({ input, onAdd }) {
  const { camera } = useThree();
  const [keys, setKeys] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
  });

  // Keyboard handlers
  useEffect(() => {
    const down = (e) => {
      switch (e.code) {
        case "KeyW":
          setKeys((k) => ({ ...k, forward: true }));
          break;
        case "KeyS":
          setKeys((k) => ({ ...k, backward: true }));
          break;
        case "KeyA":
          setKeys((k) => ({ ...k, left: true }));
          break;
        case "KeyD":
          setKeys((k) => ({ ...k, right: true }));
          break;
        case "Space":
          setKeys((k) => ({ ...k, up: true }));
          break;
        case "KeyC":
          setKeys((k) => ({ ...k, down: true }));
          break;
      }
    };
    const up = (e) => {
      switch (e.code) {
        case "KeyW":
          setKeys((k) => ({ ...k, forward: false }));
          break;
        case "KeyS":
          setKeys((k) => ({ ...k, backward: false }));
          break;
        case "KeyA":
          setKeys((k) => ({ ...k, left: false }));
          break;
        case "KeyD":
          setKeys((k) => ({ ...k, right: false }));
          break;
        case "Space":
          setKeys((k) => ({ ...k, up: false }));
          break;
        case "KeyC":
          setKeys((k) => ({ ...k, down: false }));
          break;
      }
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Movement update
  useFrame(() => {
    const moveSpeed = 0.1;
    const direction = new THREE.Vector3();
    const right = new THREE.Vector3();

    if (keys.forward) {
      camera.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      camera.position.addScaledVector(direction, moveSpeed);
    }
    if (keys.backward) {
      camera.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      camera.position.addScaledVector(direction, -moveSpeed);
    }
    if (keys.left) {
      camera.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      right.crossVectors(camera.up, direction).normalize();
      camera.position.addScaledVector(right, moveSpeed);
    }
    if (keys.right) {
      camera.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      right.crossVectors(camera.up, direction).normalize();
      camera.position.addScaledVector(right, -moveSpeed);
    }
    if (keys.up) {
      camera.position.y += moveSpeed;
    }
    if (keys.down) {
      camera.position.y -= moveSpeed;
    }
  });

  // Handle add ripple when input changes (on enter or button press)
  useEffect(() => {
    if (input.trim() !== "") {
      // Calculate position 5 units ahead of camera
      const dir = camera.getWorldDirection(new THREE.Vector3()).normalize();
      const pos = camera.position.clone().add(dir.multiplyScalar(5));
      const rot = [camera.rotation.x, camera.rotation.y, camera.rotation.z];
      onAdd(pos.toArray(), rot);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  return null; // no UI here
}

export default function Resonance3D() {
  const [ripples, setRipples] = useState([]);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);

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

  // Add ripple to Firebase
  const addRipple = (position, rotation) => {
    if (adding) return; // prevent spam
    setAdding(true);
    push(ref(database, "ripples"), {
      text: input,
      position,
      rotation,
    });
    setInput("");
    setTimeout(() => setAdding(false), 500); // debounce
  };

  // Delete ripple
  const deleteRipple = (id) => {
    remove(ref(database, `ripples/${id}`));
  };

  return (
    <>
      <Canvas
        shadows
        camera={{ position: [0, 2, 10], fov: 75 }}
        style={{ height: "100vh", background: "black" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 7]} intensity={1} castShadow />
        <PointerLockControls />
        <PlusSignAxes size={5} thickness={0.2} />
        <DotGrid size={20} spacing={2} />
        <ControlsAndPlacer input={input} onAdd={addRipple} />
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
      </Canvas>

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
            if (e.key === "Enter" && input.trim()
            if (e.key === "Enter" && input.trim() !== "") {
              e.preventDefault();
              // Trigger ripple placement by updating input state (handled by ControlsAndPlacer)
              setInput(input);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setInput("");
            }
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
          onClick={() => {
            if (input.trim() !== "") {
              setInput(input); // Trigger placement
            }
          }}
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

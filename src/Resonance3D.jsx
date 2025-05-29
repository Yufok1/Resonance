import React, { useState, useEffect } from "react";
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

// Placed ripple with fixed position/rotation
function Ripple({ id, text, position, rotation, onDelete }) {
  const ref = React.useRef();
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

// Dot field for spatial orientation
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

export default function Resonance3D() {
  const [ripples, setRipples] = useState([]);
  const [input, setInput] = useState("");

  // Keyboard movement state
  const keys = React.useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
  });

  // Keyboard event listeners
  useEffect(() => {
    const down = (e) => {
      switch (e.code) {
        case "KeyW":
          keys.current.forward = true;
          break;
        case "KeyS":
          keys.current.backward = true;
          break;
        case "KeyA":
          keys.current.left = true;
          break;
        case "KeyD":
          keys.current.right = true;
          break;
        case "Space":
          keys.current.up = true;
          break;
        case "KeyC":
          keys.current.down = true;
          break;
        default:
          break;
      }
    };
    const up = (e) => {
      switch (e.code) {
        case "KeyW":
          keys.current.forward = false;
          break;
        case "KeyS":
          keys.current.backward = false;
          break;
        case "KeyA":
          keys.current.left = false;
          break;
        case "KeyD":
          keys.current.right = false;
          break;
        case "Space":
          keys.current.up = false;
          break;
        case "KeyC":
          keys.current.down = false;
          break;
        default:
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

  // Prevent context menu on right click
  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault();
    window.addEventListener("contextmenu", handleContextMenu);
    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

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

  // Camera movement logic
  useFrame(({ camera }) => {
    const moveSpeed = 0.1;
    const direction = new THREE.Vector3();
    const right = new THREE.Vector3();

    if (keys.current.forward) {
      camera.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      camera.position.addScaledVector(direction, moveSpeed);
    }
    if (keys.current.backward) {
      camera.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      camera.position.addScaledVector(direction, -moveSpeed);
    }

    if (keys.current.left) {
      camera.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      right.crossVectors(camera.up, direction).normalize();
      camera.position.addScaledVector(right, moveSpeed);
    }
    if (keys.current.right) {
      camera.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      right.crossVectors(camera.up, direction).normalize();
      camera.position.addScaledVector(right, -moveSpeed);
    }

    if (keys.current.up) {
      camera.position.y += moveSpeed;
    }
    if (keys.current.down) {
      camera.position.y -= moveSpeed;
    }
  });

  // We need access to the camera for placing text, so create a helper component
  function ControlsAndPlacer() {
    const { camera } = useThree();

    const handleAddRipple = () => {
      if (!input.trim()) return;

      // Position text 5 units in front of camera direction
      const dir = camera.getWorldDirection(new THREE.Vector3()).normalize();
      const position = camera.position.clone().add(dir.multiplyScalar(5));

      // Rotation - can be zero or face camera
      const rotation = [0, 0, 0]; // or compute quaternion->euler if desired

      push(ref(database, "ripples"), {
        text: input,
        position: [position.x, position.y, position.z],
        rotation,
      });

      setInput("");
    };

    return (
      <>
        <PointerLockControls />
        {/* Add a button or expose handler to add ripple */}
        {/* We'll bind the handler outside for input box */}
        <button
          style={{ display: "none" }}
          onClick={handleAddRipple}
          id="addRippleButton"
        >
          Add Ripple
        </button>
      </>
    );
  }

  // We'll trigger addRipple from UI by clicking button (simulate)
  const triggerAddRipple = () => {
    // Use DOM to click the hidden button inside ControlsAndPlacer
    const btn = document.getElementById("addRippleButton");
    if (btn) btn.click();
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
        <ControlsAndPlacer />
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
            if (e.key === "Enter") {
              e.preventDefault();
              triggerAddRipple();
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
          onClick={triggerAddRipple}
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

           

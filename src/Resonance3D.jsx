import React, { useState, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
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

// Keyboard movement and rotation controller (WASD + Q/E)
function KeyboardCameraController({ movementSpeed = 0.1, rotationSpeed = 0.03 }) {
  const { camera } = useThree();
  const keys = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    rotateLeft: false,
    rotateRight: false,
  });

  useEffect(() => {
    const onKeyDown = (e) => {
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
        case "KeyQ":
          keys.current.rotateLeft = true;
          break;
        case "KeyE":
          keys.current.rotateRight = true;
          break;
        default:
          break;
      }
    };

    const onKeyUp = (e) => {
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
        case "KeyQ":
          keys.current.rotateLeft = false;
          break;
        case "KeyE":
          keys.current.rotateRight = false;
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useFrame(() => {
    // Rotation keys (Q/E)
    if (keys.current.rotateLeft) camera.rotation.y += rotationSpeed;
    if (keys.current.rotateRight) camera.rotation.y -= rotationSpeed;

    // Movement vectors
    const forwardVec = new THREE.Vector3();
    camera.getWorldDirection(forwardVec);
    forwardVec.y = 0; // horizontal movement only
    forwardVec.normalize();

    const rightVec = new THREE.Vector3();
    rightVec.crossVectors(forwardVec, camera.up).normalize(); // fixed cross product order

    const move = new THREE.Vector3();

    if (keys.current.forward) move.add(forwardVec);
    if (keys.current.backward) move.sub(forwardVec);
    if (keys.current.left) move.sub(rightVec);
    if (keys.current.right) move.add(rightVec);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(movementSpeed);
      camera.position.add(move);
    }
  });

  return null;
}

// Mouse right-click drag rotation controller
function MouseRightDragRotation({ rotationSpeed = 0.005 }) {
  const { camera, gl } = useThree();
  const dragging = useRef(false);
  const prevPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onContextMenu = (e) => e.preventDefault(); // disable context menu

    const onMouseDown = (e) => {
      if (e.button === 2) {
        dragging.current = true;
        prevPos.current = { x: e.clientX, y: e.clientY };
      }
    };

    const onMouseUp = (e) => {
      if (e.button === 2) {
        dragging.current = false;
      }
    };

    const onMouseMove = (e) => {
      if (!dragging.current) return;

      const deltaX = e.clientX - prevPos.current.x;
      const deltaY = e.clientY - prevPos.current.y;

      // Yaw rotation (around Y axis)
      camera.rotation.y -= deltaX * rotationSpeed;

      // Pitch rotation (around X axis), clamp between -90 and 90 degrees
      let newXRot = camera.rotation.x - deltaY * rotationSpeed;
      const PI_2 = Math.PI / 2;
      newXRot = Math.min(Math.max(newXRot, -PI_2), PI_2);
      camera.rotation.x = newXRot;

      prevPos.current = { x: e.clientX, y: e.clientY };
    };

    gl.domElement.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);

    return () => {
      gl.domElement.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [camera, gl.domElement, rotationSpeed]);

  return null;
}

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
  const ghostRef = useRef(null);

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

  const addRipple = () => {
    if (!input.trim() || !ghostRef.current) return;
    const pos = ghostRef.current.position;
    const rot = new THREE.Euler()
      .setFromQuaternion(ghostRef.current.quaternion)
      .toArray();
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
        camera={{ position: [0, 2, 10], fov: 75 }}
        style={{ height: "100vh", background: "black" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 7]} intensity={1} castShadow />
        <KeyboardCameraController />
        <MouseRightDragRotation />
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

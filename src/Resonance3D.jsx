import React, { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { database } from "./firebase";
import { ref, onValue, query, limitToLast } from "firebase/database";

function Ripple({ id, position, onDelete }) {
  return (
    <mesh position={position} onClick={() => onDelete(id)} castShadow>
      <boxGeometry args={[1, 1, 0.1]} />
      <meshStandardMaterial color="white" />
    </mesh>
  );
}

export default function DebugResonance3D() {
  const [ripples, setRipples] = useState([]);

  useEffect(() => {
    const ripplesRef = query(ref(database, "ripples"), limitToLast(100));

    const unsubscribe = onValue(ripplesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const loadedRipples = Object.entries(data).map(([id, ripple]) => ({
        id,
        position: ripple.position,
      }));
      console.log("Loaded ripples:", loadedRipples);
      setRipples(loadedRipples);
    });

    return () => unsubscribe();
  }, []);

  const deleteRipple = (id) => {
    const rippleRef = ref(database, `ripples/${id}`);
    rippleRef && rippleRef.remove();
  };

  return (
    <Canvas
      shadows
      camera={{ position: [0, 5, 10], fov: 60 }}
      style={{ height: "100vh", background: "black" }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 7]} intensity={1} castShadow />
      <OrbitControls />
      {ripples.map(({ id, position }) => (
        <Ripple key={id} id={id} position={position} onDelete={deleteRipple} />
      ))}
    </Canvas>
  );
}

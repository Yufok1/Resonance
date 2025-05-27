import React from "react";
import { Canvas } from "@react-three/fiber";

export default function TestScene() {
  return (
    <Canvas style={{ height: "100vh", background: "black" }}>
      <mesh>
        <boxGeometry />
        <meshStandardMaterial color="orange" />
      </mesh>
    </Canvas>
  );
}

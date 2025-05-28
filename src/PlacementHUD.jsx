
import React, { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

export default function PlacementHUD({ shape = "box", text = "", color = "#aaa", previewRef }) {
  const meshRef = useRef();
  const { camera } = useThree();

  useFrame(() => {
    const offset = new THREE.Vector3(0, 0, -5);
    const worldPos = camera.localToWorld(offset.clone());

    if (meshRef.current) {
      meshRef.current.position.copy(worldPos);
      meshRef.current.lookAt(camera.position);
      if (previewRef) previewRef.current = meshRef.current;
    }
  });

  let geometry;
  switch (shape.toLowerCase()) {
    case "sphere":
      geometry = <sphereGeometry args={[0.5, 16, 16]} />;
      break;
    case "cone":
      geometry = <coneGeometry args={[0.5, 1, 16]} />;
      break;
    default:
      geometry = <boxGeometry args={[1, 1, 1]} />;
  }

  return (
    <group ref={meshRef}>
      <mesh>
        {geometry}
        <meshStandardMaterial color={color} transparent opacity={0.25} />
      </mesh>
      {text && (
        <Text
          position={[0, 0.8, 0]}
          fontSize={0.3}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {text}
        </Text>
      )}
    </group>
  );
}

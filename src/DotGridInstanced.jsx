
import React, { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export default function DotGridInstanced({ size = 100, spacing = 5 }) {
  const meshRef = useRef();
  const { camera } = useThree();

  const positions = useMemo(() => {
    const pos = [];
    for (let x = -size; x <= size; x += spacing) {
      for (let y = -size; y <= size; y += spacing) {
        for (let z = -size; z <= size; z += spacing) {
          pos.push(new THREE.Vector3(x, y, z));
        }
      }
    }
    return pos;
  }, [size, spacing]);

  const count = positions.length;

  useFrame(() => {
    if (!meshRef.current) return;
    positions.forEach((p, i) => {
      const distance = p.distanceTo(camera.position);
      const alpha = THREE.MathUtils.clamp(1 - distance / (size * 1.5), 0, 1) * 0.3;

      const dummy = new THREE.Object3D();
      dummy.position.copy(p);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, new THREE.Color(0.33, 0.33, 0.33).multiplyScalar(alpha + 0.2));
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <sphereGeometry args={[0.05, 8, 8]} />
      <meshBasicMaterial vertexColors transparent />
    </instancedMesh>
  );
}

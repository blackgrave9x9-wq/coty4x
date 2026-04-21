import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Mesh } from 'three';
import { Float, MeshDistortMaterial, Sphere, PerspectiveCamera } from '@react-three/drei';

function RotatingMeat() {
  const meshRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
      meshRef.current.rotation.x += 0.005;
    }
  });

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={1}>
      <Sphere ref={meshRef} args={[1, 64, 64]} scale={1.5}>
        <MeshDistortMaterial
          color="#4CAF50"
          speed={3}
          distort={0.4}
          radius={1}
          metalness={0.4}
          roughness={0.4}
        />
      </Sphere>
    </Float>
  );
}

export default function MeatScene() {
  return (
    <div className="w-full h-[400px] lg:h-[600px] relative">
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
        <pointLight position={[-10, -10, -10]} color="#F5F5DC" />
        <RotatingMeat />
      </Canvas>
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-full h-full bg-radial-gradient from-transparent to-[#0A0A0A] opacity-30 absolute inset-0" />
        <div className="relative z-10 animate-dancing text-center">
          <p className="text-white font-black text-2xl lg:text-4xl drop-shadow-2xl tracking-widest uppercase">
            Welcome, <br /> we are open
          </p>
        </div>
      </div>
    </div>
  );
}

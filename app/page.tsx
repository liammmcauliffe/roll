'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfffff);

    const camera = new THREE.OrthographicCamera();
    camera.position.set(0, 6, 5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight());

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const ball = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.33, 1),
      new THREE.MeshLambertMaterial({ color: 0xff0000, flatShading: true })
    );
    // Position the ball above the ground
    ball.position.y = 0.33;
    ball.castShadow = true;
    scene.add(ball);

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      const aspect = clientWidth / clientHeight;
      camera.left = -aspect;
      camera.right = aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight, false);
    };

    resize();
    window.addEventListener('resize', resize);
    renderer.setAnimationLoop(() => renderer.render(scene, camera));

    // Cleanup
    return () => {
      window.removeEventListener('resize', resize);
      renderer.setAnimationLoop(null);
      renderer.dispose();
      ground.geometry.dispose();
      ground.material.dispose();
      ball.geometry.dispose();
      ball.material.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} style={{ position: 'fixed', inset: 0 }} />;
}

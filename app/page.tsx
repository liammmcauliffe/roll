'use client';

import { useEffect, useRef } from 'react';
import {
  addBroadphaseLayer,
  addObjectLayer,
  box,
  createWorld,
  createWorldSettings,
  enableCollision,
  MotionType,
  registerAll,
  rigidBody,
  sphere,
  updateWorld,
} from 'crashcat';
import * as THREE from 'three';

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    registerAll();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfffff);

    const camera = new THREE.OrthographicCamera();
    camera.position.set(0, 6, 5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight());

    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    groundMesh.rotation.x = -Math.PI / 2;
    scene.add(groundMesh);

    const ballRadius = 0.33;
    const ballMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(ballRadius, 1),
      new THREE.MeshLambertMaterial({ color: 0xff0000, flatShading: true })
    );
    scene.add(ballMesh);

    // Crashcat settings
    const settings = createWorldSettings();
    settings.gravity = [0, -14.7, 0];
    const dynamicBroadphase = addBroadphaseLayer(settings);
    const staticBroadphase = addBroadphaseLayer(settings);
    const dynamicLayer = addObjectLayer(settings, dynamicBroadphase);
    const staticLayer = addObjectLayer(settings, staticBroadphase);
    enableCollision(settings, dynamicLayer, staticLayer);
    const world = createWorld(settings);

    const ballBody = rigidBody.create(world, {
      motionType: MotionType.DYNAMIC,
      objectLayer: dynamicLayer,
      shape: sphere.create({ radius: ballRadius }),
      position: [0, 2, 0], // Offset to see ball fall from above
      friction: 1,
      linearDamping: 1,
      angularDamping: 1,
    });

    const groundBody = rigidBody.create(world, {
      motionType: MotionType.STATIC,
      objectLayer: staticLayer,
      shape: box.create({ halfExtents: [10, 0.5, 10] }),
      position: [0, -0.5, 0],
      friction: 1,
    });

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

    const keys = new Set<string>();

    const onKeyDown = (event: KeyboardEvent) => {
      keys.add(event.code);
      if (event.code === 'Space') event.preventDefault();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      keys.delete(event.code);
    };

    const clearKeys = () => {
      keys.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearKeys);

    let lastTime = performance.now();
    let accumulator = 0;
    const physicsStep = 1 / 120;
    const movement = new THREE.Vector3();

    renderer.setAnimationLoop(() => {
      const now = performance.now();
      accumulator += Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      while (accumulator >= physicsStep) {
        const body = rigidBody.get(world, ballBody.id);
        if (body) {
          movement.set(
            Number(keys.has('KeyD') || keys.has('ArrowRight')) -
              Number(keys.has('KeyA') || keys.has('ArrowLeft')),
            0,
            Number(keys.has('KeyS') || keys.has('ArrowDown')) -
              Number(keys.has('KeyW') || keys.has('ArrowUp'))
          );

          if (movement.lengthSq() > 0) {
            movement.normalize();
            rigidBody.addForce(world, body, [movement.x * 500, 0, movement.z * 500], true);
            rigidBody.addTorque(world, body, [movement.z * 50, 0, -movement.x * 50], true);
          }

          const isGrounded =
            Math.abs(body.position[1] - ballRadius) <= 0.04 &&
            Math.abs(body.position[0]) <= 10 - ballRadius &&
            Math.abs(body.position[2]) <= 10 - ballRadius;

          if (keys.has('Space') && isGrounded) {
            const velocity = body.motionProperties.linearVelocity;
            rigidBody.setLinearVelocity(world, body, [velocity[0], 7.5, velocity[2]]);
          }
        }

        updateWorld(world, {}, physicsStep);
        accumulator -= physicsStep;
      }

      const body = rigidBody.get(world, ballBody.id);
      if (body) {
        ballMesh.position.fromArray(body.position);
        ballMesh.quaternion.fromArray(body.quaternion);
      }

      renderer.render(scene, camera);
    });

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearKeys);
      renderer.setAnimationLoop(null);
      rigidBody.remove(world, ballBody);
      rigidBody.remove(world, groundBody);
      renderer.dispose();
      groundMesh.geometry.dispose();
      groundMesh.material.dispose();
      ballMesh.geometry.dispose();
      ballMesh.material.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} style={{ position: 'fixed', inset: 0 }} />;
}

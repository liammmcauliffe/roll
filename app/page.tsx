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
    let pointerId: number | null = null;
    let pointerStrength = 0;
    let pointerJump = false;
    const pointerDirection = { right: 0, forward: 0 };
    const pointerStart = { x: 0, y: 0, time: 0, moved: false };
    let targetZoom = 0.4;
    camera.zoom = targetZoom;
    camera.updateProjectionMatrix();

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

    const updatePointerDirection = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      const body = rigidBody.get(world, ballBody.id);
      if (!body) return;

      const ballScreen = new THREE.Vector3(body.position[0], body.position[1], body.position[2]);
      ballScreen.project(camera);
      const ballX = bounds.left + ((ballScreen.x + 1) / 2) * bounds.width;
      const ballY = bounds.top + ((1 - ballScreen.y) / 2) * bounds.height;
      const dx = event.clientX - ballX;
      const dy = event.clientY - ballY;
      const distance = Math.hypot(dx, dy);
      const deadZone = 16;
      const maxDistance = Math.min(bounds.width, bounds.height) * 0.3;
      const viewWidth = (camera.right - camera.left) / camera.zoom;
      const viewHeight = (camera.top - camera.bottom) / camera.zoom;

      pointerStrength = THREE.MathUtils.clamp(
        (distance - deadZone) / (maxDistance - deadZone),
        0,
        1
      );
      pointerDirection.right = (dx / bounds.width) * viewWidth;
      pointerDirection.forward = (-dy / bounds.height) * viewHeight;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;

      pointerId = event.pointerId;
      pointerStart.x = event.clientX;
      pointerStart.y = event.clientY;
      pointerStart.time = performance.now();
      pointerStart.moved = false;
      renderer.domElement.setPointerCapture(event.pointerId);
      updatePointerDirection(event);
      event.preventDefault();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;

      if (
        Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 12
      ) {
        pointerStart.moved = true;
      }
      updatePointerDirection(event);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;

      const duration = performance.now() - pointerStart.time;
      if (event.type === 'pointerup' && !pointerStart.moved && duration < 300) {
        pointerJump = true;
      }

      const activePointerId = pointerId;
      pointerId = null;
      pointerStrength = 0;
      pointerDirection.right = 0;
      pointerDirection.forward = 0;
      if (renderer.domElement.hasPointerCapture(activePointerId)) {
        renderer.domElement.releasePointerCapture(activePointerId);
      }
    };

    const onLostPointerCapture = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      pointerStrength = 0;
      pointerDirection.right = 0;
      pointerDirection.forward = 0;
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta =
        event.deltaY *
        (event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? window.innerHeight
            : 1);
      targetZoom = THREE.MathUtils.clamp(
        targetZoom * Math.exp(-delta * 0.001),
        0.15,
        2.5
      );
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearKeys);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('lostpointercapture', onLostPointerCapture);
    renderer.domElement.style.touchAction = 'none';

    let lastTime = performance.now();
    let accumulator = 0;
    const physicsStep = 1 / 120;
    const movement = new THREE.Vector3();
    const cameraForward = new THREE.Vector3(0, 0, -1);
    const cameraRight = new THREE.Vector3(1, 0, 0);
    const cameraPosition = new THREE.Vector3();
    const cameraTarget = new THREE.Vector3();
    let cameraYaw = 0;

    renderer.setAnimationLoop(() => {
      const now = performance.now();
      const frameDelta = Math.min((now - lastTime) / 1000, 0.1);
      accumulator += frameDelta;
      lastTime = now;

      while (accumulator >= physicsStep) {
        const rotation = Number(keys.has('KeyE')) - Number(keys.has('KeyQ'));
        cameraYaw += rotation * 1.8 * physicsStep;
        cameraForward.set(Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
        cameraRight.set(Math.cos(cameraYaw), 0, Math.sin(cameraYaw));

        const body = rigidBody.get(world, ballBody.id);
        if (body) {
          const hasPointerMovement = pointerId !== null;
          const moveRight = hasPointerMovement
            ? pointerDirection.right
            : Number(keys.has('KeyD') || keys.has('ArrowRight')) -
              Number(keys.has('KeyA') || keys.has('ArrowLeft'));
          const moveForward = hasPointerMovement
            ? pointerDirection.forward
            : Number(keys.has('KeyW') || keys.has('ArrowUp')) -
              Number(keys.has('KeyS') || keys.has('ArrowDown'));
          const strength = hasPointerMovement ? pointerStrength : 1;

          movement.set(
            cameraRight.x * moveRight + cameraForward.x * moveForward,
            0,
            cameraRight.z * moveRight + cameraForward.z * moveForward
          );

          if (movement.lengthSq() > 0 && strength > 0) {
            movement.normalize();
            rigidBody.addForce(
              world,
              body,
              [movement.x * 500 * strength, 0, movement.z * 500 * strength],
              true
            );
            rigidBody.addTorque(
              world,
              body,
              [movement.z * 50 * strength, 0, -movement.x * 50 * strength],
              true
            );
          }

          const isGrounded =
            Math.abs(body.position[1] - ballRadius) <= 0.04 &&
            Math.abs(body.position[0]) <= 10 - ballRadius &&
            Math.abs(body.position[2]) <= 10 - ballRadius;

          if ((keys.has('Space') || pointerJump) && isGrounded) {
            const velocity = body.motionProperties.linearVelocity;
            rigidBody.setLinearVelocity(world, body, [velocity[0], 7.5, velocity[2]]);
          }
          pointerJump = false;
        }

        updateWorld(world, {}, physicsStep);
        accumulator -= physicsStep;
      }

      const body = rigidBody.get(world, ballBody.id);
      if (body) {
        ballMesh.position.fromArray(body.position);
        ballMesh.quaternion.fromArray(body.quaternion);

        cameraTarget.fromArray(body.position);
        cameraPosition.set(
          body.position[0] - cameraForward.x * 5,
          body.position[1] + 6,
          body.position[2] - cameraForward.z * 5
        );
        camera.position.copy(cameraPosition);
        camera.lookAt(cameraTarget);
      }

      if (Math.abs(targetZoom - camera.zoom) > 0.0001) {
        camera.zoom += (targetZoom - camera.zoom) * (1 - Math.exp(-10 * frameDelta));
        camera.updateProjectionMatrix();
      }
      renderer.render(scene, camera);
    });

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearKeys);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('lostpointercapture', onLostPointerCapture);
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

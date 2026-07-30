'use client';

import { useEffect, useRef } from 'react';
import {
  addBroadphaseLayer,
  addObjectLayer,
  createWorld,
  createWorldSettings,
  enableCollision,
  MotionType,
  registerAll,
  rigidBody,
  sphere,
  triangleMesh,
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
    scene.background = new THREE.Color(0xe0e2db);
    scene.fog = new THREE.FogExp2(0xdbdbee, 0.05);

    const camera = new THREE.OrthographicCamera();
    camera.position.set(0, 6, 5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.imageRendering = 'pixelated';
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.2));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.4);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -35;
    directionalLight.shadow.camera.right = 35;
    directionalLight.shadow.camera.top = 35;
    directionalLight.shadow.camera.bottom = -35;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.mapSize.set(2048, 2048);
    directionalLight.shadow.bias = 0.0001;
    scene.add(directionalLight);
    scene.add(directionalLight.target);

    const textureSize = 128;
    const snowCanvas = document.createElement('canvas');
    snowCanvas.width = textureSize;
    snowCanvas.height = textureSize;
    const snowContext = snowCanvas.getContext('2d');

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const smoothstep = (t: number) => t * t * (3 - 2 * t);
    const hash = (x: number, y: number) => {
      const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return value - Math.floor(value);
    };
    const valueNoise = (x: number, y: number, cells: number) => {
      const sampleX = (x / textureSize) * cells;
      const sampleY = (y / textureSize) * cells;
      const x0 = Math.floor(sampleX);
      const y0 = Math.floor(sampleY);
      const tx = smoothstep(sampleX - x0);
      const ty = smoothstep(sampleY - y0);
      const wrap = (value: number) => ((value % cells) + cells) % cells;
      const top = lerp(hash(wrap(x0), wrap(y0)), hash(wrap(x0 + 1), wrap(y0)), tx);
      const bottom = lerp(
        hash(wrap(x0), wrap(y0 + 1)),
        hash(wrap(x0 + 1), wrap(y0 + 1)),
        tx
      );
      return lerp(top, bottom, ty);
    };

    if (snowContext) {
      const image = snowContext.createImageData(textureSize, textureSize);
      const light = [230, 235, 230];
      const base = [220, 225, 220];
      const mid = [215, 220, 215];
      const shadow = [205, 215, 210];

      for (let y = 0; y < textureSize; y++) {
        for (let x = 0; x < textureSize; x++) {
          const value =
            valueNoise(x, y, 8) * 0.55 +
            valueNoise(x + 20, y + 40, 16) * 0.35 +
            hash(x * 3 + 10, y * 5 + 20) * 0.1;
          let color = base;
          if (value > 0.65) color = light;
          else if (value < 0.35) color = shadow;
          else if (value < 0.45) color = mid;

          const index = (y * textureSize + x) * 4;
          image.data[index] = color[0];
          image.data[index + 1] = color[1];
          image.data[index + 2] = color[2];
          image.data[index + 3] = 255;
        }
      }
      snowContext.putImageData(image, 0, 0);
    }

    const snowTexture = new THREE.CanvasTexture(snowCanvas);
    snowTexture.wrapS = THREE.RepeatWrapping;
    snowTexture.wrapT = THREE.RepeatWrapping;
    snowTexture.magFilter = THREE.NearestFilter;
    snowTexture.minFilter = THREE.NearestFilter;
    snowTexture.generateMipmaps = false;
    snowTexture.colorSpace = THREE.SRGBColorSpace;

    const floorMaterial = new THREE.MeshLambertMaterial({ map: snowTexture, color: 0xffffff });

    const ballRadius = 0.33;
    const randomColor = new THREE.Color().setHSL(Math.random(), 0.7, 0.55);
    const ballMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(ballRadius, 1),
      new THREE.MeshLambertMaterial({ color: randomColor, flatShading: true })
    );
    ballMesh.castShadow = true;
    scene.add(ballMesh);

    const markerGeometry = new THREE.BufferGeometry();
    markerGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          -0.14, 0.06, -0.14, 0.14, 0.06, -0.14, -0.14, -0.06, -0.14, 0.14, -0.06,
          -0.14, 0, 0.06, 0.22, 0, -0.06, 0.22,
        ],
        3
      )
    );
    markerGeometry.setIndex([
      0, 4, 1, 2, 3, 5, 0, 1, 3, 0, 3, 2, 0, 2, 5, 0, 5, 4, 1, 4, 5, 1, 5, 3,
    ]);
    markerGeometry.computeVertexNormals();
    const directionMarker = new THREE.Mesh(
      markerGeometry,
      new THREE.MeshLambertMaterial({ color: randomColor, flatShading: true })
    );
    directionMarker.visible = false;
    directionMarker.renderOrder = 1;
    scene.add(directionMarker);

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

    const activeSeed = 67676;
    const hash2D = (x: number, z: number, salt = 0) => {
      let value = (x * 1619 + z * 31337 + salt * 1013 + activeSeed * 7919) | 0;
      value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
      value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
      value ^= value >>> 16;
      return (value >>> 0) / 4294967296;
    };
    const valueNoise2D = (x: number, z: number, cellSize: number, salt: number) => {
      const gridX = x / cellSize;
      const gridZ = z / cellSize;
      const x0 = Math.floor(gridX);
      const z0 = Math.floor(gridZ);
      const tx = smoothstep(gridX - x0);
      const tz = smoothstep(gridZ - z0);
      return lerp(
        lerp(hash2D(x0, z0, salt), hash2D(x0 + 1, z0, salt), tx),
        lerp(hash2D(x0, z0 + 1, salt), hash2D(x0 + 1, z0 + 1, salt), tx),
        tz
      );
    };
    const terrainHeight = (x: number, z: number) => {
      const height =
        valueNoise2D(x + 100, z - 100, 128, 1) * 4 +
        valueNoise2D(x - 200, z + 200, 32, 2) * 1.5 +
        valueNoise2D(x + 50, z + 50, 8, 3) * 0.5;
      const distance = Math.hypot(x, z);
      return height * smoothstep(THREE.MathUtils.clamp((distance - 12) / 30, 0, 1));
    };

    const chunkSize = 32;
    const segments = 16;
    const step = chunkSize / segments;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let z = 0; z <= segments; z++) {
      for (let x = 0; x <= segments; x++) {
        const worldX = -chunkSize / 2 + x * step;
        const worldZ = -chunkSize / 2 + z * step;
        positions.push(worldX, terrainHeight(worldX, worldZ), worldZ);
        uvs.push(worldX / 12.5, worldZ / 12.5);
      }
    }

    for (let z = 0; z < segments; z++) {
      for (let x = 0; x < segments; x++) {
        const topLeft = z * (segments + 1) + x;
        const topRight = topLeft + 1;
        const bottomLeft = topLeft + segments + 1;
        const bottomRight = bottomLeft + 1;
        indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
      }
    }

    const terrainGeometry = new THREE.BufferGeometry();
    terrainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    terrainGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    terrainGeometry.setIndex(indices);
    terrainGeometry.computeVertexNormals();

    const terrainMesh = new THREE.Mesh(terrainGeometry, floorMaterial);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    const terrainBody = rigidBody.create(world, {
      motionType: MotionType.STATIC,
      objectLayer: staticLayer,
      shape: triangleMesh.create({ positions, indices }),
      position: [0, 0, 0],
      friction: 1.8,
    });

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      const aspect = clientWidth / clientHeight;
      camera.left = -aspect;
      camera.right = aspect;
      camera.near = -50;
      camera.far = 100;
      camera.updateProjectionMatrix();
      const renderHeight = Math.min(280, clientHeight);
      renderer.setSize(Math.round(renderHeight * aspect), renderHeight, false);
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
    const markerDirection = new THREE.Vector3();
    const markerForward = new THREE.Vector3(0, 0, 1);
    let markerVisible = false;
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
            markerDirection.copy(movement);
            markerVisible = true;
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
          } else {
            markerVisible = false;
          }

          const isGrounded = world.contacts.contacts.some(
            (contact) =>
              contact.contactIndex !== -1 &&
              contact.lastProcessedFrame === world.contacts.frameStamp &&
              ((contact.bodyIdA === ballBody.id &&
                contact.bodyIdB === terrainBody.id) ||
                (contact.bodyIdA === terrainBody.id &&
                  contact.bodyIdB === ballBody.id))
          );

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

        directionMarker.visible = markerVisible;
        if (markerVisible) {
          directionMarker.position.fromArray(body.position).addScaledVector(markerDirection, 0.72);
          directionMarker.quaternion.setFromUnitVectors(markerForward, markerDirection);
        }

        cameraTarget.fromArray(body.position);
        cameraPosition.set(
          body.position[0] - cameraForward.x * 5,
          body.position[1] + 6,
          body.position[2] - cameraForward.z * 5
        );
        camera.position.copy(cameraPosition);
        camera.lookAt(cameraTarget);
        directionalLight.position.set(
          camera.position.x + 8,
          camera.position.y + 16,
          camera.position.z - 6
        );
        directionalLight.target.position.fromArray(body.position);
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
      rigidBody.remove(world, terrainBody);
      renderer.dispose();
      terrainGeometry.dispose();
      floorMaterial.dispose();
      snowTexture.dispose();
      ballMesh.geometry.dispose();
      ballMesh.material.dispose();
      markerGeometry.dispose();
      directionMarker.material.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} style={{ position: 'fixed', inset: 0 }} />;
}

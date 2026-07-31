'use client';

import { useEffect, useRef } from 'react';
import {
  addBroadphaseLayer,
  addObjectLayer,
  convexHull,
  createWorld,
  createWorldSettings,
  cylinder,
  enableCollision,
  MotionType,
  registerAll,
  rigidBody,
  scaled,
  sphere,
  triangleMesh,
  type Shape,
  updateWorld,
} from 'crashcat';
import { connect, type RoomConnection } from 'gatho/client';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

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
    const baseCameraHeight = 6.5;
    const baseCameraDistance = 5.5;
    let viewW = 10;
    const viewH = 10;
    camera.position.set(0, baseCameraHeight, baseCameraDistance);
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

    const snowfallPositions = new Float32Array(100 * 3);
    for (let index = 0; index < 100; index++) {
      snowfallPositions[index * 3] = (hash(index, 10) - 0.5) * 20;
      snowfallPositions[index * 3 + 1] = hash(index, 20) * 10 - 2;
      snowfallPositions[index * 3 + 2] = (hash(index, 30) - 0.5) * 20;
    }
    const snowfallGeometry = new THREE.BufferGeometry();
    snowfallGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(snowfallPositions, 3)
    );
    const snowfallMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.05,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const snowfall = new THREE.Points(snowfallGeometry, snowfallMaterial);
    scene.add(snowfall);

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

    type PlayerTransform = {
      type: 'transform';
      color: number;
      position: [number, number, number];
      quaternion: [number, number, number, number];
    };
    type RemotePlayer = {
      mesh: THREE.Mesh;
      marker: THREE.Mesh;
      body: ReturnType<typeof rigidBody.create>;
      targetPosition: THREE.Vector3;
      targetQuaternion: THREE.Quaternion;
    };
    const remotePlayers = new Map<string, RemotePlayer>();
    const remoteGeometry = new THREE.IcosahedronGeometry(ballRadius, 1);

    // Crashcat settings
    const settings = createWorldSettings();
    settings.gravity = [0, -14.7, 0];
    const dynamicBroadphase = addBroadphaseLayer(settings);
    const staticBroadphase = addBroadphaseLayer(settings);
    const dynamicLayer = addObjectLayer(settings, dynamicBroadphase);
    const staticLayer = addObjectLayer(settings, staticBroadphase);
    enableCollision(settings, dynamicLayer, staticLayer);
    enableCollision(settings, dynamicLayer, dynamicLayer);
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
    const forestDensity = (x: number, z: number) =>
      valueNoise2D(x, z, 64, 10) * 0.65 + valueNoise2D(x, z, 16, 20) * 0.35;

    const textureLoader = new THREE.TextureLoader();
    const loadPixelTexture = (url: string) => {
      const texture = textureLoader.load(url);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    };
    const treeTexture = loadPixelTexture('/models/tree-pine.png');
    const rockTexture = loadPixelTexture('/models/forest-pack/rocks-diffuse.png');
    const treeMaterial = new THREE.MeshLambertMaterial({
      map: treeTexture,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      flatShading: true,
    });
    const rockMaterial = new THREE.MeshLambertMaterial({
      map: rockTexture,
      flatShading: true,
    });

    type Body = ReturnType<typeof rigidBody.create>;
    type Pool = {
      mesh: THREE.InstancedMesh;
      size: number;
      collider: {
        shape: Shape;
        centerY: number;
        rotate: boolean;
      };
      nextSlot: number;
      freeSlots: number[];
    };
    const pools: Pool[] = [];
    const treePools: number[] = [];
    const rockPools: number[] = [];
    const instance = new THREE.Object3D();
    const leanAxis = new THREE.Vector3();
    const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    let assetsReady = false;
    let disposed = false;

    const addPool = (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      max: number,
      collider: Pool['collider']
    ) => {
      geometry.computeBoundingBox();
      const bounds = geometry.boundingBox!;
      const size = Math.max(
        bounds.max.x - bounds.min.x,
        bounds.max.y - bounds.min.y,
        bounds.max.z - bounds.min.z
      );
      const mesh = new THREE.InstancedMesh(geometry, material, max);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      scene.add(mesh);
      pools.push({ mesh, size, collider, nextSlot: 0, freeSlots: [] });
      return pools.length - 1;
    };

    const leaseSlot = (pool: Pool) => {
      const slot = pool.freeSlots.pop() ?? pool.nextSlot++;
      if (slot >= pool.mesh.instanceMatrix.count) return -1;
      pool.mesh.count = Math.max(pool.mesh.count, slot + 1);
      return slot;
    };

    const chunkSize = 32;
    const chunkRadius = 4;
    const segments = 16;
    const step = chunkSize / segments;
    const activeChunks = new Map<
      string,
      {
        x: number;
        z: number;
        mesh: THREE.Mesh;
        body: Body;
        instances: { poolIndex: number; slot: number; body: Body }[];
      }
    >();
    const terrainBodyIds = new Set<number>();
    let currentChunkX: number | null = null;
    let currentChunkZ: number | null = null;

    const placeAsset = (
      poolIndex: number,
      worldX: number,
      worldZ: number,
      targetSize: number,
      yaw: number,
      instances: { poolIndex: number; slot: number; body: Body }[],
      leanDirection = 0,
      leanAngle = 0
    ) => {
      const pool = pools[poolIndex];
      const slot = leaseSlot(pool);
      if (slot < 0) return;

      const scale = targetSize / pool.size;
      const worldY = terrainHeight(worldX, worldZ);
      instance.position.set(worldX, worldY, worldZ);
      instance.rotation.set(0, yaw, 0);
      leanAxis.set(Math.cos(leanDirection), 0, Math.sin(leanDirection));
      instance.rotateOnWorldAxis(leanAxis, leanAngle);
      instance.scale.setScalar(scale);
      instance.updateMatrix();
      pool.mesh.setMatrixAt(slot, instance.matrix);
      pool.mesh.instanceMatrix.needsUpdate = true;

      const body = rigidBody.create(world, {
        motionType: MotionType.STATIC,
        objectLayer: staticLayer,
        shape: scaled.create({ shape: pool.collider.shape, scale: [scale, scale, scale] }),
        position: [worldX, worldY + pool.collider.centerY * scale, worldZ],
        quaternion: pool.collider.rotate
          ? [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]
          : [0, 0, 0, 1],
        friction: 1.8,
      });
      instances.push({ poolIndex, slot, body });
    };

    const loadChunk = (chunkX: number, chunkZ: number) => {
      const key = `${chunkX},${chunkZ}`;
      if (activeChunks.has(key)) return;

      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];

      for (let z = 0; z <= segments; z++) {
        for (let x = 0; x <= segments; x++) {
          const worldX = chunkX * chunkSize - chunkSize / 2 + x * step;
          const worldZ = chunkZ * chunkSize - chunkSize / 2 + z * step;
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

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();

      const mesh = new THREE.Mesh(geometry, floorMaterial);
      mesh.receiveShadow = true;
      scene.add(mesh);

      const body = rigidBody.create(world, {
        motionType: MotionType.STATIC,
        objectLayer: staticLayer,
        shape: triangleMesh.create({ positions, indices }),
        position: [0, 0, 0],
        friction: 1.8,
      });

      const instances: { poolIndex: number; slot: number; body: Body }[] = [];
      if (assetsReady) {
        const treeCount = 22 + Math.floor(hash2D(chunkX, chunkZ, 100) * 10);
        for (let index = 0; index < treeCount; index++) {
          const worldX =
            chunkX * chunkSize +
            (hash2D(chunkX, chunkZ, index * 10 + 1) - 0.5) * chunkSize;
          const worldZ =
            chunkZ * chunkSize +
            (hash2D(chunkX, chunkZ, index * 10 + 2) - 0.5) * chunkSize;
          if (
            Math.hypot(worldX, worldZ) < 5 ||
            hash2D(chunkX, chunkZ, index * 10 + 3) > forestDensity(worldX, worldZ) * 1.3
          ) {
            continue;
          }

          const poolIndex =
            treePools[
              Math.floor(hash2D(chunkX, chunkZ, index * 10 + 4) * treePools.length)
            ];
          const height = 3 + hash2D(chunkX, chunkZ, index * 10 + 5) * 8;
          const yaw = hash2D(chunkX, chunkZ, index * 10 + 6) * Math.PI * 2;
          const leanDirection = hash2D(chunkX, chunkZ, index * 10 + 7) * Math.PI * 2;
          const leanAngle = hash2D(chunkX, chunkZ, index * 10 + 8) * 0.05;
          placeAsset(poolIndex, worldX, worldZ, height, yaw, instances, leanDirection, leanAngle);
        }

        const rockCount = 2 + Math.floor(hash2D(chunkX, chunkZ, 200) * 4);
        for (let index = 0; index < rockCount; index++) {
          const worldX =
            chunkX * chunkSize +
            (hash2D(chunkX, chunkZ, index * 10 + 7) - 0.5) * chunkSize;
          const worldZ =
            chunkZ * chunkSize +
            (hash2D(chunkX, chunkZ, index * 10 + 8) - 0.5) * chunkSize;
          if (Math.hypot(worldX, worldZ) < 4 || forestDensity(worldX, worldZ) > 0.55) {
            continue;
          }

          const poolIndex =
            rockPools[
              Math.floor(hash2D(chunkX, chunkZ, index * 10 + 9) * rockPools.length)
            ];
          const size = 0.5 + hash2D(chunkX, chunkZ, index * 10 + 10);
          const yaw = hash2D(chunkX, chunkZ, index * 10 + 11) * Math.PI * 2;
          placeAsset(poolIndex, worldX, worldZ, size, yaw, instances);
        }
      }

      terrainBodyIds.add(body.id);
      activeChunks.set(key, { x: chunkX, z: chunkZ, mesh, body, instances });
    };

    const unloadChunk = (key: string) => {
      const chunk = activeChunks.get(key);
      if (!chunk) return;

      scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      for (const prop of chunk.instances) {
        const pool = pools[prop.poolIndex];
        pool.mesh.setMatrixAt(prop.slot, hiddenMatrix);
        pool.mesh.instanceMatrix.needsUpdate = true;
        pool.freeSlots.push(prop.slot);
        rigidBody.remove(world, prop.body);
      }
      terrainBodyIds.delete(chunk.body.id);
      rigidBody.remove(world, chunk.body);
      activeChunks.delete(key);
    };

    const updateChunks = (worldX: number, worldZ: number) => {
      const centerX = Math.floor((worldX + chunkSize / 2) / chunkSize);
      const centerZ = Math.floor((worldZ + chunkSize / 2) / chunkSize);
      if (centerX === currentChunkX && centerZ === currentChunkZ) return;
      currentChunkX = centerX;
      currentChunkZ = centerZ;

      for (let x = -chunkRadius; x <= chunkRadius; x++) {
        for (let z = -chunkRadius; z <= chunkRadius; z++) {
          loadChunk(centerX + x, centerZ + z);
        }
      }

      for (const [key, chunk] of activeChunks) {
        const distance = Math.max(
          Math.abs(chunk.x - centerX),
          Math.abs(chunk.z - centerZ)
        );
        if (distance > chunkRadius + 1) unloadChunk(key);
      }
    };

    updateChunks(0, 0);

    let loadedAssetPacks = 0;
    const finishAssetPack = () => {
      loadedAssetPacks++;
      if (
        loadedAssetPacks < 2 ||
        treePools.length === 0 ||
        rockPools.length === 0 ||
        disposed
      ) {
        return;
      }

      assetsReady = true;
      const body = rigidBody.get(world, ballBody.id);
      for (const key of Array.from(activeChunks.keys())) unloadChunk(key);
      currentChunkX = null;
      currentChunkZ = null;
      updateChunks(body?.position[0] ?? 0, body?.position[2] ?? 0);
    };

    const prepareGeometry = (mesh: THREE.Mesh) => {
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      const bounds = geometry.boundingBox!;
      geometry.translate(
        -(bounds.min.x + bounds.max.x) / 2,
        -bounds.min.y,
        -(bounds.min.z + bounds.max.z) / 2
      );
      geometry.computeBoundingBox();
      return geometry;
    };

    const treeRadius = (geometry: THREE.BufferGeometry) => {
      const positions = geometry.attributes.position;
      const bounds = geometry.boundingBox!;
      const centerX = (bounds.min.x + bounds.max.x) / 2;
      const centerZ = (bounds.min.z + bounds.max.z) / 2;
      const radii: number[] = [];

      for (let index = 0; index < positions.count; index++) {
        if (
          positions.getY(index) - bounds.min.y <
          (bounds.max.y - bounds.min.y) * 0.5
        ) {
          radii.push(
            Math.hypot(
              positions.getX(index) - centerX,
              positions.getZ(index) - centerZ
            )
          );
        }
      }

      radii.sort((a, b) => a - b);
      return radii[Math.floor(radii.length * 0.3)] ?? 0.2;
    };

    const fbxManager = new THREE.LoadingManager();
    fbxManager.setURLModifier((url) =>
      /\.(?:bmp|jpe?g|png|tga|tiff?|webp)$/i.test(url)
        ? 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='
        : url
    );
    const originalWarn = globalThis.console.warn;
    const filteredWarn = (...args: unknown[]) => {
      if (!String(args[0]).startsWith('THREE.FBXLoader: %s map is not supported')) {
        originalWarn(...args);
      }
    };
    const restoreFbxWarnings = () => {
      if (globalThis.console.warn === filteredWarn) {
        globalThis.console.warn = originalWarn;
      }
    };
    globalThis.console.warn = filteredWarn;
    fbxManager.onLoad = restoreFbxWarnings;
    fbxManager.onError = restoreFbxWarnings;
    const fbxLoader = new FBXLoader(fbxManager);
    fbxLoader.load('/models/trees-pine.fbx', (model) => {
      if (disposed) return;
      model.updateMatrixWorld(true);
      const seen = new Set<string>();
      model.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh || seen.has(mesh.geometry.uuid)) return;
        seen.add(mesh.geometry.uuid);

        const geometry = prepareGeometry(mesh);
        const bounds = geometry.boundingBox!;
        const height = bounds.max.y - bounds.min.y;
        const trunk = treeRadius(geometry);
        treePools.push(
          addPool(geometry, treeMaterial, 4096, {
            shape: cylinder.create({ radius: trunk, halfHeight: height / 2, convexRadius: 0 }),
            centerY: height / 2,
            rotate: false,
          })
        );
      });
      finishAssetPack();
    });

    fbxLoader.load('/models/forest-pack/forest-game.fbx', (model) => {
      if (disposed) return;
      model.updateMatrixWorld(true);
      model.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh || !mesh.name.startsWith('Rock_')) return;

        const geometry = prepareGeometry(mesh);
        rockPools.push(
          addPool(geometry, rockMaterial, 512, {
            shape: convexHull.create({
              positions: Array.from(geometry.attributes.position.array),
              convexRadius: 0,
            }),
            centerY: 0,
            rotate: true,
          })
        );
      });
      finishAssetPack();
    });

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      const aspect = clientWidth / clientHeight;
      viewW = viewH * aspect;
      camera.left = -viewW / 2;
      camera.right = viewW / 2;
      camera.top = viewH / 2;
      camera.bottom = -viewH / 2;
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
    const pointerWorldDirection = { x: 0, z: 0 };
    const pointerStart = { x: 0, y: 0, time: 0, moved: false };
    let targetZoom = 1;
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

      pointerStrength = THREE.MathUtils.clamp(
        (distance - deadZone) / (maxDistance - deadZone),
        0,
        1
      );
      pointerDirection.right = (dx / bounds.width) * viewW;
      pointerDirection.forward = (-dy / bounds.height) * viewH;

      const worldX =
        cameraRight.x * pointerDirection.right + cameraForward.x * pointerDirection.forward;
      const worldZ =
        cameraRight.z * pointerDirection.right + cameraForward.z * pointerDirection.forward;
      const worldLength = Math.hypot(worldX, worldZ);
      pointerWorldDirection.x = worldLength > 0 ? worldX / worldLength : 0;
      pointerWorldDirection.z = worldLength > 0 ? worldZ / worldLength : 0;
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
      pointerWorldDirection.x = 0;
      pointerWorldDirection.z = 0;
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
      pointerWorldDirection.x = 0;
      pointerWorldDirection.z = 0;
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.85 : 1.18;
      targetZoom = Math.max(0.4, Math.min(2.5, targetZoom * factor));
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

    let room: RoomConnection | null = null;
    let multiplayerCancelled = false;
    let lastTransformSentAt = 0;

    const removeRemotePlayer = (id: string) => {
      const player = remotePlayers.get(id);
      if (!player) return;
      scene.remove(player.mesh);
      scene.remove(player.marker);
      (player.mesh.material as THREE.Material).dispose();
      (player.marker.material as THREE.Material).dispose();
      rigidBody.remove(world, player.body);
      remotePlayers.delete(id);
    };

    const applyRemoteTransform = (id: string, transform: PlayerTransform) => {
      if (id === room?.clientId) return;

      let player = remotePlayers.get(id);
      if (!player) {
        const mesh = new THREE.Mesh(
          remoteGeometry,
          new THREE.MeshLambertMaterial({
            color: transform.color,
            flatShading: true,
          })
        );
        mesh.castShadow = true;
        mesh.position.fromArray(transform.position);
        mesh.quaternion.fromArray(transform.quaternion);
        scene.add(mesh);
        const marker = new THREE.Mesh(
          markerGeometry,
          new THREE.MeshLambertMaterial({
            color: transform.color,
            flatShading: true,
          })
        );
        marker.renderOrder = 1;
        scene.add(marker);

        player = {
          mesh,
          marker,
          body: rigidBody.create(world, {
            motionType: MotionType.KINEMATIC,
            objectLayer: dynamicLayer,
            shape: sphere.create({ radius: ballRadius }),
            position: transform.position,
            quaternion: transform.quaternion,
          }),
          targetPosition: new THREE.Vector3().fromArray(transform.position),
          targetQuaternion: new THREE.Quaternion().fromArray(transform.quaternion),
        };
        remotePlayers.set(id, player);
      }

      (player.mesh.material as THREE.MeshLambertMaterial).color.setHex(transform.color);
      (player.marker.material as THREE.MeshLambertMaterial).color.setHex(transform.color);
      player.targetPosition.fromArray(transform.position);
      player.targetQuaternion.fromArray(transform.quaternion);
    };

    const onRoomMessage = (message: string | ArrayBuffer) => {
      if (multiplayerCancelled || typeof message !== 'string') return;

      try {
        const packet = JSON.parse(message);
        if (packet.type === 'snapshot') {
          for (const [id, transform] of packet.players as [string, PlayerTransform][]) {
            applyRemoteTransform(id, transform);
          }
        } else if (packet.type === 'transform') {
          applyRemoteTransform(packet.id, packet);
        } else if (packet.type === 'leave') {
          removeRemotePlayer(packet.id);
        }
      } catch {
        // Ignore malformed server packets.
      }
    };

    fetch(`${process.env.NEXT_PUBLIC_MULTIPLAYER_URL ?? 'http://localhost:7100'}/join`, {
      method: 'POST',
    })
      .then((response) => {
        if (!response.ok) throw new Error('multiplayer unavailable');
        return response.json() as Promise<{ url: string }>;
      })
      .then((seat) => {
        if (!multiplayerCancelled) {
          room = connect(seat.url, {
            onMessage: onRoomMessage,
            onClose: () => {
              if (!multiplayerCancelled) {
                for (const id of Array.from(remotePlayers.keys())) {
                  removeRemotePlayer(id);
                }
              }
            },
          });
        }
      })
      .catch(() => {});

    let lastTime = performance.now();
    let accumulator = 0;
    const physicsStep = 1 / 120;
    const movement = new THREE.Vector3();
    const lockedMovementDirection = new THREE.Vector3();
    const cameraForward = new THREE.Vector3(0, 0, -1);
    const cameraRight = new THREE.Vector3(1, 0, 0);
    const cameraTarget = new THREE.Vector3(0, ballRadius, 0);
    const desiredCameraPosition = new THREE.Vector3();
    const desiredLookTarget = new THREE.Vector3();
    const markerDirection = new THREE.Vector3();
    const markerForward = new THREE.Vector3(0, 0, 1);
    let cameraYaw = 0;
    let cameraYawTarget = 0;
    let movementSignature = '';
    const shortestAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

    renderer.setAnimationLoop(() => {
      const now = performance.now();
      const frameDelta = Math.min((now - lastTime) / 1000, 0.1);
      accumulator += frameDelta;
      lastTime = now;

      for (let index = 0; index < 100; index++) {
        const offset = index * 3;
        snowfallPositions[offset + 1] -= 1/2 * frameDelta;
        if (snowfallPositions[offset + 1] < -2) {
          snowfallPositions[offset + 1] = 10 - 2;
        }
      }
      snowfallGeometry.attributes.position.needsUpdate = true;

      const moveRight = Number(keys.has('KeyD') || keys.has('ArrowRight')) -
        Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      const moveForward = Number(keys.has('KeyW') || keys.has('ArrowUp')) -
        Number(keys.has('KeyS') || keys.has('ArrowDown'));
      const hasPointerMovement = pointerId !== null;
      const strength = hasPointerMovement ? pointerStrength : 1;

      if (!hasPointerMovement) {
        const nextMovementSignature = `${moveRight}:${moveForward}`;
        if (movementSignature !== nextMovementSignature) {
          lockedMovementDirection.set(
            cameraRight.x * moveRight + cameraForward.x * moveForward,
            0,
            cameraRight.z * moveRight + cameraForward.z * moveForward
          );
          if (lockedMovementDirection.lengthSq() > 0) {
            lockedMovementDirection.normalize();
          }
          movementSignature = nextMovementSignature;
        }
        movement.copy(lockedMovementDirection);
      } else {
        movement.set(pointerWorldDirection.x, 0, pointerWorldDirection.z);
      }

      while (accumulator >= physicsStep) {
        const rotation = Number(keys.has('KeyE')) - Number(keys.has('KeyQ'));
        cameraYawTarget += rotation * 1.8 * physicsStep;
        cameraForward.set(Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
        cameraRight.set(Math.cos(cameraYaw), 0, Math.sin(cameraYaw));

        const body = rigidBody.get(world, ballBody.id);
        if (body) {
          const sprint =
            !hasPointerMovement && (keys.has('ShiftLeft') || keys.has('ShiftRight'));
          const sprinting = hasPointerMovement || sprint;
          const movementPower = sprinting ? 1500 : 500;
          const rollPower = sprinting ? 150 : 50;

          if (movement.lengthSq() > 0 && strength > 0) {
            movement.normalize();
            rigidBody.addForce(
              world,
              body,
              [movement.x * movementPower * strength, 0, movement.z * movementPower * strength],
              true
            );
            rigidBody.addTorque(
              world,
              body,
              [movement.z * rollPower * strength, 0, -movement.x * rollPower * strength],
              true
            );
          }

          const isGrounded = world.contacts.contacts.some(
            (contact) =>
              contact.contactIndex !== -1 &&
              contact.lastProcessedFrame === world.contacts.frameStamp &&
              ((contact.bodyIdA === ballBody.id &&
                terrainBodyIds.has(contact.bodyIdB)) ||
                (terrainBodyIds.has(contact.bodyIdA) &&
                  contact.bodyIdB === ballBody.id))
          );

          if ((keys.has('Space') || pointerJump) && isGrounded) {
            const velocity = body.motionProperties.linearVelocity;
            rigidBody.setLinearVelocity(world, body, [velocity[0], 7.5, velocity[2]]);
          }
          pointerJump = false;
        }

        const interpolation = 1 - Math.exp(-12 * physicsStep);
        for (const player of remotePlayers.values()) {
          player.mesh.position.lerp(player.targetPosition, interpolation);
          player.mesh.quaternion.slerp(player.targetQuaternion, interpolation);
          const remoteBody = rigidBody.get(world, player.body.id);
          if (!remoteBody) continue;
          rigidBody.moveKinematic(
            remoteBody,
            player.mesh.position.toArray(),
            player.mesh.quaternion.toArray(),
            physicsStep
          );
        }

        updateWorld(world, {}, physicsStep);
        accumulator -= physicsStep;
      }

      const body = rigidBody.get(world, ballBody.id);
      if (body) {
        snowfall.position.set(
          body.position[0],
          terrainHeight(body.position[0], body.position[2]) + 2,
          body.position[2]
        );
        updateChunks(body.position[0], body.position[2]);
        ballMesh.position.fromArray(body.position);
        ballMesh.quaternion.fromArray(body.quaternion);

        for (const player of remotePlayers.values()) {
          markerDirection.copy(player.mesh.position).sub(ballMesh.position);
          const distance = markerDirection.length();
          player.marker.visible = distance > 5;
          if (distance > 0) {
            markerDirection.multiplyScalar(1 / distance);
            player.marker.position
              .copy(ballMesh.position)
              .addScaledVector(markerDirection, 0.75);
            player.marker.quaternion.setFromUnitVectors(markerForward, markerDirection);
          }
        }

        const velocity = body.motionProperties.linearVelocity;
        const horizontalSpeed = Math.hypot(velocity[0], velocity[2]);
        const shouldFollowInput =
          movement.lengthSq() > 1e-4 && strength > 0 &&
          (hasPointerMovement || moveForward > 0);
        if (shouldFollowInput) {
          cameraYawTarget = Math.atan2(movement.x, -movement.z);
        } else if (horizontalSpeed > 0.8) {
          const forwardVelocity = velocity[0] * cameraForward.x + velocity[2] * cameraForward.z;
          if (forwardVelocity > 0.1) {
            cameraYawTarget = Math.atan2(velocity[0], -velocity[2]);
          }
        }
        cameraYaw += shortestAngle(cameraYawTarget - cameraYaw) * 0.01;
        cameraForward.set(Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
        cameraRight.set(Math.cos(cameraYaw), 0, Math.sin(cameraYaw));

        desiredCameraPosition.set(
          body.position[0] - cameraForward.x * baseCameraDistance,
          baseCameraHeight + body.position[1] * 0.3,
          body.position[2] - cameraForward.z * baseCameraDistance
        );
        if (horizontalSpeed > 0.1) {
          desiredLookTarget.set(
            body.position[0] + (velocity[0] / horizontalSpeed) * 1.25,
            body.position[1] + 0.15,
            body.position[2] + (velocity[2] / horizontalSpeed) * 1.25
          );
        } else {
          desiredLookTarget.set(body.position[0], body.position[1] + 0.15, body.position[2]);
        }
        camera.position.lerp(desiredCameraPosition, 0.1);
        cameraTarget.lerp(desiredLookTarget, 0.14);
        camera.lookAt(cameraTarget);
        directionalLight.position.set(
          camera.position.x + 8,
          camera.position.y + 16,
          camera.position.z - 6
        );
        directionalLight.target.position.fromArray(body.position);

        if (room?.state === 'open' && now - lastTransformSentAt >= 33) {
          room.send(
            JSON.stringify({
              type: 'transform',
              color: randomColor.getHex(),
              position: [...body.position],
              quaternion: [...body.quaternion],
            }),
            { reliable: false }
          );
          lastTransformSentAt = now;
        }
      }

      camera.zoom += (targetZoom - camera.zoom) * 0.15;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    });

    return () => {
      disposed = true;
      restoreFbxWarnings();
      multiplayerCancelled = true;
      room?.close();
      for (const id of Array.from(remotePlayers.keys())) removeRemotePlayer(id);
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
      for (const key of activeChunks.keys()) unloadChunk(key);
      renderer.dispose();
      floorMaterial.dispose();
      snowTexture.dispose();
      snowfallGeometry.dispose();
      snowfallMaterial.dispose();
      ballMesh.geometry.dispose();
      ballMesh.material.dispose();
      remoteGeometry.dispose();
      markerGeometry.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} style={{ position: 'fixed', inset: 0 }} />;
}

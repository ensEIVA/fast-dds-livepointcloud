/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import * as THREE from 'three';
import './index.css';


const threeEle = document.getElementById('three-scene') as HTMLCanvasElement;
const subscribeBtn = document.getElementById('subscribe-btn') as HTMLButtonElement;
const unsubscribeBtn = document.getElementById('unsubscribe-btn') as HTMLButtonElement;
// let worker: Worker | null = null;

subscribeBtn.addEventListener('click', () => {
    console.log('subscribe');
    window.electron.ipcRenderer.invoke('subscribe');
})

unsubscribeBtn.addEventListener('click', () => {
    window.electron.ipcRenderer.invoke('unsubscribe');
})

const renderer = new THREE.WebGLRenderer({ canvas: threeEle });
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
camera.position.z = 15;

const pointClouds: THREE.Points[] = [];
const maxClouds = 200;

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

window.api.onPointCloudData((pointsData) => {
    let points = pointsData[0];
    const positions: number[] = [];
    const colors: number[] = [];

    for (const p of points) {
        positions.push(p.x, -p.y, p.z); // Flip Y
        colors.push(p.r / 255, p.g / 255, p.b / 255);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeBoundingBox();

    const material = new THREE.PointsMaterial({ size: 0.2, vertexColors: true });
    const newCloud = new THREE.Points(geometry, material);

    scene.add(newCloud);
    pointClouds.push(newCloud);

    // Remove oldest if over limit
    if (pointClouds.length > maxClouds) {
        const old = pointClouds.shift()!;
        scene.remove(old);
        old.geometry.dispose();
        old.material.dispose();
    }

    // updateCameraToFitAllPointClouds(pointClouds);
    updateCameraToFitLatestPointCloud(newCloud);    
  });

  function updateCameraToFitAllPointClouds(pointClouds: THREE.Points[]) {
    if (pointClouds.length === 0) return;
  
    const fullBoundingBox = new THREE.Box3();
  
    for (const cloud of pointClouds) {
      const geometry = cloud.geometry as THREE.BufferGeometry;
      geometry.computeBoundingBox();
      fullBoundingBox.union(geometry.boundingBox!);
    }
  
    const center = new THREE.Vector3();
    fullBoundingBox.getCenter(center);
  
    const size = new THREE.Vector3();
    fullBoundingBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
  
    const fov = camera.fov * (Math.PI / 180);
    const distance = maxDim / (2 * Math.tan(fov / 2));
  
    camera.position.set(center.x, center.y, center.z + distance * 1.5);
    camera.lookAt(center);
  }

  function updateCameraToFitLatestPointCloud(points: THREE.Points) {
    const boundingBox = points.geometry.boundingBox!;
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);

    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    const fov = camera.fov * (Math.PI / 180);
    const distance = maxDim / (2 * Math.tan(fov / 2));
    camera.position.set(center.x, center.y, center.z + distance * 3.5);
    camera.lookAt(center);
  }
  
  
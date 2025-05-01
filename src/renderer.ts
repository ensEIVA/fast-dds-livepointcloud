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

import { ipcMain } from 'electron';
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

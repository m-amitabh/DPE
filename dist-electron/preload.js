"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electronAPI", {
  // Invoke methods (request/response)
  invoke: (channel, ...args) => {
    return ipcRenderer.invoke(channel, ...args);
  },
  // Send one-way messages
  send: (channel, ...args) => {
    ipcRenderer.send(channel, ...args);
  },
  // Listen to events from main
  on: (channel, callback) => {
    const subscription = (_event, ...args) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
  // Ping test
  ping: () => ipcRenderer.invoke("ping")
});
